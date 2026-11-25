/**
 * OL-20261125-053 — PRIVATE ONE-SHOT CAPABILITY DRIVER for the descriptor-relative
 * native Apply helper (research/real-apply-helper.c).
 *
 * TEST-ONLY / DISABLED: no Runtime/Worker/Weixin caller exists; agent-handoff/REAL_APPLY_GATES.md
 * stays controlling. This module is deliberately SEPARATE from non-git-apply.ts (whose
 * path-based primitive is the thing this replaces at the real boundary).
 *
 * What this layer adds on top of the helper (the helper alone is only a mechanism):
 *  - a private, unguessable, one-use transaction capability bound to the LOCAL OPERATOR
 *    PRINCIPAL UID, the exact registered project identity (dev+ino+fingerprint), the exact
 *    sorted allowlisted relative paths (hash-bound), before/after image hashes, expiry,
 *    nonce and action apply|rollback;
 *  - a durable, fsync'd consumed-on-use marker written BEFORE the helper is spawned, so a
 *    capability can never be silently re-tried after a crash or a REJECT;
 *  - a SEPARATE rollback capability (rollback never reuses the apply capability);
 *  - irreversible-ambiguity freeze: an AMBIGUOUS recovery classification leaves a durable
 *    freeze marker that blocks every later operation on that transaction until a human
 *    reconciles. No automatic replay, retry or cleanup;
 *  - public GitHub text is NEVER a signature: the grant lives only in a 0600 capability
 *    file inside an owner-only 0700 journal root, and the nonce is generated locally.
 *
 * Preimage metadata (exact mode, byte size, ns-resolution mtime, inode identity) comes from
 * the helper's own read-only `inspect` over the pinned fd chain — never from a Node-side
 * approximation — so the helper's re-verification cannot drift from what was approved.
 */
import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  renameSync, writeSync
} from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { inspectProposedApplyPlan, type InspectedApplyPlan, type ProposedApplyChange } from './real-apply-contract.ts'

const CAPABILITY_ID = /^[a-z0-9][a-z0-9_-]{7,63}$/
const TRANSACTION_ID = /^[a-z0-9][a-z0-9-]{7,79}$/
const SHA = /^[a-f0-9]{64}$/
const NONCE = /^[a-f0-9]{32,64}$/
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
/** Exact capability field set. Public grant text pasted into the file fails validation. */
const CAPABILITY_FIELDS = [
  'version', 'capabilityId', 'action', 'transactionId', 'projectId', 'rootFingerprint',
  'rootPath', 'rootDev', 'rootIno', 'principalUid', 'paths', 'pathsDigest', 'planDigest',
  'nonce', 'issuedAt', 'expiresAt', 'rollbackOfTransactionId'
] as const
export type RealApplyAction = 'apply' | 'rollback'
export type NativeStep = 'prepared' | 'staged' | 'applying' | 'written'
export type RecoveryClassification = 'APPLIED' | 'PREPARED_CRASH' | 'AMBIGUOUS'

export interface RealApplyCapability {
  version: 1
  capabilityId: string
  action: RealApplyAction
  transactionId: string
  projectId: string
  rootFingerprint: string
  rootPath: string
  rootDev: number
  rootIno: number
  principalUid: number
  /** Exact sorted allowlisted relative paths; the helper is never handed anything else. */
  paths: ReadonlyArray<string>
  pathsDigest: string
  planDigest: string
  nonce: string
  issuedAt: string
  expiresAt: string
  rollbackOfTransactionId?: string
}

export interface ObservedTarget {
  rootDev: number; rootIno: number
  dev: number; ino: number
  sha256: string; bytes: number; mode: number
  mtimeSec: number; mtimeNsec: number; nlink: number
}

function object(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ' + what + ' object')
  return value as Record<string, unknown>
}
function str(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new Error('Invalid ' + what)
  return value
}
function num(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid ' + what)
  return value
}
const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
const sha256Bytes = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

/** Canonical journal root: owner-only 0700, real directory, never a symlink, outside the source tree. */
export function assertPrivateJournalRoot(journalDirectory: string, projectRoot: string): string {
  if (!isAbsolute(journalDirectory)) throw new Error('Journal directory must be absolute')
  const info = lstatSync(journalDirectory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe private journal root')
  if ((info.mode & 0o077) !== 0) throw new Error('Private journal root must be owner-only 0700')
  const uid = process.getuid?.()
  if (uid === undefined || info.uid !== uid) throw new Error('Private journal root must be owned by the local operator principal')
  const rel = relative(projectRoot, journalDirectory)
  if (rel === '' || !rel.startsWith('..' + sep)) throw new Error('Journal root must be outside the source project')
  return journalDirectory
}

/** Parse + strictly validate a raw capability document (no extra/missing keys, exact types). */
export function parseRealApplyCapability(raw: unknown): RealApplyCapability {
  const value = object(raw, 'capability')
  const owned = Object.keys(value)
  const required = CAPABILITY_FIELDS.slice(0, CAPABILITY_FIELDS.length - 1) // all but the optional rollback reference
  const allowed = owned.length === required.length || owned.length === CAPABILITY_FIELDS.length
  if (!allowed || owned.some(k => !(CAPABILITY_FIELDS as readonly string[]).includes(k)))
    throw new Error('Invalid capability fields')
  if (value.version !== 1) throw new Error('Invalid capability version')
  const capabilityId = str(value.capabilityId, 'capabilityId')
  if (!CAPABILITY_ID.test(capabilityId)) throw new Error('Invalid capability id')
  const action = str(value.action, 'action')
  if (action !== 'apply' && action !== 'rollback') throw new Error('Invalid capability action')
  const transactionId = str(value.transactionId, 'transactionId')
  if (!TRANSACTION_ID.test(transactionId)) throw new Error('Invalid transaction id')
  const projectId = str(value.projectId, 'projectId')
  const rootFingerprint = str(value.rootFingerprint, 'rootFingerprint')
  if (!SHA.test(rootFingerprint)) throw new Error('Invalid root fingerprint')
  const rootPath = str(value.rootPath, 'rootPath')
  if (!isAbsolute(rootPath)) throw new Error('Capability root path must be absolute')
  const rootDev = num(value.rootDev, 'rootDev')
  const rootIno = num(value.rootIno, 'rootIno')
  const principalUid = num(value.principalUid, 'principalUid')
  if (!Array.isArray(value.paths) || !value.paths.length || !value.paths.every(p => typeof p === 'string'))
    throw new Error('Invalid capability path list')
  const paths = value.paths as string[]
  const pathsDigest = str(value.pathsDigest, 'pathsDigest')
  if (!SHA.test(pathsDigest)) throw new Error('Invalid paths digest')
  if (pathsDigest !== hash(JSON.stringify(paths))) throw new Error('Capability path list hash binding mismatch')
  if (paths.some((p, i) => i > 0 && paths[i - 1]! >= p)) throw new Error('Capability path list must be sorted')
  const planDigest = str(value.planDigest, 'planDigest')
  if (!SHA.test(planDigest)) throw new Error('Invalid plan digest')
  const nonce = str(value.nonce, 'nonce')
  if (!NONCE.test(nonce)) throw new Error('Capability nonce must be locally generated and unguessable')
  const issuedAt = str(value.issuedAt, 'issuedAt')
  const expiresAt = str(value.expiresAt, 'expiresAt')
  if (!TIME.test(issuedAt) || !TIME.test(expiresAt)) throw new Error('Invalid capability timestamps')
  if (expiresAt <= issuedAt) throw new Error('Capability expiry must be after issuance')
  const rollbackOf = value.rollbackOfTransactionId
  if (action === 'rollback' && typeof rollbackOf !== 'string') throw new Error('Rollback capability must name the original transaction')
  if (action === 'apply' && rollbackOf !== undefined) throw new Error('Apply capability must not reference a transaction')
  if (typeof rollbackOf === 'string' && !TRANSACTION_ID.test(rollbackOf)) throw new Error('Invalid rollback reference')
  return Object.freeze({
    version: 1, capabilityId, action: action as RealApplyAction, transactionId, projectId,
    rootFingerprint, rootPath, rootDev, rootIno, principalUid,
    paths: Object.freeze([...paths]), pathsDigest, planDigest, nonce, issuedAt, expiresAt,
    ...(rollbackOf !== undefined ? { rollbackOfTransactionId: rollbackOf } : {})
  }) as RealApplyCapability
}

/** Write-then-rename with fsync of file AND directory: the marker survives a process kill. */
function durableMarker(path: string, body: string): void {
  const temporary = path + '.writing-' + process.pid
  const fd = openSync(temporary, 'w', 0o600)
  try {
    writeSync(fd, body)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temporary, path)
  const dirFd = openSync(join(path, '..'), 'r')
  try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Issue the private one-shot capability into the owner-only journal root as a 0600 file. */
export function issueRealApplyCapability(options: {
  journalDirectory: string
  projectRoot: string
  projectId: string
  rootFingerprint: string
  plan: InspectedApplyPlan
  action?: RealApplyAction
  transactionId?: string
  rollbackOfTransactionId?: string
  ttlSeconds?: number
}): { capability: RealApplyCapability; capabilityFile: string } {
  const journalDirectory = assertPrivateJournalRoot(options.journalDirectory, options.projectRoot)
  const action: RealApplyAction = options.action ?? 'apply'
  const nowMs = Date.now()
  const ttl = options.ttlSeconds ?? 300
  const rootInfo = lstatSync(options.projectRoot)
  const paths = options.plan.changes.map(c => c.path).sort()
  const capability = parseRealApplyCapability({
    version: 1,
    capabilityId: 'cap-' + randomBytes(16).toString('hex'),
    action,
    transactionId: options.transactionId ?? 'tx-' + randomBytes(8).toString('hex'),
    projectId: options.projectId,
    rootFingerprint: options.rootFingerprint,
    rootPath: options.projectRoot,
    rootDev: rootInfo.dev,
    rootIno: rootInfo.ino,
    principalUid: process.getuid?.(),
    paths,
    pathsDigest: hash(JSON.stringify(paths)),
    planDigest: options.plan.digest,
    nonce: randomBytes(16).toString('hex'),
    issuedAt: isoTime(nowMs),
    expiresAt: isoTime(nowMs + ttl * 1000),
    ...(options.rollbackOfTransactionId ? { rollbackOfTransactionId: options.rollbackOfTransactionId } : {})
  })
  const file = join(journalDirectory, capability.capabilityId + '.json')
  if (existsSync(file)) throw new Error('Capability file already exists')
  const temporary = file + '.writing-' + process.pid
  const fd = openSync(temporary, 'wx', 0o600)
  try {
    writeSync(fd, JSON.stringify(capability) + '\n')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(temporary, file)
  const dirFd = openSync(journalDirectory, 'r')
  try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
  return { capability, capabilityFile: file }
}

/** Rollback always uses a SEPARATE capability that references the original transaction. */
export function issueRollbackCapability(options: {
  journalDirectory: string
  projectRoot: string
  projectId: string
  rootFingerprint: string
  plan: InspectedApplyPlan
  originalTransactionId: string
  ttlSeconds?: number
}): { capability: RealApplyCapability; capabilityFile: string } {
  return issueRealApplyCapability({
    ...options, action: 'rollback', rollbackOfTransactionId: options.originalTransactionId
  })
}

/** Distinct per-transaction journal directory; apply and rollback never share one. */
export function nativeTransactionDirectory(journalDirectory: string, capability: RealApplyCapability): string {
  return join(journalDirectory, 'tx-' + capability.transactionId)
}

/** Load a capability file and enforce every binding, including the one-use marker and the freeze. */
export function verifyRealApplyCapability(options: {
  journalDirectory: string
  projectRoot: string
  capabilityFile: string
  action: RealApplyAction
  plan: InspectedApplyPlan
  projectId: string
  rootFingerprint: string
  now?: () => number
}): RealApplyCapability {
  const journalDirectory = assertPrivateJournalRoot(options.journalDirectory, options.projectRoot)
  if (!options.capabilityFile.startsWith(journalDirectory + sep)) throw new Error('Capability file must live inside the private journal root')
  const info = lstatSync(options.capabilityFile)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe capability file')
  if ((info.mode & 0o777) !== 0o600) throw new Error('Capability file must be 0600')
  if (info.nlink !== 1) throw new Error('Capability file must not be hardlinked')
  const uid = process.getuid?.()
  if (uid === undefined || info.uid !== uid) throw new Error('Capability file must be owned by the local operator principal')
  const capability = parseRealApplyCapability(JSON.parse(readFileSync(options.capabilityFile, 'utf8')))
  if (capability.action !== options.action) throw new Error('Capability action does not match this operation')
  if (capability.projectId !== options.projectId) throw new Error('Capability project binding mismatch')
  if (capability.rootFingerprint !== options.rootFingerprint) throw new Error('Capability root fingerprint mismatch')
  if (capability.planDigest !== options.plan.digest) throw new Error('Capability plan digest binding mismatch')
  if (capability.nonce.length < 32) throw new Error('Capability nonce too short to be unguessable')
  if (uid !== undefined && capability.principalUid !== uid) throw new Error('Capability is bound to a different operator principal uid')
  const realRoot = lstatSync(capability.rootPath)
  if (realRoot.dev !== capability.rootDev || realRoot.ino !== capability.rootIno)
    throw new Error('Registered project root identity changed since the capability was issued')
  const planPaths = options.plan.changes.map(c => c.path).sort()
  if (capability.paths.join('\n') !== planPaths.join('\n')) throw new Error('Capability exact-file-list binding mismatch')
  const now = (options.now ?? Date.now)()
  if (new Date(capability.expiresAt).getTime() <= now) throw new Error('Expired real Apply capability; no silent retry')
  if (new Date(capability.issuedAt).getTime() > now) throw new Error('Capability issued in the future')
  const marker = join(journalDirectory, 'consumed-' + capability.capabilityId)
  if (existsSync(marker)) throw new Error('Real Apply capability already consumed; no silent retry')
  const freeze = join(journalDirectory, 'freeze-' + capability.transactionId)
  if (existsSync(freeze)) throw new Error('Transaction is under ambiguity freeze; human reconciliation required')
  return capability
}

function runHelper(helperBinary: string, args: string[], input: string | undefined, timeoutMs: number): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(helperBinary, args, { input, encoding: 'utf8', timeout: timeoutMs })
  if (result.error) throw new Error('Native helper cannot run: ' + result.error.message)
  return { code: result.status ?? -1, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() }
}

/** Read-only preimage observation through the helper's pinned fd chain (exact ns metadata). */
export function inspectNativeTarget(options: {
  helperBinary: string
  projectRoot: string
  relativePath: string
  expectedRootDev?: number
  expectedRootIno?: number
  timeoutMs?: number
}): ObservedTarget | 'MISSING' {
  const outcome = runHelper(options.helperBinary, ['inspect', options.projectRoot,
    String(options.expectedRootDev ?? 0), String(options.expectedRootIno ?? 0), options.relativePath],
  undefined, options.timeoutMs ?? 10_000)
  if (outcome.code === 0 && outcome.stdout === 'OK MISSING') return 'MISSING'
  if (outcome.code !== 0) throw new Error('Native inspect rejected: ' + outcome.stdout.slice(0, 200))
  const fields = outcome.stdout.split(/\s+/)
  if (fields[0] !== 'OK' || fields[1] !== 'TARGET' || fields.length !== 12)
    throw new Error('Unexpected inspect output: ' + outcome.stdout.slice(0, 200))
  const n = (i: number): number => Number(fields[i])
  if (!Number.isSafeInteger(n(2)) || !Number.isSafeInteger(n(3)) || !Number.isSafeInteger(n(4)) ||
    !Number.isSafeInteger(n(5)) || !Number.isSafeInteger(n(7)) || !Number.isSafeInteger(n(8)) ||
    !Number.isSafeInteger(n(9)) || !Number.isSafeInteger(n(10)) || !Number.isSafeInteger(n(11)))
    throw new Error('Unexpected inspect numbers')
  if (!SHA.test(fields[6]!)) throw new Error('Unexpected inspect digest')
  return {
    rootDev: n(2), rootIno: n(3), dev: n(4), ino: n(5), sha256: fields[6]!,
    bytes: n(7), mode: n(8), mtimeSec: n(9), mtimeNsec: n(10), nlink: n(11)
  }
}

/** Parse the helper's durable journal.rec (key=value lines) out of a transaction directory. */
export function readNativeJournal(transactionDirectory: string): Record<string, string> {
  const text = readFileSync(join(transactionDirectory, 'journal.rec'), 'utf8')
  const record: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (!line) continue
    const eq = line.indexOf('=')
    if (eq <= 0) throw new Error('Malformed journal record line')
    record[line.slice(0, eq)] = line.slice(eq + 1)
  }
  return record
}

export interface NativeRunOptions {
  helperBinary: string
  journalDirectory: string
  projectRoot: string
  capabilityFile: string
  action: RealApplyAction
  plan: InspectedApplyPlan
  projectId: string
  rootFingerprint: string
  change: ProposedApplyChange
  /** Bytes of the after-image (add/modify). Delete must pass null/undefined. */
  afterImage?: Uint8Array | null
  timeoutMs?: number
  now?: () => number
}

/**
 * Run one descriptor-relative native apply (or rollback) under a verified one-shot capability.
 * The consumed marker is durable BEFORE the helper is spawned, so neither a crash nor a REJECT
 * can leave a capability that gets silently re-tried.
 */
export function runNativeRealApply(options: NativeRunOptions): {
  stdout: string; transactionDirectory: string; consumedMarker: string; capability: RealApplyCapability; journal: Record<string, string>; observed: ObservedTarget | 'MISSING'
} {
  const capability = verifyRealApplyCapability({
    journalDirectory: options.journalDirectory, projectRoot: options.projectRoot,
    capabilityFile: options.capabilityFile, action: options.action, plan: options.plan,
    projectId: options.projectId, rootFingerprint: options.rootFingerprint, now: options.now
  })
  const change = options.change
  if (capability.paths.length !== options.plan.changes.length ||
    !capability.paths.includes(change.path)) throw new Error('Change is outside the capability allowlist')

  // Authoritative preimage observation via the helper itself (pinned fd chain, exact ns).
  const observed = inspectNativeTarget({
    helperBinary: options.helperBinary, projectRoot: options.projectRoot,
    relativePath: change.path, expectedRootDev: capability.rootDev, expectedRootIno: capability.rootIno
  })
  if (change.beforeSha256 !== null) {
    if (observed === 'MISSING') throw new Error('Native apply target vanished after approval; no silent retry')
    if (observed.sha256 !== change.beforeSha256 || observed.bytes !== change.beforeBytes || observed.mode !== change.beforeMode)
      throw new Error('Native apply target no longer matches the approved preview; no silent retry')
    if (observed.nlink !== 1) throw new Error('Native apply target is hardlinked; refuse')
  } else if (observed !== 'MISSING') {
    throw new Error('Native add target already exists; refuse to clobber')
  }

  const transactionDirectory = nativeTransactionDirectory(options.journalDirectory, capability)
  if (existsSync(transactionDirectory)) throw new Error('Transaction journal directory already exists; no silent retry')
  mkdirSync(transactionDirectory, { mode: 0o700 })

  // Stage the after-image into the private transaction journal (never into the source tree).
  let afterImageName: string | undefined
  if (change.afterSha256 !== null) {
    if (!options.afterImage) throw new Error('Native apply/rollback requires the after-image bytes')
    if (sha256Bytes(options.afterImage) !== change.afterSha256) throw new Error('After-image does not match the approved plan digest')
    if (options.afterImage.length !== change.afterBytes) throw new Error('After-image size does not match the approved plan')
    afterImageName = 'after.bin'
    const fd = openSync(join(transactionDirectory, afterImageName), 'wx', 0o600)
    try {
      writeSync(fd, options.afterImage)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    const dirFd = openSync(transactionDirectory, 'r')
    try { fsyncSync(dirFd) } finally { closeSync(dirFd) }
  }

  const marker = join(options.journalDirectory, 'consumed-' + capability.capabilityId)
  durableMarker(marker, JSON.stringify({
    version: 1, capabilityId: capability.capabilityId, action: capability.action,
    transactionId: capability.transactionId, pid: process.pid, consumedAt: new Date().toISOString()
  }) + '\n')

  const missing = observed === 'MISSING'
  const spec = helperSpec(capability, {
    tx_dir: transactionDirectory, path: change.path, action: change.action,
    before_sha256: change.beforeSha256 ?? '-',
    before_bytes: String(change.beforeBytes ?? 0),
    before_mode: String(change.beforeMode ?? 0),
    before_mtime_sec: missing ? '0' : String(observed.mtimeSec),
    before_mtime_nsec: missing ? '0' : String(observed.mtimeNsec),
    after_sha256: change.afterSha256 ?? '-',
    after_bytes: String(change.afterBytes ?? 0),
    after_mode: String(change.afterMode ?? 0),
    after_image: afterImageName
  })
  const outcome = runHelper(options.helperBinary, [capability.action], spec, options.timeoutMs ?? 30_000)
  if (outcome.code !== 0) {
    const detail = outcome.stdout || outcome.stderr || 'exit ' + outcome.code
    throw new Error('Native apply rejected (' + capability.transactionId + '): ' + detail)
  }
  if (!outcome.stdout.startsWith('OK APPLIED')) throw new Error('Unexpected native helper output: ' + outcome.stdout.slice(0, 200))
  return { stdout: outcome.stdout, transactionDirectory, consumedMarker: marker, capability,
    journal: readNativeJournal(transactionDirectory), observed }
}

function helperSpec(capability: RealApplyCapability, fields: Record<string, string | undefined>): string {
  const base: Record<string, string> = {
    kind: capability.action,
    root: capability.rootPath,
    exp_dev: String(capability.rootDev),
    exp_ino: String(capability.rootIno),
    transaction_id: capability.transactionId,
    nonce: capability.nonce,
    capability_id: capability.capabilityId,
    plan_digest: capability.planDigest
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) base[key] = value
  }
  return Object.entries(base).map(([k, v]) => k + '=' + v).join('\n') + '\n'
}

/**
 * Read-only recovery classification for one native transaction. Never repairs, never retries.
 * AMBIGUOUS leaves a durable freeze marker that blocks every later capability on the transaction.
 */
export function classifyNativeRealApplyRecovery(options: {
  helperBinary: string
  journalDirectory: string
  projectRoot: string
  capabilityFile: string
  plan: InspectedApplyPlan
  projectId: string
  rootFingerprint: string
  change: ProposedApplyChange
  timeoutMs?: number
}): { classification: RecoveryClassification; stdout: string; freezeMarker?: string; transactionDirectory: string } {
  const capability = parseRealApplyCapability(JSON.parse(readFileSync(options.capabilityFile, 'utf8')))
  const journalDirectory = assertPrivateJournalRoot(options.journalDirectory, options.projectRoot)
  const transactionDirectory = nativeTransactionDirectory(journalDirectory, capability)
  const change = options.change
  const spec = helperSpec(capability, {
    tx_dir: transactionDirectory, path: change.path, action: change.action,
    before_sha256: change.beforeSha256 ?? '-', before_bytes: String(change.beforeBytes ?? 0),
    before_mode: String(change.beforeMode ?? 0), before_mtime_sec: '0', before_mtime_nsec: '0',
    after_sha256: change.afterSha256 ?? '-', after_bytes: String(change.afterBytes ?? 0),
    after_mode: String(change.afterMode ?? 0)
  })
  const outcome = runHelper(options.helperBinary, ['recover'], spec, options.timeoutMs ?? 30_000)
  const match = /^OK CLASSIFY (APPLIED|PREPARED_CRASH|AMBIGUOUS)(?: reason=(\S+))? /.exec(outcome.stdout)
  if (outcome.code !== 0 || !match) throw new Error('Unexpected recovery output: ' + outcome.stdout.slice(0, 200))
  const classification = match[1] as RecoveryClassification
  let freezeMarker: string | undefined
  if (classification === 'AMBIGUOUS') {
    // Irreversible-ambiguity freeze: durable, owner-only, never auto-cleared by this driver.
    freezeMarker = join(journalDirectory, 'freeze-' + capability.transactionId)
    if (!existsSync(freezeMarker)) {
      durableMarker(freezeMarker, JSON.stringify({
        version: 1, transactionId: capability.transactionId, capabilityId: capability.capabilityId,
        classification, reason: match[2] ?? 'target-state-matches-neither-image',
        observedAt: new Date().toISOString()
      }) + '\n')
    }
  }
  return { classification, stdout: outcome.stdout, freezeMarker, transactionDirectory }
}

/** Build a single-file inspected plan from one change (sorted, one element). */
export function singleFileApplyPlan(options: {
  projectId: string; rootFingerprint: string; sourceRevision: string; change: ProposedApplyChange
}): InspectedApplyPlan {
  return inspectProposedApplyPlan({
    version: 1, projectId: options.projectId, rootFingerprint: options.rootFingerprint,
    sourceRevision: options.sourceRevision, changes: [options.change]
  })
}
