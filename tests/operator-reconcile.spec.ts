/**
 * OL-20261125-054 subagent B: the operator-private reconciliation interface (docs/018, OL-054 M4) on a running Runtime with a
 * synthetic 0600 grant file — authentication, race and refusal behaviour, the irreversible fsynced audit journal, and the
 * idempotent historical-intake regression that keeps a replayed Trigger from becoming a second Ticket or a second outbound reply.
 * Synthetic peers and disposable SQLite only: no real Weixin, model, host service, or production state.
 */
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { key, threadKey } from '../src/core/index.ts'
import { messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'
import { OperatorReview, OPERATOR_TOKEN_FILE_ENV } from '../src/app/operator-review.ts'
import { startRuntime, feishu, type Host } from './fixtures/host.ts'

const TOKEN = 'SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL'
const WEIXIN_PEER = 'approved-peer'
const journalOf = (h: Host) => join(h.directory, 'operator-review-journal.jsonl')
const operator = (token = TOKEN) => ({ 'x-operator-token': token })
/** A native Weixin inbound message as the real Source parses it; `accountHash` fingerprints the synthetic account token. */
function native(messageId: string, accountHash: string) {
  return messageToTrigger({ message_id: messageId, from_user_id: WEIXIN_PEER, message_type: 1, message_state: 2,
    create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_NOT_A_REAL_TOKEN',
    item_list: [{ type: 1, text_item: { text: 'synthetic inbound' } }] }, accountHash)!
}
const fingerprint = (token: string) => key('weixin-account', token)
/** Advance the clock past the retry backoff and run one pass, as the main Outbox harness does. */
async function at(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + ms })
  try { await h.runtime.pump(); await h.runtime.sendReplies() } finally { vi.useRealTimers() }
}
/** The fake native Weixin kind every hold test uses: the preflight reason is the durable hold's first reason. */
const heldKind = (preflight: (message: { id: string }) => { status: 'review'; reason: string } | { status: 'ready' }) => ({
  kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
  schema: z.object({}).strict(), fields: [],
  channel: { preflight, send: async () => 'sent' as const, link: () => ({ url: '', label: { zh: '', en: '' } }) },
})
const enableWeixin = (h: Host) => h.runtime.store.saveSettings({ ...h.runtime.store.settings(),
  sources: { ...h.runtime.store.settings().sources, weixin: { enabled: true, config: {} } } })
const heldReceipt = (id: string, reason = 'ambiguous_send') => ({ id, kind: 'reply' as const, text: 'synthetic',
  channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } }, review: { at: expect.any(String), reason } })

let h: Host, tokenFile: string, tokenDir: string
beforeEach(async () => {
  tokenDir = mkdtempSync(join(tmpdir(), 'ol054-operator-'))
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

it('installs the private reconciliation service only with the grant, and never exposes it or the token in public state', async () => {
  // A Runtime without the grant answer 404: the interface is not installed, not merely unauthorized.
  vi.unstubAllEnvs()
  const plain = await startRuntime()
  expect((await plain.api('GET', 'operator/reconcile/ledger')).status).toBe(404)
  expect((await plain.api('POST', 'operator/reconcile/anything', { outcome: 'no_resend' })).status).toBe(404)
  expect((await plain.api('POST', 'operator/triggers/x/terminal')).status).toBe(404)
  expect(plain.runtime.operatorReview).toBeUndefined()
  await plain.stop()
  vi.stubEnv(OPERATOR_TOKEN_FILE_ENV, tokenFile)
  expect(h.runtime.operatorReview).toBeInstanceOf(OperatorReview)
  const state = await h.api('GET', 'state')
  expect(state.status).toBe(200)
  expect(JSON.stringify(state.body)).not.toContain(TOKEN)
  expect(state.body.weixinOutboxReview).toEqual({ total: 0, reasons: {} })
})

it('a forged or missing token is rejected, and only the operator token reaches the ledger', async () => {
  const forged = await h.api('GET', 'operator/reconcile/ledger', undefined, operator('SYNTHETIC-FORGED-TOKEN-VALUE-X'))
  expect(forged.status).toBe(401)
  expect((await h.api('GET', 'operator/reconcile/ledger')).status).toBe(401)
  expect((await h.api('POST', 'operator/reconcile/whatever', { outcome: 'no_resend' }, operator('SYNTHETIC-FORGED-TOKEN-VALUE-X'))).status).toBe(401)
  expect((await h.api('POST', 'operator/triggers/x/terminal', undefined, operator('SYNTHETIC-FORGED-TOKEN-VALUE-X'))).status).toBe(401)
  const ok = await h.api('GET', 'operator/reconcile/ledger', undefined, operator())
  expect(ok.status).toBe(200)
  expect(ok.body).toEqual({ receipts: [] })
  // A non-same-origin listener is refused before the token is ever considered.
  const intruder = await h.api('GET', 'operator/reconcile/ledger', undefined, { host: 'evil.example:3082', 'x-operator-token': TOKEN })
  expect(intruder.status).toBe(403)
})

it('the ledger projects only the sanitized receipt: never payload text, peer, context token or credential', async () => {
  h.runtime.sources.register(heldKind(() => ({ status: 'review', reason: 'account_mismatch' })))
  enableWeixin(h)
  const message = { id: 'held-receipt-1', kind: 'reply' as const, text: 'REAL PAYTEXT NEVER SHOWN', ticketId: 'ticket-9',
    channel: { source: 'weixin', thread: 'weixin:peer-secret', address: { peer: 'peer-secret', contextToken: 'SYNTHETIC_CONTEXT' } } }
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  const ledger = await h.api('GET', 'operator/reconcile/ledger', undefined, operator())
  expect(ledger.status).toBe(200)
  expect(ledger.body.receipts).toEqual([{ id: 'held-receipt-1', kind: 'reply', ticketId: 'ticket-9', claimed: false,
    reviewAt: expect.any(String), reason: 'account_mismatch' }])
  const text = JSON.stringify(ledger.body)
  for (const secret of ['REAL PAYTEXT', 'peer-secret', 'SYNTHETIC_CONTEXT', TOKEN]) expect(text).not.toContain(secret)
  // The public aggregate stays a redacted count, unchanged by the operator interface.
  const state = await h.api('GET', 'state')
  expect(state.body.weixinOutboxReview).toEqual({ total: 1, reasons: { account_mismatch: 1 } })
})

it('duplicate operator clicks and two competing controllers produce exactly one durable effect and one journal record', async () => {
  h.runtime.sources.register(heldKind(() => ({ status: 'review', reason: 'ambiguous_send' })))
  enableWeixin(h)
  const message = { id: 'race-receipt', kind: 'reply' as const, text: 'synthetic', channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } } }
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  const first = await h.api('POST', 'operator/reconcile/race-receipt', { outcome: 'no_resend' }, operator())
  const second = await h.api('POST', 'operator/reconcile/race-receipt', { outcome: 'confirmed_sent' }, operator())
  expect(first.status).toBe(200)
  expect(first.body).toMatchObject({ id: 'race-receipt', status: 'dropped', outcome: 'no_resend', journal: true })
  expect(String(first.body.principal)).toMatch(/^[a-f0-9]{12}$/)
  // The second click (another controller, another request) changes nothing and is refused.
  expect(second.status).toBe(400)
  expect(second.body).toMatchObject({ code: 'reviewHoldSettled' })
  const receipt = h.runtime.store.receipts.get(message.id)!
  expect(receipt.status).toBe('dropped')
  expect(receipt.dropped).toMatchObject({ reason: 'operatorNoResend' })
  // The forensic hold and the one-shot claim survive terminalization, and the claim is never reset.
  expect(receipt.review).toMatchObject({ reason: 'ambiguous_send' })
  const journal = readFileSync(journalOf(h), 'utf8').trim().split('\n')
  expect(journal).toHaveLength(1)
  expect(JSON.parse(journal[0]!)).toMatchObject({ kind: 'receipt', id: 'race-receipt', outcome: 'no_resend', principal: first.body.principal })
  expect(journal[0]!).not.toContain(TOKEN)
  // The settled ID leaves the ledger and nothing re-sends it.
  expect((await h.api('GET', 'operator/reconcile/ledger', undefined, operator())).body.receipts).toEqual([])
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get(message.id)?.status).toBe('dropped')
})

it('only an explicit confirmation marks a hold sent; a terminal classification never resends the same ID', async () => {
  h.runtime.sources.register(heldKind(() => ({ status: 'review', reason: 'ambiguous_send' })))
  enableWeixin(h)
  const message = { id: 'confirm-sent', kind: 'reply' as const, text: 'synthetic', channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } } }
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get('confirm-sent')?.status).toBe('pending')
  const confirmed = await h.api('POST', 'operator/reconcile/confirm-sent', { outcome: 'confirmed_sent' }, operator())
  expect(confirmed.status).toBe(200)
  expect(confirmed.body).toMatchObject({ status: 'sent', outcome: 'confirmed_sent' })
  const receipt = h.runtime.store.receipts.get('confirm-sent')!
  expect(receipt).toMatchObject({ status: 'sent', review: { reason: 'ambiguous_send' } })
  expect(receipt.dropped).toBeUndefined()
  // Reusing the settled ID (a new message for the same conversation needs a NEW id) is refused and never re-sent.
  const reuse = await h.api('POST', 'operator/reconcile/confirm-sent', { outcome: 'no_resend' }, operator())
  expect(reuse.status).toBe(400)
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get('confirm-sent')?.status).toBe('sent')
})

it('an unknown ID and an already-settled ID are both refused, and never reopened', async () => {
  const unknown = await h.api('POST', 'operator/reconcile/no-such-receipt', { outcome: 'no_resend' }, operator())
  expect(unknown.status).toBe(400)
  expect(unknown.body).toMatchObject({ code: 'reviewHoldSettled', error: expect.stringContaining('not a pending') })
  // A pending Weixin receipt with no review hold is not the operator's to settle either.
  h.runtime.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [], channel: { send: async () => 'sent' as const, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  enableWeixin(h)
  const held = { id: 'settled-already', kind: 'reply' as const, text: 'synthetic', channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } } }
  h.runtime.store.receipts.add(held)
  h.runtime.store.receipts.settle(held, 'sent')
  const settled = await h.api('POST', 'operator/reconcile/settled-already', { outcome: 'no_resend' }, operator())
  expect(settled.status).toBe(400)
  expect(settled.body).toMatchObject({ code: 'reviewHoldSettled' })
  expect(h.runtime.store.receipts.get('settled-already')?.status).toBe('sent')
})

it('an account swap mid-review leaves the hold frozen: the reconcile records the hold it found, not a resend', async () => {
  h.runtime.sources.register(heldKind(() => ({ status: 'review', reason: 'account_mismatch' })))
  enableWeixin(h)
  const before = fingerprint('SYNTHETIC_WEIXIN_ACCOUNT_A_ONLY_NEVER_REAL')
  const message = { id: 'account-swap', kind: 'reply' as const, text: 'synthetic',
    channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's', accountHash: before, contextToken: 'SYNTHETIC_CONTEXT' } } }
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get('account-swap')?.review?.reason).toBe('account_mismatch')
  // The account changes while the hold is under review; nothing about the hold is rewritten and nothing is sent.
  const after = fingerprint('SYNTHETIC_WEIXIN_ACCOUNT_B_ONLY_NEVER_REAL')
  h.runtime.store.saveSettings({ ...h.runtime.store.settings(),
    sources: { ...h.runtime.store.settings().sources, weixin: { enabled: true, config: { allowedPeers: [{ id: 's' }] } } } })
  const reviewAt = h.runtime.store.receipts.get('account-swap')?.review?.at
  const ledger = await h.api('GET', 'operator/reconcile/ledger', undefined, operator())
  expect(ledger.body.receipts).toEqual([{ id: 'account-swap', kind: 'reply', claimed: false, reviewAt: reviewAt, reason: 'account_mismatch' }])
  const settled = await h.api('POST', 'operator/reconcile/account-swap', { outcome: 'no_resend' }, operator())
  expect(settled.status).toBe(200)
  const receipt = h.runtime.store.receipts.get('account-swap')!
  expect(receipt.review).toMatchObject({ reason: 'account_mismatch', at: reviewAt })
  expect(after).not.toBe(before)
})

it('a terminal-marked reviewed acknowledgement releases the later same-ticket reply behind it', async () => {
  h.runtime.sources.register(heldKind(message => message.id === 'reviewed-ack'
    ? { status: 'review', reason: 'account_mismatch' } : { status: 'ready' }))
  enableWeixin(h)
  const channel = { source: 'weixin', thread: 'weixin:peer', address: { peer: 'peer' } }
  h.runtime.outbox.send({ id: 'reviewed-ack', kind: 'acknowledgement', text: 'ack', ticketId: 'ticket-1', channel })
  h.runtime.outbox.send({ id: 'later-reply', kind: 'reply', text: 'answer', ticketId: 'ticket-1', channel })
  await h.runtime.sendReplies()
  // Held, the acknowledgement blocks the reply behind it.
  expect(h.runtime.store.receipts.get('later-reply')?.status).toBe('pending')
  expect(h.runtime.store.receipts.get('reviewed-ack')?.review?.reason).toBe('account_mismatch')
  const settled = await h.api('POST', 'operator/reconcile/reviewed-ack', { outcome: 'no_resend' }, operator())
  expect(settled.status).toBe(200)
  // The settled ack no longer holds the queue: once the held row's backoff passes, the reply goes out unchanged.
  await at(5_000)
  expect(h.runtime.store.receipts.get('reviewed-ack')?.status).toBe('dropped')
  expect(h.runtime.store.receipts.get('later-reply')?.status).toBe('sent')
})

it('two controllers racing the same ID concurrently still produce one durable effect', async () => {
  h.runtime.sources.register(heldKind(() => ({ status: 'review', reason: 'ambiguous_send' })))
  enableWeixin(h)
  const message = { id: 'concurrent-race', kind: 'reply' as const, text: 'synthetic', channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } } }
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  // Two operators click at the same time on two different controllers.
  const [first, second] = await Promise.all([
    h.api('POST', 'operator/reconcile/concurrent-race', { outcome: 'no_resend' }, operator()),
    h.api('POST', 'operator/reconcile/concurrent-race', { outcome: 'confirmed_sent' }, operator()),
  ])
  const codes = [first.status, second.status].sort()
  expect(codes).toEqual([200, 400])
  const settled = h.runtime.store.receipts.get('concurrent-race')!
  // Exactly one transition: the winner's outcome, the forensic hold intact, one journal line.
  expect(['sent', 'dropped']).toContain(settled.status)
  expect(settled.review).toMatchObject({ reason: 'ambiguous_send' })
  expect(readFileSync(journalOf(h), 'utf8').trim().split('\n')).toHaveLength(1)
})

it('an interrupted journal record freezes reconciliation with a human-reconciliation error, and nothing is repaired', async () => {
  h.runtime.sources.register(heldKind(() => ({ status: 'review', reason: 'ambiguous_send' })))
  enableWeixin(h)
  const message = { id: 'frozen-receipt', kind: 'reply' as const, text: 'synthetic', channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } } }
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  // A partial durable write (the crash between the append and its fsync) leaves a tail the journal cannot answer.
  appendFileSync(journalOf(h), '{"at":"2026-11-25T00:00:00.000Z","kind":"rec')
  const reopened = new OperatorReview({ store: h.runtime.store, effects: h.runtime.effects, engine: h.runtime.engine,
    token: TOKEN, journal: journalOf(h) })
  expect(reopened.ledger(50)).toEqual([{ id: 'frozen-receipt', kind: 'reply', claimed: false, reviewAt: expect.any(String), reason: 'ambiguous_send' }])
  expect(() => reopened.reconcile('frozen-receipt', 'no_resend')).toThrow(/reconciliation is frozen until a human reconciles it/)
  expect(() => reopened.classifyTrigger('whatever-trigger')).toThrow(/frozen/)
  // Uncertain receipts stay frozen: the hold is untouched and no repair was attempted.
  expect(h.runtime.store.receipts.get('frozen-receipt')).toMatchObject({ status: 'pending', review: { reason: 'ambiguous_send' } })
  expect(readFileSync(journalOf(h), 'utf8').endsWith(',"kind":"rec')).toBe(true)
})

it('a pending Trigger is classified terminal without a Ticket, is idempotent, and leaves its row and receipts alone', async () => {
  // While processing is paused, a recorded Trigger stays queued for its next Eval: that is the queue the operator closes.
  await h.runtime.settings.pause(true, 'panel')
  const trigger = feishu('40', 'please look at this')
  h.runtime.receive(trigger)
  await h.runtime.idle()
  const threadKeyOf = threadKey(trigger.threads[0]!)
  expect(h.runtime.store.threads.get(threadKeyOf)!.pending).toContain(trigger.id)
  const first = await h.api('POST', `operator/triggers/${trigger.id}/terminal`, undefined, operator())
  expect(first.status).toBe(200)
  expect(first.body).toMatchObject({ triggerId: trigger.id, classified: true, decision: expect.any(String) })
  // Durable: the ignore Decision exists and the Trigger left the queue, but its row was not deleted.
  expect(h.runtime.store.triggers.get(trigger.id)).toBeDefined()
  expect(h.runtime.store.threads.get(threadKeyOf)!.pending).not.toContain(trigger.id)
  expect(h.runtime.store.decisions.byThread(threadKeyOf).some(item => item.kind === 'ignore'
    && item.reason.some(reason => reason.code === 'operatorTerminal'))).toBe(true)
  const again = await h.api('POST', `operator/triggers/${trigger.id}/terminal`, undefined, operator())
  expect(again.status).toBe(200)
  expect(again.body).toMatchObject({ classified: false })
  // Processing resumes: the settled Trigger can never become a Ticket.
  await h.runtime.settings.pause(false, 'panel')
  await h.runtime.idle()
  expect(h.runtime.store.tickets.list()).toHaveLength(0)
  // A fresh message still works end to end: exactly one Ticket.
  const fresh = await h.acceptedTicket(feishu('41', 'a new request'))
  expect(fresh.ticket).toBeDefined()
  const journal = readFileSync(journalOf(h), 'utf8').trim().split('\n')
  expect(journal.filter(line => JSON.parse(line).kind === 'trigger')).toHaveLength(1)
  expect(journal.every(line => !line.includes(TOKEN))).toBe(true)
})

it('a Trigger a live Eval holds is refused, never silently dropped (fail-closed)', async () => {
  const trigger = feishu('42', 'under assessment')
  h.runtime.receive(trigger)
  await h.runtime.idle()
  // The auto-mode pass started an Eval that holds the Trigger.
  expect(h.runtime.store.triggers.disposition(trigger.id)?.evalId).toBeDefined()
  const refused = await h.api('POST', `operator/triggers/${trigger.id}/terminal`, undefined, operator())
  expect(refused.status).toBe(400)
  expect(refused.body).toMatchObject({ code: 'triggerEvaluated', error: expect.stringContaining('holds this trigger') })
  // Nothing was dropped: the Trigger is still held by its Eval and its queue membership is intact.
  expect(h.runtime.store.triggers.get(trigger.id)).toBeDefined()
  const thread = h.runtime.store.threads.get(threadKey(trigger.threads[0]!))!
  expect(thread.evaluating?.triggerIds).toContain(trigger.id)
})

it('a Trigger that already carries a Decision, and one that is unknown, are both refused', async () => {
  const accepted = await h.acceptedTicket(feishu('43', 'already routed'))
  const routed = await h.api('POST', `operator/triggers/${accepted.trigger.id}/terminal`, undefined, operator())
  expect(routed.status).toBe(400)
  expect(routed.body).toMatchObject({ code: 'triggerSettled', error: expect.stringContaining('already carries a Decision') })
  const unknown = await h.api('POST', 'operator/triggers/no-such-trigger/terminal', undefined, operator())
  expect(unknown.status).toBe(404)
  expect(unknown.body).toMatchObject({ code: 'unknownTrigger' })
})

it('replayed historical intake on a paused source-only instance creates no Ticket and no second outbound reply (OL-053 11 to 12)', async () => {
  const account = fingerprint('SYNTHETIC_WEIXIN_ACCOUNT_A_ONLY_NEVER_REAL')
  await h.runtime.settings.pause(true, 'panel')
  // The first ingestion of a historical message (trigger 11) while processing is paused: recorded, never assessed or answered.
  const historical = native('synthetic-historical-11', account)
  expect(h.runtime.receive(historical)).toBe('stored')
  await h.runtime.idle()
  expect(h.runtime.store.tickets.list()).toHaveLength(0)
  expect(h.runtime.store.threads.get(threadKey(historical.threads[0]!))!.pending).toContain(historical.id)
  // The same provider message arrives again (the OL-053 re-ingestion): duplicate identity, zero new Tickets, zero sends.
  expect(h.runtime.receive(native('synthetic-historical-11', account))).toBe('duplicate')
  await h.runtime.idle()
  expect(h.runtime.store.tickets.list()).toHaveLength(0)
  expect(h.runtime.store.receipts.waiting()).toHaveLength(0)
  // An outbound reply for the replayed Trigger stays one durable receipt: the same ID is never queued twice.
  const reply = h.runtime.engine.reply({ purpose: 'answer', triggerId: historical.id, text: 'handled earlier' })
  expect(reply.reused).toBe(false)
  const replay = h.runtime.engine.reply({ purpose: 'answer', triggerId: historical.id, text: 'handled earlier' })
  expect(replay.reused).toBe(true)
  expect(replay.id).toBe(reply.id)
  expect(h.runtime.store.receipts.waiting()).toHaveLength(1)
  // A fresh message (trigger 12) still reaches the queue exactly once; nothing is ticketed or sent while paused.
  const fresh = native('synthetic-fresh-12', account)
  expect(h.runtime.receive(fresh)).toBe('stored')
  await h.runtime.idle()
  expect(h.runtime.store.tickets.list()).toHaveLength(0)
  // Terminal classification of the historical Trigger, then processing resumes: it can never become a Ticket.
  const terminal = await h.api('POST', `operator/triggers/${historical.id}/terminal`, undefined, operator())
  expect(terminal.status).toBe(200)
  h.runtime.sources.register(heldKind(() => ({ status: 'ready' })))
  await h.runtime.settings.pause(false, 'panel')
  await h.runtime.idle()
  await h.runtime.sendReplies()
  expect(h.runtime.store.tickets.list()).toHaveLength(0)
  // The historical Trigger is settled terminal and its row untouched; the single queued reply went out exactly once, same ID.
  expect(h.runtime.store.triggers.get(historical.id)).toBeDefined()
  expect(h.runtime.store.threads.get(threadKey(historical.threads[0]!))!.pending).not.toContain(historical.id)
  expect(h.runtime.store.receipts.get(reply.id)).toMatchObject({ status: 'sent' })
  expect(h.runtime.store.receipts.waiting()).toHaveLength(0)
  // The fresh message still works end to end through the Feishu path: exactly one Ticket, one acknowledgement.
  const worked = await h.acceptedTicket(feishu('44', 'a genuinely new request'))
  expect(worked.ticket).toBeDefined()
})
