/**
 * OL-20261125-054 — OPERATOR-PRIVATE PREVIEW → REVIEW → ONE-USE CAPABILITY → APPLY → ROLLBACK.
 *
 * This is the product-side connector the lead wires into the operator endpoint. It is a
 * thin, fail-closed orchestration over the OL-053 native driver (real-apply-native-driver.ts)
 * and the pure plan contract (real-apply-contract.ts). It adds:
 *  - a BOUNDED, reviewable preview (≤2 files, ≤8KiB changed total, no deletions) whose
 *    before/after hashes, bytes and modes come from the helper's own read-only `inspect`
 *    over the pinned fd chain (so ACL/xattr/flags/hardlink/symlink refusals happen BEFORE
 *    any capability is issued);
 *  - binding of the CURRENT registered identity (root dev+ino AND canonical ancestor
 *    identities captured at registration) at preview time; a preview/review/capability is
 *    never rebound onto a changed registration or a re-registered project — re-preview
 *    required (docs/020 runbook);
 *  - a durable operator review marker that binds the exact previewed plan digest: the
 *    one-use capability is issued only after that marker exists for this preview;
 *  - a pre-apply external-writer QUIESCENCE gate: every target must be byte-for-byte and
 *    mtime-for-mtime identical to what the operator reviewed when the capability is issued
 *    (and the driver/helper re-verify the preimage again through the same fd before the
 *    rename);
 *  - execution ONLY from a protected operator-owned process context: a Worker session
 *    (which always carries DSH_SUPERAGENT_TICKET in its executor env) must never invoke
 *    Apply — the Worker only proposes the diff;
 *  - a SEPARATE one-use rollback capability with exact bytes+mode verification of the
 *    applied after-image before the rollback is even previewed, restoring the durable
 *    before.bin images that the helper fsync'd into each transaction directory;
 *  - the product Apply path stays default OFF behind DSH_SUPERAGENT_REAL_APPLY_ENABLED
 *    (explicit env gate, opt-in; there is NO generic permission endpoint).
 *
 * Honest limits (see docs/020): the registry identity evidence is read-only registration-
 * time trust, not an authenticated OS capability; the quiescence gate narrows but does not
 * eliminate a non-cooperating same-UID writer between the final preimage verification and
 * renameat; ancestor swap above the pinned root, mounts, and power-loss durability are
 * class-limited residual risks; a same-UID adversary can forge capability files (the 0600
 * owner-only journal + unguessable nonce + consume marker narrow, but do not remove, this).
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspectProposedApplyPlan, type InspectedApplyPlan, type ProposedApplyChange } from './real-apply-contract.ts'
import {
  assertPrivateJournalRoot, classifyNativeRealApplyRecovery, durablePrivateMarker,
  inspectNativeMarker, inspectNativeTarget, issueRealApplyCapability, nativeTransactionDirectory, parseRealApplyCapability,
  readNativeJournal, runNativeRealApplyPlan,
  type ObservedTarget, type RealApplyAction, type RealApplyCapability, type RecoveryClassification
} from './real-apply-native-driver.ts'
import { LocalProjectRegistry, type Project } from './project-registry.ts'

/** Explicit product gate. Default OFF; only flip after the local technical gates pass. */
export const REAL_APPLY_OPERATOR_FLAG = 'DSH_SUPERAGENT_REAL_APPLY_ENABLED'
/** Worker executor marker; a Worker session must never execute real Apply. */
export const WORKER_SESSION_MARKER = 'DSH_SUPERAGENT_TICKET'
/** OL-054 live-canary bound: at most 2 text files, at most 8KiB changed in total. */
export const OPERATOR_PREVIEW_MAX_FILES = 2
export const OPERATOR_PREVIEW_MAX_TOTAL_BYTES = 8 * 1024

const SHA = /^[a-f0-9]{64}$/
const PREVIEW_ID = /^pv-[a-f0-9]{32}$/

export function realApplyOperatorEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[REAL_APPLY_OPERATOR_FLAG]
  return value === '1' || value === 'true'
}

/** Durable protected operator opt-in record, inside the owner-only 0700 journal root.
 * The env flag alone does not survive a restart; this marker is the ONLY thing that keeps
 * real Apply enabled after the operator's process restarts. Strict shape + owner-only file
 * guards fail closed: a forged or malformed marker never enables the product path. */
export const OPERATOR_APPLY_OPTIN_FILE = 'apply-opt-in'
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

export function readOperatorApplyOptIn(input: {
  journalDirectory: string; projectRoot: string; helperBinary?: string
}): Readonly<{ version: 1; enabled: true; principalUid: number; updatedAt: string; source: string }> | null {
  const journalDirectory = assertPrivateJournalRoot(input.journalDirectory, input.projectRoot)
  const file = join(journalDirectory, OPERATOR_APPLY_OPTIN_FILE)
  if (!existsSync(file)) return null
  requirePrivateJournalFile(file, journalDirectory, 'operator apply opt-in')
  if (input.helperBinary) probePrivateJournalMarker(file, 'operator apply opt-in', input.helperBinary)
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  if (raw.version !== 1 || raw.enabled !== true || typeof raw.principalUid !== 'number' ||
    typeof raw.updatedAt !== 'string' || !TIME.test(raw.updatedAt) || typeof raw.source !== 'string')
    throw new Error('Operator apply opt-in record is malformed; real Apply stays OFF')
  const uid = process.getuid?.()
  if (uid === undefined || raw.principalUid !== uid)
    throw new Error('Operator apply opt-in is bound to a different principal uid; real Apply stays OFF')
  return Object.freeze({ version: 1 as const, enabled: true as const,
    principalUid: raw.principalUid, updatedAt: raw.updatedAt, source: raw.source })
}

/** The product gate is ON only if the explicit env flag is set OR a well-formed, owner-only
 * durable opt-in record exists in the private journal (the restart-surviving config). */
export function operatorApplyEnabled(input: {
  env?: NodeJS.ProcessEnv; journalDirectory: string; projectRoot: string; helperBinary?: string
}): boolean {
  if (realApplyOperatorEnabled(input.env ?? process.env)) return true
  return readOperatorApplyOptIn({ journalDirectory: input.journalDirectory, projectRoot: input.projectRoot,
    helperBinary: input.helperBinary }) !== null
}

/** Record the durable opt-in (write-then-rename, fsync of file AND directory). */
export function writeOperatorApplyOptIn(input: {
  journalDirectory: string; projectRoot: string; source: string
}): { optInFile: string; record: Readonly<{ version: 1; enabled: true; principalUid: number; updatedAt: string; source: string }> } {
  const journalDirectory = assertPrivateJournalRoot(input.journalDirectory, input.projectRoot)
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error('Operator apply opt-in requires a local principal uid')
  const record = Object.freeze({ version: 1 as const, enabled: true as const,
    principalUid: uid, updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), source: input.source })
  const optInFile = join(journalDirectory, OPERATOR_APPLY_OPTIN_FILE)
  durablePrivateMarker(optInFile, JSON.stringify(record) + '\n')
  return { optInFile, record }
}

/** Same derivation as project-workspaces.projectFingerprint, kept local so this module
 * does not pull the workspace layer into the operator endpoint's import graph. */
export function operatorProjectFingerprint(project: Project): string {
  return createHash('sha256').update(JSON.stringify([project.id, project.root, project.kind, project.readOnly])).digest('hex')
}

export interface RegisteredIdentityBinding {
  root: string; dev: number; ino: number
  ancestors: ReadonlyArray<{ path: string; dev: number; ino: number }>
}

export interface OperatorPreviewObservation {
  path: string
  state: 'present' | 'missing'
  dev: number; ino: number
  sha256: string; bytes: number; mode: number
  mtimeSec: number; mtimeNsec: number; nlink: number
}

export interface OperatorApplyPreviewRecord {
  version: 1
  previewId: string
  projectId: string
  rootFingerprint: string
  sourceRevision: string
  planDigest: string
  changes: ReadonlyArray<ProposedApplyChange>
  identity: RegisteredIdentityBinding
  observations: ReadonlyArray<OperatorPreviewObservation>
  summary: ReadonlyArray<string>
  createdAt: string
}

function identityEquals(a: RegisteredIdentityBinding, b: RegisteredIdentityBinding): boolean {
  if (a.root !== b.root || a.dev !== b.dev || a.ino !== b.ino) return false
  if (a.ancestors.length !== b.ancestors.length) return false
  return a.ancestors.every((entry, i) => {
    const other = b.ancestors[i]
    return !!other && other.path === entry.path && other.dev === entry.dev && other.ino === entry.ino
  })
}

function observationEquals(a: OperatorPreviewObservation, target: ObservedTarget | 'MISSING'): boolean {
  if (a.state === 'missing') return target === 'MISSING'
  if (target === 'MISSING') return false
  return a.dev === target.dev && a.ino === target.ino && a.sha256 === target.sha256 &&
    a.bytes === target.bytes && a.mode === target.mode &&
    a.mtimeSec === target.mtimeSec && a.mtimeNsec === target.mtimeNsec && a.nlink === target.nlink
}

function requirePrivateJournalFile(file: string, journalDirectory: string, what: string): void {
  if (!file.startsWith(journalDirectory + '/')) throw new Error(what + ' must live inside the private journal root')
  const info = lstatSync(file)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe ' + what + ' file')
  if ((info.mode & 0o777) !== 0o600) throw new Error(what + ' file must be 0600')
  if (info.nlink !== 1) throw new Error(what + ' file must not be hardlinked')
  const uid = process.getuid?.()
  if (uid === undefined || info.uid !== uid) throw new Error(what + ' file must be owned by the local operator principal')
}

/** Probe a private journal marker through the helper's own no-follow fd: Apple special
 * flags, ACLs and extended attributes are not observable from Node's lstat on macOS, so
 * the grant evidence (preview/review/capability/receipt/opt-in) is checked with the SAME
 * policy predicates the Apply path uses. Tamper detection, never authentication. */
function probePrivateJournalMarker(file: string, what: string, helperBinary: string, timeoutMs?: number): void {
  try {
    inspectNativeMarker({ helperBinary, markerFile: file, timeoutMs })
  } catch (error) {
    throw new Error('Unsafe ' + what + ' file: ' + (error instanceof Error ? error.message : String(error)))
  }
}

const hashHex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

function parseOperatorPreviewRecord(raw: unknown): OperatorApplyPreviewRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid operator preview record')
  const value = raw as Record<string, unknown>
  if (value.version !== 1 || typeof value.previewId !== 'string' || !PREVIEW_ID.test(value.previewId) ||
    typeof value.projectId !== 'string' || typeof value.rootFingerprint !== 'string' || !SHA.test(value.rootFingerprint) ||
    typeof value.sourceRevision !== 'string' || typeof value.planDigest !== 'string' || !SHA.test(value.planDigest) ||
    !Array.isArray(value.changes) || !Array.isArray(value.observations) || !Array.isArray(value.summary) ||
    typeof value.createdAt !== 'string')
    throw new Error('Invalid operator preview record fields')
  const identity = value.identity as Record<string, unknown> | undefined
  if (!identity || typeof identity.root !== 'string' || typeof identity.dev !== 'number' ||
    typeof identity.ino !== 'number' || !Array.isArray(identity.ancestors))
    throw new Error('Invalid operator preview identity binding')
  const ancestors = identity.ancestors.map(entry => {
    const item = entry as Record<string, unknown>
    if (typeof item.path !== 'string' || typeof item.dev !== 'number' || typeof item.ino !== 'number')
      throw new Error('Invalid operator preview ancestor binding')
    return Object.freeze({ path: item.path, dev: item.dev, ino: item.ino })
  })
  const observations = value.observations.map(entry => {
    const item = entry as Record<string, unknown>
    if (typeof item.path !== 'string' || (item.state !== 'present' && item.state !== 'missing') ||
      typeof item.dev !== 'number' || typeof item.ino !== 'number' || typeof item.sha256 !== 'string' ||
      typeof item.bytes !== 'number' || typeof item.mode !== 'number' ||
      typeof item.mtimeSec !== 'number' || typeof item.mtimeNsec !== 'number' || typeof item.nlink !== 'number')
      throw new Error('Invalid operator preview observation')
    return Object.freeze({
      path: item.path, state: item.state, dev: item.dev, ino: item.ino, sha256: item.sha256,
      bytes: item.bytes, mode: item.mode, mtimeSec: item.mtimeSec, mtimeNsec: item.mtimeNsec, nlink: item.nlink
    })
  })
  const changes = value.changes.map(entry => {
    const item = entry as Record<string, unknown>
    if (typeof item.path !== 'string' || (item.action !== 'add' && item.action !== 'modify' && item.action !== 'delete') ||
      !(item.beforeSha256 === null || typeof item.beforeSha256 === 'string') ||
      !(item.afterSha256 === null || typeof item.afterSha256 === 'string') ||
      !(item.beforeBytes === null || typeof item.beforeBytes === 'number') ||
      !(item.afterBytes === null || typeof item.afterBytes === 'number') ||
      !(item.beforeMode === null || typeof item.beforeMode === 'number') ||
      !(item.afterMode === null || typeof item.afterMode === 'number'))
      throw new Error('Invalid operator preview change')
    return Object.freeze({
      path: item.path, action: item.action, beforeSha256: item.beforeSha256 as string | null,
      afterSha256: item.afterSha256 as string | null, beforeBytes: item.beforeBytes as number | null,
      afterBytes: item.afterBytes as number | null, beforeMode: item.beforeMode as number | null,
      afterMode: item.afterMode as number | null
    }) as ProposedApplyChange
  })
  return Object.freeze({
    version: 1, previewId: value.previewId, projectId: value.projectId,
    rootFingerprint: value.rootFingerprint, sourceRevision: value.sourceRevision,
    planDigest: value.planDigest, changes: Object.freeze(changes),
    identity: Object.freeze({
      root: identity.root, dev: identity.dev, ino: identity.ino, ancestors: Object.freeze(ancestors)
    }),
    observations: Object.freeze(observations),
    summary: Object.freeze(value.summary.map(line => String(line))),
    createdAt: value.createdAt
  })
}

function readOperatorPreviewRecord(previewFile: string, journalDirectory: string, helperBinary?: string): OperatorApplyPreviewRecord {
  requirePrivateJournalFile(previewFile, journalDirectory, 'preview')
  if (helperBinary) probePrivateJournalMarker(previewFile, 'preview', helperBinary)
  return parseOperatorPreviewRecord(JSON.parse(readFileSync(previewFile, 'utf8')))
}

function inspectBoundedTotal(changes: readonly ProposedApplyChange[]): number {
  // A same-length replacement is still a full-file edit. Absolute byte-length DELTA
  // would count e.g. an 8 MiB A→B replacement as 0 bytes and bypass the 8 KiB
  // operator canary limit. Budget the larger image for every touched file, including
  // reverse (rollback) plans, rather than interpreting the limit as file-size growth.
  let total = 0
  for (const change of changes) {
    total += Math.max(change.beforeBytes ?? 0, change.afterBytes ?? 0)
  }
  return total
}

/**
 * Build the reviewable bounded preview. The plan digest, sorted exact file list and every
 * before/after hash/byte/mode come from the helper's own read-only inspect over the pinned
 * fd chain, and the preview is bound to the CURRENT registered root+ancestor identity.
 * A root/ancestor identity change (docs/020) fails closed here; xattr/flags/ACL/hardlink/
 * symlink targets are refused before any capability exists. Deletions are refused: the
 * OL-054 product preview only ever adds or mutates bounded text files.
 */
export function buildOperatorApplyPreview(input: {
  registry: LocalProjectRegistry
  projectId: string
  journalDirectory: string
  helperBinary: string
  sourceRevision: string
  changes: readonly ProposedApplyChange[]
  timeoutMs?: number
}): { preview: OperatorApplyPreviewRecord; previewFile: string; plan: InspectedApplyPlan } {
  const project = input.registry.get(input.projectId)
  if (project.kind !== 'local' || project.readOnly) throw new Error('Operator Apply preview requires a writable local project')
  input.registry.assertRegisteredRootIdentity(input.projectId)
  const identity = input.registry.registeredRootIdentity(input.projectId)
  if (input.changes.length > OPERATOR_PREVIEW_MAX_FILES)
    throw new Error('Operator Apply preview exceeds the bounded 2-file review limit')
  for (const change of input.changes) {
    if (change.action === 'delete')
      throw new Error('Operator Apply preview refuses deletions; re-preview or roll back instead')
  }
  if (inspectBoundedTotal(input.changes) > OPERATOR_PREVIEW_MAX_TOTAL_BYTES)
    throw new Error('Operator Apply preview exceeds the bounded 8KiB review limit')
  const rootFingerprint = operatorProjectFingerprint(project)
  const plan = inspectProposedApplyPlan({
    version: 1, projectId: input.projectId, rootFingerprint,
    sourceRevision: input.sourceRevision, changes: input.changes
  })
  const journalDirectory = assertPrivateJournalRoot(input.journalDirectory, project.root)
  const observations: OperatorPreviewObservation[] = []
  const summary: string[] = []
  for (const change of plan.changes) {
    const observed = inspectNativeTarget({
      helperBinary: input.helperBinary, projectRoot: project.root, relativePath: change.path,
      expectedRootDev: identity.dev, expectedRootIno: identity.ino, timeoutMs: input.timeoutMs
    })
    if (change.action === 'modify') {
      if (observed === 'MISSING') throw new Error('Operator Apply preview target vanished before review')
      if (observed.sha256 !== change.beforeSha256 || observed.bytes !== change.beforeBytes || observed.mode !== change.beforeMode)
        throw new Error('Operator Apply preview preimage does not match the proposed before-image')
      if (observed.nlink !== 1) throw new Error('Operator Apply preview target is hardlinked; refuse before issue')
      observations.push(Object.freeze({ path: change.path, state: 'present', dev: observed.dev, ino: observed.ino,
        sha256: observed.sha256, bytes: observed.bytes, mode: observed.mode,
        mtimeSec: observed.mtimeSec, mtimeNsec: observed.mtimeNsec, nlink: observed.nlink }))
      summary.push(change.path + ': modify before ' + change.beforeSha256 + ' ' + change.beforeBytes + 'B mode ' +
        (change.beforeMode ?? 0).toString(8) + ' -> after ' + change.afterSha256 + ' ' + change.afterBytes + 'B mode ' +
        (change.afterMode ?? 0).toString(8))
    } else {
      if (observed !== 'MISSING') throw new Error('Operator Apply preview add target already exists; refuse to clobber')
      observations.push(Object.freeze({ path: change.path, state: 'missing', dev: 0, ino: 0, sha256: '-',
        bytes: 0, mode: 0, mtimeSec: 0, mtimeNsec: 0, nlink: 0 }))
      summary.push(change.path + ': add (absent) -> after ' + change.afterSha256 + ' ' + change.afterBytes + 'B mode ' +
        (change.afterMode ?? 0).toString(8))
    }
  }
  const previewId = 'pv-' + randomBytes(16).toString('hex')
  const preview: OperatorApplyPreviewRecord = Object.freeze({
    version: 1, previewId, projectId: input.projectId, rootFingerprint,
    sourceRevision: input.sourceRevision, planDigest: plan.digest,
    changes: plan.changes, identity: Object.freeze(identity),
    observations: Object.freeze(observations), summary: Object.freeze(summary),
    createdAt: new Date().toISOString()
  })
  const previewFile = join(journalDirectory, 'preview-' + previewId + '.json')
  if (existsSync(previewFile)) throw new Error('Operator preview file already exists')
  durablePrivateMarker(previewFile, JSON.stringify(preview) + '\n')
  return { preview, previewFile, plan }
}

/**
 * The protected operator process records the review of the EXACT previewed diff. The
 * review marker binds the preview id + plan digest + principal uid; issuing the one-use
 * capability without it fails closed.
 */
export function recordOperatorReview(input: {
  journalDirectory: string
  previewFile: string
  confirmedPlanDigest: string
}): { reviewFile: string; reviewRecord: Readonly<{ version: 1; previewId: string; planDigest: string; reviewerUid: number; reviewedAt: string }> } {
  const journalDirectory = input.journalDirectory
  const preview = readOperatorPreviewRecord(input.previewFile, journalDirectory)
  if (input.confirmedPlanDigest !== preview.planDigest)
    throw new Error('Operator review digest does not match the exact previewed diff')
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error('Operator review requires a local principal uid')
  const reviewRecord = Object.freeze({
    version: 1 as const, previewId: preview.previewId, planDigest: preview.planDigest,
    reviewerUid: uid, reviewedAt: new Date().toISOString()
  })
  const reviewFile = join(journalDirectory, 'review-' + preview.previewId)
  if (existsSync(reviewFile)) throw new Error('Operator review already recorded; re-preview required')
  durablePrivateMarker(reviewFile, JSON.stringify(reviewRecord) + '\n')
  return { reviewFile, reviewRecord }
}

function readOperatorReviewRecord(reviewFile: string, journalDirectory: string, preview: OperatorApplyPreviewRecord, helperBinary?: string): void {
  requirePrivateJournalFile(reviewFile, journalDirectory, 'review')
  if (helperBinary) probePrivateJournalMarker(reviewFile, 'review', helperBinary)
  const raw = JSON.parse(readFileSync(reviewFile, 'utf8')) as Record<string, unknown>
  if (raw.version !== 1 || raw.previewId !== preview.previewId || raw.planDigest !== preview.planDigest)
    throw new Error('Operator review does not bind this preview and diff digest')
  const uid = process.getuid?.()
  if (uid === undefined || raw.reviewerUid !== uid)
    throw new Error('Operator review was recorded by a different principal uid')
}

/**
 * Issue the ONE-USE capability, only after the operator reviewed the exact diff, and only
 * while the CURRENT registration still matches the identity the preview was bound to
 * (no stale rebind: a re-registration or an identity change forces a NEW preview) AND the
 * targets are quiescent — byte-for-byte and mtime-for-mtime identical to what was reviewed.
 * `action: 'rollback'` issues the SEPARATE rollback capability that names the original
 * transaction; it never reuses the apply capability.
 */
export function issueOperatorCapability(input: {
  registry: LocalProjectRegistry
  projectId: string
  journalDirectory: string
  helperBinary: string
  previewFile: string
  reviewFile: string
  action?: RealApplyAction
  rollbackOfTransactionId?: string
  ttlSeconds?: number
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
}): { capability: RealApplyCapability; capabilityFile: string; plan: InspectedApplyPlan } {
  const env = input.env ?? process.env
  const project = input.registry.get(input.projectId)
  input.registry.assertRegisteredRootIdentity(input.projectId)
  const journalDirectory = assertPrivateJournalRoot(input.journalDirectory, project.root)
  if (!operatorApplyEnabled({ env, journalDirectory, projectRoot: project.root, helperBinary: input.helperBinary }))
    throw new Error('Real Apply product path is disabled; enable ' + REAL_APPLY_OPERATOR_FLAG +
      ' or the durable owner-only apply-opt-in record only after local technical gates pass')
  const preview = readOperatorPreviewRecord(input.previewFile, journalDirectory, input.helperBinary)
  readOperatorReviewRecord(input.reviewFile, journalDirectory, preview, input.helperBinary)
  const currentIdentity = input.registry.registeredRootIdentity(input.projectId)
  if (!identityEquals(preview.identity, currentIdentity))
    throw new Error('Operator preview is bound to a superseded registration; re-preview required (no stale rebind)')
  if (preview.rootFingerprint !== operatorProjectFingerprint(project))
    throw new Error('Operator preview root fingerprint is stale; re-preview required (no stale rebind)')
  const plan = inspectProposedApplyPlan({
    version: 1, projectId: preview.projectId, rootFingerprint: preview.rootFingerprint,
    sourceRevision: preview.sourceRevision, changes: preview.changes
  })
  if (plan.digest !== preview.planDigest)
    throw new Error('Operator preview plan digest does not match the recorded changes')
  for (const observation of preview.observations) {
    const observed = inspectNativeTarget({
      helperBinary: input.helperBinary, projectRoot: project.root, relativePath: observation.path,
      expectedRootDev: currentIdentity.dev, expectedRootIno: currentIdentity.ino, timeoutMs: input.timeoutMs
    })
    if (!observationEquals(observation, observed))
      throw new Error('External writer moved the target since the preview; review again (quiescence gate)')
    if (observed !== 'MISSING' && observed.nlink !== 1)
      throw new Error('Operator capability target is hardlinked; refuse before issue')
  }
  const action: RealApplyAction = input.action ?? 'apply'
  const issued = issueRealApplyCapability({
    journalDirectory, projectRoot: project.root, projectId: preview.projectId,
    rootFingerprint: preview.rootFingerprint, plan, action,
    rollbackOfTransactionId: input.rollbackOfTransactionId, ttlSeconds: input.ttlSeconds,
    previewId: preview.previewId
  })
  return { ...issued, plan }
}

/**
 * Execute the reviewed plan from the PROTECTED OPERATOR-OWNED process context. The Worker
 * must never reach this: a Worker executor session always carries DSH_SUPERAGENT_TICKET,
 * and this entry point refuses that context. The helper is spawned only from here, under
 * the verified one-shot capability, and the capability is consumed exactly once for the
 * whole transaction (durable marker before the first spawn; committed backup + fsync of
 * each before-image happens inside the helper, per transaction directory).
 */
export function executeOperatorApply(input: {
  registry: LocalProjectRegistry
  projectId: string
  journalDirectory: string
  helperBinary: string
  capabilityFile: string
  previewFile: string
  action?: RealApplyAction
  afterImages: Readonly<Record<string, Uint8Array>>
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  now?: () => number
}): {
  capability: RealApplyCapability; consumedMarker: string; receiptFile: string
  results: ReadonlyArray<{ change: Readonly<ProposedApplyChange>; stdout: string; transactionDirectory: string; journal: Record<string, string>; observed: ObservedTarget | 'MISSING' }>
} {
  const env = input.env ?? process.env
  if (env[WORKER_SESSION_MARKER])
    throw new Error('Worker process must never invoke real Apply; only the protected operator context executes')
  const project = input.registry.get(input.projectId)
  input.registry.assertRegisteredRootIdentity(input.projectId)
  const journalDirectory = assertPrivateJournalRoot(input.journalDirectory, project.root)
  if (!operatorApplyEnabled({ env, journalDirectory, projectRoot: project.root, helperBinary: input.helperBinary }))
    throw new Error('Real Apply product path is disabled; enable ' + REAL_APPLY_OPERATOR_FLAG +
      ' or the durable owner-only apply-opt-in record only after local technical gates pass')
  const preview = readOperatorPreviewRecord(input.previewFile, journalDirectory, input.helperBinary)
  const plan = inspectProposedApplyPlan({
    version: 1, projectId: preview.projectId, rootFingerprint: preview.rootFingerprint,
    sourceRevision: preview.sourceRevision, changes: preview.changes
  })
  if (plan.digest !== preview.planDigest)
    throw new Error('Operator preview plan digest does not match the recorded changes')
  for (const change of plan.changes) {
    if (change.afterSha256 === null) continue
    const bytes = input.afterImages[change.path]
    if (bytes === undefined) throw new Error('Operator apply is missing the after-image bytes for ' + change.path)
    if (hashHex(bytes) !== change.afterSha256)
      throw new Error('Operator apply after-image does not match the reviewed plan digest')
    if (bytes.length !== change.afterBytes)
      throw new Error('Operator apply after-image size does not match the reviewed plan')
  }
  const action: RealApplyAction = input.action ?? 'apply'
  // The grant must be bound to the EXACT preview this execution is reading. Two different
  // preview ids can share one plan digest (same changes, different principals/sessions);
  // without this binding an execution could silently consume a capability issued from a
  // different preview whose review was never the operator's own (docs/022 threat 2).
  // A capability whose digest was forged fails the driver's digest binding below.
  const granted = parseRealApplyCapability(JSON.parse(readFileSync(input.capabilityFile, 'utf8')))
  if (granted.previewId !== undefined && granted.planDigest === preview.planDigest &&
    granted.previewId !== preview.previewId)
    throw new Error('Capability preview binding does not match this operator preview; re-issue required (no cross-preview rebind)')
  const run = runNativeRealApplyPlan({
    helperBinary: input.helperBinary, journalDirectory, projectRoot: project.root,
    capabilityFile: input.capabilityFile, action, plan, projectId: preview.projectId,
    rootFingerprint: preview.rootFingerprint, afterImages: input.afterImages,
    timeoutMs: input.timeoutMs, now: input.now
  })
  // Post-apply re-observation through the helper's own pinned fd chain: a same-UID
  // external writer that swapped the leaf AFTER the renameat but BEFORE the receipt
  // must not be recorded as the applied result (docs/022 threat: exact target switch
  // after apply). The identity reported by the helper (dev/ino) must match the fresh
  // inspect, and the bytes must match the reviewed after-image.
  const postObservations: Array<{ path: string; observed: ObservedTarget | 'MISSING'; helperDev: number; helperIno: number }> = []
  for (const result of run.results) {
    const fields = result.stdout.split(/\s+/)
    const helperDev = Number(fields[2]); const helperIno = Number(fields[3])
    const observed = inspectNativeTarget({
      helperBinary: input.helperBinary, projectRoot: project.root, relativePath: result.change.path,
      expectedRootDev: run.capability.rootDev, expectedRootIno: run.capability.rootIno,
      timeoutMs: input.timeoutMs
    })
    postObservations.push({ path: result.change.path, observed, helperDev, helperIno })
    if (result.change.afterSha256 !== null) {
      if (observed === 'MISSING')
        throw new Error('Applied target vanished immediately after Apply; no silent retry')
      if (observed.ino !== helperIno || observed.dev !== helperDev)
        throw new Error('Applied target inode was swapped by an external writer after Apply; no silent retry')
      if (observed.sha256 !== result.change.afterSha256 || observed.bytes !== result.change.afterBytes ||
        observed.mode !== result.change.afterMode)
        throw new Error('Applied target no longer matches the reviewed after-image; no silent retry')
      if (observed.nlink !== 1)
        throw new Error('Applied target is hardlinked after Apply; refuse')
    } else if (observed !== 'MISSING') {
      throw new Error('Deleted target reappeared after Apply; no silent retry')
    }
  }
  const receiptFile = join(journalDirectory, 'receipt-' + run.capability.transactionId + '.json')
  if (existsSync(receiptFile)) throw new Error('Operator apply receipt already exists; no silent retry')
  durablePrivateMarker(receiptFile, JSON.stringify({
    version: 1, action: run.capability.action, transactionId: run.capability.transactionId,
    capabilityId: run.capability.capabilityId, previewId: preview.previewId,
    planDigest: preview.planDigest, executedAt: new Date().toISOString(), pid: process.pid,
    files: run.results.map(result => ({
      path: result.change.path, transactionDirectory: result.transactionDirectory,
      journalStatus: result.journal.status,
      post: result.stdout.split(/\s+/).slice(2).join(' ')
    })),
    postObservations: postObservations.map(entry => ({
      path: entry.path, helperDev: entry.helperDev, helperIno: entry.helperIno,
      observed: entry.observed === 'MISSING' ? 'MISSING' : {
        dev: entry.observed.dev, ino: entry.observed.ino, sha256: entry.observed.sha256,
        bytes: entry.observed.bytes, mode: entry.observed.mode,
        mtimeSec: entry.observed.mtimeSec, mtimeNsec: entry.observed.mtimeNsec, nlink: entry.observed.nlink
      }
    }))
  }) + '\n')
  return { capability: run.capability, consumedMarker: run.consumedMarker, receiptFile, results: run.results }
}

/**
 * Build the rollback preview by inverting the ORIGINAL reviewed plan. Before the rollback
 * is even previewed, every current target is verified against the APPLIED after-image
 * (exact bytes + mode via the helper's own inspect) and every before.bin backup in the
 * original transaction directories is verified against the original before-image hash.
 * Rollback deletions are only permitted when reverting an `add` (the OL-054 apply preview
 * itself refuses deletions).
 */
export function buildOperatorRollbackPreview(input: {
  registry: LocalProjectRegistry
  projectId: string
  journalDirectory: string
  helperBinary: string
  originalPreviewFile: string
  originalCapabilityFile: string
  timeoutMs?: number
}): {
  preview: OperatorApplyPreviewRecord; previewFile: string
  rollbackPlan: InspectedApplyPlan
  rollbackAfterImages: Readonly<Record<string, Uint8Array>>
} {
  const project = input.registry.get(input.projectId)
  input.registry.assertRegisteredRootIdentity(input.projectId)
  const identity = input.registry.registeredRootIdentity(input.projectId)
  const journalDirectory = assertPrivateJournalRoot(input.journalDirectory, project.root)
  const preview = readOperatorPreviewRecord(input.originalPreviewFile, journalDirectory, input.helperBinary)
  const originalPlan = inspectProposedApplyPlan({
    version: 1, projectId: preview.projectId, rootFingerprint: preview.rootFingerprint,
    sourceRevision: preview.sourceRevision, changes: preview.changes
  })
  if (originalPlan.digest !== preview.planDigest)
    throw new Error('Operator preview plan digest does not match the recorded changes')
  const originalCapability = parseRealApplyCapability(JSON.parse(readFileSync(input.originalCapabilityFile, 'utf8')))
  if (originalCapability.action !== 'apply') throw new Error('Rollback must reference an applied transaction')

  const inverted: ProposedApplyChange[] = []
  for (const change of originalPlan.changes) {
    if (change.action === 'modify') inverted.push(Object.freeze({
      path: change.path, action: 'modify', beforeSha256: change.afterSha256, afterSha256: change.beforeSha256,
      beforeBytes: change.afterBytes, afterBytes: change.beforeBytes,
      beforeMode: change.afterMode, afterMode: change.beforeMode
    }))
    else if (change.action === 'add') inverted.push(Object.freeze({
      path: change.path, action: 'delete', beforeSha256: change.afterSha256, afterSha256: null,
      beforeBytes: change.afterBytes, afterBytes: null, beforeMode: change.afterMode, afterMode: null
    }))
    else inverted.push(Object.freeze({
      path: change.path, action: 'add', beforeSha256: null, afterSha256: change.beforeSha256,
      beforeBytes: null, afterBytes: change.beforeBytes, beforeMode: null, afterMode: change.beforeMode
    }))
  }
  if (inverted.length > OPERATOR_PREVIEW_MAX_FILES)
    throw new Error('Operator Apply preview exceeds the bounded 2-file review limit')
  if (inspectBoundedTotal(inverted) > OPERATOR_PREVIEW_MAX_TOTAL_BYTES)
    throw new Error('Operator Apply preview exceeds the bounded 8KiB review limit')
  const rootFingerprint = operatorProjectFingerprint(project)
  const rollbackPlan = inspectProposedApplyPlan({
    version: 1, projectId: input.projectId, rootFingerprint,
    sourceRevision: preview.sourceRevision, changes: inverted
  })

  const observations: OperatorPreviewObservation[] = []
  const summary: string[] = []
  const rollbackAfterImages: Record<string, Uint8Array> = {}
  for (const change of rollbackPlan.changes) {
    const observed = inspectNativeTarget({
      helperBinary: input.helperBinary, projectRoot: project.root, relativePath: change.path,
      expectedRootDev: identity.dev, expectedRootIno: identity.ino, timeoutMs: input.timeoutMs
    })
    if (change.action === 'delete' || change.action === 'modify') {
      // Exact bytes+mode verification of the applied after-image being rolled back.
      if (observed === 'MISSING') throw new Error('Rollback target vanished; the applied after-image is not present')
      if (observed.sha256 !== change.beforeSha256 || observed.bytes !== change.beforeBytes || observed.mode !== change.beforeMode)
        throw new Error('Rollback target no longer matches the applied after-image bytes+mode; refuse')
      if (observed.nlink !== 1) throw new Error('Operator Apply preview target is hardlinked; refuse before issue')
      observations.push(Object.freeze({ path: change.path, state: 'present', dev: observed.dev, ino: observed.ino,
        sha256: observed.sha256, bytes: observed.bytes, mode: observed.mode,
        mtimeSec: observed.mtimeSec, mtimeNsec: observed.mtimeNsec, nlink: observed.nlink }))
      if (change.action === 'modify') summary.push(change.path + ': rollback modify before ' + change.beforeSha256 +
        ' ' + change.beforeBytes + 'B mode ' + (change.beforeMode ?? 0).toString(8) + ' -> after ' + change.afterSha256 +
        ' ' + change.afterBytes + 'B mode ' + (change.afterMode ?? 0).toString(8))
      else summary.push(change.path + ': rollback delete of applied add ' + change.beforeSha256 + ' ' + change.beforeBytes + 'B')
    } else {
      if (observed !== 'MISSING') throw new Error('Rollback add target already exists; refuse to clobber')
      observations.push(Object.freeze({ path: change.path, state: 'missing', dev: 0, ino: 0, sha256: '-',
        bytes: 0, mode: 0, mtimeSec: 0, mtimeNsec: 0, nlink: 0 }))
      summary.push(change.path + ': rollback add restores ' + change.afterSha256 + ' ' + change.afterBytes + 'B')
    }
    if (change.action === 'modify' || change.action === 'add') {
      // The restore bytes are the durable before.bin the helper fsync'd during the apply.
      const transactionDirectory = nativeTransactionDirectory(journalDirectory, originalCapability, change.path)
      const journal = readNativeJournal(transactionDirectory)
      if (journal.status !== 'applied') throw new Error('Rollback requires an applied original transaction journal')
      const beforeBytes = readFileSync(join(transactionDirectory, 'before.bin'))
      if (hashHex(new Uint8Array(beforeBytes)) !== (change.afterSha256 ?? change.beforeSha256))
        throw new Error('Rollback before-image backup does not match the original hash; refuse')
      rollbackAfterImages[change.path] = beforeBytes
    }
  }
  const previewId = 'pv-' + randomBytes(16).toString('hex')
  const rollbackPreview: OperatorApplyPreviewRecord = Object.freeze({
    version: 1, previewId, projectId: input.projectId, rootFingerprint,
    sourceRevision: preview.sourceRevision, planDigest: rollbackPlan.digest,
    changes: rollbackPlan.changes, identity: Object.freeze(identity),
    observations: Object.freeze(observations), summary: Object.freeze(summary),
    createdAt: new Date().toISOString()
  })
  const previewFile = join(journalDirectory, 'preview-' + previewId + '.json')
  if (existsSync(previewFile)) throw new Error('Operator preview file already exists')
  durablePrivateMarker(previewFile, JSON.stringify(rollbackPreview) + '\n')
  return { preview: rollbackPreview, previewFile, rollbackPlan,
    rollbackAfterImages: Object.freeze(rollbackAfterImages) }
}

/**
 * Read-only recovery classification for every change of an operator-applied plan.
 * AMBIGUOUS leaves a durable freeze marker (driver) that blocks any later capability on
 * that transaction; nothing here repairs, retries, replays or cleans a frozen journal.
 */
export function classifyOperatorApplyRecovery(input: {
  helperBinary: string
  journalDirectory: string
  projectRoot: string
  capabilityFile: string
  plan: InspectedApplyPlan
  projectId: string
  rootFingerprint: string
  timeoutMs?: number
}): ReadonlyArray<{ path: string; classification: RecoveryClassification; stdout: string; freezeMarker?: string; transactionDirectory: string }> {
  return Object.freeze(input.plan.changes.map(change => {
    const outcome = classifyNativeRealApplyRecovery({
      helperBinary: input.helperBinary, journalDirectory: input.journalDirectory,
      projectRoot: input.projectRoot, capabilityFile: input.capabilityFile, plan: input.plan,
      projectId: input.projectId, rootFingerprint: input.rootFingerprint,
      change, timeoutMs: input.timeoutMs
    })
    return Object.freeze({ path: change.path, classification: outcome.classification,
      stdout: outcome.stdout, freezeMarker: outcome.freezeMarker, transactionDirectory: outcome.transactionDirectory })
  }))
}

/**
 * Execute a SEPARATE one-use rollback capability. Same protected-context rules as the
 * apply execution; the rollback capability is consumed once and restores the exact
 * bytes+mode verified during the rollback preview (from the fsync'd before.bin backups).
 */
export function executeOperatorRollback(input: Parameters<typeof executeOperatorApply>[0] & {
  rollbackPreview: OperatorApplyPreviewRecord
}): ReturnType<typeof executeOperatorApply> {
  return executeOperatorApply({ ...input, action: 'rollback', afterImages: input.afterImages })
}

/** Read-only receipt/preview evidence for the operator UI: never a mutation. */
export function readOperatorApplyReceipt(input: {
  journalDirectory: string; receiptFile: string; helperBinary?: string
}): Readonly<Record<string, unknown>> {
  requirePrivateJournalFile(input.receiptFile, input.journalDirectory, 'receipt')
  if (input.helperBinary) probePrivateJournalMarker(input.receiptFile, 'receipt', input.helperBinary)
  return Object.freeze(JSON.parse(readFileSync(input.receiptFile, 'utf8')) as Record<string, unknown>)
}
