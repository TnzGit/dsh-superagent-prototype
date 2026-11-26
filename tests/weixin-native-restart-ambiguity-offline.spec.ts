/** OL-055 S2.3 OFFLINE ONLY: cursor persistence + restart ambiguity with fake HTTP.
 * A fresh Store handle over the same disposable SQLite is the replayed state of a crashed process.
 * Restart with pending reviewed receipts and a terminal historical trigger must NOT auto-requeue,
 * auto-unpause, or re-egress; account swap and peer revocation fail closed. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { KV } from '../src/kv.ts'
import { key } from '../src/core/ids.ts'
import { threadKey } from '../src/core/index.ts'
import { Store } from '../src/app/store.ts'
import { messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'
import { nativeWeixinKind, pollNativeWeixin } from '../src/sources/weixin-native.ts'
import { startRuntime, type Host } from './fixtures/host.ts'
import { waitUntil } from './fixtures/async.ts'

const TOKEN_A = 'SYNTHETIC_OL055_ACCOUNT_A_ONLY_NEVER_REAL'
const TOKEN_B = 'SYNTHETIC_OL055_ACCOUNT_B_ONLY_NEVER_REAL'
const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')
const PEER = 'ol055-synthetic-peer'
const POLL = 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates'
const SEND = 'https://ilinkai.weixin.qq.com/ilink/bot/sendmessage'
const triggerId = (messageId: string) => key('weixin', messageId)

let h: Host
let parent: string
let credsFile: string
let pollBody: unknown[] = []
let pollRet = 0
let httpStatus = 200
const sent: Array<{ url: string; auth: string; body: Record<string, unknown> }> = []
let sendFaults: (() => Error)[] = []

function incoming(messageId: string) {
  return {
    message_id: messageId, from_user_id: PEER, message_type: 1, message_state: 2,
    create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_NOT_A_REAL_TOKEN',
    item_list: [{ type: 1, text_item: { text: 'synthetic inbound' } }],
  }
}
function writeCreds(token: string) {
  writeFileSync(credsFile, JSON.stringify({ token, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
  chmodSync(credsFile, 0o600)
}
function fakeFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    if (url === POLL && init.method === 'POST') {
      await new Promise(resolve => setTimeout(resolve, 5))
      if (httpStatus !== 200) return new Response('{"ret":0}', { status: httpStatus, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({
        ret: pollRet, errcode: 0, msgs: pollBody,
        get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url === SEND && init.method === 'POST') {
      sent.push({ url, auth: String((init.headers as Record<string, string>)?.Authorization),
        body: JSON.parse(String(init.body)) as Record<string, unknown> })
      const fault = sendFaults.shift()
      if (fault) throw fault()
      return new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw Error('OFFLINE EGRESS TRIPWIRE: ' + url)
  }))
}
async function pollPage(controller: AbortController) {
  const ctx = h.runtime.context(nativeWeixinKind)
  const running = pollNativeWeixin(ctx, controller.signal, trigger => h.runtime.routeNativeWeixin(trigger))
  await new Promise(resolve => setTimeout(resolve, 80))
  controller.abort()
  await running
  return ctx
}

beforeEach(async () => {
  parent = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol055-restart-')))
  credsFile = join(parent, 'synthetic-weixin-credentials.json')
  writeCreds(TOKEN_A)
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', credsFile)
  h = await startRuntime()
  h.runtime.sources.register(nativeWeixinKind)
  const settings = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...settings,
    sources: { ...settings.sources, weixin: { enabled: true, config: { allowedPeers: [{ id: PEER }] } } },
    policy: { ...settings.policy, sources: { ...settings.policy.sources, weixin: { allowed: [{ id: PEER, name: 'Synthetic Peer' }] } } } })
  sent.length = 0
  sendFaults = []
  pollBody = []
  pollRet = 0
  httpStatus = 200
  fakeFetch()
})
afterEach(async () => {
  await h.stop()
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  rmSync(parent, { recursive: true, force: true })
})

it('S2.3: the committed cursor is durable across a restart and the replayed poller sends it back to the provider', async () => {
  pollBody = [incoming('ol055-cursor-1')]
  const controller = new AbortController()
  await pollPage(controller)
  // Cursor committed after durable ingestion; trigger stored.
  expect(h.runtime.store.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(h.runtime.store.triggers.get(triggerId('ol055-cursor-1'))).toBeTruthy()
  // Restart model: fresh Store handle over the same disposable SQLite.
  const reopened = new Store(join(h.directory, 'orchestrator.sqlite'))
  try { expect(reopened.get(KV.weixin.nativeCursor)).toBe('cursor-after-page') } finally { reopened.close() }
  // The replayed poller offers the durable cursor to the provider; the replayed trigger is a duplicate.
  pollBody = [incoming('ol055-cursor-1')]
  const replay = new AbortController()
  await pollPage(replay)
  const calls = (vi.mocked(fetch).mock.calls as unknown as Array<[string, RequestInit]>)
    .filter(([url, init]) => url === POLL && init.method === 'POST')
  const pollCall = calls.at(-1)! // the replayed request, not the first page's request
  expect(JSON.parse(String(pollCall[1].body)).get_updates_buf).toBe('cursor-after-page')
  // Replay created no second trigger row and advanced nothing new.
  const rows = h.runtime.store.db.prepare('SELECT count(*) c FROM trigger WHERE id=?').get(triggerId('ol055-cursor-1')) as { c: number }
  expect(rows.c).toBe(1)
})

it('S2.3: a 401 poll failure never commits the cursor and the account identity stays pinned', async () => {
  pollBody = [incoming('ol055-401-1')]
  h.runtime.store.set(KV.weixin.nativeAccount, fingerprint(TOKEN_A)) // account already pinned: no rotation reset
  h.runtime.store.set(KV.weixin.nativeCursor, 'durable-cursor-before-failure')
  httpStatus = 401
  const controller = new AbortController()
  await pollPage(controller)
  expect(h.runtime.store.get(KV.weixin.nativeCursor)).toBe('durable-cursor-before-failure')
  expect(h.runtime.store.triggers.get(triggerId('ol055-401-1'))).toBeUndefined()
  httpStatus = 200
})

it('S2.3: a 429 poll failure keeps the durable cursor and the trigger un-ingested', async () => {
  pollBody = [incoming('ol055-429-1')]
  h.runtime.store.set(KV.weixin.nativeAccount, fingerprint(TOKEN_A)) // account already pinned: no rotation reset
  h.runtime.store.set(KV.weixin.nativeCursor, 'durable-cursor-before-throttle')
  httpStatus = 429
  const controller = new AbortController()
  await pollPage(controller)
  expect(h.runtime.store.get(KV.weixin.nativeCursor)).toBe('durable-cursor-before-throttle')
  expect(h.runtime.store.triggers.get(triggerId('ol055-429-1'))).toBeUndefined()
  httpStatus = 200
})

it('S2.3: ret -14 (stale bot) fails closed without committing the cursor and reports the pairing requirement', async () => {
  pollBody = [incoming('ol055-14-1')]
  h.runtime.store.set(KV.weixin.nativeAccount, fingerprint(TOKEN_A)) // account already pinned: no rotation reset
  h.runtime.store.set(KV.weixin.nativeCursor, 'durable-cursor-before-stale-bot')
  pollRet = -14
  const controller = new AbortController()
  const ctx = h.runtime.context(nativeWeixinKind)
  const running = pollNativeWeixin(ctx, controller.signal, trigger => h.runtime.routeNativeWeixin(trigger))
  await waitUntil(() => h.runtime.health['weixin']?.state === 'paused' || h.runtime.health['weixin']?.state === 'error')
  controller.abort()
  await running
  expect(h.runtime.store.get(KV.weixin.nativeCursor)).toBe('durable-cursor-before-stale-bot')
  expect(h.runtime.store.triggers.get(triggerId('ol055-14-1'))).toBeUndefined()
  expect(h.runtime.health['weixin']?.detail ?? '').toMatch(/pair|stale/i)
  pollRet = 0
})

it('S2.3: accepted-then-EOF is ambiguous and a restart over the same SQLite never replays the claim', async () => {
  pollBody = [incoming('ol055-eof-1')]
  const controller = new AbortController()
  await pollPage(controller)
  const trigger = messageToTrigger(incoming('ol055-eof-1') as never, fingerprint(TOKEN_A))!
  const id = 'ol055-eof-reply'
  sendFaults = [() => Error('synthetic accepted-then-EOF')]
  h.runtime.outbox.send({ id, kind: 'reply', text: 'Review pending', channel: trigger.channel! })
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(1) // the attempt happened once, acceptance is unknown
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('ambiguous_send')
  expect(h.runtime.store.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
  // Restart model over the SAME disposable SQLite: the claim survives and is never re-attempted automatically.
  const reopened = new Store(join(h.directory, 'orchestrator.sqlite'))
  try {
    expect(reopened.receipts.get(id)).toMatchObject({ status: 'pending', review: { reason: 'ambiguous_send' } })
    expect(reopened.receipts.claimOneShotSend(id)).toBe(false) // already claimed: a replayed claim cannot re-open it
  } finally { reopened.close() }
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(1) // zero second egress: real live resolution stays GATED to human reconciliation
})

it('S2.3: restart with a pending reviewed receipt and a terminal historical trigger does NOT auto-requeue or auto-unpause', async () => {
  // Seed the crashed process's durable state BEFORE the runtime opens it: a terminal (ignored) trigger
  // already decided, its thread with an empty pending queue, and a reviewed pending receipt.
  const trigger = messageToTrigger(incoming('ol055-terminal-1') as never, fingerprint(TOKEN_A))!
  const receiptId = 'ol055-seeded-review'
  h = await startRuntime(seed => {
    seed.triggers.save(trigger)
    seed.threads.save({ key: threadKey(trigger.threads[0]!), pending: [], subscriptions: [], context: [], correlated: [], meta: {},
      createdAt: trigger.at, lastAt: trigger.at } as never)
    seed.decisions.save({ id: 'seed-decision', evalId: 'seed-eval', threadKey: threadKey(trigger.threads[0]!),
      triggerIds: [trigger.id], policyVersion: 'v1', at: trigger.at, kind: 'ignore',
      reason: [{ code: 'notRequest' } as never], strength: 'explicit' } as never)
    seed.receipts.add({ id: receiptId, kind: 'reply', text: 'Review pending', channel: trigger.channel! })
    seed.receipts.claimOneShotSend(receiptId)
    seed.receipts.holdForReview(receiptId, 'ambiguous_send')
  })
  h.runtime.sources.register(nativeWeixinKind)
  const settings = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...settings,
    sources: { ...settings.sources, weixin: { enabled: true, config: { allowedPeers: [{ id: PEER }] } } } })
  fakeFetch()
  // The restart's first pass: the terminal trigger is NOT requeued and the reviewed receipt is NOT replayed.
  await h.runtime.pump()
  expect(h.runtime.store.threads.get(threadKey(trigger.threads[0]!))?.pending).toEqual([])
  expect(h.runtime.store.threads.get(threadKey(trigger.threads[0]!))?.evaluating).toBeUndefined()
  const row = h.runtime.store.receipts.get(receiptId)!
  expect(row.status).toBe('pending')
  expect(row.review?.reason).toBe('ambiguous_send')
  expect(sent).toHaveLength(0) // zero egress after the restart
  // The reviewed receipt has no retry effect; repeated pumps leave it alone.
  for (let i = 0; i < 3; i++) await h.runtime.pump()
  expect(sent).toHaveLength(0)
  expect(h.runtime.store.receipts.get(receiptId)?.status).toBe('pending')
  // An explicit reevaluate of the terminal trigger keeps the decision: no fresh Eval for a settled trigger's queue.
  expect(h.runtime.engine.reevaluate(trigger.id)).toBe(true)
})

it('S2.3: account swap after the crash fails closed — the replayed runtime sends nothing for the old account', async () => {
  pollBody = [incoming('ol055-swap-1')]
  const controller = new AbortController()
  await pollPage(controller)
  const trigger = messageToTrigger(incoming('ol055-swap-1') as never, fingerprint(TOKEN_A))!
  const id = 'ol055-swap-reply'
  h.runtime.outbox.send({ id, kind: 'reply', text: 'Review pending', channel: trigger.channel! })
  // Simulate the crash model: rotate the credentials to another synthetic account, then replay over the same SQLite.
  writeCreds(TOKEN_B)
  const reopened = new Store(join(h.directory, 'orchestrator.sqlite'))
  try { expect(reopened.receipts.get(id)).toMatchObject({ status: 'pending' }) } finally { reopened.close() }
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(0) // fail closed: the current credentials no longer match the receipt's account hash
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('account_mismatch')
})

it('S2.3: peer revocation before the replayed delivery settles the receipt dropped with zero egress (fail closed)', async () => {
  pollBody = [incoming('ol055-revoke-1')]
  const controller = new AbortController()
  await pollPage(controller)
  const trigger = messageToTrigger(incoming('ol055-revoke-1') as never, fingerprint(TOKEN_A))!
  const id = 'ol055-revoke-reply'
  h.runtime.outbox.send({ id, kind: 'reply', text: 'Review pending', channel: trigger.channel! })
  // Restart model with the peer removed from the allowlist before anything is delivered.
  const settings = h.runtime.store.settings()
  h.runtime.store.saveSettings({ ...settings, sources: { ...settings.sources,
    weixin: { enabled: true, config: { allowedPeers: [] } } } })
  await h.runtime.sendReplies()
  expect(sent).toHaveLength(0)
  expect(h.runtime.store.receipts.get(id)?.status).toBe('dropped')
  expect(h.runtime.store.receipts.get(id)?.dropped?.reason).toBe('channelIgnored')
  expect(h.runtime.store.receipts.get(id)?.singleSendAttemptAt).toBeFalsy()
})
