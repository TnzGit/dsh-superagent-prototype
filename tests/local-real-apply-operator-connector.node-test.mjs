/**
 * OL-20261125-054 — operator-private preview→capability→Apply→rollback connector
 * adversarial offline tests, on FRESH owner-controlled REGISTERED synthetic sacrificial
 * projects (0700 temp) ONLY. Never against real user projects, home, credentials,
 * Weixin network, or host services.
 *
 * Asserts: preview/identity binding (root + canonical ancestors), stale-rebind refusal,
 * forged/expired/consumed capability enforcement, the 2-file/8KiB bound, deletion refusal,
 * xattr/flags/hardlink/symlink refusals BEFORE any issue, the writer-quiescence gate,
 * the crash-injection recovery classification matrix (read-only, freeze never auto-cleared),
 * SEPARATE one-use rollback with exact bytes+mode restoration, the default-OFF flag gate,
 * and the Worker-context refusal (a Worker process must never invoke Apply).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyNativeRealApplyRecovery, inspectNativeTarget, issueRealApplyCapability,
  nativeTransactionDirectory, readNativeJournal, verifyRealApplyCapability,
  runNativeRealApply
} from '../src/local-first/real-apply-native-driver.ts'
import {
  buildOperatorApplyPreview, buildOperatorRollbackPreview, classifyOperatorApplyRecovery,
  executeOperatorApply, issueOperatorCapability, operatorProjectFingerprint,
  readOperatorApplyReceipt, recordOperatorReview, realApplyOperatorEnabled,
  OPERATOR_PREVIEW_MAX_TOTAL_BYTES, REAL_APPLY_OPERATOR_FLAG, WORKER_SESSION_MARKER
} from '../src/local-first/real-apply-operator-connector.ts'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const helperSource = join(repoRoot, 'research', 'real-apply-helper.c')
const xattrSource = join(repoRoot, 'tests', 'fixtures', 'os-xattr-fixture.c')
const compiler = process.env.CC || 'cc'
const PROJECT_ID = 'synthetic-sacrificial-project'
const REVISION = createHash('sha256').update('synthetic-source-revision').digest('hex')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const bytes = (text) => new TextEncoder().encode(text)
const ENABLED = { [REAL_APPLY_OPERATOR_FLAG]: '1' }

function buildHelper(temp) {
  const binary = join(temp, 'real-apply-helper')
  const result = spawnSync(compiler,
    ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', helperSource, '-o', binary],
    { encoding: 'utf8', timeout: 45_000 })
  assert.equal(result.status, 0, 'helper must compile: ' + (result.stderr ?? '').slice(0, 2000))
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

async function fixture(work) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol054-apply-')))
  const projects = join(base, 'projects')
  const journal = join(base, 'journal')
  mkdirSync(projects); mkdirSync(journal, { mode: 0o700 })
  const root = join(projects, 'doc'); mkdirSync(root, { mode: 0o700 })
  const helperBinary = buildHelper(base)
  try {
    await work({ base, projects, journal, root, helperBinary,
      registry: () => new LocalProjectRegistry([projects], [{ id: PROJECT_ID, root, kind: 'local' }]) })
  } finally { rmSync(base, { recursive: true, force: true }) }
}

const modifyChange = (path, beforeText, afterText) => ({
  path, action: 'modify',
  beforeSha256: sha(beforeText), afterSha256: sha(afterText),
  beforeBytes: beforeText.length, afterBytes: afterText.length,
  beforeMode: 0o600, afterMode: 0o600
})
const addChange = (path, afterText, mode = 0o600) => ({
  path, action: 'add',
  beforeSha256: null, afterSha256: sha(afterText),
  beforeBytes: null, afterBytes: afterText.length,
  beforeMode: null, afterMode: mode
})

/** Full operator flow up to execution: preview → review → capability → execute. */
function fullFlow({ registry, journal, root, helperBinary, changes, afterImages, env = ENABLED }) {
  const built = buildOperatorApplyPreview({
    registry, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes
  })
  const review = recordOperatorReview({
    journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest
  })
  const issued = issueOperatorCapability({
    registry, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env
  })
  const executed = executeOperatorApply({
    registry, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages, env
  })
  return { built, review, issued, executed }
}

/** Crash-injection: run the helper with stop_after=<step>, kill it, await exit. */
async function crashAtStep(helperBinary, spec, step) {
  const child = spawn(helperBinary, ['apply'], { stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdin.write(spec)
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

test('two-file bounded plan: preview→review→capability→execute applies both files, consumes exactly once, leaves a durable receipt', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'ALPHA ORIGINAL\n'); chmodSync(join(root, 'a.txt'), 0o600)
  writeFileSync(join(root, 'notes.md'), 'NOTES ORIGINAL\n'); chmodSync(join(root, 'notes.md'), 0o600)
  const reg = registry()
  const flow = fullFlow({
    registry: reg, journal, root, helperBinary,
    changes: [modifyChange('a.txt', 'ALPHA ORIGINAL\n', 'ALPHA REVIEWED\n'), addChange('new.txt', 'NEW FILE\n')],
    afterImages: { 'a.txt': bytes('ALPHA REVIEWED\n'), 'new.txt': bytes('NEW FILE\n') }
  })
  assert.equal(flow.executed.results.length, 2)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'ALPHA REVIEWED\n')
  assert.equal(readFileSync(join(root, 'new.txt'), 'utf8'), 'NEW FILE\n')
  assert.equal(lstatSync(join(root, 'new.txt')).mode & 0o777, 0o600, 'mode installed exactly as reviewed')
  // ONE consumption for the whole transaction; per-file durable transaction directories.
  assert.equal(existsSync(flow.executed.consumedMarker), true)
  const txDirs = flow.executed.results.map(r => r.transactionDirectory)
  assert.notEqual(txDirs[0], txDirs[1], 'each change keeps its own journal directory')
  for (const dir of txDirs) {
    assert.equal(readNativeJournal(dir).status, 'applied')
    const record = readNativeJournal(dir)
    if (record.action === 'modify') {
      assert.equal(existsSync(join(dir, 'before.bin')), true, 'committed backup captured in the transaction journal')
      assert.equal(sha(readFileSync(join(dir, 'before.bin'))), record.before_sha256,
        'the fsync’d before.bin matches the reviewed preimage hash')
    } else {
      assert.equal(record.before_sha256, '-', 'add has no before-image backup')
    }
  }
  const receipt = readOperatorApplyReceipt({ journalDirectory: journal, receiptFile: flow.executed.receiptFile })
  assert.equal(receipt.planDigest, flow.built.preview.planDigest)
  assert.equal(receipt.transactionId, flow.issued.capability.transactionId)
  assert.equal(receipt.files.length, 2)
  // Preview summary is operator-reviewable: sorted exact file list with before/after hashes.
  assert.deepEqual(flow.built.preview.changes.map(c => c.path), ['a.txt', 'new.txt'])
  assert.equal(flow.built.preview.summary.length, 2)
  assert.match(flow.built.preview.summary.join('\n'), /before [a-f0-9]{64}.*after [a-f0-9]{64}/)
}))

test('bounded limits: three files and any change over 8KiB are refused before review or issue', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); writeFileSync(join(root, 'b.txt'), 'B\n')
  writeFileSync(join(root, 'c.txt'), 'C\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [modifyChange('a.txt', 'A\n', 'AA\n'), modifyChange('b.txt', 'B\n', 'BB\n'), addChange('c.txt', 'NEW\n')]
  }), /bounded 2-file review limit/)
  const big = 'X'.repeat(OPERATOR_PREVIEW_MAX_TOTAL_BYTES + 100) + '\n'
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', big)]
  }), /bounded 8KiB review limit/)
  // A same-length large replacement changes EVERY byte, not zero bytes. Its
  // equal before/after size must not bypass the review budget.
  const sameSizeBefore = 'A'.repeat(OPERATOR_PREVIEW_MAX_TOTAL_BYTES + 1)
  const sameSizeAfter = 'B'.repeat(OPERATOR_PREVIEW_MAX_TOTAL_BYTES + 1)
  writeFileSync(join(root, 'equal-size.txt'), sameSizeBefore)
  chmodSync(join(root, 'equal-size.txt'), 0o600)
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('equal-size.txt', sameSizeBefore, sameSizeAfter)]
  }), /bounded 8KiB review limit/)
  // Two individually modest changes must not add up beyond the total budget.
  const modestBefore = 'A'.repeat(5 * 1024)
  const modestAfter = 'B'.repeat(5 * 1024)
  writeFileSync(join(root, 'second.txt'), modestBefore)
  chmodSync(join(root, 'second.txt'), 0o600)
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [modifyChange('a.txt', 'A\n', modestAfter), modifyChange('second.txt', modestBefore, modestAfter)]
  }), /bounded 8KiB review limit/)
  // The refusals left no preview or capability file behind.
  assert.equal(readdirSync(journal).filter(f => f.startsWith('preview-') || f.startsWith('cap-')).length, 0)
}))

test('deletions are refused in the operator preview: no destructive Apply without a rollback path', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [{ path: 'a.txt', action: 'delete', beforeSha256: sha('A\n'), afterSha256: null,
      beforeBytes: 2, afterBytes: null, beforeMode: 0o600, afterMode: null }]
  }), /refuses deletions/)
}))

test('root replaced at the same path (deterministic ABA) invalidates preview, issue AND the already-issued capability', async () => fixture(async ({ base, journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const fingerprint = operatorProjectFingerprint(reg.get(PROJECT_ID))
  const flow = fullFlow({ registry: reg, journal, root, helperBinary,
    changes: [modifyChange('a.txt', 'A\n', 'B\n')], afterImages: { 'a.txt': bytes('B\n') } })
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'B\n')
  const registered = lstatSync(root)
  const tombstone = join(base, 'old-registered-root')
  renameSync(root, tombstone) // keep the OLD inode live: deterministic ABA (no Linux inode-reuse games)
  mkdirSync(root, { mode: 0o700 }); writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  assert.notDeepEqual([lstatSync(root).dev, lstatSync(root).ino], [registered.dev, registered.ino])
  // A NEW preview on the stale registry fails the registration identity gate.
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'C\n')]
  }), /identity changed/)
  // The already-issued capability is bound to the OLD root dev+ino: the driver's own
  // root-identity check refuses it; the connector's preview-binding check refuses rebinding.
  assert.throws(() => issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: flow.built.previewFile, reviewFile: flow.review.reviewFile, env: ENABLED
  }), /identity changed/)
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: flow.issued.capabilityFile,
    action: 'apply', plan: flow.built.plan, projectId: PROJECT_ID, rootFingerprint: fingerprint
  }), /Registered project root identity changed since the capability was issued/)
  assert.throws(() => runNativeRealApply({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: flow.issued.capabilityFile, action: 'apply', plan: flow.built.plan,
    projectId: PROJECT_ID, rootFingerprint: fingerprint,
    change: flow.built.plan.changes[0], afterImage: bytes('B\n')
  }), /Registered project root identity changed/)
  // The stale capability must not be consumable; nothing mutated the replacement root.
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n')
}))

test('re-registration never rebinds the old preview: stale ticket/fingerprint/capability require a fresh review', async () => fixture(async ({ base, projects, journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const registered = lstatSync(root)
  const tombstone = join(base, 'old-registered-root')
  renameSync(root, tombstone)
  mkdirSync(root, { mode: 0o700 }); writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  assert.notDeepEqual([lstatSync(root).dev, lstatSync(root).ino], [registered.dev, registered.ino])
  // The operator RE-REGISTERS the replacement (docs/020): a NEW registry instance with the
  // same id and the SAME path-only fingerprint. The OLD preview must never be rebound.
  const reRegistered = new LocalProjectRegistry([projects], [{ id: PROJECT_ID, root, kind: 'local' }])
  assert.equal(operatorProjectFingerprint(reRegistered.get(PROJECT_ID)),
    operatorProjectFingerprint(reg.get(PROJECT_ID)), 'path fingerprint alone cannot see the ABA')
  assert.throws(() => issueOperatorCapability({
    registry: reRegistered, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  }), /superseded registration; re-preview required/)
  // A fresh preview on the NEW registration works and binds the NEW identities.
  const fresh = buildOperatorApplyPreview({
    registry: reRegistered, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  assert.deepEqual([fresh.preview.identity.dev, fresh.preview.identity.ino],
    [lstatSync(root).dev, lstatSync(root).ino])
  const freshReview = recordOperatorReview({ journalDirectory: journal, previewFile: fresh.previewFile,
    confirmedPlanDigest: fresh.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reRegistered, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: fresh.previewFile, reviewFile: freshReview.reviewFile, env: ENABLED
  })
  const executed = executeOperatorApply({
    registry: reRegistered, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: fresh.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: ENABLED
  })
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'B\n')
  assert.equal(existsSync(executed.consumedMarker), true)
}))

test('ancestor identity change above the pinned root fails the preview closed even when the root inode is moved back', async () => fixture(async ({ base, projects, journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const priorParent = lstatSync(projects), priorRoot = lstatSync(root)
  const tombstone = join(base, 'old-registered-ancestor')
  renameSync(projects, tombstone)
  mkdirSync(projects, { mode: 0o700 })
  renameSync(join(tombstone, 'doc'), root) // root inode UNCHANGED; ancestor identity changed
  assert.deepEqual([lstatSync(root).dev, lstatSync(root).ino], [priorRoot.dev, priorRoot.ino])
  assert.notDeepEqual([lstatSync(projects).dev, lstatSync(projects).ino], [priorParent.dev, priorParent.ino])
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  }), /ancestor identity changed/)
}))

test('forged capability (plausible file, tampered plan digest) is refused before any mutation', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const flow = fullFlow({ registry: reg, journal, root, helperBinary,
    changes: [modifyChange('a.txt', 'A\n', 'B\n')], afterImages: { 'a.txt': bytes('B\n') } })
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'B\n')
  // Same-UID adversary forges a second capability file with tampered bindings.
  const forged = join(journal, 'cap-forged-capability-x.json')
  const original = JSON.parse(readFileSync(flow.issued.capabilityFile, 'utf8'))
  writeFileSync(forged, JSON.stringify({ ...original, capabilityId: 'cap-forged-capability-x',
    transactionId: 'tx-forged-transaction', planDigest: sha('adversary-forged-context'),
    issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() }) + '\n')
  chmodSync(forged, 0o600)
  const preview = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'B\n', 'C\n')]
  })
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: forged, previewFile: preview.previewFile,
    afterImages: { 'a.txt': bytes('C\n') }, env: ENABLED
  }), /Capability plan digest binding mismatch/)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'B\n', 'the forged grant mutated nothing')
  // A hardlinked "forged" copy of a valid capability file is refused by the driver too.
  const linked = join(journal, 'cap-hardlinked-copy.json')
  linkSync(flow.issued.capabilityFile, linked)
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: linked, action: 'apply',
    plan: flow.built.plan, projectId: PROJECT_ID,
    rootFingerprint: operatorProjectFingerprint(reg.get(PROJECT_ID))
  }), /must not be hardlinked/)
}))

test('expired capability refuses execution with no silent retry', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, ttlSeconds: 1, env: ENABLED
  })
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: ENABLED,
    now: () => Date.now() + 10_000
  }), /Expired real Apply capability; no silent retry/)
  // The expiry refusal must not have consumed or mutated anything.
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n')
  assert.equal(existsSync(join(journal, 'consumed-' + issued.capability.capabilityId)), false)
}))

test('consumed-on-use: the one-use capability cannot be executed twice, and a rejected execution stays consumed', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const flow = fullFlow({ registry: reg, journal, root, helperBinary,
    changes: [modifyChange('a.txt', 'A\n', 'B\n')], afterImages: { 'a.txt': bytes('B\n') } })
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: flow.issued.capabilityFile, previewFile: flow.built.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: ENABLED
  }), /already consumed; no silent retry/)
  // Adversarial REJECT path: a writer raced between issue and execute.
  const built2 = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [addChange('gone.txt', 'X\n')]
  })
  const review2 = recordOperatorReview({ journalDirectory: journal, previewFile: built2.previewFile,
    confirmedPlanDigest: built2.preview.planDigest })
  const issued2 = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built2.previewFile, reviewFile: review2.reviewFile, env: ENABLED
  })
  writeFileSync(join(root, 'gone.txt'), 'SOMEONE ELSE\n') // same-UID writer raced between issue and execute
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued2.capabilityFile, previewFile: built2.previewFile,
    afterImages: { 'gone.txt': bytes('X\n') }, env: ENABLED
  }), /already exists; refuse to clobber/)
  assert.equal(existsSync(join(journal, 'consumed-' + issued2.capability.capabilityId)), true,
    'consumed marker is durable BEFORE the helper runs; a REJECT can never be silently retried')
}))

test('Worker context must never invoke Apply; the flag stays default OFF', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  assert.equal(realApplyOperatorEnabled({}), false, 'default OFF')
  assert.equal(realApplyOperatorEnabled({ [REAL_APPLY_OPERATOR_FLAG]: '0' }), false)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  assert.throws(() => issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: {}
  }), /disabled/)
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages: { 'a.txt': bytes('B\n') },
    env: { ...ENABLED, [WORKER_SESSION_MARKER]: 'ticket-1' }
  }), /Worker process must never invoke real Apply/)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n', 'nothing executed')
}))

test('writer-quiescence gate: a same-UID external writer between preview and issue forces a fresh review', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  writeFileSync(join(root, 'a.txt'), 'WRITTEN BY SOMEONE ELSE\n') // same-UID external writer
  assert.throws(() => issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  }), /External writer moved the target since the preview; review again \(quiescence gate\)/)
  assert.equal(readdirSync(journal).filter(f => f.startsWith('cap-')).length, 0,
    'the gate refuses BEFORE any capability exists')
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'WRITTEN BY SOMEONE ELSE\n',
    'the gate is read-only; it does not restore or overwrite anything')
}))

test('ACL/xattr/flags/hardlink/symlink/mode targets are refused BEFORE any capability is issued', async () => fixture(async ({ base, journal, root, helperBinary, registry }) => {
  const reg = registry()
  // unknown xattr
  writeFileSync(join(root, 'xattr.txt'), 'A\n'); chmodSync(join(root, 'xattr.txt'), 0o600)
  const setter = buildXattrSetter(base)
  const wrote = spawnSync(setter, [join(root, 'xattr.txt')], { encoding: 'utf8', timeout: 5_000 })
  assert.equal(wrote.status, 0)
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('xattr.txt', 'A\n', 'B\n')]
  }), /Native inspect rejected: REJECT target-xattr/)
  // special flags (macOS UF_* via chflags; the helper refuses any st_flags)
  writeFileSync(join(root, 'locked.txt'), 'A\n'); chmodSync(join(root, 'locked.txt'), 0o600)
  const flags = spawnSync('chflags', ['uchg', join(root, 'locked.txt')], { encoding: 'utf8', timeout: 5_000 })
  if (flags.status === 0) {
    assert.throws(() => buildOperatorApplyPreview({
      registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
      sourceRevision: REVISION, changes: [modifyChange('locked.txt', 'A\n', 'B\n')]
    }), /Native inspect rejected: REJECT target-flags/)
    spawnSync('chflags', ['nouchg', join(root, 'locked.txt')], { timeout: 5_000 })
  }
  // hardlink
  writeFileSync(join(root, 'hard.txt'), 'A\n'); chmodSync(join(root, 'hard.txt'), 0o600)
  linkSync(join(root, 'hard.txt'), join(root, 'hard-twin.txt'))
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('hard.txt', 'A\n', 'B\n')]
  }), /Native inspect rejected: REJECT target-hardlinked/)
  // symlinked path component
  mkdirSync(join(root, 'realdir'))
  writeFileSync(join(root, 'realdir', 'leaf.txt'), 'A\n'); chmodSync(join(root, 'realdir', 'leaf.txt'), 0o600)
  symlinkSync('realdir', join(root, 'linkdir'))
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('linkdir/leaf.txt', 'A\n', 'B\n')]
  }), /Native inspect rejected: REJECT symlink-component/)
  // group/world-writable mode outside the narrow range
  writeFileSync(join(root, 'loose.txt'), 'A\n'); chmodSync(join(root, 'loose.txt'), 0o666)
  assert.throws(() => buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('loose.txt', 'A\n', 'B\n')]
  }), /Native inspect rejected: REJECT target-unsafe-mode/)
  // All refusals are read-only: no capability exists, the xattr target is untouched.
  assert.equal(readdirSync(journal).filter(f => f.startsWith('cap-')).length, 0)
  assert.equal(readFileSync(join(root, 'xattr.txt'), 'utf8'), 'A\n')
}))

test('crash-injection recovery matrix stays read-only: staged crash → PREPARED_CRASH, untouched sibling → PREPARED_CRASH, foreign state → AMBIGUOUS durable freeze (never auto-cleared or auto-retried)', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'ALPHA ORIGINAL\n'); chmodSync(join(root, 'a.txt'), 0o600)
  writeFileSync(join(root, 'b.txt'), 'BETA ORIGINAL\n'); chmodSync(join(root, 'b.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [modifyChange('a.txt', 'ALPHA ORIGINAL\n', 'ALPHA REVIEWED\n'),
      modifyChange('b.txt', 'BETA ORIGINAL\n', 'BETA REVIEWED\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  const capability = issued.capability
  const observed = inspectNativeTarget({ helperBinary, projectRoot: root, relativePath: 'a.txt',
    expectedRootDev: capability.rootDev, expectedRootIno: capability.rootIno })
  // Drive the helper directly for one change with crash injection after the 'staged' step.
  const txDir = nativeTransactionDirectory(journal, capability, 'a.txt')
  mkdirSync(txDir, { mode: 0o700 })
  writeFileSync(join(txDir, 'after.bin'), 'ALPHA REVIEWED\n'); chmodSync(join(txDir, 'after.bin'), 0o600)
  const spec = [
    'kind=apply', 'root=' + root, 'exp_dev=' + capability.rootDev, 'exp_ino=' + capability.rootIno,
    'transaction_id=' + capability.transactionId, 'nonce=' + capability.nonce,
    'capability_id=' + capability.capabilityId, 'plan_digest=' + capability.planDigest,
    'tx_dir=' + txDir, 'path=a.txt', 'action=modify',
    'before_sha256=' + sha('ALPHA ORIGINAL\n'), 'before_bytes=' + observed.bytes,
    'before_mode=' + observed.mode, 'before_mtime_sec=' + observed.mtimeSec,
    'before_mtime_nsec=' + observed.mtimeNsec,
    'after_sha256=' + sha('ALPHA REVIEWED\n'), 'after_bytes=15', 'after_mode=384',
    'after_image=after.bin', 'stop_after=staged'
  ].join('\n') + '\n'
  const seen = await crashAtStep(helperBinary, spec, 'staged')
  assert.ok(seen.includes('STEP staged'))
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'ALPHA ORIGINAL\n', 'crash before rename left the preimage intact')
  // Read-only classification of the WHOLE plan (a.txt crashed mid-flight, b.txt never attempted).
  const matrix = classifyOperatorApplyRecovery({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: issued.capabilityFile, plan: built.plan,
    projectId: PROJECT_ID, rootFingerprint: capability.rootFingerprint
  })
  assert.equal(matrix.length, 2)
  assert.deepEqual(matrix.map(m => m.path), ['a.txt', 'b.txt'])
  assert.equal(matrix[0].classification, 'PREPARED_CRASH')
  assert.match(matrix[0].stdout, /staged=present/)
  assert.equal(matrix[1].classification, 'PREPARED_CRASH') // b.txt untouched: still matches its before-image
  assert.equal(matrix[0].freezeMarker, undefined, 'PREPARED_CRASH never freezes')
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'ALPHA ORIGINAL\n', 'classification repaired nothing')
  // Foreign state (matches neither image) → AMBIGUOUS + durable freeze, stable on re-run.
  writeFileSync(join(root, 'a.txt'), 'SOMEONE ELSE WROTE THIS\n')
  const ambiguous = classifyNativeRealApplyRecovery({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: issued.capabilityFile, plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, change: built.plan.changes[0]
  })
  assert.equal(ambiguous.classification, 'AMBIGUOUS')
  assert.ok(ambiguous.freezeMarker && existsSync(ambiguous.freezeMarker), 'freeze is durable')
  // A frozen transaction is never auto-retried: any capability on that transaction id
  // refuses until a human reconciles; the classifier never clears or replays the freeze.
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
    rootFingerprint: capability.rootFingerprint, change: built.plan.changes[0]
  })
  assert.equal(again.classification, 'AMBIGUOUS', 'reclassification is read-only and stable')
  assert.ok(existsSync(ambiguous.freezeMarker), 'the freeze marker survives; nothing cleaned it')
}))

test('crash after the written step classifies as APPLIED (durable journal survives the kill)', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  const capability = issued.capability
  const observed = inspectNativeTarget({ helperBinary, projectRoot: root, relativePath: 'a.txt',
    expectedRootDev: capability.rootDev, expectedRootIno: capability.rootIno })
  const txDir = nativeTransactionDirectory(journal, capability, 'a.txt')
  mkdirSync(txDir, { mode: 0o700 })
  writeFileSync(join(txDir, 'after.bin'), 'B\n'); chmodSync(join(txDir, 'after.bin'), 0o600)
  const spec = [
    'kind=apply', 'root=' + root, 'exp_dev=' + capability.rootDev, 'exp_ino=' + capability.rootIno,
    'transaction_id=' + capability.transactionId, 'nonce=' + capability.nonce,
    'capability_id=' + capability.capabilityId, 'plan_digest=' + capability.planDigest,
    'tx_dir=' + txDir, 'path=a.txt', 'action=modify',
    'before_sha256=' + sha('A\n'), 'before_bytes=' + observed.bytes, 'before_mode=' + observed.mode,
    'before_mtime_sec=' + observed.mtimeSec, 'before_mtime_nsec=' + observed.mtimeNsec,
    'after_sha256=' + sha('B\n'), 'after_bytes=2', 'after_mode=384',
    'after_image=after.bin', 'stop_after=written'
  ].join('\n') + '\n'
  const seen = await crashAtStep(helperBinary, spec, 'written')
  assert.ok(seen.includes('STEP written'), 'the rename happened before the kill')
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'B\n')
  const classification = classifyNativeRealApplyRecovery({
    helperBinary, journalDirectory: journal, projectRoot: root,
    capabilityFile: issued.capabilityFile, plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, change: built.plan.changes[0]
  })
  assert.equal(classification.classification, 'APPLIED')
  assert.equal(classification.freezeMarker, undefined)
}))

test('rollback is a SEPARATE one-use capability and restores exact bytes+mode from the fsync’d backups', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'ALPHA ORIGINAL\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const flow = fullFlow({ registry: reg, journal, root, helperBinary,
    changes: [modifyChange('a.txt', 'ALPHA ORIGINAL\n', 'ALPHA REVIEWED\n'), addChange('new.txt', 'NEW FILE\n')],
    afterImages: { 'a.txt': bytes('ALPHA REVIEWED\n'), 'new.txt': bytes('NEW FILE\n') } })
  assert.equal(readFileSync(join(root, 'new.txt'), 'utf8'), 'NEW FILE\n')

  const rollback = buildOperatorRollbackPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    originalPreviewFile: flow.built.previewFile, originalCapabilityFile: flow.issued.capabilityFile
  })
  assert.deepEqual(rollback.rollbackPlan.changes.map(c => [c.path, c.action]),
    [['a.txt', 'modify'], ['new.txt', 'delete']], 'rollback inverts the reviewed plan exactly')
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: rollback.previewFile,
    confirmedPlanDigest: rollback.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: rollback.previewFile, reviewFile: review.reviewFile,
    action: 'rollback', rollbackOfTransactionId: flow.issued.capability.transactionId, env: ENABLED
  })
  assert.equal(issued.capability.action, 'rollback')
  assert.notEqual(issued.capability.capabilityId, flow.issued.capability.capabilityId,
    'rollback is a SEPARATE capability, never a reuse of the apply grant')
  assert.equal(issued.capability.rollbackOfTransactionId, flow.issued.capability.transactionId)

  const executed = executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: rollback.previewFile, action: 'rollback',
    afterImages: rollback.rollbackAfterImages, env: ENABLED
  })
  assert.equal(executed.capability.capabilityId, issued.capability.capabilityId)
  // Exact bytes+mode restoration: a.txt back to the ORIGINAL preimage, new.txt gone.
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'ALPHA ORIGINAL\n')
  assert.equal(lstatSync(join(root, 'a.txt')).mode & 0o777, 0o600)
  assert.equal(sha(readFileSync(join(root, 'a.txt'))), sha('ALPHA ORIGINAL\n'))
  assert.equal(existsSync(join(root, 'new.txt')), false)
  assert.equal(existsSync(join(journal, 'consumed-' + issued.capability.capabilityId)), true)
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: rollback.previewFile, action: 'rollback',
    afterImages: rollback.rollbackAfterImages, env: ENABLED
  }), /already consumed; no silent retry/)
}))

test('rollback refuses a target that drifted from the applied after-image (exact bytes+mode check)', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'ALPHA ORIGINAL\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const flow = fullFlow({ registry: reg, journal, root, helperBinary,
    changes: [modifyChange('a.txt', 'ALPHA ORIGINAL\n', 'ALPHA REVIEWED\n')],
    afterImages: { 'a.txt': bytes('ALPHA REVIEWED\n') } })
  writeFileSync(join(root, 'a.txt'), 'WRITTEN AFTER APPLY\n') // same-UID writer moved the applied file
  assert.throws(() => buildOperatorRollbackPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    originalPreviewFile: flow.built.previewFile, originalCapabilityFile: flow.issued.capabilityFile
  }), /no longer matches the applied after-image bytes\+mode; refuse/)
}))

test('tampered after-image bytes at execution are refused before the helper spawns (digest binding)', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes: [modifyChange('a.txt', 'A\n', 'B\n')]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages: { 'a.txt': bytes('TAMPERED\n') }, env: ENABLED
  }), /after-image does not match the reviewed plan digest/)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n')
  assert.equal(existsSync(join(journal, 'consumed-' + issued.capability.capabilityId)), false,
    'refused BEFORE the capability was consumed')
}))
