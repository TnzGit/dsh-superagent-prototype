/**
 * Pure proposed-Apply plan contract (P3 preflight, NOT an executor).
 *
 * This file has NO filesystem, process, network, capability, approval, journal
 * or Apply API. It does not authenticate the proposer, attest any file metadata,
 * defeat TOCTOU or authorize a write. An OS-isolated local helper MUST
 * independently revalidate every byte/metadata/identity under its own trust
 * boundary and acquire a separate private one-shot operator capability.
 */
import { createHash } from 'node:crypto'

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/
const SHA = /^[a-f0-9]{64}$/
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MAX_FILES = 24, MAX_FILE_BYTES = 64 * 1024 * 1024, MAX_TOTAL_BYTES = 256 * 1024 * 1024
const FORBIDDEN = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', '.env', '.aws', '.ssh',
  '.gnupg', '.dsh-project.json', '.dsh', 'id_rsa', 'id_ed25519', 'credentials', 'secrets'])
const BAD_EXT = /\.(?:pem|key|p12|pfx|sqlite|sqlite3|db|sock|lock)$/i

type Action = 'add' | 'modify' | 'delete'
export interface ProposedApplyChange {
  path: string
  action: Action
  beforeSha256: string | null
  afterSha256: string | null
  beforeBytes: number | null
  afterBytes: number | null
  beforeMode: number | null
  afterMode: number | null
}
export interface ProposedApplyPlan {
  version: 1
  projectId: string
  rootFingerprint: string
  sourceRevision: string
  changes: ProposedApplyChange[]
}
export type InspectedApplyPlan = Readonly<Omit<ProposedApplyPlan, 'changes'> & {
  changes: ReadonlyArray<Readonly<ProposedApplyChange>>
  digest: string
}>
function object(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error('Invalid ' + what + ' object')
  return value as Record<string, unknown>
}
function keys(value: Record<string, unknown>, names: string[], what: string): void {
  if (Object.keys(value).length !== names.length || Object.keys(value).some(k => !names.includes(k)))
    throw new Error('Invalid ' + what + ' fields')
}
function sha(value: unknown): value is string { return typeof value === 'string' && SHA.test(value) }
function bytes(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_FILE_BYTES
}
function mode(value: unknown): value is number {
  // A deliberately narrow ordinary-file POSIX mode, excluding setuid, setgid,
  // sticky and group/world write. ACLs/xattrs/flags still require OS inspection.
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0o400 && value <= 0o755 && (value & 0o022) === 0 &&
    (value & 0o7000) === 0
}
function safeRelativePath(path: unknown): path is string {
  if (typeof path !== 'string' || !path || path.length > 500 || path.startsWith('/') ||
    path.includes('\\') || path.includes('\0') || path.includes('//') || path !== path.trim())
    return false
  const segments = path.split('/')
  return segments.every(segment => SEGMENT.test(segment) && segment !== '.' && segment !== '..' &&
    !segment.startsWith('.') && !FORBIDDEN.has(segment.toLowerCase()) && !BAD_EXT.test(segment))
}
/**
 * Validate and canonicalize an untrusted *proposal* without touching source.
 * Digest is for deterministic plan correlation, NEVER a signed operator grant.
 *
 * Conservative ASCII-only names intentionally avoid macOS Unicode aliasing.
 * Case-insensitive collision/prefix checks reject path aliases that can differ
 * on case-sensitive CI and case-insensitive operator filesystems.
 */
export function inspectProposedApplyPlan(input: unknown): InspectedApplyPlan {
  const plan = object(input, 'plan')
  keys(plan, ['version', 'projectId', 'rootFingerprint', 'sourceRevision', 'changes'], 'plan')
  if (plan.version !== 1 || typeof plan.projectId !== 'string' || !ID.test(plan.projectId) ||
    !sha(plan.rootFingerprint) || !sha(plan.sourceRevision) ||
    !Array.isArray(plan.changes) || !plan.changes.length || plan.changes.length > MAX_FILES)
    throw new Error('Invalid proposed Apply scope or limits')
  const changes: ProposedApplyChange[] = []
  const paths = new Set<string>()
  let total = 0
  for (const entry of plan.changes) {
    const c = object(entry, 'change')
    keys(c, ['path', 'action', 'beforeSha256', 'afterSha256', 'beforeBytes', 'afterBytes',
      'beforeMode', 'afterMode'], 'change')
    if (!safeRelativePath(c.path)) throw new Error('Unsafe proposed Apply path')
    const path = c.path.toLowerCase()
    if (paths.has(path) || [...paths].some(other => other.startsWith(path + '/') || path.startsWith(other + '/')))
      throw new Error('Colliding proposed Apply paths')
    paths.add(path)
    if (!['add', 'modify', 'delete'].includes(c.action as string))
      throw new Error('Invalid proposed Apply action')
    const action = c.action as Action
    const hasBefore = sha(c.beforeSha256) && bytes(c.beforeBytes) && mode(c.beforeMode)
    const hasAfter = sha(c.afterSha256) && bytes(c.afterBytes) && mode(c.afterMode)
    if (!(action === 'add' ? !hasBefore && hasAfter && c.beforeSha256 === null &&
            c.beforeBytes === null && c.beforeMode === null
      : action === 'delete' ? hasBefore && !hasAfter && c.afterSha256 === null &&
            c.afterBytes === null && c.afterMode === null
      : hasBefore && hasAfter)) throw new Error('Invalid proposed Apply before/after image')
    total += (typeof c.beforeBytes === 'number' ? c.beforeBytes : 0) +
      (typeof c.afterBytes === 'number' ? c.afterBytes : 0)
    if (total > MAX_TOTAL_BYTES) throw new Error('Proposed Apply exceeds byte budget')
    changes.push({ path: c.path, action, beforeSha256: c.beforeSha256 as string | null,
      afterSha256: c.afterSha256 as string | null,
      beforeBytes: c.beforeBytes as number | null, afterBytes: c.afterBytes as number | null,
      beforeMode: c.beforeMode as number | null, afterMode: c.afterMode as number | null })
  }
  // The exact serialized plan has one canonical order. No hidden mutation/reorder
  // is allowed between preview, user review and the future independent helper.
  if (changes.some((c, i) => i > 0 && changes[i - 1]!.path >= c.path))
    throw new Error('Proposed Apply changes must be sorted by path')
  const normalized = { version: 1 as const, projectId: plan.projectId,
    rootFingerprint: plan.rootFingerprint, sourceRevision: plan.sourceRevision, changes }
  const digest = createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
  return Object.freeze({ ...normalized, changes: Object.freeze(changes.map(c => Object.freeze(c))),
    digest }) as InspectedApplyPlan
}
