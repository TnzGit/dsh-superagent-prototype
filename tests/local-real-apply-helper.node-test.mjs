/**
 * OL-20261125-053 — descriptor-relative, no-follow native Apply helper adversarial
 * acceptance on disposable synthetic fixtures ONLY (fresh 0700 temp projects).
 * Never invoke against real user projects, home, or production.
 *
 * Asserts exact REJECT codes, zero-repair and no-retry semantics, and exercises the
 * C compile (full link and `cc -c` object-only) portably on macOS and Linux CI.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const helperSource = join(repoRoot, 'research', 'real-apply-helper.c')
const buildScript = join(repoRoot, 'research', 'real-apply-helper-build.sh')
const compiler = process.env.CC || 'cc'

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

function compileHelper(temp) {
  const binary = join(temp, 'real-apply-helper')
  const linked = spawnSync(compiler,
    ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', helperSource, '-o', binary],
    { encoding: 'utf8', timeout: 45_000 })
  assert.equal(linked.status, 0, 'Native helper must compile on CI Linux/macOS: ' + (linked.stderr ?? '').slice(0, 2000))
  const objectFile = join(temp, 'real-apply-helper.o')
  const objectOnly = spawnSync(compiler,
    ['-std=c11', '-Wall', '-Wextra', '-Werror', '-c', helperSource, '-o', objectFile],
    { encoding: 'utf8', timeout: 45_000 })
  assert.equal(objectOnly.status, 0, 'Native helper object-only compile must work: ' + (objectOnly.stderr ?? '').slice(0, 2000))
  assert.ok(existsSync(objectFile), 'object compile must produce the .o file')
  return binary
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

// Exact ns mtime via bigint stats — the helper compares st_mtimespec nanoseconds.
// The preimage is frozen against the REAL target path (not always f.leaf), so an
// unsafe-mode/special-file target is refused by the walk before the preimage check.
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
    // unique nonce per spec: a crashed apply leaves its staged temp behind, and a
    // reused nonce would make the next attempt fail on stage-create-failure.
    nonce: overrides.nonce || randomBytes(16).toString('hex'),
    ...overrides
  })
}

async function fixture(run) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-real-apply-helper-')))
  const root = join(temp, 'project')
  mkdirSync(root, { mode: 0o700 })
  const nested = join(root, 'dir')
  mkdirSync(nested, { mode: 0o700 })
  const journal = join(temp, 'journal')
  mkdirSync(journal, { mode: 0o700 })
  const leaf = join(nested, 'leaf.txt')
  writeFileSync(leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
  const binary = compileHelper(temp)
  const rootStat = lstatSync(root)
  const f = { temp, root, journal, nested, leaf, binary, rootDev: rootStat.dev, rootIno: rootStat.ino }
  try {
    return await run(f)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function txDir(f, name = 'tx') {
  const dir = join(f.journal, name)
  mkdirSync(dir, { mode: 0o700 })
  writeFileSync(join(dir, 'after.bin'), 'REPLACEMENT SYNTHETIC\n', { mode: 0o600 })
  return dir
}

function runHelper(f, args, input) {
  const result = spawnSync(f.binary, args, { input, encoding: 'utf8', timeout: 30_000 })
  assert.equal(result.error, undefined, 'helper must be runnable')
  return { code: result.status ?? -1, stdout: result.stdout.trim() }
}

function inspectTarget(f, path) {
  return runHelper(f, ['inspect', f.root, String(f.rootDev), String(f.rootIno), path])
}

test('native compile is exercised portably (full link and object-only, -Werror)', () => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-real-apply-compile-')))
  try {
    const binary = compileHelper(temp)
    const usage = spawnSync(binary, ['no-such-subcommand'], { input: 'kind=apply\n', encoding: 'utf8', timeout: 10_000 })
    assert.equal(usage.status, 2)
    assert.equal(usage.stdout.trim(), 'REJECT spec-invalid')
    const script = spawnSync('/bin/sh', [buildScript, join(temp, 'built-by-script')], { encoding: 'utf8', timeout: 60_000 })
    assert.equal(script.status, 0, 'build script must compile portably: ' + (script.stderr ?? '').slice(0, 2000))
    assert.ok(existsSync(join(temp, 'built-by-script')))
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

test('helper binds the root fd to the registered dev/ino and refuses root symlink, group-writable root and identity drift', () =>
  fixture((f) => {
    const ok = inspectTarget(f, 'dir/leaf.txt')
    assert.equal(ok.code, 0)
    assert.match(ok.stdout, /^OK TARGET /)
    const link = join(f.temp, 'root-link')
    symlinkSync(f.root, link)
    const viaLink = runHelper(f, ['inspect', link, String(f.rootDev), String(f.rootIno), 'dir/leaf.txt'])
    assert.deepEqual(viaLink.stdout, 'REJECT root-is-symlink')
    chmodSync(f.root, 0o775) // group-WRITABLE: private_dir policy rejects any 022 bit
    const loose = inspectTarget(f, 'dir/leaf.txt')
    assert.deepEqual(loose.stdout, 'REJECT root-unsafe')
    chmodSync(f.root, 0o700)
    const wrongIdentity = runHelper(f, ['inspect', f.root, String(f.rootDev + 1), String(f.rootIno), 'dir/leaf.txt'])
    assert.deepEqual(wrongIdentity.stdout, 'REJECT root-identity-drift')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('helper rejects a symlink at EVERY level without following it, exact codes only', () =>
  fixture((f) => {
    // final component symlink
    symlinkSync(f.leaf, join(f.nested, 'shortcut.txt'))
    const tx = txDir(f)
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx, { path: 'dir/shortcut.txt' })).stdout, 'REJECT symlink-component')
    // intermediate directory symlink
    symlinkSync(f.nested, join(f.root, 'alias'))
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx, { path: 'alias/leaf.txt' })).stdout, 'REJECT symlink-component')
    // symlink whose target is outside the root
    const outside = join(f.temp, 'outside.txt')
    writeFileSync(outside, 'ESCAPED\n', { mode: 0o600 })
    symlinkSync(outside, join(f.nested, 'escape.txt'))
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx, { path: 'dir/escape.txt' })).stdout, 'REJECT symlink-component')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
    assert.equal(readFileSync(outside, 'utf8'), 'ESCAPED\n')
    // inspect refuses the same shapes
    assert.deepEqual(inspectTarget(f, 'dir/shortcut.txt').stdout, 'REJECT symlink-component')
    assert.deepEqual(inspectTarget(f, 'alias/leaf.txt').stdout, 'REJECT symlink-component')
    // a missing leaf is reported, not guessed
    assert.deepEqual(inspectTarget(f, 'dir/nope.txt').stdout, 'OK MISSING')
  }))

test('helper rejects hardlinked targets and unsafe modes/special files (fifo, socket, setuid, group-writable)', () =>
  fixture((f) => {
    const tx = txDir(f)
    linkSync(f.leaf, join(f.nested, 'twin.txt'))
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx)).stdout, 'REJECT target-hardlinked')
    rmSync(join(f.nested, 'twin.txt'))

    const setuid = join(f.nested, 'setuid.txt')
    writeFileSync(setuid, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    chmodSync(setuid, 0o4600)
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx, { path: 'dir/setuid.txt' })).stdout, 'REJECT target-unsafe-mode')

    const groupWrite = join(f.nested, 'group.txt')
    writeFileSync(groupWrite, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    chmodSync(groupWrite, 0o660) // bypass the process umask so the bit is really set
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx, { path: 'dir/group.txt' })).stdout, 'REJECT target-unsafe-mode')

    const fifo = join(f.nested, 'pipe.fifo')
    const made = spawnSync('mkfifo', [fifo], { encoding: 'utf8', timeout: 5000 })
    assert.equal(made.status, 0, 'mkfifo must be available on CI: ' + (made.stderr ?? ''))
    // placeholder preimage: the pinned walk refuses the special file BEFORE the
    // preimage is ever read (reading a fifo with no writer would block forever).
    const specialSpec = (path) => spec({
      root: f.root, path, action: 'modify',
      exp_dev: String(f.rootDev), exp_ino: String(f.rootIno),
      before_sha256: sha('PLACEHOLDER NOT READ'), before_bytes: '21',
      before_mode: '384', before_mtime_sec: '0', before_mtime_nsec: '0',
      after_sha256: sha('REPLACEMENT SYNTHETIC\n'), after_bytes: '22',
      after_mode: '384', after_image: 'after.bin', tx_dir: tx,
      nonce: randomBytes(16).toString('hex')
    })
    assert.deepEqual(runHelper(f, ['apply'], specialSpec('dir/pipe.fifo')).stdout, 'REJECT target-not-regular')
    assert.deepEqual(inspectTarget(f, 'dir/pipe.fifo').stdout, 'REJECT target-not-regular')

    // unix socket: macOS caps sun_path at 104 bytes, so listen at a short path
    // (same volume) and have the child move the resulting special file into the
    // project tree before exiting (close() would unlink it).
    const shortTemp = realpathSync(mkdtempSync('/tmp/dshsk-'))
    const shortSocket = join(shortTemp, 's')
    const socket = join(f.nested, 'sock.unix')
    const sock = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import {createServer} from 'node:net'; import {renameSync} from 'node:fs';
       const s=createServer(); s.listen(${JSON.stringify(shortSocket)},()=>{renameSync(${JSON.stringify(shortSocket)}, ${JSON.stringify(socket)}); process.exit(0)});
       setTimeout(()=>process.exit(1),1500);`],
    { encoding: 'utf8', timeout: 15_000 })
    assert.equal(sock.status, 0, 'unix socket fixture must be creatable: ' + (sock.stderr ?? ''))
    rmSync(shortTemp, { recursive: true, force: true })
    assert.deepEqual(runHelper(f, ['apply'], specialSpec('dir/sock.unix')).stdout, 'REJECT target-not-regular')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('inode/path ABA: same size, changed bytes, size, mode or mtime is caught immediately before the write', () =>
  fixture((f) => {
    const tx = txDir(f)
    const original = exactSpec(f, tx) // frozen approval of the ORIGINAL preimage

    writeFileSync(f.leaf, 'EXTERNAL SWAP XX\n', { mode: 0o600 })
    assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-hash-drift')

    // content hash is verified FIRST through the fd, so any size change also
    // changes the digest; the helper reports the digest drift, never the size.
    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\nX', { mode: 0o600 })
    assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-hash-drift')

    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    chmodSync(f.leaf, 0o400)
    assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-mode-drift')

    chmodSync(f.leaf, 0o600)
    const before = lstatSync(f.leaf, { bigint: true })
    const touch = spawnSync('touch', ['-t', '203801010203.04', f.leaf], { encoding: 'utf8', timeout: 5000 })
    assert.equal(touch.status, 0)
    const after = lstatSync(f.leaf, { bigint: true })
    assert.equal(before.mtimeNs !== after.mtimeNs, true, 'touch must change mtime for the drift to be real')
    assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-mtime-drift')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('leaf-entry ABA (unlinked original + recreated same name) is never trusted as the approved inode', () =>
  fixture((f) => {
    const tx = txDir(f)
    const original = exactSpec(f, tx)
    const originalIno = lstatSync(f.leaf, { bigint: true }).ino
    // Deterministic ABA on both Linux and macOS: rename the original leaf to a
    // tombstone so its inode stays allocated, then recreate the same name with a
    // genuinely different inode (ext4 may otherwise reuse a just-freed inode).
    renameSync(f.leaf, join(f.temp, 'leaf-tombstone'))
    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    const recreated = lstatSync(f.leaf, { bigint: true })
    assert.equal(recreated.ino !== originalIno, true, 'recreation must produce a different inode')
    // The frozen approval names the ORIGINAL inode+ns mtime; the helper must refuse the
    // swapped entry rather than silently applying to the new file.
    assert.deepEqual(runHelper(f, ['apply'], original).stdout, 'REJECT preimage-mtime-drift')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
    // A freshly re-issued approval of the NEW inode may apply (no stale-path trust)
    const applied = runHelper(f, ['apply'], exactSpec(f, tx))
    assert.equal(applied.code, 0, applied.stdout)
    assert.match(applied.stdout, /^OK APPLIED /)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'REPLACEMENT SYNTHETIC\n')
    // the atomic rename installs the staged inode; the leaf is a single-link regular file
    assert.equal(lstatSync(f.leaf).nlink, 1)
    // add must never clobber an existing entry
    const tx2 = txDir(f, 'tx-add')
    const addSpec = exactSpec(f, tx2, { action: 'add', before_sha256: '-', before_bytes: '0', before_mode: '0', before_mtime_sec: '0', before_mtime_nsec: '0', plan_digest: sha('add-plan') })
    assert.deepEqual(runHelper(f, ['apply'], addSpec).stdout, 'REJECT target-exists-for-add')
    // modify on a missing leaf must refuse, never guess
    const missingSpec = exactSpec(f, tx)
    rmSync(f.leaf)
    assert.deepEqual(runHelper(f, ['apply'], missingSpec).stdout, 'REJECT target-missing')
  }))

test('external concurrent writer racing the parked helper: pinned fd + journal survive the swap, never silent repair', () =>
  fixture(async (f) => {
    const tx = txDir(f)
    // Freeze the approval against the ORIGINAL inode+ns mtime before the race begins.
    const frozen = exactSpec(f, tx)
    // Start the real OS child, parked right after the 'applying' journal record
    // (which is written AFTER the final preimage + entry-identity re-verification).
    const child = spawn(f.binary, ['apply'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    const parked = new Promise((resolvePromise, rejectPromise) => {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdout += chunk
        if (stdout.includes('STEP applying')) resolvePromise()
      })
      child.on('error', rejectPromise)
    })
    child.stdin.write(frozen.replace('path=dir/leaf.txt', 'path=dir/leaf.txt').replace('\n', '\nstop_after=applying\n'))
    child.stdin.end()
    await parked
    // Non-cooperating external writer swaps the leaf ENTRY while the helper is parked.
    rmSync(f.leaf)
    writeFileSync(f.leaf, 'EXTERNAL RACED X\n', { mode: 0o600 })
    child.kill('SIGKILL')
    await new Promise((resolvePromise) => child.on('close', () => resolvePromise()))
    // The write never happened (crash injection); the swapped external file is what
    // remains. Recovery must classify, not repair, and must not guess.
    const recovered = runHelper(f, ['recover'], frozen)
    assert.equal(recovered.code, 0, recovered.stdout)
    // The helper re-walks and opens the NEW inode (never trusts a stale path), and
    // 'EXTERNAL RACED X\n' matches neither frozen image -> AMBIGUOUS, never auto-repaired
    assert.match(recovered.stdout, /^OK CLASSIFY AMBIGUOUS /)
    assert.match(recovered.stdout, /staged=present/)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'EXTERNAL RACED X\n')
  }))

test('crash injection between every journal step kills the exact OS child; recovery classifies and never repairs', () =>
  fixture(async (f) => {
    for (const step of ['prepared', 'staged', 'applying']) {
      writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
      const tx = txDir(f, 'tx-crash-' + step)
      // one nonce shared by the crashed child and the later recover, so recover
      // looks for the staged temp the child actually created
      const nonce = randomBytes(16).toString('hex')
      const child = spawn(f.binary, ['apply'], { stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = ''
      const parked = new Promise((resolvePromise, rejectPromise) => {
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', (chunk) => {
          stdout += chunk
          if (stdout.includes('STEP ' + step)) resolvePromise()
        })
        child.on('error', rejectPromise)
      })
      child.stdin.write(exactSpec(f, tx, { stop_after: step, nonce }))
      child.stdin.end()
      await parked
      child.kill('SIGKILL')
      await new Promise((resolvePromise) => child.on('close', () => resolvePromise()))
      const recovered = runHelper(f, ['recover'], exactSpec(f, tx, { nonce }))
      assert.equal(recovered.code, 0, step + ': ' + recovered.stdout)
      assert.match(recovered.stdout, new RegExp('^OK CLASSIFY PREPARED_CRASH staged=' + (step === 'prepared' ? 'absent' : 'present') + ' '))
      assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n', step + ': zero repair')
      assert.equal(existsSync(join(tx, 'before.bin')), true, step + ': durable before-image must exist')
    }
    // crash AFTER the rename: applied state is classified APPLIED
    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    const tx = txDir(f, 'tx-crash-written')
    const writtenNonce = randomBytes(16).toString('hex')
    const child = spawn(f.binary, ['apply'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    const parked = new Promise((resolvePromise, rejectPromise) => {
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdout += chunk
        if (stdout.includes('STEP written')) resolvePromise()
      })
      child.on('error', rejectPromise)
    })
    child.stdin.write(exactSpec(f, tx, { stop_after: 'written', nonce: writtenNonce }))
    child.stdin.end()
    await parked
    child.kill('SIGKILL')
    await new Promise((resolvePromise) => child.on('close', () => resolvePromise()))
    const recovered = runHelper(f, ['recover'], exactSpec(f, tx, { nonce: writtenNonce }))
    assert.match(recovered.stdout, /^OK CLASSIFY APPLIED staged=absent /)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'REPLACEMENT SYNTHETIC\n')
  }))

test('insufficient backup: a stale before.bin in the fresh transaction directory is refused, never overwritten', () =>
  fixture((f) => {
    const tx = txDir(f, 'tx-insufficient')
    writeFileSync(join(tx, 'before.bin'), 'STALE PARTIAL BACKUP\n', { mode: 0o600 })
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx)).stdout, 'REJECT backup-create-failure')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
    assert.equal(readFileSync(join(tx, 'before.bin'), 'utf8'), 'STALE PARTIAL BACKUP\n')
  }))

test('unsafe transaction journal directory is refused before anything is written', () =>
  fixture((f) => {
    const tx = txDir(f, 'tx-loose')
    chmodSync(tx, 0o775) // group-WRITABLE journal dir: refuse before any write
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx)).stdout, 'REJECT tx-dir-unsafe')
    chmodSync(tx, 0o700)
    const symlinked = join(f.journal, 'tx-link')
    symlinkSync(tx, symlinked)
    assert.deepEqual(runHelper(f, ['apply'], exactSpec(f, tx, { tx_dir: symlinked })).stdout, 'REJECT tx-dir-open-failure')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('malformed or duplicate spec fails closed; unknown keys never partially applied', () =>
  fixture((f) => {
    const tx = txDir(f)
    const good = exactSpec(f, tx)
    assert.deepEqual(runHelper(f, ['bogus-subcommand'], good).stdout, 'REJECT subcommand-unknown')
    assert.deepEqual(runHelper(f, ['apply'], good + 'extra_key=1\n').stdout, 'REJECT spec-invalid')
    assert.deepEqual(runHelper(f, ['apply'], good + 'kind=apply\n').stdout, 'REJECT spec-invalid')
    assert.deepEqual(runHelper(f, ['apply'], good.replace('kind=apply', 'kind=rollback')).stdout, 'REJECT capability-kind-mismatch')
    assert.deepEqual(runHelper(f, ['apply'], good.replace('path=dir/leaf.txt', 'path=../outside')).stdout, 'REJECT path-unsafe')
    assert.deepEqual(runHelper(f, ['apply'], good.replace(/^nonce=[0-9a-f]+$/m, 'nonce=ZZ')).stdout, 'REJECT spec-identifier-unparseable')
    assert.deepEqual(runHelper(f, ['apply'], good.replace('after_mode=384', 'after_mode=4755')).stdout, 'REJECT after-mode-unsafe')
    assert.deepEqual(runHelper(f, ['apply'], good.replace('after_sha256=' + sha('REPLACEMENT SYNTHETIC\n'), 'after_sha256=zz')).stdout, 'REJECT image-digest-unparseable')
    assert.deepEqual(runHelper(f, ['apply'], good.replace('after_image=after.bin', 'after_image=.hidden')).stdout, 'REJECT after-image-name-unsafe')
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('helper SHA-256 matches Node createHash byte-for-byte (multi-block and empty inputs)', () =>
  fixture((f) => {
    const big = join(f.nested, 'big.bin')
    const payload = new Uint8Array(200_000).fill(97)
    writeFileSync(big, payload, { mode: 0o600 })
    const outcome = inspectTarget(f, 'dir/big.bin')
    assert.equal(outcome.code, 0, outcome.stdout)
    const fields = outcome.stdout.split(/\s+/)
    assert.equal(fields[6], createHash('sha256').update(payload).digest('hex'))
    assert.equal(fields[7], '200000')
    const empty = join(f.nested, 'empty.bin')
    writeFileSync(empty, '', { mode: 0o600 })
    assert.equal(inspectTarget(f, 'dir/empty.bin').stdout.split(/\s+/)[6], createHash('sha256').update('').digest('hex'))
  }))

test('delete is durable and classified; an add on a missing leaf installs without clobbering', () =>
  fixture((f) => {
    const tx = txDir(f, 'tx-delete')
    const stat = lstatSync(f.leaf, { bigint: true })
    const deleteSpec = spec({
      root: f.root, path: 'dir/leaf.txt', action: 'delete',
      exp_dev: String(f.rootDev), exp_ino: String(f.rootIno),
      before_sha256: sha(readFileSync(f.leaf)), before_bytes: String(stat.size),
      before_mode: String(stat.mode & 0o7777n),
      before_mtime_sec: String(stat.mtimeNs / 1000000000n),
      before_mtime_nsec: String(stat.mtimeNs % 1000000000n),
      after_sha256: '-', after_bytes: '0', after_mode: '0',
      tx_dir: tx, plan_digest: sha('delete-plan')
    })
    const removed = runHelper(f, ['apply'], deleteSpec)
    assert.equal(removed.code, 0, removed.stdout)
    assert.equal(existsSync(f.leaf), false)
    assert.equal(lstatSync(tx).mode & 0o777, 0o700)
    const journal = readFileSync(join(tx, 'journal.rec'), 'utf8')
    assert.match(journal, /status=applied/)
    assert.match(journal, /action=delete/)
    const recovered = runHelper(f, ['recover'], deleteSpec)
    assert.match(recovered.stdout, /^OK CLASSIFY APPLIED /)
    // add on a missing leaf
    const txAdd = txDir(f, 'tx-add')
    writeFileSync(join(txAdd, 'after.bin'), 'BRAND NEW FILE\n', { mode: 0o600 })
    const addSpec = spec({
      kind: 'apply', root: f.root, path: 'dir/added.txt', action: 'add',
      exp_dev: String(f.rootDev), exp_ino: String(f.rootIno),
      before_sha256: '-', before_bytes: '0', before_mode: '0',
      before_mtime_sec: '0', before_mtime_nsec: '0',
      after_sha256: sha('BRAND NEW FILE\n'), after_bytes: '15', after_mode: '384',
      after_image: 'after.bin', tx_dir: txAdd, plan_digest: sha('add-plan')
    })
    const added = runHelper(f, ['apply'], addSpec)
    assert.equal(added.code, 0, added.stdout)
    assert.equal(readFileSync(join(f.nested, 'added.txt'), 'utf8'), 'BRAND NEW FILE\n')
    assert.equal(lstatSync(join(f.nested, 'added.txt')).nlink, 1)
  }))

test('helper never prints host paths or file bytes on any output path', () =>
  fixture((f) => {
    const tx = txDir(f)
    const outputs = [
      inspectTarget(f, 'dir/leaf.txt').stdout,
      runHelper(f, ['apply'], exactSpec(f, tx)).stdout,
      runHelper(f, ['recover'], exactSpec(f, tx)).stdout
    ]
    for (const line of outputs) {
      assert.equal(line.includes(f.temp), false, 'output must not leak the fixture path: ' + line)
      assert.equal(line.includes('ORIGINAL SYNTHETIC'), false, 'output must not leak file bytes: ' + line)
    }
  }))
