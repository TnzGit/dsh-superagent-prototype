/**
 * OL-20261125-053 — one-use capability enforcement for the native Apply driver on
 * disposable synthetic fixtures ONLY (fresh 0700 temp projects + journal roots).
 * Never invoke against real user projects, home, or production.
 *
 * Asserts the exact error strings, the consumed-on-use / no-silent-retry semantics,
 * the ambiguity freeze, and a registered sacrificial-project end-to-end scenario.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertPrivateJournalRoot, classifyNativeRealApplyRecovery, inspectNativeTarget,
  issueRealApplyCapability, issueRollbackCapability, nativeTransactionDirectory,
  parseRealApplyCapability, readNativeJournal, runNativeRealApply, singleFileApplyPlan,
  verifyRealApplyCapability
} from '../src/local-first/real-apply-native-driver.ts'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const helperSource = join(repoRoot, 'research', 'real-apply-helper.c')
const compiler = process.env.CC || 'cc'

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const PROJECT_ID = 'synthetic-sacrificial-project'
const FINGERPRINT = sha('synthetic-root-fingerprint')
const REVISION = sha('synthetic-source-revision') // 64-hex: the contract REVISION shape
const NOW = () => Date.now()
const bytes = (text) => new TextEncoder().encode(text)

function buildHelper(temp) {
  const binary = join(temp, 'real-apply-helper')
  const result = spawnSync(compiler,
    ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', helperSource, '-o', binary],
    { encoding: 'utf8', timeout: 45_000 })
  assert.equal(result.status, 0, 'helper must compile: ' + (result.stderr ?? '').slice(0, 2000))
  return binary
}

function plan(change) {
  return singleFileApplyPlan({
    projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
    sourceRevision: REVISION, change
  })
}
function modifyChange(path, beforeText, afterText) {
  return {
    path, action: 'modify',
    beforeSha256: sha(beforeText), afterSha256: sha(afterText),
    beforeBytes: beforeText.length, afterBytes: afterText.length,
    beforeMode: 0o600, afterMode: 0o600
  }
}

function fixture(run) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-real-apply-cap-')))
  const root = join(temp, 'project')
  mkdirSync(root, { mode: 0o700 })
  const nested = join(root, 'dir')
  mkdirSync(nested, { mode: 0o700 })
  const journal = join(temp, 'journal')
  mkdirSync(journal, { mode: 0o700 })
  const leaf = join(nested, 'leaf.txt')
  writeFileSync(leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
  const helperBinary = buildHelper(temp)
  const f = { temp, root, nested, leaf, journal, helperBinary }
  try {
    return run(f)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

test('private journal root is enforced: absolute, real directory, 0700, owner, out-of-source', () =>
  fixture((f) => {
    assert.equal(assertPrivateJournalRoot(f.journal, f.root), f.journal)
    assert.throws(() => assertPrivateJournalRoot('journal', f.root), { message: 'Journal directory must be absolute' })
    const inside = join(f.root, 'journal-inside')
    mkdirSync(inside, { mode: 0o700 })
    assert.throws(() => assertPrivateJournalRoot(inside, f.root), { message: 'Journal root must be outside the source project' })
    chmodSync(f.journal, 0o755)
    assert.throws(() => assertPrivateJournalRoot(f.journal, f.root), { message: 'Private journal root must be owner-only 0700' })
    chmodSync(f.journal, 0o700)
    const symlinkedJournal = join(f.temp, 'journal-link')
    symlinkSync(f.journal, symlinkedJournal)
    assert.throws(() => assertPrivateJournalRoot(symlinkedJournal, f.root), { message: 'Unsafe private journal root' })
    const fileJournal = join(f.temp, 'journal-file')
    writeFileSync(fileJournal, '', { mode: 0o600 })
    assert.throws(() => assertPrivateJournalRoot(fileJournal, f.root), { message: 'Unsafe private journal root' })
    assert.equal(lstatSync(f.journal).mode & 0o777, 0o700)
  }))

test('capability schema is strict: forged, malformed and public-text capabilities fail closed', () => {
  const good = {
    version: 1, capabilityId: 'cap-a1b2c3d4e5f60718', action: 'apply',
    transactionId: 'tx-a1b2c3d4e5f60718', projectId: PROJECT_ID,
    rootFingerprint: FINGERPRINT, rootPath: '/synthetic/root',
    rootDev: 1, rootIno: 2, principalUid: 501,
    paths: ['dir/a.txt', 'dir/b.txt'], planDigest: 'c'.repeat(64),
    nonce: 'a'.repeat(32), issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:05:00.000Z'
  }
  good.pathsDigest = sha(JSON.stringify(good.paths))
  assert.equal(parseRealApplyCapability(good).capabilityId, 'cap-a1b2c3d4e5f60718')

  assert.throws(() => parseRealApplyCapability({ ...good, version: 2 }), { message: 'Invalid capability version' })
  assert.throws(() => parseRealApplyCapability({ ...good, capabilityId: 'Cap-Bad' }), { message: 'Invalid capability id' })
  assert.throws(() => parseRealApplyCapability({ ...good, action: 'promote' }), { message: 'Invalid capability action' })
  assert.throws(() => parseRealApplyCapability({ ...good, transactionId: 'tx_bad' }), { message: 'Invalid transaction id' })
  assert.throws(() => parseRealApplyCapability({ ...good, rootFingerprint: 'short' }), { message: 'Invalid root fingerprint' })
  assert.throws(() => parseRealApplyCapability({ ...good, rootPath: 'relative/root' }), { message: 'Capability root path must be absolute' })
  assert.throws(() => parseRealApplyCapability({ ...good, rootDev: -1 }), { message: 'Invalid rootDev' })
  assert.throws(() => parseRealApplyCapability({ ...good, paths: ['dir/b.txt', 'dir/a.txt'], pathsDigest: sha(JSON.stringify(['dir/b.txt', 'dir/a.txt'])) }), { message: 'Capability path list must be sorted' })
  assert.throws(() => parseRealApplyCapability({ ...good, pathsDigest: 'f'.repeat(64) }), { message: 'Capability path list hash binding mismatch' })
  assert.throws(() => parseRealApplyCapability({ ...good, planDigest: 'not-a-digest' }), { message: 'Invalid plan digest' })
  assert.throws(() => parseRealApplyCapability({ ...good, nonce: 'short' }), { message: 'Capability nonce must be locally generated and unguessable' })
  assert.throws(() => parseRealApplyCapability({ ...good, issuedAt: '2026-01-01 00:00:00' }), { message: 'Invalid capability timestamps' })
  assert.throws(() => parseRealApplyCapability({ ...good, expiresAt: '2025-12-31T00:00:00.000Z' }), { message: 'Capability expiry must be after issuance' })
  assert.throws(() => parseRealApplyCapability({ ...good, rollbackOfTransactionId: 'tx-a1b2c3d4e5f60718' }), { message: 'Apply capability must not reference a transaction' })
  assert.throws(() => parseRealApplyCapability({ ...good, action: 'rollback' }), { message: 'Rollback capability must name the original transaction' })
  assert.throws(() => parseRealApplyCapability({ ...good, action: 'rollback', rollbackOfTransactionId: 'tx_bad' }), { message: 'Invalid rollback reference' })
  assert.throws(() => parseRealApplyCapability({ ...good, extraField: 1 }), { message: 'Invalid capability fields' })
  // text copied from the public GitHub page is never a signature
  assert.throws(() => parseRealApplyCapability('{"capabilityId":"cap-a1b2c3d4e5f60718"}'), { message: 'Invalid capability object' })
})

test('verify binds the capability to project, plan, principal uid, root identity and expiry', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    const issued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan
    })
    const base = {
      journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, now: NOW
    }
    assert.equal(verifyRealApplyCapability(base).capabilityId, issued.capability.capabilityId)

    assert.throws(() => verifyRealApplyCapability({ ...base, action: 'rollback' }), { message: 'Capability action does not match this operation' })
    assert.throws(() => verifyRealApplyCapability({ ...base, projectId: 'other-project' }), { message: 'Capability project binding mismatch' })
    assert.throws(() => verifyRealApplyCapability({ ...base, rootFingerprint: sha('other-fingerprint') }), { message: 'Capability root fingerprint mismatch' })
    assert.throws(() => verifyRealApplyCapability({
      ...base, plan: plan(modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'DIFFERENT BYTES\n'))
    }), { message: 'Capability plan digest binding mismatch' })
    // frozen clock beyond the ttl: expired, never retried
    assert.throws(() => verifyRealApplyCapability({ ...base, now: () => Date.now() + 10 * 3600_000 }), { message: 'Expired real Apply capability; no silent retry' })
    // capability file safety: symlink, mode, hardlink (all inside the journal root)
    const link = join(f.journal, 'cap-link.json')
    symlinkSync(issued.capabilityFile, link)
    assert.throws(() => verifyRealApplyCapability({ ...base, capabilityFile: link }), { message: 'Unsafe capability file' })
    chmodSync(issued.capabilityFile, 0o644)
    assert.throws(() => verifyRealApplyCapability(base), { message: 'Capability file must be 0600' })
    chmodSync(issued.capabilityFile, 0o600)
    linkSync(issued.capabilityFile, join(f.journal, 'cap-twin.json'))
    assert.throws(() => verifyRealApplyCapability(base), { message: 'Capability file must not be hardlinked' })
    rmSync(join(f.journal, 'cap-twin.json'))
    // forged file outside the journal root
    const outside = join(f.temp, 'forged.json')
    writeFileSync(outside, JSON.stringify(issued.capability), { mode: 0o600 })
    assert.throws(() => verifyRealApplyCapability({ ...base, capabilityFile: outside }), { message: 'Capability file must live inside the private journal root' })
    // a public text blob copied off GitHub is never accepted as a signature
    const publicText = join(f.journal, 'cap-public-text-001.json')
    writeFileSync(publicText, '"looks like a capability"\n', { mode: 0o600 })
    assert.throws(() => verifyRealApplyCapability({ ...base, capabilityFile: publicText }), { message: 'Invalid capability object' })
    // registered project identity change since issuance (root ABA).
    // A decoy allocation consumes the freed inode number first so the replacement carries a
    // genuinely different dev/inode identity (Linux reuses just-freed inodes immediately).
    writeFileSync(join(f.temp, 'decoy-inode-consumer'), 'x\n', { mode: 0o600 })
    rmSync(f.root, { recursive: true, force: true })
    writeFileSync(join(f.temp, 'decoy-inode-consumer-2'), 'x\n', { mode: 0o600 })
    mkdirSync(f.root, { mode: 0o700 })
    assert.throws(() => verifyRealApplyCapability(base), { message: 'Registered project root identity changed since the capability was issued' })
  }))

test('one-use enforcement: the consumed-on-use marker blocks every silent retry', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    const issued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan
    })
    const first = runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change, afterImage: bytes('REPLACEMENT SYNTHETIC\n')
    })
    assert.match(first.stdout, /^OK APPLIED /)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'REPLACEMENT SYNTHETIC\n')
    assert.equal(existsSync(first.consumedMarker), true)
    assert.equal(readNativeJournal(first.transactionDirectory).status, 'applied')
    assert.equal(readNativeJournal(first.transactionDirectory).capability_id, issued.capability.capabilityId)
    // second use of the SAME capability: refused, never silently retried
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change, afterImage: bytes('REPLACEMENT SYNTHETIC\n')
    }), { message: 'Real Apply capability already consumed; no silent retry' })
    // and a bare verify() refuses too
    assert.throws(() => verifyRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, now: NOW
    }), { message: 'Real Apply capability already consumed; no silent retry' })
    // a fresh, separately issued capability may still act (the refusal is per-capability)
    const second = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan
    })
    const again = runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: second.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change: modifyChange('dir/leaf.txt', 'REPLACEMENT SYNTHETIC\n', 'SECOND PASS\n'),
      afterImage: bytes('SECOND PASS\n')
    })
    assert.match(again.stdout, /^OK APPLIED /)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'SECOND PASS\n')
  }))

test('driver preimage checks use the helper fd view: drift, vanish, hardlink and add-clobber refuse before spawn', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    function issue() {
      return issueRealApplyCapability({
        journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
        rootFingerprint: FINGERPRINT, plan: appliedPlan
      })
    }
    function attempt(capabilityFile) {
      return runNativeRealApply({
        helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
        capabilityFile, action: 'apply', plan: appliedPlan,
        projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
        change, afterImage: bytes('REPLACEMENT SYNTHETIC\n')
      })
    }
    // external drift after approval
    writeFileSync(f.leaf, 'EXTERNAL SWAP XX\n', { mode: 0o600 })
    assert.throws(() => attempt(issue().capabilityFile), {
      message: 'Native apply target no longer matches the approved preview; no silent retry'
    })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'EXTERNAL SWAP XX\n')
    // vanished after approval
    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    rmSync(f.leaf)
    assert.throws(() => attempt(issue().capabilityFile), {
      message: 'Native apply target vanished after approval; no silent retry'
    })
    // hardlinked target: the helper's own pinned-fd walk refuses it before any write
    writeFileSync(f.leaf, 'ORIGINAL SYNTHETIC\n', { mode: 0o600 })
    linkSync(f.leaf, join(f.nested, 'twin.txt'))
    assert.throws(() => attempt(issue().capabilityFile), {
      message: 'Native inspect rejected: REJECT target-hardlinked'
    })
    rmSync(join(f.nested, 'twin.txt'))
    // add clobbering an existing entry
    const addChange = {
      path: 'dir/leaf.txt', action: 'add',
      beforeSha256: null, afterSha256: sha('BRAND NEW FILE\n'),
      beforeBytes: null, afterBytes: 15, beforeMode: null, afterMode: 0o600
    }
    const addPlan = plan(addChange)
    const addIssued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: addPlan
    })
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: addIssued.capabilityFile, action: 'apply', plan: addPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change: addChange, afterImage: bytes('BRAND NEW FILE\n')
    }), { message: 'Native add target already exists; refuse to clobber' })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
    // allowlist: a change outside the capability paths is refused
    const otherPlan = plan(modifyChange('dir/other.txt', 'X\n', 'Y\n'))
    const otherIssued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: otherPlan
    })
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: otherIssued.capabilityFile, action: 'apply', plan: otherPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change: modifyChange('dir/outside.txt', 'X\n', 'Y\n'),
      afterImage: bytes('Y\n')
    }), { message: 'Change is outside the capability allowlist' })
    // after-image mismatch against the approved plan digest
    assert.throws(() => attempt2(f, issue().capabilityFile, appliedPlan, change, 'WRONG BYTES\n'), {
      message: 'After-image does not match the approved plan digest'
    })
    // a plan that declares a bogus afterBytes (contract does not cross-check it)
    // must refuse when the real image size disagrees: digest ok, size wrong.
    const lyingChange = { ...change, afterBytes: 99 }
    const lyingPlan = plan(lyingChange)
    const lyingIssued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: lyingPlan
    })
    assert.throws(() => attempt2(f, lyingIssued.capabilityFile, lyingPlan, lyingChange, 'REPLACEMENT SYNTHETIC\n'), {
      message: 'After-image size does not match the approved plan'
    })
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issue().capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, change
    }), { message: 'Native apply/rollback requires the after-image bytes' })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

function attempt2(f, capabilityFile, appliedPlan, change, text) {
  return runNativeRealApply({
    helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
    capabilityFile, action: 'apply', plan: appliedPlan,
    projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
    change, afterImage: bytes(text)
  })
}

test('transaction journal directory must not pre-exist: no silent retry onto a stale tx', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    const issued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan
    })
    mkdirSync(nativeTransactionDirectory(f.journal, issued.capability), { mode: 0o700 })
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change, afterImage: bytes('REPLACEMENT SYNTHETIC\n')
    }), { message: 'Transaction journal directory already exists; no silent retry' })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('end-to-end sacrificial project: apply then rollback with a SEPARATE capability; ambiguity freezes the transaction', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    const issued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan
    })
    const applied = runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change, afterImage: bytes('REPLACEMENT SYNTHETIC\n')
    })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'REPLACEMENT SYNTHETIC\n')
    assert.equal(readNativeJournal(applied.transactionDirectory).kind, 'apply')
    assert.equal(lstatSync(applied.transactionDirectory).mode & 0o777, 0o700)

    // rollback needs its OWN capability bound to its OWN (reversed) plan
    const rollbackChange = modifyChange('dir/leaf.txt', 'REPLACEMENT SYNTHETIC\n', 'ORIGINAL SYNTHETIC\n')
    const rollbackPlan = plan(rollbackChange)
    const rollbackIssued = issueRollbackCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: rollbackPlan,
      originalTransactionId: issued.capability.transactionId
    })
    assert.equal(rollbackIssued.capability.action, 'rollback')
    assert.equal(rollbackIssued.capability.rollbackOfTransactionId, issued.capability.transactionId)
    assert.notEqual(rollbackIssued.capability.transactionId, issued.capability.transactionId)
    const rolledBack = runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: rollbackIssued.capabilityFile, action: 'rollback', plan: rollbackPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change: rollbackChange,
      afterImage: readFileSync(join(applied.transactionDirectory, 'before.bin'))
    })
    assert.match(rolledBack.stdout, /^OK APPLIED /)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
    assert.equal(readNativeJournal(rolledBack.transactionDirectory).kind, 'rollback')
    // rollback is one-use as well
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: rollbackIssued.capabilityFile, action: 'rollback', plan: rollbackPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change: rollbackChange,
      afterImage: readFileSync(join(applied.transactionDirectory, 'before.bin'))
    }), { message: 'Real Apply capability already consumed; no silent retry' })

    // recovery classification is read-only and never repairs: the ORIGINAL apply
    // transaction, seen after the rollback, matches its own before-image -> PREPARED_CRASH
    const classified = classifyNativeRealApplyRecovery({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, change
    })
    assert.equal(classified.classification, 'PREPARED_CRASH')
    assert.equal(classified.freezeMarker, undefined)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')

    // the completed rollback transaction classifies APPLIED
    const rolledBackClass = classifyNativeRealApplyRecovery({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: rollbackIssued.capabilityFile, plan: rollbackPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, change: rollbackChange
    })
    assert.equal(rolledBackClass.classification, 'APPLIED')

    // forge an AMBIGUOUS state: external writer swaps content to match neither image
    writeFileSync(f.leaf, 'NEITHER IMAGE XX\n', { mode: 0o600 })
    const ambiguous = classifyNativeRealApplyRecovery({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: rollbackIssued.capabilityFile, plan: rollbackPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, change: rollbackChange
    })
    assert.equal(ambiguous.classification, 'AMBIGUOUS')
    assert.equal(existsSync(ambiguous.freezeMarker), true)
    assert.equal(readFileSync(f.leaf, 'utf8'), 'NEITHER IMAGE XX\n') // zero repair
    // the durable freeze blocks every later capability bound to that transaction
    const retry = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: rollbackPlan, action: 'rollback',
      rollbackOfTransactionId: issued.capability.transactionId,
      transactionId: rollbackIssued.capability.transactionId
    })
    assert.throws(() => verifyRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: retry.capabilityFile, action: 'rollback', plan: rollbackPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, now: NOW
    }), { message: 'Transaction is under ambiguity freeze; human reconciliation required' })
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: retry.capabilityFile, action: 'rollback', plan: rollbackPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change: rollbackChange, afterImage: bytes('ORIGINAL SYNTHETIC\n')
    }), { message: 'Transaction is under ambiguity freeze; human reconciliation required' })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'NEITHER IMAGE XX\n')
    // the freeze marker is a private 0600 regular file, never a symlink
    const freezeStat = lstatSync(ambiguous.freezeMarker)
    assert.equal(freezeStat.isFile() && !freezeStat.isSymbolicLink(), true)
    assert.equal(freezeStat.mode & 0o777, 0o600)
  }))

test('inspectNativeTarget returns the fd view and refuses unsafe targets', () =>
  fixture((f) => {
    const observed = inspectNativeTarget({
      helperBinary: f.helperBinary, projectRoot: f.root, relativePath: 'dir/leaf.txt',
      expectedRootDev: lstatSync(f.root).dev, expectedRootIno: lstatSync(f.root).ino
    })
    assert.equal(observed.sha256, sha('ORIGINAL SYNTHETIC\n'))
    assert.equal(observed.bytes, 19)
    assert.equal(observed.mode, 0o600)
    assert.equal(observed.nlink, 1)
    assert.equal(Number.isSafeInteger(observed.mtimeSec), true)
    assert.equal(Number.isSafeInteger(observed.mtimeNsec), true)
    rmSync(f.leaf)
    assert.equal(inspectNativeTarget({
      helperBinary: f.helperBinary, projectRoot: f.root, relativePath: 'dir/leaf.txt'
    }), 'MISSING')
    symlinkSync(join(f.temp, 'nowhere.txt'), f.leaf)
    assert.throws(() => inspectNativeTarget({
      helperBinary: f.helperBinary, projectRoot: f.root, relativePath: 'dir/leaf.txt'
    }), { message: /Native inspect rejected: REJECT symlink-component/ })
    // wrong registered root identity is refused
    assert.throws(() => inspectNativeTarget({
      helperBinary: f.helperBinary, projectRoot: f.root, relativePath: 'dir/leaf.txt',
      expectedRootDev: lstatSync(f.root).dev + 7, expectedRootIno: lstatSync(f.root).ino
    }), { message: /Native inspect rejected: REJECT root-identity-drift/ })
  }))

test('expired and future-issued capabilities fail closed with exact strings', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    const issued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan, ttlSeconds: 1
    })
    assert.throws(() => verifyRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      now: () => Date.now() + 3600_000
    }), { message: 'Expired real Apply capability; no silent retry' })
    const future = join(f.journal, 'cap-future-issued-001.json')
    const raw = { ...issued.capability }
    raw.capabilityId = 'cap-future-issued-001'
    raw.issuedAt = new Date(Date.now() + 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    raw.expiresAt = new Date(Date.now() + 7200_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
    writeFileSync(future, JSON.stringify(raw), { mode: 0o600 })
    assert.throws(() => verifyRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, capabilityFile: future,
      action: 'apply', plan: appliedPlan, projectId: PROJECT_ID, rootFingerprint: FINGERPRINT, now: NOW
    }), { message: 'Capability issued in the future' })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
  }))

test('the driver never re-uses the apply capability for a rollback and never accepts a plan the capability did not sign', () =>
  fixture((f) => {
    const change = modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'REPLACEMENT SYNTHETIC\n')
    const appliedPlan = plan(change)
    const issued = issueRealApplyCapability({
      journalDirectory: f.journal, projectRoot: f.root, projectId: PROJECT_ID,
      rootFingerprint: FINGERPRINT, plan: appliedPlan
    })
    // rollback action against an apply capability: refused
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'rollback', plan: appliedPlan,
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change, afterImage: bytes('ORIGINAL SYNTHETIC\n')
    }), { message: 'Capability action does not match this operation' })
    // a DIFFERENT plan (different digest) under the same capability: refused
    assert.throws(() => runNativeRealApply({
      helperBinary: f.helperBinary, journalDirectory: f.journal, projectRoot: f.root,
      capabilityFile: issued.capabilityFile, action: 'apply',
      plan: plan(modifyChange('dir/leaf.txt', 'ORIGINAL SYNTHETIC\n', 'OTHER BYTES\n')),
      projectId: PROJECT_ID, rootFingerprint: FINGERPRINT,
      change, afterImage: bytes('REPLACEMENT SYNTHETIC\n')
    }), { message: 'Capability plan digest binding mismatch' })
    assert.equal(readFileSync(f.leaf, 'utf8'), 'ORIGINAL SYNTHETIC\n')
    assert.equal(existsSync(join(f.journal, 'consumed-' + issued.capability.capabilityId)), false)
  }))
