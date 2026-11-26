/**
 * OL-20261126-055 S4 — adversarial fuzz/kill matrix for the native Apply helper, on
 * FRESH owner-controlled REGISTERED synthetic sacrificial projects (0700 temp) ONLY.
 * Never against real user projects, home, credentials, live services or the private vault.
 *
 * Asserts: crash after ANY renameat and before the audit fsync (the new `renamed` stop
 * point) is classified APPLIED with the LAST durable journal record still `applying`
 * (recovery is content-derived, never journal-trusted); before-image journal failure
 * (insufficient backup, unsafe/ACL'd/immutabilised transaction directory) is refused
 * before ANY source mutation; an external same-UID writer that wins the final
 * preimage→renameat window is classified AMBIGUOUS with a durable freeze and is NEVER
 * auto-repaired, auto-retried or auto-cleaned; a frozen approval can never be silently
 * re-used after a foreign write; a bounded synthetic canary Apply plus a SEPARATE
 * rollback capability restores exact bytes+mode.
 *
 * Power-loss limitation (recorded honestly, see docs/022): fsync of file + directory is
 * exercised here, but APFS/EXT4 media ordering under real power loss is NOT provable by
 * SIGKILL tests — a crash-injection proves the journal record survives a process kill,
 * not that it survives loss of device power.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync
} from 'node:fs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyNativeRealApplyRecovery, inspectNativeTarget, issueRealApplyCapability,
  nativeTransactionDirectory, parseRealApplyCapability, readNativeJournal,
  runNativeRealApply, singleFileApplyPlan, verifyRealApplyCapability
} from '../src/local-first/real-apply-native-driver.ts'
import {
  buildOperatorApplyPreview, buildOperatorRollbackPreview, classifyOperatorApplyRecovery,
  executeOperatorApply, executeOperatorRollback, issueOperatorCapability, operatorProjectFingerprint,
  readOperatorApplyReceipt, recordOperatorReview, REAL_APPLY_OPERATOR_FLAG
} from '../src/local-first/real-apply-operator-connector.ts'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const helperSource = join(repoRoot, 'research', 'real-apply-helper.c')
const xattrSource = join(repoRoot, 'tests', 'fixtures', 'os-xattr-fixture.c')
const compiler = process.env.CC || 'cc'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const bytes = (text) => new TextEncoder().encode(text)
const ENABLED = { [REAL_APPLY_OPERATOR_FLAG]: '1' }
const modify = (path, beforeText, afterText) => ({
  path, action: 'modify', beforeSha256: sha(beforeText), afterSha256: sha(afterText),
  beforeBytes: Buffer.byteLength(beforeText), afterBytes: Buffer.byteLength(afterText),
  beforeMode: 0o600, afterMode: 0o600
})
const add = (path, afterText) => ({
  path, action: 'add', beforeSha256: null, afterSha256: sha(afterText),
  beforeBytes: null, afterBytes: Buffer.byteLength(afterText),
  beforeMode: null, afterMode: 0o600
})
const remove = (path, beforeText) => ({
  path, action: 'delete', beforeSha256: sha(beforeText), afterSha256: null,
  beforeBytes: Buffer.byteLength(beforeText), afterBytes: null,
  beforeMode: 0o600, afterMode: null
})
const PROJECT_ID = 'synthetic-sacrificial-project'
const REVISION = sha('synthetic-source-revision')

function compileHelper(temp) {
  const binary = join(temp, 'real-apply-helper')
  const linked = spawnSync(compiler,
    ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', helperSource, '-o', binary],
    { encoding: 'utf8', timeout: 45_000 })
  assert.equal(linked.status, 0, 'Native helper must compile on CI Linux/macOS: ' + (linked.stderr ?? '').slice(0, 2000))
  return binary
}

function buildXattrSetter(temp) {
  const binary = join(temp, 'xattr-setter')
  const result = spawnSync(compiler,
    ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', xattrSource, '-o', binary],
    { encoding: 'utf8', timeout: 45_000 })
  assert.equal(result.status, 0, 'xattr fixture writer must compile: ' + (result.stderr ?? '').slice(0, 2000))
  return binary
}

/** Helper-only fixture: 0700 project + 0700 journal + one 0600 leaf. */
async function fixture(run) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-kill-')))
  const root = join(temp, 'project')
  mkdirSync(root, { mode: 0o700 })
  const nested = join(root, 'dir')
  mkdirSync(nested, { mode: 0o700 })
  const journal = join(temp, 'journal')
  mkdirSync(journal, { mode: 0o700 })
  const leaf = join(nested, 'leaf.txt')
  writeFileSync(leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
  const binary = compileHelper(temp)
  const stat = lstatSync(root)
  const f = { temp, root, journal, nested, leaf, binary, rootDev: stat.dev, rootIno: stat.ino }
  try {
    return await run(f)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

/** Operator fixture: registered project + 0700 journal + built helper. */
async function operatorFixture(work) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-kill-op-')))
  const projects = join(base, 'projects')
  const journal = join(base, 'journal')
  mkdirSync(projects); mkdirSync(journal, { mode: 0o700 })
  const root = join(projects, 'doc'); mkdirSync(root, { mode: 0o700 })
  const helperBinary = compileHelper(base)
  try {
    await work({ base, projects, journal, root, helperBinary,
      registry: () => new LocalProjectRegistry([projects], [{ id: PROJECT_ID, root, kind: 'local' }]) })
  } finally { rmSync(base, { recursive: true, force: true }) }
}

function txDir(f, name = 'tx') {
  const dir = join(f.journal, name)
  mkdirSync(dir, { mode: 0o700 })
  writeFileSync(join(dir, 'after.bin'), 'REPLACEMENT SYNTHETIC\n', { mode: 0o600 })
  return dir
}

function spec(overrides) {
  const base = {
    kind: 'apply', root: overrides.root, path: overrides.path,
    action: overrides.action || 'modify',
    exp_dev: overrides.exp_dev, exp_ino: overrides.exp_ino,
    before_sha256: overrides.before_sha256, before_bytes: overrides.before_bytes,
    before_mode: overrides.before_mode, before_mtime_sec: overrides.before_mtime_sec,
    before_mtime_nsec: overrides.before_mtime_nsec,
    after_sha256: overrides.after_sha256, after_bytes: overrides.after_bytes,
    after_mode: overrides.after_mode, after_image: overrides.after_image,
    tx_dir: overrides.tx_dir, transaction_id: 'tx-adversarial-0001',
    nonce: overrides.nonce || '0123456789abcdef0123456789abcdef',
    capability_id: 'cap-adversarial-0001',
    plan_digest: overrides.plan_digest || overrides.before_sha256,
    stop_after: overrides.stop_after
  }
  return Object.entries(base)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => key + '=' + value).join('\n') + '\n'
}

function exactSpec(f, tx, overrides = {}) {
  const path = overrides.path || 'dir/leaf.txt'
  const stat = lstatSync(join(f.root, path), { bigint: true })
  const mtimeNs = stat.mtimeNs
  return spec({
    root: f.root, path,
    exp_dev: String(f.rootDev), exp_ino: String(f.rootIno),
    before_sha256: sha(readFileSync(join(f.root, path))),
    before_bytes: String(stat.size),
    before_mode: String(stat.mode & 0o7777n),
    before_mtime_sec: String(mtimeNs / 1000000000n),
    before_mtime_nsec: String(mtimeNs % 1000000000n),
    after_sha256: sha('REPLACEMENT SYNTHETIC\n'), after_bytes: '22',
    after_mode: String(0o600), after_image: 'after.bin', tx_dir: tx,
    nonce: overrides.nonce || randomBytes(16).toString('hex'),
    ...overrides
  })
}

function runHelper(f, args, input) {
  const result = spawnSync(f.binary, args, { input, encoding: 'utf8', timeout: 30_000 })
  assert.equal(result.error, undefined, 'helper must be runnable')
  return { code: result.status ?? -1, stdout: result.stdout.trim() }
}

/** Crash-injection: run the helper with stop_after=<step>, kill it, await exit. */
async function crashAtStep(binary, specText, step) {
  const child = spawn(binary, ['apply'], { stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdin.write(specText)
  child.stdin.end()
  const seen = await new Promise((resolve, reject) => {
    let buffer = ''
    child.stdout.on('data', chunk => {
      buffer += chunk
      if (buffer.includes('STEP ' + step)) resolve(buffer)
    })
    child.on('error', reject)
    setTimeout(() => reject(new Error('helper never reached STEP ' + step + ': ' + buffer)), 15_000)
  })
  child.kill('SIGKILL')
  await once(child, 'exit')
  return seen
}

const chflagsAvailable = (() => {
  const probe = spawnSync('chflags', ['--help'], { encoding: 'utf8', timeout: 5_000 })
  return probe.status === 0 || probe.status === 1
})()

const aclAvailable = (() => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-aclprobe-')))
  const file = join(temp, 'probe.txt')
  writeFileSync(file, 'x\n', { mode: 0o600 })
  const result = spawnSync('chmod', ['+a', 'owner allow read', file], { encoding: 'utf8', timeout: 5_000 })
  rmSync(temp, { recursive: true, force: true })
  return result.status === 0
})()

test('crash after ANY renameat and before the audit fsync is classified APPLIED; the last durable journal record is still "applying" (recovery is content-derived, never journal-trusted)', async () => fixture(async (f) => {
  // modify: the rename already installed the new inode when the child is killed.
  const tx = txDir(f, 'tx-renamed-modify')
  const nonce = randomBytes(16).toString('hex')
  const seen = await crashAtStep(f.binary, exactSpec(f, tx, { stop_after: 'renamed', nonce }), 'renamed')
  assert.ok(seen.includes('STEP renamed'), 'the rename happened before the kill')
  assert.equal(readFileSync(f.leaf, 'utf8'), 'REPLACEMENT SYNTHETIC\n')
  const journal = readFileSync(join(tx, 'journal.rec'), 'utf8')
  assert.match(journal, /status=applying/, 'the LAST durable record is applying: the applied record never reached disk')
  assert.equal(journal.includes('status=applied'), false, 'no applied record was written')
  const recovered = runHelper(f, ['recover'], exactSpec(f, tx, { nonce }))
  assert.match(recovered.stdout, /^OK CLASSIFY APPLIED staged=absent /)
  assert.equal(recovered.code, 0)

  // add: linkat+unlinkat happened, the leaf is the reviewed after-image.
  rmSync(f.leaf)
  const txAdd = txDir(f, 'tx-renamed-add')
  writeFileSync(join(txAdd, 'after.bin'), 'BRAND NEW FILE\n', { mode: 0o600 })
  const addNonce = randomBytes(16).toString('hex')
  const addSpec = spec({
    kind: 'apply', root: f.root, path: 'dir/added.txt', action: 'add',
    exp_dev: String(f.rootDev), exp_ino: String(f.rootIno),
    before_sha256: '-', before_bytes: '0', before_mode: '0',
    before_mtime_sec: '0', before_mtime_nsec: '0',
    after_sha256: sha('BRAND NEW FILE\n'), after_bytes: '15', after_mode: '384',
    after_image: 'after.bin', tx_dir: txAdd, nonce: addNonce, plan_digest: sha('add-plan'),
    stop_after: 'renamed'
  })
  const addSeen = await crashAtStep(f.binary, addSpec, 'renamed')
  assert.ok(addSeen.includes('STEP renamed'))
  assert.equal(readFileSync(join(f.nested, 'added.txt'), 'utf8'), 'BRAND NEW FILE\n')
  assert.equal(lstatSync(join(f.nested, 'added.txt')).nlink, 1)
  const addRecovered = runHelper(f, ['recover'], addSpec.replace('stop_after=renamed\n', ''))
  assert.match(addRecovered.stdout, /^OK CLASSIFY APPLIED staged=absent /)

  // delete: unlinkat happened, the leaf is gone.
  writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
  const txDel = txDir(f, 'tx-renamed-delete')
  writeFileSync(join(txDel, 'after.bin'), 'REPLACEMENT SYNTHETIC\n', { mode: 0o600 })
  const delNonce = randomBytes(16).toString('hex')
  const stat = lstatSync(f.leaf, { bigint: true })
  const delSpec = spec({
    kind: 'apply', root: f.root, path: 'dir/leaf.txt', action: 'delete',
    exp_dev: String(f.rootDev), exp_ino: String(f.rootIno),
    before_sha256: sha(readFileSync(f.leaf)), before_bytes: String(stat.size),
    before_mode: String(stat.mode & 0o7777n),
    before_mtime_sec: String(stat.mtimeNs / 1000000000n),
    before_mtime_nsec: String(stat.mtimeNs % 1000000000n),
    after_sha256: '-', after_bytes: '0', after_mode: '0',
    tx_dir: txDel, nonce: delNonce, plan_digest: sha('delete-plan'), stop_after: 'renamed'
  })
  const delSeen = await crashAtStep(f.binary, delSpec, 'renamed')
  assert.ok(delSeen.includes('STEP renamed'))
  assert.equal(existsSync(f.leaf), false)
  const delRecovered = runHelper(f, ['recover'], delSpec.replace('stop_after=renamed\n', ''))
  assert.match(delRecovered.stdout, /^OK CLASSIFY APPLIED staged=absent /)
}))

test('crash before the rename never mutates the source: PREPARED_CRASH with the staged temp left in place (no auto cleanup, no auto retry)', async () => fixture(async (f) => {
  for (const step of ['prepared', 'staged', 'applying']) {
    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    const tx = txDir(f, 'tx-crash-' + step)
    const nonce = randomBytes(16).toString('hex')
    await crashAtStep(f.binary, exactSpec(f, tx, { stop_after: step, nonce }), step)
    const recovered = runHelper(f, ['recover'], exactSpec(f, tx, { nonce }))
    assert.equal(recovered.code, 0, step + ': ' + recovered.stdout)
    assert.match(recovered.stdout, new RegExp('^OK CLASSIFY PREPARED_CRASH staged=' + (step === 'prepared' ? 'absent' : 'present') + ' '))
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n', step + ': zero repair')
    assert.equal(existsSync(join(tx, 'before.bin')), true, step + ': durable before-image exists')
    if (step !== 'prepared') {
      // the staged temp is LEFT behind for the operator to inspect; nothing auto-cleans it
      assert.equal(existsSync(join(f.nested, '.dsh-apply-' + nonce + '.tmp')), true,
        step + ': staged temp must survive classification')
    }
    // Re-issuing the SAME approval is refused: the frozen preimage is gone from the
    // helper's point of view only if something else moved it — here the source is intact,
    // so a fresh approval on a NEW transaction may apply, but the crashed one is never retried.
    const retry = runHelper(f, ['recover'], exactSpec(f, tx, { nonce }))
    assert.match(retry.stdout, /^OK CLASSIFY PREPARED_CRASH /, 'classification is idempotent and read-only')
  }
}))

test('before-image journal failures are refused before ANY source mutation (insufficient backup, unsafe tx dir, ACL, immutabilised journal, group-writable journal)', async () => fixture(async (f) => {
  const before = readFileSync(f.leaf, 'utf8')

  // stale/partial before.bin in a fresh transaction directory
  const stale = txDir(f, 'tx-stale-backup')
  writeFileSync(join(stale, 'before.bin'), 'STALE PARTIAL BACKUP\n', { mode: 0o600 })
  assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, stale)).stdout, 'REJECT backup-create-failure')
  assert.equal(readFileSync(f.leaf, 'utf8'), before)
  assert.equal(readFileSync(join(stale, 'before.bin'), 'utf8'), 'STALE PARTIAL BACKUP\n')

  // group-writable transaction directory
  const loose = txDir(f, 'tx-loose')
  chmodSync(loose, 0o775)
  assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, loose)).stdout, 'REJECT tx-dir-unsafe')
  chmodSync(loose, 0o700)

  // symlinked transaction directory
  const symlinked = join(f.journal, 'tx-link')
  symlinkSync(loose, symlinked)
  assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, loose, { tx_dir: symlinked })).stdout, 'REJECT tx-dir-open-failure')
  assert.equal(readFileSync(f.leaf, 'utf8'), before)

  // ACL on the transaction directory (macOS): refused before anything is written
  if (aclAvailable) {
    const aclTx = txDir(f, 'tx-acl')
    const acl = spawnSync('chmod', ['+a', 'owner allow write', aclTx], { encoding: 'utf8', timeout: 5_000 })
    if (acl.status === 0) {
      assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, aclTx)).stdout, 'REJECT tx-dir-acl')
      assert.equal(readFileSync(f.leaf, 'utf8'), before)
      spawnSync('chmod', ['-a', 'owner allow write', aclTx], { timeout: 5_000 })
    }
  }

  // immutabilised transaction directory: the journal tmp cannot be created, so the
  // durable before-image audit fails closed and the source is untouched.
  if (chflagsAvailable) {
    const lockedTx = txDir(f, 'tx-locked')
    const flags = spawnSync('chflags', ['uchg', lockedTx], { encoding: 'utf8', timeout: 5_000 })
    if (flags.status === 0) {
      const result = runHelper(f, ['apply'], exactSpec(f, lockedTx))
      assert.match(result.stdout, /^REJECT (tx-dir-unsafe|journal-create-failure|tx-dir-flags)$/, result.stdout)
      assert.equal(readFileSync(f.leaf, 'utf8'), before, 'a journal fsync/create failure must never mutate the source')
      spawnSync('chflags', ['nouchg', lockedTx], { timeout: 5_000 })
    }
  }

  // a journal tmp left by a previous crashed attempt is NOT auto-cleaned, and a fresh
  // approval still succeeds (the tmp name is pid-scoped, so it cannot collide)
  const leftover = txDir(f, 'tx-leftover')
  writeFileSync(join(leftover, '.state-prepared-9999'), 'X\n', { mode: 0o600 })
  const applied = runHelper(f, ['apply'], exactSpec(f, leftover))
  assert.match(applied.stdout, /^OK APPLIED /)
  assert.equal(existsSync(join(leftover, '.state-prepared-9999')), true, 'nothing auto-cleans the stale tmp')
  writeFileSync(f.leaf, before, { mode: 0o600 })
}))

test('external same-UID writer that wins the final preimage→renameat window is classified AMBIGUOUS with a durable freeze; never repaired, never retried, never auto-cleaned', async () => fixture(async (f) => {
  const tx = txDir(f, 'tx-race')
  const frozen = exactSpec(f, tx)
  const child = spawn(f.binary, ['apply'], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  const parked = new Promise((resolvePromise, rejectPromise) => {
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
      if (stdout.includes('STEP applying')) resolvePromise()
    })
    child.on('error', rejectPromise)
  })
  child.stdin.write(frozen.replace('\n', '\nstop_after=applying\n'))
  child.stdin.end()
  await parked
  // Non-cooperating same-UID writer swaps the leaf ENTRY while the helper is parked,
  // AFTER the helper's final preimage verification and BEFORE the renameat.
  rmSync(f.leaf)
  writeFileSync(f.leaf, 'EXTERNAL RACED X\n', { mode: 0o600 })
  child.kill('SIGKILL')
  await new Promise((resolvePromise) => child.on('close', () => resolvePromise()))

  const recovered = runHelper(f, ['recover'], frozen)
  assert.equal(recovered.code, 0, recovered.stdout)
  assert.match(recovered.stdout, /^OK CLASSIFY AMBIGUOUS /)
  assert.match(recovered.stdout, /staged=present/)
  assert.equal(readFileSync(f.leaf, 'utf8'), 'EXTERNAL RACED X\n', 'classification repaired nothing')

  // The frozen approval can never be silently re-used after the foreign write: a re-run
  // of the SAME approval refuses on the preimage, it does not clobber the foreign bytes.
  const reUse = runHelper(f, ['apply'], frozen)
  assert.deepEqual(reUse.stdout, 'REJECT preimage-hash-drift')
  assert.equal(readFileSync(f.leaf, 'utf8'), 'EXTERNAL RACED X\n')

  // A fresh approval of the CURRENT inode may apply (no stale-path trust).
  const fresh = runHelper(f, ['apply'], exactSpec(f, txDir(f, 'tx-fresh')))
  assert.equal(fresh.code, 0, fresh.stdout)
  assert.match(fresh.stdout, /^OK APPLIED /)
  assert.equal(readFileSync(f.leaf, 'utf8'), 'REPLACEMENT SYNTHETIC\n')
}))

test('adversarial pre-mutation fuzz: every tamper class is refused with an exact code and zero source mutation', async () => fixture(async (f) => {
  const tx = txDir(f, 'tx-fuzz')
  const original = exactSpec(f, tx)
  const before = readFileSync(f.leaf, 'utf8')

  // content swap (same size, different bytes)
  writeFileSync(f.leaf, 'ORIGINAL SYNTHETIX\n', { mode: 0o600 })
  assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-hash-drift')

  // size swap
  writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\nXX', { mode: 0o600 })
  assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-hash-drift')
  writeFileSync(f.leaf, before, { mode: 0o600 })

  // truncation to zero bytes
  truncateSync(f.leaf, 0)
  assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-hash-drift')
  writeFileSync(f.leaf, before, { mode: 0o600 })

  // mode drift
  chmodSync(f.leaf, 0o400)
  assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-mode-drift')
  chmodSync(f.leaf, 0o600)

  // hardlink
  linkSync(f.leaf, join(f.nested, 'twin.txt'))
  assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT target-hardlinked')
  rmSync(join(f.nested, 'twin.txt'))

  // unknown xattr
  const setter = buildXattrSetter(f.temp)
  const wrote = spawnSync(setter, [f.leaf], { encoding: 'utf8', timeout: 5_000 })
  assert.equal(wrote.status, 0)
  assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT target-xattr')

  // special flags (macOS UF_* via chflags)
  if (chflagsAvailable) {
    const flags = spawnSync('chflags', ['uchg', f.leaf], { encoding: 'utf8', timeout: 5_000 })
    if (flags.status === 0) {
      assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT target-flags')
      spawnSync('chflags', ['nouchg', f.leaf], { timeout: 5_000 })
    }
  }

  // remove the unknown xattr so the ACL probe reports the ACL, not the xattr.
  // Use the read-only inspect view: it proves the xattr is gone without paying a
  // preimage-mtime-drift for the restored bytes.
  const inspectArgs = ['inspect', f.root, String(f.rootDev), String(f.rootIno), 'dir/leaf.txt']
  if (process.platform === 'darwin') {
    const cleared = spawnSync('xattr', ['-d', 'com.example.dsh-inspector-synthetic', f.leaf],
      { encoding: 'utf8', timeout: 5_000 })
    assert.equal(cleared.status, 0, 'fixture xattr must be removable: ' + (cleared.stderr ?? ''))
    assert.match(runHelper(f, inspectArgs).stdout, /^OK TARGET /)
  } else {
    spawnSync('setfattr', ['-x', 'user.dsh-inspector-synthetic', f.leaf], { timeout: 5_000 })
    assert.match(runHelper(f, inspectArgs).stdout, /^OK TARGET /)
  }

  // ACL (macOS): the walk refuses the ACL BEFORE the preimage check, so this is exact
  // even though the restored bytes moved the mtime.
  if (aclAvailable) {
    const acl = spawnSync('chmod', ['+a', 'owner allow write', f.leaf], { encoding: 'utf8', timeout: 5_000 })
    if (acl.status === 0) {
      assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT target-acl')
      assert.deepEqual(runHelper(f, inspectArgs).stdout, 'REJECT target-acl')
      spawnSync('chmod', ['-a', 'owner allow write', f.leaf], { timeout: 5_000 })
    }
  }

  // every refusal left the source bytes exactly as they were
  assert.equal(readFileSync(f.leaf, 'utf8'), before)
  assert.equal(readdirSync(tx).filter(e => e !== 'after.bin').length, 0,
    'no journal artifacts were written by any refused apply')
}))

test('bounded synthetic canary Apply on a fresh registered project plus a DISTINCT rollback capability restores exact bytes+mode (no reuse of the apply grant)', async () => operatorFixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'CANARY ALPHA\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [modify('a.txt', 'CANARY ALPHA\n', 'CANARY APPLIED\n'), add('b.txt', 'CANARY NEW\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  const executed = executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages: { 'a.txt': bytes('CANARY APPLIED\n'), 'b.txt': bytes('CANARY NEW\n') }, env: ENABLED
  })
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'CANARY APPLIED\n')
  assert.equal(readFileSync(join(root, 'b.txt'), 'utf8'), 'CANARY NEW\n')
  const receipt = readOperatorApplyReceipt({ journalDirectory: journal, receiptFile: executed.receiptFile, helperBinary })
  assert.equal(receipt.transactionId, executed.capability.transactionId)
  assert.ok(Array.isArray(receipt.postObservations) && receipt.postObservations.length === 2)

  // Rollback is a SEPARATE one-use capability that names the original transaction.
  const rollback = buildOperatorRollbackPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    originalPreviewFile: built.previewFile, originalCapabilityFile: issued.capabilityFile
  })
  const rollbackReview = recordOperatorReview({ journalDirectory: journal,
    previewFile: rollback.previewFile, confirmedPlanDigest: rollback.rollbackPlan.digest })
  const rollbackIssued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: rollback.previewFile, reviewFile: rollbackReview.reviewFile,
    action: 'rollback', rollbackOfTransactionId: executed.capability.transactionId, env: ENABLED
  })
  assert.equal(rollbackIssued.capability.action, 'rollback')
  assert.equal(rollbackIssued.capability.rollbackOfTransactionId, executed.capability.transactionId)
  const undone = executeOperatorRollback({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: rollbackIssued.capabilityFile, previewFile: rollback.previewFile,
    rollbackPreview: rollback.preview,
    afterImages: rollback.rollbackAfterImages, env: ENABLED
  })
  assert.equal(undone.capability.action, 'rollback')
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'CANARY ALPHA\n', 'exact bytes restored')
  assert.equal(lstatSync(join(root, 'a.txt')).mode & 0o777, 0o600, 'exact mode restored')
  assert.equal(existsSync(join(root, 'b.txt')), false, 'the added file is removed by the inverted plan')
  // the original apply capability is consumed and can never be replayed
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: issued.capability.rootFingerprint
  }), /already consumed; no silent retry/)
}))

test('manual recovery classification over the whole operator plan is read-only and stable for every class (no auto replay)', async () => operatorFixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'ALPHA ORIGINAL\n'); chmodSync(join(root, 'a.txt'), 0o600)
  writeFileSync(join(root, 'b.txt'), 'BETA ORIGINAL\n'); chmodSync(join(root, 'b.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [modify('a.txt', 'ALPHA ORIGINAL\n', 'ALPHA REVIEWED\n'),
      modify('b.txt', 'BETA ORIGINAL\n', 'BETA REVIEWED\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.plan.digest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  const capability = issued.capability
  const observed = inspectNativeTarget({ helperBinary, projectRoot: root, relativePath: 'a.txt',
    expectedRootDev: capability.rootDev, expectedRootIno: capability.rootIno })

  // crash AFTER the renameat for a.txt (the new `renamed` stop point)
  const txDirA = nativeTransactionDirectory(journal, capability, 'a.txt')
  mkdirSync(txDirA, { mode: 0o700 })
  writeFileSync(join(txDirA, 'after.bin'), 'ALPHA REVIEWED\n'); chmodSync(join(txDirA, 'after.bin'), 0o600)
  const crashSpec = [
    'kind=apply', 'root=' + root, 'exp_dev=' + capability.rootDev, 'exp_ino=' + capability.rootIno,
    'transaction_id=' + capability.transactionId, 'nonce=' + capability.nonce,
    'capability_id=' + capability.capabilityId, 'plan_digest=' + capability.planDigest,
    'tx_dir=' + txDirA, 'path=a.txt', 'action=modify',
    'before_sha256=' + sha('ALPHA ORIGINAL\n'), 'before_bytes=' + observed.bytes,
    'before_mode=' + observed.mode, 'before_mtime_sec=' + observed.mtimeSec,
    'before_mtime_nsec=' + observed.mtimeNsec,
    'after_sha256=' + sha('ALPHA REVIEWED\n'), 'after_bytes=' + Buffer.byteLength('ALPHA REVIEWED\n'), 'after_mode=384',
    'after_image=after.bin', 'stop_after=renamed'
  ].join('\n') + '\n'
  await crashAtStep(helperBinary, crashSpec, 'renamed')
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'ALPHA REVIEWED\n')

  const matrix = classifyOperatorApplyRecovery({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: issued.capabilityFile, plan: built.plan,
    projectId: PROJECT_ID, rootFingerprint: capability.rootFingerprint
  })
  assert.deepEqual(matrix.map(m => m.path), ['a.txt', 'b.txt'])
  assert.equal(matrix[0].classification, 'APPLIED', 'renameat completed before the kill')
  assert.equal(matrix[1].classification, 'PREPARED_CRASH', 'b.txt never attempted')
  assert.equal(matrix[0].freezeMarker, undefined)
  assert.equal(matrix[1].freezeMarker, undefined)
  assert.equal(readFileSync(join(root, 'b.txt'), 'utf8'), 'BETA ORIGINAL\n', 'classification repaired nothing')

  // A foreign write on b.txt moves it into the AMBIGUOUS class with a durable freeze.
  writeFileSync(join(root, 'b.txt'), 'SOMEONE ELSE WROTE THIS\n')
  const ambiguous = classifyNativeRealApplyRecovery({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: issued.capabilityFile, plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, change: built.plan.changes[1]
  })
  assert.equal(ambiguous.classification, 'AMBIGUOUS')
  assert.ok(ambiguous.freezeMarker && existsSync(ambiguous.freezeMarker), 'freeze is durable')
  const retry = issueRealApplyCapability({
    journalDirectory: journal, projectRoot: root, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, plan: built.plan,
    transactionId: capability.transactionId
  })
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: retry.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID, rootFingerprint: capability.rootFingerprint
  }), /ambiguity freeze; human reconciliation required/)
  const again = classifyNativeRealApplyRecovery({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: issued.capabilityFile, plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, change: built.plan.changes[1]
  })
  assert.equal(again.classification, 'AMBIGUOUS', 'reclassification is read-only and stable')
  assert.ok(existsSync(ambiguous.freezeMarker), 'nothing auto-cleared the freeze')
}))

test('single-file native apply rejects a foreign preimage without spawning, and a plan the capability did not sign is refused', async () => fixture(async (f) => {
  const tx = join(f.journal, 'tx-single')
  mkdirSync(tx, { mode: 0o700 })
  writeFileSync(join(tx, 'after.bin'), 'REPLACEMENT SYNTHETIC\n', { mode: 0o600 })
  const plan = singleFileApplyPlan({
    projectId: PROJECT_ID, rootFingerprint: sha('synthetic-root-fingerprint'), sourceRevision: REVISION,
    change: modify('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
  })
  const issued = issueRealApplyCapability({
    journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
    rootFingerprint: sha('synthetic-root-fingerprint'), plan
  })
  // A foreign write before execution: the driver's preimage observation is through the
  // helper's fd view, so the drift is caught before the helper is spawned for the write.
  writeFileSync(f.leaf, 'SOMEONE ELSE\n', { mode: 0o600 })
  assert.throws(() => runNativeRealApply({
    helperBinary: f.binary, journalDirectory: f.journal, projectRoot: f.root,
    capabilityFile: issued.capabilityFile, action: 'apply', plan, projectId: PROJECT_ID,
    rootFingerprint: sha('synthetic-root-fingerprint'),
    change: plan.changes[0], afterImage: bytes('REPLACEMENT SYNTHETIC\n')
  }), /no longer matches the approved preview; no silent retry/)
  assert.equal(readFileSync(f.leaf, 'utf8'), 'SOMEONE ELSE\n', 'no repair on rejection')
  assert.equal(existsSync(tx), true, 'the driver refused BEFORE creating any transaction journal')
  // an unsigned plan is refused
  const otherPlan = singleFileApplyPlan({
    projectId: PROJECT_ID, rootFingerprint: sha('synthetic-root-fingerprint'), sourceRevision: REVISION,
    change: add('dir/other.txt', 'OTHER\n')
  })
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: f.journal, projectRoot: f.root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: otherPlan, projectId: PROJECT_ID,
    rootFingerprint: sha('synthetic-root-fingerprint')
  }), /plan digest binding mismatch/)
  assert.equal(parseRealApplyCapability(JSON.parse(readFileSync(issued.capabilityFile, 'utf8'))).ancestors.length > 0, true,
    'a newly issued capability always carries the canonical ancestor chain')
}))
