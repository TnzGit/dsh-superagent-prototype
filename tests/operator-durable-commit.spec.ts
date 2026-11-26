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
import { OperatorReview, OPERATOR_TOKEN_FILE_ENV, journalLineOf, readOperatorToken } from '../src/app/operator-review.ts'
import { startRuntime, feishu, type Host } from './fixtures/host.ts'

const TOKEN = 'SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL'
const ROTATED = 'SYNTHETIC_ROTATED_TOKEN_ONLY_NEVER_REAL'
const journalOf = (h: Host) => join(h.directory, 'operator-review-journal.jsonl')
const operator = (token = TOKEN) => ({ 'x-operator-token': token })
/** A held native Weixin review receipt, landed straight in the durable outbox. */
const holdReceipt = (h: Host, id: string, reason = 'ambiguous_send') => {
  h.runtime.store.receipts.add({ id, kind: 'reply', text: 'synthetic',
    channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 'approved-peer' } } })
  h.runtime.store.receipts.holdForReview(id, reason)
}
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
  expect(h.runtime.store.tickets.list()).toHaveLength(0)
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
  const entry = h.runtime.operatorReview!.auditLedger(10)[0]!
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

it('token rotation takes effect only on reinstall, never hot: one grant governs every operator route at once', async () => {
  holdReceipt(h, 'rotated')
  expect((await h.api('GET', 'operator/reconcile/ledger', undefined, operator())).status).toBe(200)
  expect((await h.api('POST', 'operator/reconcile/rotated', { outcome: 'no_resend' }, operator())).status).toBe(200)
  const before = h.runtime.store.operatorAudit.list(50)[0]!.principal
  writeFileSync(tokenFile, ROTATED, { mode: 0o600 })
  // The grant is read once when the service is installed: the running service keeps the token it holds and never hot-swaps,
  // so a replaced grant file cannot leave the routes half-rotated.
  expect(h.runtime.operatorReview!.authorized(operator(TOKEN))).toBe(true)
  expect(h.runtime.operatorReview!.authorized(operator(ROTATED))).toBe(false)
  // What an install holds is exactly what the replaced file says: the old token is not read through.
  expect(readOperatorToken(tokenFile)).toBe(ROTATED)
  // A reinstall governs every operator route at once: the old token is refused everywhere, the new one accepted everywhere.
  const reinstalled = await startRuntime()
  expect((await reinstalled.api('GET', 'operator/reconcile/ledger', undefined, operator(TOKEN))).status).toBe(401)
  expect((await reinstalled.api('POST', 'operator/reconcile/anything', { outcome: 'no_resend' }, operator(TOKEN))).status).toBe(401)
  expect((await reinstalled.api('POST', 'operator/triggers/t1/terminal', undefined, operator(TOKEN))).status).toBe(401)
  expect((await reinstalled.api('GET', 'operator/reconcile/ledger', undefined, operator(ROTATED))).status).toBe(200)
  // A hold the reinstalled grant can reconcile lands exactly once; a replayed reviewed hold is refused, never a second send.
  holdReceipt(reinstalled, 'rotated-fresh')
  expect((await reinstalled.api('POST', 'operator/reconcile/rotated-fresh', { outcome: 'confirmed_sent' }, operator(ROTATED))).status).toBe(200)
  expect((await reinstalled.api('POST', 'operator/reconcile/rotated-fresh', { outcome: 'confirmed_sent' }, operator(ROTATED))).status).toBe(400)
  expect(reinstalled.runtime.store.receipts.get('rotated-fresh')!.status).toBe('sent')
  // The new principal is a different hash of the new token, never the token itself.
  const after = reinstalled.runtime.store.operatorAudit.list(50)[0]!.principal
  expect(after).toMatch(/^[0-9a-f]{12}$/)
  expect(after).not.toBe(before)
  expect(JSON.stringify(reinstalled.runtime.store.operatorAudit.list(50))).not.toContain(ROTATED)
  await reinstalled.stop()
  // A missing grant is not a partially installed one: without the file every route answers 404, never a partial 401.
  vi.unstubAllEnvs()
  const plain = await startRuntime()
  expect(plain.runtime.operatorReview).toBeUndefined()
  expect((await plain.api('GET', 'operator/reconcile/ledger', undefined, operator(ROTATED))).status).toBe(404)
  expect((await plain.api('POST', 'operator/reconcile/rotated', { outcome: 'no_resend' }, operator(ROTATED))).status).toBe(404)
  expect((await plain.api('POST', 'operator/triggers/t1/terminal', undefined, operator(ROTATED))).status).toBe(404)
  await plain.stop()
  vi.stubEnv(OPERATOR_TOKEN_FILE_ENV, tokenFile)
  // The pre-rotation terminal receipt on the original host stays terminal: rotation never reopens a closed outcome.
  expect(h.runtime.store.receipts.get('rotated')!.status).toBe('dropped')
  expect((await h.api('POST', 'operator/reconcile/rotated', { outcome: 'confirmed_sent' }, operator())).status).toBe(400)
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

it('the bearer window bounds requests and never accepts a refused one: reads and mutations are capped separately', async () => {
  const review = h.runtime.operatorReview!
  // Reads: the window admits exactly its bound, then refuses with how long to wait, and the refusal changes nothing.
  for (let i = 0; i < 120; i++) expect((await h.api('GET', 'operator/reconcile/ledger', undefined, operator())).status).toBe(200)
  const read = await h.api('GET', 'operator/reconcile/ledger', undefined, operator())
  expect(read.status).toBe(429)
  expect(String(read.body.error)).toMatch(/rate limit/)
  expect(Number(read.body.retry_after_ms)).toBeGreaterThan(0)
  // Mutations: a held receipt reconciled after the mutation window is over is refused, and it stays pending: a refused
  // request accepted nothing, so no send and no audit.
  holdReceipt(h, 'rate-mutation')
  for (let i = 0; i < 30; i++) {
    holdReceipt(h, `mut-${i}`)
    expect((await h.api('POST', `operator/reconcile/mut-${i}`, { outcome: 'no_resend' }, operator())).status).toBe(200)
  }
  const late = await h.api('POST', 'operator/reconcile/rate-mutation', { outcome: 'confirmed_sent' }, operator())
  expect(late.status).toBe(429)
  expect(h.runtime.store.receipts.get('rate-mutation')!.status).toBe('pending')
  // A refused request accepted nothing: the hold stays pending and its audit count did not grow.
  expect(h.runtime.store.operatorAudit.count()).toBe(30)
  // A read-only view is bounded too: the status route counts against the read window, not the mutation window.
  const status = await h.api('GET', 'operator/status', undefined, operator())
  expect(status.status).toBe(429)
  // The bound is per instance and per window: a fresh install admits its own first requests again.
  const fresh = await startRuntime()
  expect((await fresh.api('GET', 'operator/status', undefined, operator())).status).toBe(200)
  await fresh.stop()
})

it('the private status route demands the grant, projects no secret, and its one mutation pauses without sending anything', async () => {
  const unauthorized = await h.api('GET', 'operator/status', undefined, { 'x-operator-token': 'forged-forged-forged' })
  expect(unauthorized.status).toBe(401)
  const noHeader = await h.api('GET', 'operator/status', undefined, {})
  expect(noHeader.status).toBe(401)
  // Without the grant the whole operator surface is absent, not half-installed: the pause route answers 404 too.
  vi.unstubAllEnvs()
  const plain = await startRuntime()
  expect((await plain.api('POST', 'operator/executor/pause', { paused: true }, operator(ROTATED))).status).toBe(404)
  expect((await plain.api('GET', 'operator/status', undefined, operator(ROTATED))).status).toBe(404)
  await plain.stop()
  vi.stubEnv(OPERATOR_TOKEN_FILE_ENV, tokenFile)
  const view = await h.api('GET', 'operator/status', undefined, operator())
  expect(view.status).toBe(200)
  // The view says what is installed and where its state lives, and carries no secret, no payload and no peer.
  expect(view.body).toMatchObject({ build: { name: 'dsh-superagent', version: expect.any(String) },
    stateDir: h.runtime.machine.stateDir, executor: { paused: false } })
  expect(JSON.stringify(view.body)).not.toContain(TOKEN)
  expect(JSON.stringify(view.body)).not.toContain('approved-peer')
  expect(JSON.stringify(view.body)).not.toContain('synthetic')
  // The one safe mutation: pausing and resuming the controlled Executor, idempotently, with no outbound send behind it.
  const paused = await h.api('POST', 'operator/executor/pause', { paused: true }, operator())
  expect(paused.status).toBe(200)
  expect(paused.body).toEqual({ paused: true })
  expect((await h.api('POST', 'operator/executor/pause', { paused: true }, operator())).body).toEqual({ paused: true })
  expect((await h.api('GET', 'operator/status', undefined, operator())).body).toMatchObject({ executor: { paused: true } })
  // A paused Executor with a held receipt sends nothing: the hold stays pending, and nothing is audited by the pause.
  holdReceipt(h, 'paused-no-send')
  expect(h.runtime.store.receipts.get('paused-no-send')!.status).toBe('pending')
  expect(h.runtime.store.operatorAudit.count()).toBe(0)
  const resumed = await h.api('POST', 'operator/executor/pause', { paused: false }, operator())
  expect(resumed.body).toEqual({ paused: false })
  // The body is strict: a field it does not take, or a value that is not a boolean, is refused outright.
  expect((await h.api('POST', 'operator/executor/pause', { paused: 'yes' }, operator())).status).toBe(400)
  expect((await h.api('POST', 'operator/executor/pause', { paused: true, send: true }, operator())).status).toBe(400)
})

it('a projection fsynced before its transaction committed is caught by corroboration and frozen, never re-sent', async () => {
  // The split the other way round: the external line landed while the durable receipt stayed pending, as a crash between the
  // file fsync and the SQLite commit would leave it. Corroboration refuses to trust that line.
  holdReceipt(h, 'fsync-before-commit')
  const journal = journalOf(h)
  const line = JSON.stringify({ at: '2026-11-26T00:00:00.000Z', kind: 'receipt', id: 'fsync-before-commit',
    principal: h.runtime.operatorReview!.principal, outcome: 'confirmed_sent' })
  writeFileSync(journal, `${line}\n`, { mode: 0o600 })
  const review = reopen(h)
  expect(review.journalStatus().current).toBe(false)
  // Frozen: the mutation stops rather than trusting the file, and the receipt is still pending, so nothing was ever accepted.
  let message = ''
  try { review.reconcile('fsync-before-commit', 'no_resend') } catch (error) { message = String(error) }
  expect(message).toMatch(/cannot corroborate/)
  expect(h.runtime.store.receipts.get('fsync-before-commit')!.status).toBe('pending')
  expect(h.runtime.store.operatorAudit.count()).toBe(0)
  // The hold was never claimed for a send: the ledger's own read of it says so, and the freeze reports the shape only.
  expect(h.runtime.store.receipts.reviewLedger(50).find(item => item.id === 'fsync-before-commit')!.claimed).toBe(false)
  expect(message).not.toContain('confirmed_sent')
  // Recovery is a human step, not a repair: the ledger is the authority, so a human reconciles the file before mutating again.
  writeFileSync(journal, '', { mode: 0o600 })
  const recovered = reopen(h)
  expect(recovered.journalStatus().current).toBe(true)
  expect(recovered.ledger(50).map(receipt => receipt.id)).toContain('fsync-before-commit')
  expect((await h.api('POST', 'operator/reconcile/fsync-before-commit', { outcome: 'no_resend' }, operator())).status).toBe(200)
  expect(h.runtime.store.receipts.get('fsync-before-commit')!.status).toBe('dropped')
  expect((await h.api('POST', 'operator/reconcile/fsync-before-commit', { outcome: 'no_resend' }, operator())).status).toBe(400)
})
