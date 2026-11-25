/** Operator-private live reconciliation (OL-054 M4): an authenticated loopback-only interface for listing and settling held native Weixin review receipts, and for terminal classification of pending Triggers, with an irreversible owner-only audit journal. */
import { constants, closeSync, existsSync, fchmodSync, fsyncSync, fstatSync, lstatSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs'
import { createHash, timingSafeEqual } from 'node:crypto'
import { isAbsolute } from 'node:path'
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
/** One durable audit record: sanitized (ID, kind, outcome, principal hash) — never peer IDs, payload text, tokens or provider strings. */
export interface OperatorJournalRecord { at: string; kind: 'receipt' | 'trigger'; id: string; outcome?: OperatorOutcome; principal: string }

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
    if (!stats.isFile() || (stats.mode & 0o077) !== 0 || stats.size > 64 * 1024)
      throw new Error('Operator reconcile token must be an owner-owned, owner-only regular file (max 64 KiB)')
    if (process.getuid && stats.uid !== process.getuid())
      throw new Error('Operator reconcile token must be owned by the current user')
    const token = readFileSync(fd, 'utf8').trim()
    if (token.length < 16) throw new Error('Operator reconcile token must be at least 16 characters')
    return token
  } finally { closeSync(fd) }
}

export interface OperatorReviewHost {
  store: Store
  effects: Pick<Effects, 'cancel'>
  engine: Pick<Engine, 'classifyPendingTrigger'>
  /** The token read from the private grant file; the only secret this service holds. */
  token: string
  /** Path of the append-only, owner-only, fsynced audit journal (inside the 0700 state directory). */
  journal: string
}

/**
 * The operator-private reconciliation service, installed only when the private 0600 grant exists (docs/018 runbook, OL-054 M4).
 * Auth: requests must carry `x-operator-token`, compared in constant time against hashes of the token; same-origin and loopback are enforced by the HTTP layer.
 * Reconciliation is first-writer-wins: exactly one durable terminal transition per receipt ID, journaled and fsynced inside the same Store transaction; a duplicate click or a second controller gets a refusal, never a second effect.
 * A terminal classification never resets the durable one-shot claim, never resends the same ID, and never marks an ambiguous hold sent without an explicit confirmation; a warranted follow-up needs a NEW message ID.
 * The journal is append-only with no repair: an interrupted (partial or malformed) tail freezes every mutation and reports a human-reconciliation error, while the sanitized ledger stays readable and uncertain receipts stay frozen.
 */
export class OperatorReview {
  /** A stable hash of the token, published in audit records in place of the secret itself. */
  private readonly principal: string
  private readonly tokenHash: Buffer
  private readonly frozen?: string
  private readonly host: OperatorReviewHost
  constructor(host: OperatorReviewHost) {
    this.host = host
    this.tokenHash = createHash('sha256').update(host.token).digest()
    this.principal = this.tokenHash.toString('hex').slice(0, 12)
    if (!existsSync(host.journal)) writeFileSync(host.journal, '', { mode: 0o600 })
    else fchmodSync(openSync(host.journal, constants.O_RDWR), 0o600)
    this.frozen = this.inspectJournal()
  }
  /** Whether `headers` carry the operator's private token (constant-time over SHA-256 digests, so length and content do not leak). */
  authorized(headers: IncomingMessage['headers']): boolean {
    const supplied = headers['x-operator-token']
    if (typeof supplied !== 'string') return false
    return timingSafeEqual(createHash('sha256').update(supplied).digest(), this.tokenHash)
  }
  /** The read-only sanitized reconciliation ledger (docs/018): it stays readable even when the journal is frozen. */
  ledger(limit = 50): { id: string; kind: 'acknowledgement' | 'reply' | 'notice'; ticketId?: string; claimed: boolean; claimedAt?: string; reviewAt: string; reason: WeixinReviewReason }[] {
    return this.host.store.receipts.reviewLedger(limit)
  }
  /**
   * Reconciles ONE held receipt by exact ID: the single durable, irreversible terminal transition, journaled and fsynced inside the same
   * Store transaction as the compare-and-swap, then the pending `reply` effect is cancelled so nothing retries it.
   * @throws UserError `reviewHoldSettled` when the ID is unknown, already terminal, or never a pending Weixin review hold (also the
   * first-writer-wins refusal for a duplicate click or the losing controller of a race); a frozen journal throws a plain error (HTTP 500).
   */
  reconcile(id: string, outcome: OperatorOutcome): { id: string; status: 'sent' | 'dropped'; outcome: OperatorOutcome; principal: string; journal: true } {
    this.assertUnfrozen()
    const { store, effects } = this.host
    return store.atomic(() => {
      const receipt = store.receipts.get(id)
      if (!receipt || receipt.channel.source !== 'weixin' || receipt.status !== 'pending' || !receipt.review) throw new UserError('reviewHoldSettled')
      if (!store.receipts.operatorSettleReview(id, outcome, this.principal)) throw new UserError('reviewHoldSettled')
      this.append({ at: new Date().toISOString(), kind: 'receipt', id, outcome, principal: this.principal })
      effects.cancel('reply', id)
      const settled = store.receipts.get(id)!
      return { id, status: settled.status as 'sent' | 'dropped', outcome, principal: this.principal, journal: true as const }
    })
  }
  /**
   * Terminal classification of ONE pending Trigger by exact ID: a durable ignore Decision that takes it out of its Thread's queue
   * without deleting the Trigger row or any receipt, so it can never become a Ticket after processing resumes. Idempotent (a repeat
   * reports `classified: false` and journals nothing); fails closed when a live Eval already holds the Trigger, and refuses a Trigger
   * that already carries a different Decision or one that is not pending.
   */
  classifyTrigger(triggerId: string): { triggerId: string; classified: boolean; decision: string } {
    this.assertUnfrozen()
    return this.host.store.atomic(() => {
      const result = this.host.engine.classifyPendingTrigger(triggerId)
      if (!result.already) this.append({ at: new Date().toISOString(), kind: 'trigger', id: triggerId, principal: this.principal })
      return { triggerId, classified: !result.already, decision: result.decision.id }
    })
  }
  private assertUnfrozen(): void {
    if (this.frozen) throw new Error(`Operator review journal has an interrupted record; reconciliation is frozen until a human reconciles it: ${this.frozen}`)
  }
  /** Appends one audit record and fsyncs it; the journal is append-only, and nothing here rewrites or repairs it. */
  private append(record: OperatorJournalRecord): void {
    const fd = openSync(this.host.journal, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT)
    try { writeSync(fd, `${JSON.stringify(record)}\n`); fsyncSync(fd) } finally { closeSync(fd) }
  }
  /** Whether the journal's last record is incomplete or malformed, which freezes every mutation until a human reconciles it. */
  private inspectJournal(): string | undefined {
    let text: string
    try { text = readFileSync(this.host.journal, 'utf8') } catch { return undefined }
    const lines = text.split('\n').filter(line => line.length > 0)
    if (!lines.length) return undefined
    const last = lines[lines.length - 1]!
    try {
      const record = JSON.parse(last) as OperatorJournalRecord
      if (record.kind !== 'receipt' && record.kind !== 'trigger') return `unrecognized journal record: ${last}`
      if (typeof record.at !== 'string' || typeof record.id !== 'string' || typeof record.principal !== 'string') return `incomplete journal record: ${last}`
      return undefined
    } catch { return `interrupted journal record: ${last}` }
  }
}
export type { Decision }
