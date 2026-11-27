/** OL-052 P3: the installed native Weixin fake-delivery vertical.
 * REAL application code path end to end with fake transport only:
 * fake getupdates -> pollNativeWeixin -> native Trigger -> real Engine intake ->
 * Decision/Ticket -> disposable Worker Sessions with a MOCKED deterministic agent
 * (zero real model turns) -> orchestrator_report ready -> the ACTUAL installed
 * nativeWeixinKind source -> durable SQLite Outbox -> fake sendmessage acceptance
 * AND ambiguous-EOF -> review or sent.
 *
 * SIMULATED: this is NOT a real Weixin account, peer, QR, network, model turn,
 * original host state, or production source Apply. Real live resolution stays
 * GATED: only human reconciliation against a genuine peer with server-side
 * idempotency may settle a review hold (docs/018 runbook). */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { OutboundMessage } from '../src/core/index.ts'
import { key } from '../src/core/ids.ts'
import { Store } from '../src/app/store.ts'
import { messageToTrigger, WEIXIN_REPLY_MAX_AGE_MS } from '../src/local-first/weixin-native-protocol.ts'
import { nativeWeixinKind, pollNativeWeixin } from '../src/sources/weixin-native.ts'
import { startRuntime, type Host } from './fixtures/host.ts'
import { waitUntil } from './fixtures/async.ts'

const TOKEN_A = 'SYNTHETIC_WEIXIN_ACCOUNT_A_ONLY_NEVER_REAL'
const TOKEN_B = 'SYNTHETIC_WEIXIN_ACCOUNT_B_ONLY_NEVER_REAL'
const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')
const PEER = 'ol052-synthetic-peer'
const PROJECT = 'ol052-fixture'
const POLL = 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates'
const SEND = 'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage'

let h: Host
let parent: string
let source: string
let credsFile: string
const sent: Array<{ url: string; auth: string; body: Record<string, unknown> }> = []
let pollMessages: unknown[] = []
let pollFaults: (() => Error)[] = []
let sendFaults: (() => Error)[] = []

function incoming(messageId: string, text: string) {
  return {
    message_id: messageId, from_user_id: PEER, message_type: 1, message_state: 2,
    create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_NOT_A_REAL_TOKEN',
    item_list: [{ type: 1, text_item: { text } }],
  }
}
const triggerId = (input: { message_id: string }) => key('weixin', input.message_id)

function writeCreds(token: string) {
  writeFileSync(credsFile, JSON.stringify({ token, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
  chmodSync(credsFile, 0o600)
}

function fakeFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    if (url === POLL && init.method === 'POST') {
      // Yield a real macrotask so the test's timers can run while the loop spins.
      await new Promise(resolve => setTimeout(resolve, 5))
      const fault = pollFaults.shift()
      if (fault) throw fault()
      const body = JSON.parse(String(init.body)) as { get_updates_buf?: string }
      return new Response(JSON.stringify({
        ret: 0, errcode: 0,
        msgs: body.get_updates_buf === '' ? pollMessages : [],
        get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url === SEND && init.method === 'POST') {
      // Record the acceptance shape BEFORE any fault so accepted-then-EOF still counts as one attempt.
      sent.push({ url, auth: String((init.headers as Record<string, string>)?.Authorization),
        body: JSON.parse(String(init.body)) as Record<string, unknown> })
      const fault = sendFaults.shift()
      if (fault) throw fault()
      return new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200,
        headers: { 'content-type': 'application/json' } })
    }
    throw Error('OFFLINE EGRESS TRIPWIRE: ' + url)
  }))
}

/** Runs the REAL native poll loop against the real SourceContext until the fake page's trigger is durably ingested, then stops the loop. */
async function pollOnePage(input: { message_id: string }) {
  const controller = new AbortController()
  const ctx = h.runtime.context(nativeWeixinKind)
  const running = pollNativeWeixin(ctx, controller.signal, trigger => h.runtime.routeNativeWeixin(trigger))
  await waitUntil(() => h.runtime.store.triggers.get(triggerId(input)) !== undefined)
  controller.abort()
  await running
}
function nativeTrigger(index = 0) {
  const trigger = messageToTrigger(pollMessages[index] as never, fingerprint(TOKEN_A))!
  expect(trigger.channel).toBeTruthy()
  return trigger
}
async function at(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + ms })
  try { await h.runtime.pump(); await h.runtime.sendReplies() } finally { vi.useRealTimers() }
}

beforeEach(async () => {
  parent = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol052-vertical-')))
  const stateDir = join(parent, 'state')
  const registered = join(parent, 'registered')
  source = join(registered, PROJECT)
  mkdirSync(stateDir, { recursive: true, mode: 0o700 })
  mkdirSync(source, { recursive: true, mode: 0o700 })
  writeFileSync(join(source, 'before.txt'), 'ORIGINAL\n')
  writeFileSync(join(source, 'to-delete.txt'), 'DELETE ONLY IN COPY\n')
  writeFileSync(join(source, '.env'), 'FIXTURE SECRET EXCLUDED\n', { mode: 0o600 })
  credsFile = join(parent, 'synthetic-weixin-credentials.json')
  writeCreds(TOKEN_A)
  const registryFile = join(parent, 'local-projects.json')
  writeFileSync(registryFile, JSON.stringify({ allowedRoots: [registered],
    projects: [{ id: PROJECT, root: source, kind: 'local' }] }), { mode: 0o600 })
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', credsFile)
  vi.stubEnv('DSH_SUPERAGENT_LOCAL_PROJECTS_FILE', registryFile)
  h = await startRuntime()
  h.runtime.sources.register(nativeWeixinKind)
  const settings = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...settings,
    sources: { ...settings.sources, weixin: { enabled: true, config: { allowedPeers: [{ id: PEER }] } } },
    policy: { ...settings.policy, sources: { ...settings.policy.sources, weixin: { allowed: [{ id: PEER, name: 'Synthetic Peer' }] } } } })
  expect(h.runtime.sources.instance('weixin')?.enabled).toBe(true)
  expect(h.runtime.configured()).toBe(true)
  sent.length = 0
  pollFaults = []
  sendFaults = []
  pollMessages = []
  fakeFetch()
})
afterEach(async () => {
  await h.stop()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  rmSync(parent, { recursive: true, force: true })
})

it('fake getupdates poll enters the REAL Engine, opens a Ticket, runs the disposable Worker snapshot, and the installed native source delivers both replies as fake acceptances', async () => {
  pollMessages = [incoming('ol052-vertical-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  // Real Engine intake with a real durable trigger row; no OpenClaw relay installed,
  // so routeNativeWeixin returns false and the real ctx.receive path ingests it.
  const row = h.runtime.store.triggers.get(triggerId(pollMessages[0] as { message_id: string }))!
  expect(row.channel?.source).toBe('weixin')
  const ticket = await h.acceptedTicket(nativeTrigger())
  expect(ticket.ticket.execution?.projectId).toBe(PROJECT)
  // The worker workspace is a disposable isolated COPY with the original bytes; the
  // registered source is never written, and the excluded secret never enters the copy.
  expect(readFileSync(join(ticket.ticket.execution!.directory, 'before.txt'), 'utf8')).toBe('ORIGINAL\n')
  expect(existsSync(join(ticket.ticket.execution!.directory, '.env'))).toBe(false)
  await h.runTool(ticket.sessionId, 'orchestrator_report',
    { state: 'ready', summary: 'Fixture preview; original unchanged (SIMULATED worker report)' })
  const result = await h.runTool(h.runtime.masterId, 'orchestrator_reply',
    { ticket_id: ticket.ticket.id, purpose: 'result', text: 'Review pending, no source apply' }) as { status: string }
  expect(result.status).toBe('sent')
  // Installed native source + durable SQLite Outbox + fake sendmessage acceptance:
  // the acknowledgement and the result reply are BOTH settled 'sent' with exactly one egress each.
  expect(sent).toHaveLength(2)
  for (const item of sent) {
    expect(item.url).toBe(SEND)
    expect(item.auth).toBe('Bearer ' + TOKEN_A)
    const msg = item.body.msg as Record<string, unknown>
    expect(msg.to_user_id).toBe(PEER)
    expect(msg.context_token).toBe('SYNTHETIC_CONTEXT_NOT_A_REAL_TOKEN')
  }
  expect(sent[1]!.body.msg as Record<string, unknown>).toMatchObject({ client_id: expect.stringMatching(/^dsh-[a-f0-9]{32}$/) })
  const settled = h.runtime.store.db.prepare("SELECT id FROM outbox WHERE json_extract(value,'$.status')='sent' ORDER BY rowid").all() as { id: string }[]
  expect(settled).toHaveLength(2)
  // The original registered source is byte-identical (NO production Apply happened).
  expect(readFileSync(join(source, 'before.txt'), 'utf8')).toBe('ORIGINAL\n')
  expect(readFileSync(join(source, 'to-delete.txt'), 'utf8')).toBe('DELETE ONLY IN COPY\n')
  expect(readFileSync(join(source, '.env'), 'utf8')).toBe('FIXTURE SECRET EXCLUDED\n')
})

it('a duplicate incoming message ID is ingested exactly once by the real Engine intake', async () => {
  pollMessages = [incoming('ol052-dup-1', '/project ' + PROJECT + '\nEdit isolated copy only'),
    incoming('ol052-dup-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const rows = h.runtime.store.db.prepare('SELECT count(*) c FROM trigger WHERE id=?').get(triggerId(pollMessages[0] as { message_id: string })) as { c: number }
  expect(rows.c).toBe(1)
})

it('the same result text replayed for one Ticket reuses the reply ID and never re-sends (one durable row, one egress)', async () => {
  pollMessages = [incoming('ol052-double-queue-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const ticket = await h.acceptedTicket(nativeTrigger())
  await h.runTool(ticket.sessionId, 'orchestrator_report', { state: 'ready', summary: 'SIMULATED ready' })
  const first = await h.runTool(h.runtime.masterId, 'orchestrator_reply',
    { ticket_id: ticket.ticket.id, purpose: 'result', text: 'Review pending' }) as { status: string }
  expect(first.status).toBe('sent')
  expect(sent).toHaveLength(2) // acknowledgement + result
  const before = sent.length
  const replay = await h.runTool(h.runtime.masterId, 'orchestrator_reply',
    { ticket_id: ticket.ticket.id, purpose: 'result', text: 'Review pending' }) as { status: string }
  expect(replay.status).toBe('sent')
  expect(sent).toHaveLength(before)
  const count = h.runtime.store.db.prepare("SELECT count(*) c FROM outbox WHERE json_extract(value,'$.kind')='reply' AND json_extract(value,'$.status')='sent'").get() as { c: number }
  expect(count.c).toBe(1)
})

it('while the weixin Source is disabled the durable receipt waits with zero egress, and after re-enable the installed source sends it exactly once', async () => {
  pollMessages = [incoming('ol052-off-on-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const outbound: OutboundMessage = { id: 'ol052-off-on-reply', kind: 'reply', text: 'Review pending', channel: nativeTrigger().channel! }
  const settings = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...settings, sources: { ...settings.sources,
    weixin: { enabled: false, config: { allowedPeers: [{ id: PEER }] } } } })
  h.runtime.outbox.send(outbound)
  await h.runtime.sendReplies()
  expect(h.runtime.outbox.status(outbound.id)).toBe('pending')
  expect(h.runtime.store.receipts.get(outbound.id)?.review).toBeFalsy()
  expect(sent).toHaveLength(0)
  const current = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...current, sources: { ...current.sources,
    weixin: { enabled: true, config: { allowedPeers: [{ id: PEER }] } } } })
  await at(5000)
  expect(h.runtime.outbox.status(outbound.id)).toBe('sent')
  expect(sent).toHaveLength(1)
})

it('a peer revoked before delivery is settled dropped channelIgnored with zero egress and no claim', async () => {
  pollMessages = [incoming('ol052-revoked-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const outbound: OutboundMessage = { id: 'ol052-revoked-reply', kind: 'reply', text: 'Review pending', channel: nativeTrigger().channel! }
  h.runtime.outbox.send(outbound)
  const settings = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...settings, sources: { ...settings.sources, weixin: { enabled: true, config: { allowedPeers: [] } } } })
  await h.runtime.sendReplies()
  expect(h.runtime.outbox.status(outbound.id)).toBe('dropped')
  expect(h.runtime.store.receipts.get(outbound.id)?.dropped?.reason).toBe('channelIgnored')
  expect(h.runtime.store.receipts.get(outbound.id)?.singleSendAttemptAt).toBeFalsy()
  expect(sent).toHaveLength(0)
})

it('an ambiguous-EOF review hold blocks a later same-ticket reply indefinitely and the reviewed row is never replayed', async () => {
  pollMessages = [incoming('ol052-backpressure-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const channel = nativeTrigger().channel!
  const first: OutboundMessage = { id: 'ol052-eof-first', kind: 'reply', text: 'Earlier message', channel, ticketId: 'ol052-synthetic-ticket' }
  const later: OutboundMessage = { id: 'ol052-eof-later', kind: 'reply', text: 'Later message', channel, ticketId: 'ol052-synthetic-ticket' }
  sendFaults = [() => Error('synthetic accepted-then-EOF')]
  h.runtime.outbox.send(first)
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(1)
  expect(h.runtime.store.receipts.get(first.id)?.review?.reason).toBe('ambiguous_send')
  expect(h.runtime.outbox.status(first.id)).toBe('pending')
  h.runtime.outbox.send(later)
  await h.runtime.sendReplies()
  // The later message stays queued behind the reviewed earlier row; the reviewed one is never attempted again.
  expect(sent).toHaveLength(1)
  expect(h.runtime.outbox.status(later.id)).toBe('pending')
  // A review hold has no retry effect: the later message stays blocked indefinitely
  // (real live resolution stays GATED: only human reconciliation may settle the hold).
  for (let i = 0; i < 4; i++) await at(300_000)
  expect(h.runtime.outbox.status(later.id)).toBe('pending')
  expect(sent).toHaveLength(1)
  expect(h.runtime.outbox.status(first.id)).toBe('pending')
  expect(h.runtime.store.receipts.get(first.id)?.review?.reason).toBe('ambiguous_send')
})

it('a crash after the durable claim, replayed over the SAME disposable SQLite, holds for review with zero second egress', async () => {
  pollMessages = [incoming('ol052-restart-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const channel = nativeTrigger().channel!
  const id = 'ol052-restart-reply'
  h.runtime.outbox.send({ id, kind: 'reply', text: 'Review pending', channel })
  expect(h.runtime.store.receipts.claimOneShotSend(id)).toBe(true)
  // OL-052 restart model: a fresh Store handle over the same disposable SQLite is the crashed process's replayed state.
  const reopened = new Store(join(h.directory, 'orchestrator.sqlite'))
  try {
    expect(reopened.receipts.get(id)).toMatchObject({ status: 'pending' })
    expect(reopened.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
    expect(reopened.receipts.add({ id, kind: 'reply', text: 'duplicate-injection', channel })).toBe(false)
    expect(reopened.receipts.get(id)?.text).toBe('Review pending')
    expect(reopened.receipts.claimOneShotSend(id)).toBe(false)
  } finally { reopened.close() }
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(0)
  const row = h.runtime.store.receipts.get(id)!
  expect(row.status).toBe('pending')
  expect(row.review?.reason).toBe('ambiguous_send')
  expect(row.singleSendAttemptAt).toBeTruthy()
})

it('credentials rotated to another synthetic account before the pump hold the reply for review with zero egress', async () => {
  pollMessages = [incoming('ol052-account-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const channel = nativeTrigger().channel!
  expect(channel.address.accountHash).toBe(fingerprint(TOKEN_A))
  writeCreds(TOKEN_B)
  const outbound: OutboundMessage = { id: 'ol052-account-reply', kind: 'reply', text: 'Review pending', channel }
  h.runtime.outbox.send(outbound)
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(0)
  expect(h.runtime.store.receipts.get(outbound.id)?.review?.reason).toBe('account_mismatch')
})

it('a reply whose synthetic reply window already expired is held for review with zero egress (an old credential cannot send a newer context)', async () => {
  pollMessages = [incoming('ol052-expired-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  await pollOnePage(pollMessages[0] as { message_id: string })
  const stale = messageToTrigger({ ...(pollMessages[0] as Record<string, unknown>), create_time_ms: Date.now() - WEIXIN_REPLY_MAX_AGE_MS - 60_000 } as never, fingerprint(TOKEN_A))!
  const outbound: OutboundMessage = { id: 'ol052-expired-reply', kind: 'reply', text: 'Late reply', channel: stale.channel! }
  h.runtime.outbox.send(outbound)
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(0)
  expect(h.runtime.outbox.status(outbound.id)).toBe('pending')
  expect(h.runtime.store.receipts.get(outbound.id)?.review?.reason).toBe('context_expired_or_unbounded')
})

it('a fake poll transport fault keeps the loop error-reported and the trigger out of the Engine and the Outbox', async () => {
  pollMessages = [incoming('ol052-poll-fault-1', '/project ' + PROJECT + '\nEdit isolated copy only')]
  pollFaults = [() => TypeError('synthetic poll EOF')]
  const controller = new AbortController()
  const ctx = h.runtime.context(nativeWeixinKind)
  const running = pollNativeWeixin(ctx, controller.signal, trigger => h.runtime.routeNativeWeixin(trigger))
  await waitUntil(() => h.runtime.health['weixin']?.state === 'error')
  controller.abort()
  await running
  expect(h.runtime.store.triggers.get(triggerId(pollMessages[0] as { message_id: string }))).toBeUndefined()
  expect(sent).toHaveLength(0)
  expect(h.runtime.store.receipts.waiting()).toHaveLength(0)
})
