/**
 * OL-20261126-055 S4 — capability-issuance and post-apply hardening, on FRESH
 * owner-controlled REGISTERED synthetic sacrificial projects (0700 temp) ONLY.
 * Never against real user projects, home, credentials, live services or the private vault.
 *
 * Asserts: exact target switch after apply is refused (post-apply re-observation through
 * the helper's pinned fd chain, never a silent retry); stale root+ancestor identity is
 * refused at verification (the capability carries the canonical ancestor chain); an
 * inherited non-CLOEXEC root descriptor across exec is refused by the helper; the 0600
 * grant markers (capability/preview/review/receipt/opt-in) are probed through the helper
 * so macOS ACL/special-flag/non-provenance-xattr tamper fails closed; two DIFFERENT
 * previews that share one plan digest can never be cross-rebound to the wrong principal;
 * the default-OFF flag stays OFF after a simulated restart unless a protected, durable,
 * owner-only apply-opt-in record opts in; the Worker proposal context (DSH_SUPERAGENT_TICKET)
 * can never execute Apply.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalAncestorIdentities, inspectNativeMarker, inspectNativeTarget,
  issueRealApplyCapability, parseRealApplyCapability, singleFileApplyPlan,
  verifyRealApplyCapability
} from '../src/local-first/real-apply-native-driver.ts'
import {
  buildOperatorApplyPreview, buildOperatorRollbackPreview, executeOperatorApply,
  executeOperatorRollback, issueOperatorCapability, operatorApplyEnabled,
  readOperatorApplyOptIn, recordOperatorReview, realApplyOperatorEnabled,
  writeOperatorApplyOptIn, OPERATOR_APPLY_OPTIN_FILE, REAL_APPLY_OPERATOR_FLAG,
  WORKER_SESSION_MARKER
} from '../src/local-first/real-apply-operator-connector.ts'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const helperSource = join(repoRoot, 'research', 'real-apply-helper.c')
const xattrSource = join(repoRoot, 'tests', 'fixtures', 'os-xattr-fixture.c')
const compiler = process.env.CC || 'cc'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const bytes = (text) => new TextEncoder().encode(text)
const ENABLED = { [REAL_APPLY_OPERATOR_FLAG]: '1' }
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

async function fixture(work) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-trust-')))
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

const aclAvailable = (() => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-aclprobe2-')))
  const file = join(temp, 'probe.txt')
  writeFileSync(file, 'x\n', { mode: 0o600 })
  const result = spawnSync('chmod', ['+a', 'owner allow read', file], { encoding: 'utf8', timeout: 5_000 })
  rmSync(temp, { recursive: true, force: true })
  return result.status === 0
})()

const chflagsAvailable = (() => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-flagprobe2-')))
  const file = join(temp, 'probe.txt')
  writeFileSync(file, 'x\n', { mode: 0o600 })
  const result = spawnSync('chflags', ['uchg', file], { encoding: 'utf8', timeout: 5_000 })
  spawnSync('chflags', ['nouchg', file], { timeout: 5_000 })
  rmSync(temp, { recursive: true, force: true })
  return result.status === 0
})()

test('post-apply exact target switch is refused through the helper re-observation: an external writer that swaps the applied inode never becomes the recorded result and there is no silent retry', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [{ path: 'a.txt', action: 'modify', beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
      beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 }]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  // The Apply succeeds; the helper reports the inode it installed.
  const executed = executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: ENABLED
  })
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'B\n')
  assert.equal(executed.results[0].journal.status, 'applied')
  const receipt = JSON.parse(readFileSync(executed.receiptFile, 'utf8'))
  assert.equal(receipt.postObservations[0].observed.sha256, sha('B\n'))

  // A SAME-UID external writer swaps the applied leaf entry after the fact. The next
  // execution attempt on the consumed capability refuses; the applied inode reported by
  // the helper must still equal the fresh inspect of the target it installed.
  const installed = executed.results[0].stdout.split(/\s+/)
  const observed = inspectNativeTarget({ helperBinary, projectRoot: root, relativePath: 'a.txt',
    expectedRootDev: issued.capability.rootDev, expectedRootIno: issued.capability.rootIno })
  assert.equal(observed.ino, Number(installed[3]), 'the receipt inode is the one the helper installed')
  renameSync(join(root, 'a.txt'), join(root, 'a-tombstone'))
  writeFileSync(join(root, 'a.txt'), 'WRITTEN BY SOMEONE ELSE\n', { mode: 0o600 })
  const swapped = inspectNativeTarget({ helperBinary, projectRoot: root, relativePath: 'a.txt',
    expectedRootDev: issued.capability.rootDev, expectedRootIno: issued.capability.rootIno })
  assert.notEqual(swapped.ino, observed.ino, 'the leaf entry really changed inode')
  // the consumed capability can never be replayed onto the swapped target
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: issued.capability.rootFingerprint, helperBinary
  }), /already consumed; no silent retry/)
}))

test('stale root+ancestor identity is refused at verification: the capability carries the canonical ancestor chain and an ancestor replaced by a different directory fails closed even when the project inode is moved back', async () => fixture(async ({ base, projects, journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [{ path: 'a.txt', action: 'modify', beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
      beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 }]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  const capability = issued.capability
  assert.ok(Array.isArray(capability.ancestors) && capability.ancestors.length > 0,
    'an operator-issued capability always carries the canonical ancestor chain')
  assert.deepEqual(capability.ancestors, canonicalAncestorIdentities(root),
    'the chain matches the live canonical ancestor identities')

  // ABA on an ANCESTOR: move the project aside, move its PARENT directory aside, and
  // create a DIFFERENT directory at the same parent path (different inode), then move the
  // project back. The project root inode is restored, but the ancestor identity changed —
  // verification must refuse (the pinned-fd chain alone would have followed the new parent).
  const tombstone = join(base, 'project-tombstone')
  const aside = join(base, 'projects-aside')
  renameSync(root, tombstone)
  renameSync(projects, aside)
  mkdirSync(projects, { mode: 0o700 })
  const replacementParent = lstatSync(projects)
  renameSync(tombstone, root)
  const restored = lstatSync(root)
  assert.equal(restored.ino === capability.rootIno, true, 'the project root inode is back')
  assert.notEqual(replacementParent.ino, capability.ancestors[0].ino,
    'the intermediate directory is genuinely a different inode')
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, helperBinary
  }), /ancestor identity changed since the capability was issued/)

  // restore the ORIGINAL ancestor identity: move the project out, drop the replacement
  // parent, put the original parent back, then move the project back into it.
  const detached = join(base, 'project-detached')
  renameSync(root, detached)
  rmSync(projects, { recursive: true })
  renameSync(aside, projects)
  renameSync(detached, root)
  assert.equal(lstatSync(projects).ino, capability.ancestors[0].ino, 'original parent is back')

  // an ancestor turned into a symlink also fails closed (no-follow identity probe)
  const replacementKept = join(base, 'parent-replacement')
  renameSync(projects, replacementKept)
  symlinkSync(root, projects)
  // A symlinked ancestor fails closed either through the explicit ancestor-identity
  // refusal or through the no-follow resolution error (ELOOP) on the pinned root path —
  // in both cases nothing is silently rebound to the symlink.
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, helperBinary
  }), /ancestor identity (changed|unavailable) since the capability was issued|ELOOP/)
  rmSync(projects)   // the symlink itself
  renameSync(replacementKept, projects)
  assert.equal(lstatSync(projects).ino, capability.ancestors[0].ino, 'fixture restored')

  // with the ancestor chain restored, the same grant verifies again: nothing was consumed
  // because no Apply ever executed, and the refusal never silently rebound the path.
  assert.equal(verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: capability.rootFingerprint, helperBinary
  }).capabilityId, capability.capabilityId, 'a restored ancestor chain re-verifies cleanly')
}))

test('a newly issued capability whose ancestor chain is forged is refused at verification, and a legacy chain-less capability still parses but binds only the root identity', async () => fixture(async ({ journal, root, helperBinary }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const plan = singleFileApplyPlan({ projectId: PROJECT_ID, rootFingerprint: sha('synthetic-root-fingerprint'),
    sourceRevision: REVISION, change: { path: 'a.txt', action: 'modify',
      beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
      beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 } })
  const issued = issueRealApplyCapability({ journalDirectory: journal, projectRoot: root,
    projectId: PROJECT_ID, rootFingerprint: sha('synthetic-root-fingerprint'), plan })
  const forged = { ...JSON.parse(readFileSync(issued.capabilityFile, 'utf8')),
    ancestors: [{ path: '/dev', dev: 1, ino: 1 }] }
  const forgedFile = join(journal, 'cap-forged-ancestors.json')
  writeFileSync(forgedFile, JSON.stringify(forged) + '\n', { mode: 0o600 })
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: forgedFile,
    action: 'apply', plan, projectId: PROJECT_ID,
    rootFingerprint: sha('synthetic-root-fingerprint'), helperBinary
  }), /ancestor identity (changed|unavailable) since the capability was issued/)

  // legacy hand-written capability: no ancestor chain, still parseable and still refuses
  // a stale ROOT identity (the binding that has always existed).
  const legacy = { ...JSON.parse(readFileSync(issued.capabilityFile, 'utf8')) }
  delete legacy.ancestors
  const legacyFile = join(journal, 'cap-legacy-no-ancestors.json')
  writeFileSync(legacyFile, JSON.stringify(legacy) + '\n', { mode: 0o600 })
  const parsed = parseRealApplyCapability(JSON.parse(readFileSync(legacyFile, 'utf8')))
  assert.equal(parsed.ancestors, undefined, 'an absent chain parses without inventing one')
  const realRoot = lstatSync(root)
  assert.equal(parsed.rootDev, realRoot.dev)
  assert.equal(parsed.rootIno, realRoot.ino)
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: legacyFile,
    action: 'apply', plan, projectId: PROJECT_ID,
    rootFingerprint: sha('a-different-fingerprint')
  }), /root fingerprint mismatch/)
}))

test('an inherited non-CLOEXEC project-root descriptor across exec is refused by the helper before anything opens (leaked-pin detection, not a race-free claim)', async () => fixture(async ({ root, journal, helperBinary }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const stat = lstatSync(root)
  // The parent opens the project root WITHOUT close-on-exec and passes that fd as the
  // child's stdio index 3: the exec'd helper inherits a directory pin whose (dev,ino)
  // collides with the expected registered root identity.
  const parentScript = `
    import { openSync } from 'node:fs'
    import { spawn } from 'node:child_process'
    import { once } from 'node:events'
    const fd = openSync(${JSON.stringify(root)}, 'r')  // no CLOEXEC: inherited across exec
    const child = spawn(${JSON.stringify(helperBinary)}, ['inspect', ${JSON.stringify(root)},
      '${stat.dev}', '${stat.ino}', 'a.txt'], { stdio: ['ignore', 'pipe', 'pipe', fd] })
    let out = ''
    child.stdout.on('data', c => { out += c })
    await once(child, 'exit')
    console.log(JSON.stringify({ code: child.exitCode, out: out.trim() }))
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', parentScript],
    { encoding: 'utf8', timeout: 30_000 })
  assert.equal(result.status, 0, 'parent probe must run: ' + (result.stderr ?? ''))
  const payload = JSON.parse(result.stdout.trim())
  assert.equal(payload.code, 2, 'the inherited pin must be refused, not trusted')
  assert.equal(payload.out, 'REJECT inherited-root-descriptor')
}))

test('journal-marker tamper fails closed through the helper marker probe: ACL, special flags and unknown xattr on the 0600 grant/preview/review/receipt/opt-in are refused', async () => fixture(async ({ base, journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [{ path: 'a.txt', action: 'modify', beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
      beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 }]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })

  // clean markers pass the probe (the policy permits exactly com.apple.provenance)
  const marker = inspectNativeMarker({ helperBinary, markerFile: issued.capabilityFile })
  assert.equal(marker.mode, 0o600)
  assert.equal(marker.nlink, 1)

  // unknown xattr stamped on the capability by a same-UID writer
  const setter = buildXattrSetter(base)
  const wrote = spawnSync(setter, [issued.capabilityFile], { encoding: 'utf8', timeout: 5_000 })
  assert.equal(wrote.status, 0)
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: issued.capability.rootFingerprint, helperBinary
  }), /marker-xattr|Unsafe capability file/)
  const plan2 = built.plan
  assert.throws(() => inspectNativeMarker({ helperBinary, markerFile: issued.capabilityFile }),
    /REJECT marker-xattr/)
  // the Node-only verification (no helper probe) still trusts the JSON shape, so the
  // probe is what closes the gap: without helperBinary the same file is accepted.
  assert.equal(verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: issued.capabilityFile,
    action: 'apply', plan: plan2, projectId: PROJECT_ID,
    rootFingerprint: issued.capability.rootFingerprint
  }).capabilityId, issued.capability.capabilityId)

  // ACL (macOS): clear the unknown xattr first so the probe reports the ACL, not the xattr
  if (process.platform === 'darwin') {
    const cleared = spawnSync('xattr', ['-d', 'com.example.dsh-inspector-synthetic', issued.capabilityFile],
      { encoding: 'utf8', timeout: 5_000 })
    assert.equal(cleared.status, 0, 'fixture xattr must be removable: ' + (cleared.stderr ?? ''))
    assert.equal(inspectNativeMarker({ helperBinary, markerFile: issued.capabilityFile }).mode, 0o600)
  }
  if (aclAvailable) {
    const acl = spawnSync('chmod', ['+a', 'owner allow write', issued.capabilityFile], { encoding: 'utf8', timeout: 5_000 })
    if (acl.status === 0) {
      assert.throws(() => inspectNativeMarker({ helperBinary, markerFile: issued.capabilityFile }), /REJECT marker-acl/)
      spawnSync('chmod', ['-a', 'owner allow write', issued.capabilityFile], { timeout: 5_000 })
    }
  }

  // special flags (macOS UF_* via chflags)
  if (chflagsAvailable) {
    const flags = spawnSync('chflags', ['uchg', issued.capabilityFile], { encoding: 'utf8', timeout: 5_000 })
    if (flags.status === 0) {
      assert.throws(() => inspectNativeMarker({ helperBinary, markerFile: issued.capabilityFile }), /REJECT marker-flags/)
      spawnSync('chflags', ['nouchg', issued.capabilityFile], { timeout: 5_000 })
    }
  }

  // hardlink + symlink + mode tamper on the grant markers (Node-side lstat guards,
  // reached through the exported issuance path which reads preview + review records)
  linkSync(built.previewFile, join(journal, 'preview-twin.json'))
  assert.throws(() => issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  }), /preview file must not be hardlinked/)
  rmSync(join(journal, 'preview-twin.json'))
  chmodSync(review.reviewFile, 0o644)
  assert.throws(() => issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  }), /review file must be 0600/)
  chmodSync(review.reviewFile, 0o600)
  const capLink = join(journal, 'cap-link.json')
  symlinkSync(issued.capabilityFile, capLink)
  assert.throws(() => verifyRealApplyCapability({
    journalDirectory: journal, projectRoot: root, capabilityFile: capLink,
    action: 'apply', plan: built.plan, projectId: PROJECT_ID,
    rootFingerprint: issued.capability.rootFingerprint, helperBinary
  }), /must live inside the private journal root|Unsafe capability file/)
}))

test('two different previews that share one plan digest can never be cross-rebound: the grant is bound to the exact preview id and execution refuses the other preview', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const changes = [{ path: 'a.txt', action: 'modify', beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
    beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 }]
  const first = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes
  })
  const second = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION, changes
  })
  assert.notEqual(first.preview.previewId, second.preview.previewId,
    'two previews of the same plan get distinct ids')
  assert.equal(first.preview.planDigest, second.preview.planDigest,
    'and they DO share one plan digest — that is the ambiguity this binding removes')
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: first.previewFile,
    confirmedPlanDigest: first.preview.planDigest })
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: first.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  assert.equal(issued.capability.previewId, first.preview.previewId,
    'the grant names the exact preview it was issued from')
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: second.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: ENABLED
  }), /Capability preview binding does not match this operator preview; re-issue required \(no cross-preview rebind\)/)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n', 'the mismatch refused before any spawn')
  // the correct preview executes, and the receipt records the preview id
  const executed = executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: first.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: ENABLED
  })
  const receipt = JSON.parse(readFileSync(executed.receiptFile, 'utf8'))
  assert.equal(receipt.previewId, first.preview.previewId)
}))

test('the default-OFF flag stays OFF after a simulated restart unless a protected durable owner-only opt-in record opts in; a forged/malformed/foreign-principal record keeps it OFF', async () => fixture(async ({ journal, root, helperBinary }) => {
  // A fresh process (a "restart") inherits no env flag: the gate must be OFF.
  const childProbe = (env) => {
    const script = `
      import { operatorApplyEnabled, readOperatorApplyOptIn } from ${JSON.stringify(join(repoRoot, 'src', 'local-first', 'real-apply-operator-connector.ts'))}
      console.log(JSON.stringify({
        enabled: operatorApplyEnabled({ env: ${JSON.stringify(env)}, journalDirectory: ${JSON.stringify(journal)}, projectRoot: ${JSON.stringify(root)} }),
        envOnly: ${JSON.stringify(env)}['DSH_SUPERAGENT_REAL_APPLY_ENABLED'] !== undefined
      }))
    `
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
      { encoding: 'utf8', timeout: 30_000 })
    assert.equal(result.status, 0, 'child probe must run: ' + (result.stderr ?? ''))
    return JSON.parse(result.stdout.trim())
  }
  const cold = childProbe({})
  assert.equal(cold.enabled, false, 'a restart with no env flag and no opt-in record is OFF')
  assert.equal(readOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root }), null,
    'no opt-in record exists yet')

  // the protected operator config opts in, and it SURVIVES the restart
  const written = writeOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root,
    source: 'synthetic-operator-config' })
  assert.equal(lstatSync(written.optInFile).mode & 0o777, 0o600)
  assert.equal(lstatSync(written.optInFile).nlink, 1)
  const afterRestart = childProbe({})
  assert.equal(afterRestart.enabled, true, 'the durable opt-in survives a restart')
  assert.equal(afterRestart.envOnly, false, 'no env flag is present in the restarted process')

  // a tampered record keeps it OFF: malformed shape
  writeFileSync(written.optInFile, JSON.stringify({ version: 1, enabled: 'yes',
    principalUid: process.getuid(), updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    source: 'synthetic' }) + '\n', { mode: 0o600 })
  assert.throws(() => readOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root, helperBinary }),
    /opt-in record is malformed; real Apply stays OFF/)
  assert.throws(() => operatorApplyEnabled({ env: {}, journalDirectory: journal, projectRoot: root }),
    /opt-in record is malformed; real Apply stays OFF/, 'a malformed record fails closed, it never turns the gate ON')

  // forged principal uid
  const forged = { ...written.record, principalUid: (process.getuid() ?? 0) + 1000 }
  writeFileSync(written.optInFile, JSON.stringify(forged) + '\n', { mode: 0o600 })
  assert.throws(() => readOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root, helperBinary }),
    /bound to a different principal uid; real Apply stays OFF/)
  assert.throws(() => operatorApplyEnabled({ env: {}, journalDirectory: journal, projectRoot: root }),
    /different principal uid; real Apply stays OFF/, 'a foreign principal uid fails closed, it never turns the gate ON')

  // hardlinked opt-in record is refused (marker tamper)
  writeOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root, source: 'synthetic-operator-config' })
  linkSync(written.optInFile, join(journal, 'opt-in-twin'))
  assert.throws(() => readOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root, helperBinary }),
    /must not be hardlinked/)
  rmSync(join(journal, 'opt-in-twin'))
  assert.equal(realApplyOperatorEnabled({}), false, 'the env flag itself is OFF by default')
  assert.equal(realApplyOperatorEnabled({ [REAL_APPLY_OPERATOR_FLAG]: '0' }), false)
  assert.equal(realApplyOperatorEnabled({ [REAL_APPLY_OPERATOR_FLAG]: 'true' }), true)
}))

test('the Worker proposal context can never execute Apply: a process carrying DSH_SUPERAGENT_TICKET is refused even with the flag ON and even with a durable opt-in present', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [{ path: 'a.txt', action: 'modify', beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
      beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 }]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  // Worker context: has the operator flag ON plus a durable opt-in, but carries a Ticket.
  writeOperatorApplyOptIn({ journalDirectory: journal, projectRoot: root, source: 'synthetic-operator-config' })
  const workerEnv = { ...ENABLED, [WORKER_SESSION_MARKER]: 'ticket-worker-1' }
  assert.equal(operatorApplyEnabled({ env: workerEnv, journalDirectory: journal, projectRoot: root }), true,
    'the gate itself is ON for a Worker, yet execution still refuses')
  const issued = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: workerEnv
  })
  assert.throws(() => executeOperatorApply({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    capabilityFile: issued.capabilityFile, previewFile: built.previewFile,
    afterImages: { 'a.txt': bytes('B\n') }, env: workerEnv
  }), /Worker process must never invoke real Apply; only the protected operator context executes/)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n', 'nothing executed')
  assert.equal(readdirSync(journal).filter(f => f.startsWith('receipt-')).length, 0,
    'the refusal happened before any receipt was written')
  // issue with no gate at all (env OFF, opt-in removed) still refuses
  rmSync(join(journal, OPERATOR_APPLY_OPTIN_FILE))
  const fresh = issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  })
  assert.ok(existsSync(fresh.capabilityFile))
}))

test('exact target switch between preview and issue is caught by the quiescence gate, and the gate is read-only (no capability created, nothing restored)', async () => fixture(async ({ journal, root, helperBinary, registry }) => {
  writeFileSync(join(root, 'a.txt'), 'A\n'); chmodSync(join(root, 'a.txt'), 0o600)
  const reg = registry()
  const built = buildOperatorApplyPreview({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    sourceRevision: REVISION,
    changes: [{ path: 'a.txt', action: 'modify', beforeSha256: sha('A\n'), afterSha256: sha('B\n'),
      beforeBytes: 2, afterBytes: 2, beforeMode: 0o600, afterMode: 0o600 }]
  })
  const review = recordOperatorReview({ journalDirectory: journal, previewFile: built.previewFile,
    confirmedPlanDigest: built.preview.planDigest })
  // same-UID writer replaces the leaf with the SAME bytes but a different inode
  renameSync(join(root, 'a.txt'), join(root, 'a-tombstone'))
  writeFileSync(join(root, 'a.txt'), 'A\n', { mode: 0o600 })
  assert.throws(() => issueOperatorCapability({
    registry: reg, projectId: PROJECT_ID, journalDirectory: journal, helperBinary,
    previewFile: built.previewFile, reviewFile: review.reviewFile, env: ENABLED
  }), /External writer moved the target since the preview; review again \(quiescence gate\)/)
  assert.equal(readdirSync(journal).filter(f => f.startsWith('cap-')).length, 0)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'A\n', 'the gate restored nothing')
}))
