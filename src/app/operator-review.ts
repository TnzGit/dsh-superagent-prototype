/** Operator-private live reconciliation (OL-054 M4, hardened by OL-055 S1): an authenticated loopback-only interface for listing and settling held native Weixin review receipts, and for terminal classification of pending Triggers, with ONE authoritative durable audit commit and a hardened append-only projection. */
import { constants, closeSync, fchmodSync, fsyncSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync, writeSync } from 'node:fs'
import { createHash, timingSafeEqual } from 'node:crypto'
import { dirname, isAbsolute } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { UserError } from '../core/errors.ts'
import type { Decision } from '../core/model.ts'
import type { Engine } from '../core/engine.ts'
import type { Effects } from './effects.ts'
import type { Store, WeixinReviewReason } from './store.ts'

/** The private grant: an absolute path, outside the repo, to an owner-only token file. Absent it, the service is never installed. */
export const OPERATOR_TOKEN_FILE_ENV = 'DSH_OPERATOR_RECONCILE_TOKEN_FILE'
/** How a reviewed hold ends: only an explicit operator confirmation of a completed send marks it sent; anything else is a terminal no-resend. */
export type OperatorOutcome = 'confirmed_sent' | 'no_resend'
/** What kind of durable action one audit record attests to. */
export type OperatorAuditKind = 'receipt' | 'trigger'
/** One sanitized audit record: ID, kind, outcome, principal hash — never peer IDs, payload text, tokens or provider strings. */
export interface OperatorAuditRecord { at: string; kind: OperatorAuditKind; id: string; outcome?: OperatorOutcome; principal: string }
/** The same record as the authoritative ledger stores it: a monotonic sequence orders the commit history. */
export interface OperatorAuditEntry extends OperatorAuditRecord { seq: number }
/** The external projection may lag the ledger; this is what a caller needs to know to stay fail-closed. */
export interface OperatorJournalStatus { entries: number; projected: number; current: boolean }
/** What the installed operator interface enforces about its own bearer lifecycle; nothing here is a secret. */
export interface OperatorLifecycle {
  grant: string
  bearer: string
  transport: string
  bodyMaxBytes: number
  rate: { readsPerMinute: number; mutationsPerMinute: number }
}

/** The journal may never grow without bound: a human must reconcile a file past this size before it is used again. */
export const OPERATOR_JOURNAL_MAX_BYTES = 64 * 1024 * 1024
/** The token grant file is bounded the same way the native Weixin credentials are. */
export const OPERATOR_TOKEN_MAX_BYTES = 64 * 1024
/** An operator request body is bounded far below the panel's default: the reconcile body is one small JSON object. */
export const OPERATOR_BODY_MAX_BYTES = 4 * 1024
/** How many operator requests a sliding window admits, split by read and mutation (OL-055 S1 bearer-lifecycle bound). */
export const OPERATOR_READS_PER_WINDOW = 120
export const OPERATOR_MUTATIONS_PER_WINDOW = 30
/** The window an operator rate limit slides over. */
export const OPERATOR_WINDOW_MS = 60_000

/** Thrown when the private operator interface has served too many requests in the current window; HTTP maps it to 429. */
export class OperatorRateLimited extends Error {
  readonly retryAfterMs: number
  constructor(retryAfterMs: number) {
    super(`Operator request rate limit reached; retry in ${retryAfterMs} ms`)
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * A sliding-window bound on how many requests one installed operator service admits, so a stuck page, a scripted retry or a
 * token-guessing client can never hammer the loopback interface without limit. In-memory and per instance: it bounds this
 * process's operator traffic, not the operator's intent.
 */
export class OperatorRateWindow {
  private times: number[] = []
  readonly limit: number
  readonly windowMs: number
  private readonly now: () => number
  constructor(limit: number, windowMs = OPERATOR_WINDOW_MS, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }
  /** Admits one request now, or throws how long a caller must wait before the window has room for it again. */
  reserve(): void {
    const now = this.now()
    this.times = this.times.filter(time => now - time < this.windowMs)
    if (this.times.length >= this.limit) throw new OperatorRateLimited(this.windowMs - (now - this.times[0]!))
    this.times.push(now)
  }
}

/**
 * Reads the private operator reconcile token from an owner-owned, owner-only (0600) regular file, never a symlink, read through one `O_NOFOLLOW` descriptor with its `fstat` checked before reading (the same guard as the native Weixin credentials).
 * @returns the token, or `undefined` when no grant path is set.
 * @throws Error when the grant is not absolute, not a regular owner-only file, oversized, or its token is shorter than 16 characters.
 */
export function readOperatorToken(file = process.env[OPERATOR_TOKEN_FILE_ENV]): string | undefined {
  if (!file) return undefined
  if (!isAbsolute(file)) throw new Error('Operator reconcile token path must be absolute')
  const link = lstatSync(file)
  if (link.isSymbolicLink()) throw new Error('Operator reconcile token must be an owner-only non-symlink file')
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stats = fstatSync(fd)
    if (!stats.isFile() || (stats.mode & 0o077) !== 0 || stats.size > OPERATOR_TOKEN_MAX_BYTES)
      throw new Error('Operator reconcile token must be an owner-owned, owner-only regular file (max 64 KiB)')
    if (process.getuid && stats.uid !== process.getuid())
      throw new Error('Operator reconcile token must be owned by the current user')
    const token = readFileSync(fd, 'utf8').trim()
    if (token.length < 16) throw new Error('Operator reconcile token must be at least 16 characters')
    return token
  } finally { closeSync(fd) }
}

/** The canonical JSONL projection of one audit record: field order is fixed so a re-projection is exact and idempotent. */
export function journalLineOf(record: OperatorAuditRecord): string {
  const ordered: Record<string, unknown> = { at: record.at, kind: record.kind, id: record.id, principal: record.principal }
  if (record.outcome !== undefined) ordered.outcome = record.outcome
  return JSON.stringify(ordered)
}

export interface OperatorReviewHost {
  store: Store
  effects: Pick<Effects, 'cancel'>
  engine: Pick<Engine, 'classifyPendingTrigger'>
  /** The token read from the private grant file; the only secret this service holds. */
  token: string
  /** Path of the append-only, owner-only, fsynced journal projection (inside the 0700 state directory). */
  journal: string
}

/**
 * The operator-private reconciliation service, installed only when the private 0600 grant exists (docs/018 runbook, OL-054 M4).
 * Auth: requests must carry `x-operator-token`, compared in constant time against hashes of the token; same-origin and loopback are enforced by the HTTP layer. Carrying the token proves possession of a secret, never the identity of a named human.
 * ONE authoritative durable audit commit: the terminal transition and its audit row are written in the SAME SQLite transaction (the ledger is the authority), and the external JSONL journal is a validated idempotent projection appended only AFTER that commit. A crash before the commit leaves nothing; a crash after the commit but before the projection re-projects on the next construction; a projection the ledger or the durable receipt state cannot corroborate freezes reconciliation until a human reconciles it. No transition ever authorizes a second send, loses a terminal Trigger classification, or declares an uncommitted effect accepted.
 * Reconciliation is first-writer-wins: a duplicate click or a losing controller gets a refusal, never a second effect.
 * A terminal classification never resets the durable one-shot claim, never resends the same ID, and never marks an ambiguous hold sent without an explicit confirmation; a warranted follow-up needs a NEW message ID.
 * Every journal access opens the exact path with `O_NOFOLLOW` — read, append and validation independently — and checks the file it actually opened on its own descriptor: a regular file, owner-only mode, exactly one hard link, the current user's ownership, a bounded size, and every real ancestor a directory owned by the operator or root and not group/world writable unless sticky. Each descriptor is closed explicitly. A symlink, a hardlink or a foreign owner can neither be modified nor read through, and no foreign content is ever echoed into a diagnostic.
 */
export class OperatorReview {
  /** A stable hash of the token, published in audit records in place of the secret itself. */
  /** The sanitized 12-hex identity of the grant that attested an audit record; it is a hash, never the token itself. */
  readonly principal: string
  private readonly tokenHash: Buffer
  private readonly frozen?: string
  private readonly host: OperatorReviewHost
  private readonly reads = new OperatorRateWindow(OPERATOR_READS_PER_WINDOW)
  private readonly mutations = new OperatorRateWindow(OPERATOR_MUTATIONS_PER_WINDOW)
  constructor(host: OperatorReviewHost) {
    this.host = host
    this.tokenHash = createHash('sha256').update(host.token).digest()
    this.principal = this.tokenHash.toString('hex').slice(0, 12)
    this.validateJournal()
    // Check the existing projection BEFORE replaying authoritative rows. A truncated
    // or forged tail must freeze the operator, not become an ignored middle line
    // after re-projection has appended a fresh well-formed final record.
    const initialFailure = this.inspectJournal()
    if (!initialFailure) this.reprojectLedger()
    this.frozen = initialFailure ?? this.inspectJournal()
  }
  /** Whether `headers` carry the operator's private token (constant-time over SHA-256 digests, so length and content do not leak). */
  authorized(headers: IncomingMessage['headers']): boolean {
    const supplied = headers['x-operator-token']
    if (typeof supplied !== 'string') return false
    return timingSafeEqual(createHash('sha256').update(supplied).digest(), this.tokenHash)
  }
  /** Admits one read-only operator request in the current window, or throws how long the caller must wait (HTTP 429). */
  admitRead(): void { this.reads.reserve() }
  /** Admits one mutation operator request in the current window, or throws how long the caller must wait (HTTP 429). */
  admitMutation(): void { this.mutations.reserve() }
  /** The read-only sanitized reconciliation ledger (docs/018): it stays readable even when the journal is frozen. */
  ledger(limit = 50): { id: string; kind: 'acknowledgement' | 'reply' | 'notice'; ticketId?: string; claimed: boolean; claimedAt?: string; reviewAt: string; reason: WeixinReviewReason }[] {
    return this.host.store.receipts.reviewLedger(limit)
  }
  /** The authoritative durable audit ledger, oldest first: what this operator actually committed, in commit order. */
  auditLedger(limit = 200): OperatorAuditEntry[] { return this.ledgerEntries(limit) }
  private ledgerEntries(limit: number): OperatorAuditEntry[] {
    return this.host.store.operatorAudit.list(limit).map(({ outcome, ...row }) =>
      ({ ...row, kind: row.kind as OperatorAuditKind, ...(outcome ? { outcome: outcome as OperatorOutcome } : {}) }))
  }
  /** Whether the external projection has caught up with the authoritative ledger (read-only; never repairs anything). */
  journalStatus(): OperatorJournalStatus {
    const entries = this.host.store.operatorAudit.count()
    const projected = this.readJournal().length
    return { entries, projected, current: entries === projected }
  }
  /**
   * The lifecycle facts this interface enforces, so the operator UI can state them instead of implying them: what the grant is,
   * what the bounds are, and what this interface is NOT. Carrying the bearer token proves possession of a secret and NEVER the
   * identity of a named human — there is no session, no login, and no per-person attribution behind it.
   */
  lifecycle(): OperatorLifecycle {
    return {
      grant: 'private 0600 token file, read when the service is installed and never hot-swapped',
      bearer: 'possession of the token authenticates the request, not a named human',
      transport: 'loopback 127.0.0.1 and same-origin only',
      bodyMaxBytes: OPERATOR_BODY_MAX_BYTES,
      rate: { readsPerMinute: OPERATOR_READS_PER_WINDOW, mutationsPerMinute: OPERATOR_MUTATIONS_PER_WINDOW },
    }
  }
  /**
   * Reconciles ONE held receipt by exact ID: the single durable, irreversible terminal transition, recorded in the authoritative
   * SQLite audit ledger inside the SAME Store transaction as the compare-and-swap; the pending `reply` effect is cancelled in that
   * same transaction so nothing retries it. The external journal is projected only after the commit, so losing the file write can
   * never lose the audit, and an aborted transaction can never leave a projection behind.
   * @throws UserError `reviewHoldSettled` when the ID is unknown, already terminal, or never a pending Weixin review hold (also the
   * first-writer-wins refusal for a duplicate click or the losing controller of a race); a frozen journal throws a plain error (HTTP 500).
   */
  reconcile(id: string, outcome: OperatorOutcome): { id: string; status: 'sent' | 'dropped'; outcome: OperatorOutcome; principal: string; journal: true } {
    this.assertUnfrozen()
    const { store, effects } = this.host
    const result = store.atomic(() => {
      const receipt = store.receipts.get(id)
      if (!receipt || receipt.channel.source !== 'weixin' || receipt.status !== 'pending' || !receipt.review) throw new UserError('reviewHoldSettled')
      const record: OperatorAuditRecord = { at: new Date().toISOString(), kind: 'receipt', id, outcome, principal: this.principal }
      // First-writer-wins at the audit ledger: the same (kind, ID, principal) may be attested only once.
      if (!store.operatorAudit.append(record)) throw new UserError('reviewHoldSettled')
      if (!store.receipts.operatorSettleReview(id, outcome, this.principal)) { store.operatorAudit.remove(record); throw new UserError('reviewHoldSettled') }
      effects.cancel('reply', id)
      const settled = store.receipts.get(id)!
      return { id, status: settled.status as 'sent' | 'dropped', record }
    })
    this.project(result.record)
    return { id: result.id, status: result.status, outcome, principal: this.principal, journal: true }
  }
  /**
   * Terminal classification of ONE pending Trigger by exact ID: a durable ignore Decision that takes it out of its Thread's queue
   * without deleting the Trigger row or any receipt, so it can never become a Ticket after processing resumes. Idempotent (a repeat
   * reports `classified: false` and audits nothing); fails closed when a live Eval already holds the Trigger, and refuses a Trigger
   * that already carries a different Decision or one that is not pending.
   */
  classifyTrigger(triggerId: string): { triggerId: string; classified: boolean; decision: string } {
    this.assertUnfrozen()
    const result = this.host.store.atomic(() => {
      const classified = this.host.engine.classifyPendingTrigger(triggerId)
      if (classified.already) return { decision: classified.decision, already: true, record: undefined }
      const record: OperatorAuditRecord = { at: new Date().toISOString(), kind: 'trigger', id: triggerId, principal: this.principal }
      // The audit row commits with the Decision: a crash can never lose the terminal classification.
      this.host.store.operatorAudit.append(record)
      return { decision: classified.decision, already: false, record }
    })
    if (result.record) this.project(result.record)
    return { triggerId, classified: !result.already, decision: result.decision.id }
  }
  private assertUnfrozen(): void {
    // A separate local process can corrupt or replace the journal AFTER startup.
    // Verify again before each operator mutation, not only in the constructor.
    const problem = this.frozen ?? this.inspectJournal()
    if (problem) throw new Error(`Operator review journal is inconsistent; reconciliation is frozen until a human reconciles it: ${problem}`)
  }
  /** Creates the journal owner-only when absent, or validates the file that already exists, through one `O_NOFOLLOW` descriptor that is closed explicitly. */
  private validateJournal(): void {
    const existed = this.exists(this.host.journal)
    const fd = this.openJournal(constants.O_RDWR | constants.O_CREAT)
    try { if (!existed) fsyncSync(fd) } finally { closeSync(fd) }
  }
  /** Appends one ledger record to the exact journal path and fsyncs it, AFTER the commit that made it durable; nothing here rewrites or repairs the journal. */
  private project(record: OperatorAuditRecord): void {
    const line = journalLineOf(record)
    if (this.readJournal().includes(line)) return
    const fd = this.openJournal(constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT)
    try {
      writeSync(fd, `${line}\n`)
      fsyncSync(fd)
    } finally { closeSync(fd) }
  }
  /** Re-appends every authoritative ledger record the external journal is missing; the ledger is the authority, so nothing is discarded. */
  private reprojectLedger(): void {
    const projected = new Set(this.readJournal())
    for (const entry of this.ledgerEntries(Number.MAX_SAFE_INTEGER)) {
      const line = journalLineOf(entry)
      if (projected.has(line)) continue
      const fd = this.openJournal(constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT)
      try {
        writeSync(fd, `${line}\n`)
        fsyncSync(fd)
      } finally { closeSync(fd) }
    }
  }
  /** Whether the journal path exists as anything at all (a dangling symlink counts as absent and is rejected by the open). */
  private exists(path: string): boolean {
    try { return lstatSync(path).isFile() } catch { return false }
  }
  /**
   * Opens the exact journal path with `O_NOFOLLOW`, creating it owner-only when absent, and refuses anything the descriptor did
   * not actually land on: a symlink target, a shared-inode hardlink, a foreign owner or an unbounded file. Only a file proven to
   * be our own inode has its mode tightened; a foreign file is never modified.
   */
  private openJournal(flags: number): number {
    const path = this.host.journal
    if (!isAbsolute(path)) throw new Error('Operator review journal path must be absolute')
    this.assertAncestors(path)
    const existed = this.exists(path)
    let fd: number
    // The open itself is refused when the path is a symlink (`O_NOFOLLOW`), and the diagnostic names only the path, never the target.
    try { fd = openSync(path, flags | constants.O_NOFOLLOW) }
    catch { throw new Error(`Operator review journal must be opened without following symlinks: ${path}`) }
    // Identity first: a foreign inode is refused before any descriptor operation can change it.
    // A failed fstat/ownership/fchmod must ALSO close the descriptor; otherwise a
    // repeated hostile journal path can exhaust the operator process's FD budget.
    try {
      this.assertJournalOwnership(fstatSync(fd), path)
      // A file this descriptor just created is made owner-only immediately; a pre-existing journal of ours is tightened the way the
      // installed constructor always did, so an older valid journal keeps working without a migration.
      if (!existed || (Number(fstatSync(fd).mode) & 0o077) !== 0) fchmodSync(fd, 0o600)
      if ((Number(fstatSync(fd).mode) & 0o077) !== 0) throw new Error('Operator review journal must be an owner-only file (0600)')
      return fd
    } catch (error) {
      try { closeSync(fd) } catch { /* Preserve the original failed validation. */ }
      throw error
    }
  }
  /** Reads the journal through its own `O_NOFOLLOW` descriptor, so a swapped root or a symlink can never be read through. */
  private readJournal(): string[] {
    const fd = this.openJournal(constants.O_RDONLY)
    let text: string
    try { text = readFileSync(fd, 'utf8') } finally { closeSync(fd) }
    return text.split('\n').filter(line => line.length > 0)
  }
  /** The journal must be a regular file on its own inode, owned by the current user, and of a bounded size — never a symlink target or a hardlink to a foreign inode. */
  private assertJournalOwnership(stats: ReturnType<typeof fstatSync>, path: string): void {
    if (!stats.isFile()) throw new Error(`Operator review journal must be a regular file, not a ${path}`)
    if (process.getuid && stats.uid !== process.getuid()) throw new Error('Operator review journal must be owned by the current user')
    if (stats.nlink !== 1) throw new Error('Operator review journal must have exactly one hard link to its own inode')
    if (stats.size > OPERATOR_JOURNAL_MAX_BYTES) throw new Error('Operator review journal exceeds its bounded size; a human must reconcile it')
  }
  /** Every real ancestor of the journal must be a directory owned by the current user or root, and not group/world writable unless sticky (the same rule as the Weixin credentials). */
  private assertAncestors(file: string): void {
    const uid = process.getuid ? process.getuid() : undefined
    let dir: string
    try { dir = realpathSync(dirname(file)) }
    catch { throw new Error(`Operator review journal ancestor directory cannot be resolved: ${dirname(file)}`) }
    for (;;) {
      let fd: number
      try { fd = openSync(dir, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY) }
      catch { throw new Error(`Operator review journal ancestor directory cannot be opened without following symlinks: ${dir}`) }
      try {
        const stats = fstatSync(fd)
        const sticky = Number(stats.mode) & 0o1000
        if (!stats.isDirectory() || (uid !== undefined && stats.uid !== uid && stats.uid !== 0)
          || ((stats.mode & 0o022) !== 0 && !sticky))
          throw new Error('Operator review journal ancestors must be operator/root-owned directories, not group or world writable unless sticky')
      } finally { closeSync(fd) }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  /**
   * Whether the journal's tail is unusable or its records contradict the durable state, which freezes every mutation until a human
   * reconciles it. Only the shape of the record is echoed — never a foreign line's content.
   */
  private inspectJournal(): string | undefined {
    let lines: string[]
    try { lines = this.readJournal() } catch { return undefined }
    if (!lines.length) return undefined
    // Corroboration: ALL lines, not just the last, must be syntactically sound
    // and tied to the durable state. Old pre-ledger terminal records remain
    // readable for an additive migration, but malformed/duplicate lines freeze.
    const ledger = new Set(this.ledgerEntries(Number.MAX_SAFE_INTEGER).map(entry => journalLineOf(entry)))
    const seen = new Set<string>()
    for (const line of lines) {
      let record: OperatorAuditRecord
      try { record = JSON.parse(line) as OperatorAuditRecord }
      catch { return 'interrupted journal record' }
      if (record.kind !== 'receipt' && record.kind !== 'trigger') return 'unrecognized journal record'
      if (typeof record.at !== 'string' || typeof record.id !== 'string' || typeof record.principal !== 'string')
        return 'incomplete journal record'
      if (seen.has(line)) return 'duplicate journal record'
      seen.add(line)
      if (ledger.has(line)) continue
      // Compatibility with pre-SQLite-audit journal entries: legacy terminal
      // receipt/trigger records may not yet have an authoritative ledger row.
      if (record.kind === 'receipt') {
        const receipt = this.host.store.receipts.get(record.id)
        if (!receipt || receipt.status === 'pending') return 'journal record the durable receipt state cannot corroborate'
        continue
      }
      if (this.host.store.triggers.get(record.id)) continue
      return 'journal record the durable Trigger state cannot corroborate'
    }
    return undefined
  }
}
export type { Decision }
