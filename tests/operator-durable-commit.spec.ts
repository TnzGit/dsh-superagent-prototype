/**
 * OL-20261126-055 subagent B (S1): ONE authoritative durable audit commit on a running Runtime — the SQLite audit ledger is the
 * authority and the JSONL journal is only its validated, idempotent projection. Covers the crash transitions the plan demands
 * (the durable commit before the external fsync, an external write that cannot land, a rolled-back transaction), a stale or
 * swapped journal root, token rotation without partial control, and the request bounds. Synthetic peers and disposable SQLite
 * only: no real Weixin, model, host service, or production state.
 */
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { threadKey } from '../src/core/index.ts'
import { OperatorReview, OPERATOR_TOKEN_FILE_ENV, journalLineOf } from '../src/app/operator-review.ts'
import { startRuntime, feishu, type Host } from './fixtures/host.ts'

const TOKEN = 'SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL'
const ROTATED = 'SYNTHETIC_ROTATED_TOKEN_ONLY_NEVER_REAL'
const journalOf = (h: Host) => join(h.directory, 'operator-review-journal.jsonl')
const operator = (token = TOKEN) => ({ 'x-operator-token': token })
/** A held native Weixin review receipt, landed straight in the durable outbox. */
const holdReceipt = (h: Host, id: string, reason = 'ambiguous_send') => h.runtime.store.receipts.add({
  id, kind: 'reply', text: 'synthetic', status: 'pending', claimed: false,
  channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 'approved-peer' } }, review: { at: '2026-11-26T00:00:00.000Z', reason } })
/** Rebuilds the operator service over the same durable store, exactly as a restart would. */
const reopen = (host: Host, journal = journalOf(host), token = TOKEN) =>
  new OperatorReview({ store: host.runtime.store, effects: host.runtime.effects, engine: host.runtime.engine, token, journal })

let h: Host, tokenDir: string, tokenFile: string
beforeEach(async () => {
  tokenDir = mkdtempSync(join(tmpdir(), 'ol055-durable-'))
  tokenFile = join(tokenDir, 'operator-token')
  writeFileSync(tokenFile, TOKEN, { mode: 0o600 })
  vi.stubEnv(OPERATOR_TOKEN_FILE_ENV, tokenFile)
  h = await startRuntime()
})
afterEach(async () => {
  await h.stop()
  vi.unstubAllEnvs()
  rmSync(tokenDir, { recursive: true, force: true })
})

it('the SQLite audit ledger is the authority: a lost external projection is re-projected on reopen and never re-sends', async () => {
  holdReceipt(h, 'durable-split')
  const response = await h.api('POST', 'operator/reconcile/durable-split', { outcome: 'no_resend' }, operator())
  expect(response.status).toBe(200)
  const journal = journalOf(h)
  // The split: the durable commit landed, the external fsync'd projection did not.
  writeFileSync(journal, '', { mode: 0o600 })
  expect(h.runtime.operatorReview!.journalStatus()).toEqual({ entries: 1, projected: 0, current: false })
  // Reopening re-projects the authoritative ledger instead of trusting the empty file.
  const reopened = reopen(h)
  expect(reopened.journalStatus().current).toBe(true)
  expect(readFileSync(journal, 'utf8').trim().split('\n')).toHaveLength(1)
  // The terminal receipt is durable: a replayed reviewed hold is refused, never a second send.
  const replay = await h.api('POST', 'operator/reconcile/durable-split', { outcome: 'confirmed_sent' }, operator())
  expect(replay.status).toBe(400)
  expect(replay.body).toMatchObject({ code: 'reviewHoldSettled' })
  expect(h.runtime.store.receipts.get('durable-split')!.status).toBe('dropped')
})

it('an external write that cannot land never declares an uncommitted effect accepted, and never touches the foreign file', async () => {
  holdReceipt(h, 'unwritable')
  const journal = journalOf(h)
  rmSync(journal, { force: true })
  // A foreign file behind a symlink at the journal path: the projection is refused after the durable commit.
  const foreign = join(h.directory, 'foreign.txt')
  writeFileSync(foreign, 'SENSITIVE FOREIGN PAYTEXT\n', { mode: 0o644 })
  symlinkSync(foreign, journal)
  const response = await h.api('POST', 'operator/reconcile/unwritable', { outcome: 'no_resend' }, operator())
  expect(response.status).toBe(500)
  expect(JSON.stringify(response.body)).not.toContain('SENSITIVE FOREIGN PAYTEXT')
  expect(String(response.body.error)).toMatch(/without following symlinks/)
  // The foreign file is neither modified nor read through; the durable terminal transition still holds.
  expect(statSync(foreign).mode & 0o777).toBe(0o644)
  expect(readFileSync(foreign, 'utf8')).toBe('SENSITIVE FOREIGN PAYTEXT\n')
  expect(h.runtime.store.receipts.get('unwritable')!.status).toBe('dropped')
  expect(h.runtime.store.operatorAudit.count()).toBe(1)
  // The reply effect was cancelled in the same transaction: nothing retries the ambiguous send.
  expect(h.runtime.effects.pending('reply', 'unwritable')).toBe(false)
})

it('a rolled-back transaction leaves no projection and no audit: the effect is never declared accepted', async () => {
  holdReceipt(h, 'rollback')
  const journal = journalOf(h)
  const before = readFileSync(journal, 'utf8')
  const review = new OperatorReview({ store: h.runtime.store,
    effects: { cancel: () => { throw new Error('effect cancellation failed') } },
    engine: h.runtime.engine, token: TOKEN, journal })
  expect(() => review.reconcile('rollback', 'no_resend')).toThrow(/effect cancellation failed/)
  // The savepoint rolled the whole transition back: the hold stays pending, nothing is audited, nothing is projected.
  expect(h.runtime.store.receipts.get('rollback')!.status).toBe('pending')
  expect(h.runtime.store.operatorAudit.count()).toBe(0)
  expect(readFileSync(journal, 'utf8')).toBe(before)
})

it('a terminal Trigger classification survives the external split: never lost, never re-classified', async () => {
  await h.runtime.settings.pause(true, 'panel')
  const trigger = feishu('77', 'please close this out')
  h.runtime.receive(trigger)
  await h.runtime.idle()
  const first = await h.api('POST', `operator/triggers/${trigger.id}/terminal`, undefined, operator())
  expect(first.status).toBe(200)
  expect(first.body).toMatchObject({ classified: true })
  // The split: the durable Decision and its audit committed, the external projection did not.
  writeFileSync(journalOf(h), '', { mode: 0o600 })
  const reopened = reopen(h)
  expect(reopened.journalStatus().current).toBe(true)
  expect(reopened.auditLedger()).toHaveLength(1)
  // Idempotent: a repeat reports classified:false and audits nothing new; the terminal classification is not lost.
  const again = await h.api('POST', `operator/triggers/${trigger.id}/terminal`, undefined, operator())
  expect(again.status).toBe(200)
  expect(again.body).toMatchObject({ classified: false })
  expect(h.runtime.store.operatorAudit.count()).toBe(1)
  const thread = h.runtime.store.threads.get(threadKey(trigger.threads[0]!))!
  expect(thread.pending).not.toContain(trigger.id)
  await h.runtime.settings.pause(false, 'panel')
  await h.runtime.idle()
  expect(h.runtime.store.tickets.list().map(ticket => ticket.triggerId)).not.toContain(trigger.id)
})

it('the durable audit ledger is sanitized: never the token, never payload text, never a provider string', async () => {
  holdReceipt(h, 'sanitized-audit')
  await h.api('POST', 'operator/reconcile/sanitized-audit', { outcome: 'no_resend' }, operator())
  const entries = h.runtime.store.operatorAudit.list(50)
  expect(entries).toHaveLength(1)
  expect(entries[0]!.id).toBe('sanitized-audit')
  expect(entries[0]!.outcome).toBe('no_resend')
  const text = JSON.stringify(entries)
  expect(text).not.toContain(TOKEN)
  expect(text).not.toContain('synthetic')
  expect(text).not.toContain('approved-peer')
  // The principal is a hash of the token, never the token itself.
  expect(entries[0]!.principal).toMatch(/^[0-9a-f]{12}$/)
})

it('the projection keeps a canonical field order, so a re-projection is exact and idempotent', async () => {
  holdReceipt(h, 'canonical')
  await h.api('POST', 'operator/reconcile/canonical', { outcome: 'confirmed_sent' }, operator())
  const line = readFileSync(journalOf(h), 'utf8').trim()
  const entry = h.runtime.store.operatorAudit.list(10)[0]!
  expect(journalLineOf(entry)).toBe(line)
  // Re-projecting the same ledger record adds nothing: the projection is idempotent.
  writeFileSync(journalOf(h), '', { mode: 0o600 })
  reopen(h)
  expect(readFileSync(journalOf(h), 'utf8').trim().split('\n')).toEqual([line])
  reopen(h)
  expect(readFileSync(journalOf(h), 'utf8').trim().split('\n')).toEqual([line])
})

it('a stale journal root is frozen with a shape-only diagnostic and never mutates anything', async () => {
  holdReceipt(h, 'stale-root')
  const journal = journalOf(h)
  await h.api('POST', 'operator/reconcile/stale-root', { outcome: 'no_resend' }, operator())
  // Another process's journal lands at the same path: its records are corroborated by nothing in our durable state.
  writeFileSync(journal, '{"at":"2026-11-26T00:00:00.000Z","kind":"receipt","id":"other-receipt","principal":"bbbbbbbbbbbb","outcome":"confirmed_sent"}\n', { mode: 0o600 })
  const review = reopen(h)
  expect(review.journalStatus().current).toBe(false)
  expect(review.ledger(50)).toEqual([]) // the sanitized read-only ledger still answers
  let message = ''
  try { review.reconcile('stale-root', 'no_resend') } catch (error) { message = String(error) }
  expect(message).toMatch(/cannot corroborate/)
  // The diagnostic never echoes the foreign line's content.
  expect(message).not.toContain('other-receipt')
  expect(h.runtime.store.receipts.get('stale-root')!.status).toBe('dropped')
})

it('token rotation takes effect on restart with no partial control: the old token is refused on every route', async () => {
  holdReceipt(h, 'rotated')
  expect((await h.api('GET', 'operator/reconcile/ledger', undefined, operator())).status).toBe(200)
  writeFileSync(tokenFile, ROTATED, { mode: 0o600 })
  await h.stop()
  h = await startRuntime()
  // The new token authorizes every operator route at once; the old one is refused everywhere (no partial control).
  expect((await h.api('GET', 'operator/reconcile/ledger', undefined, operator(TOKEN))).status).toBe(401)
  expect((await h.api('GET', 'operator/reconcile/ledger', undefined, operator(ROTATED))).status).toBe(200)
  expect((await h.api('POST', 'operator/reconcile/rotated', { outcome: 'no_resend' }, operator(TOKEN))).status).toBe(401)
  expect((await h.api('POST', 'operator/triggers/no-such-trigger/terminal', undefined, operator(TOKEN))).status).toBe(401)
  expect((await h.api('POST', 'operator/triggers/no-such-trigger/terminal', undefined, operator(ROTATED))).status).toBe(404)
  // The rotated grant is the only one the restarted Runtime holds, and it reconciles the hold exactly once.
  holdReceipt(h, 'rotated')
  expect((await h.api('POST', 'operator/reconcile/rotated', { outcome: 'no_resend' }, operator(ROTATED))).status).toBe(200)
  expect(h.runtime.store.receipts.get('rotated')!.status).toBe('dropped')
  // The new principal is a different hash of the new token, never the token itself; a replayed hold stays refused.
  const principal = h.runtime.store.operatorAudit.list(50)[0]!.principal
  expect(principal).toMatch(/^[0-9a-f]{12}$/)
  expect(h.runtime.store.receipts.get('rotated')!.operator!.principal).toBe(principal)
  expect((await h.api('POST', 'operator/reconcile/rotated', { outcome: 'no_resend' }, operator(ROTATED))).status).toBe(400)
})

it('request bounds are enforced: an oversized body, a clamped ledger limit, a strict outcome, and nothing accepted by a refused request', async () => {
  holdReceipt(h, 'bounded')
  const oversized = await h.api('POST', 'operator/reconcile/bounded', { outcome: 'no_resend', filler: 'x'.repeat(200 * 1024) }, operator())
  expect(oversized.status).toBe(400)
  expect(String(oversized.body.error)).toMatch(/exceeds/)
  const clamped = await h.api('GET', 'operator/reconcile/ledger?limit=100000', undefined, operator())
  expect(clamped.status).toBe(200)
  expect((clamped.body.receipts as unknown[]).length).toBeLessThanOrEqual(200)
  const badOutcome = await h.api('POST', 'operator/reconcile/bounded', { outcome: 'maybe', extra: 1 }, operator())
  expect(badOutcome.status).toBe(400)
  const notJson = await h.api('POST', 'operator/reconcile/bounded', undefined, operator())
  expect(notJson.status).toBe(400)
  // No refused request accepted anything: the hold is still pending and nothing was audited.
  expect(h.runtime.store.receipts.get('bounded')!.status).toBe('pending')
  expect(h.runtime.store.operatorAudit.count()).toBe(0)
})

it('already terminal receipts are replayed and refused: the projection stays append-only and current', async () => {
  holdReceipt(h, 'append-one')
  holdReceipt(h, 'append-two')
  expect((await h.api('POST', 'operator/reconcile/append-one', { outcome: 'no_resend' }, operator())).status).toBe(200)
  expect((await h.api('POST', 'operator/reconcile/append-two', { outcome: 'confirmed_sent' }, operator())).status).toBe(200)
  const lines = readFileSync(journalOf(h), 'utf8').trim().split('\n')
  expect(lines).toHaveLength(2)
  expect(h.runtime.operatorReview!.journalStatus()).toEqual({ entries: 2, projected: 2, current: true })
  // A replayed reviewed hold of an already terminal receipt is refused, never a second send.
  for (const id of ['append-one', 'append-two']) {
    const replay = await h.api('POST', `operator/reconcile/${id}`, { outcome: 'no_resend' }, operator())
    expect(replay.status).toBe(400)
    expect(replay.body).toMatchObject({ code: 'reviewHoldSettled' })
  }
  expect(readFileSync(journalOf(h), 'utf8').trim().split('\n')).toHaveLength(2)
  expect(h.runtime.store.receipts.get('append-one')!.status).toBe('dropped')
  expect(h.runtime.store.receipts.get('append-two')!.status).toBe('sent')
})
