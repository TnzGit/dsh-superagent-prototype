/** OL-055 S2.2 OFFLINE ONLY: durable replay suppression proof past the FIFO 2000-entry seen set.
 * Replaying more than 2000 distinct updates followed by an old update cannot create a second
 * executable Ticket or outbound claim, because the Engine trigger-ID backstop lives in durable
 * SQLite (trigger rows are never pruned). Includes provider message-ID collision/absence/malformed
 * variants, and proves fresh legitimate messages are never silently dropped. */
import { afterEach, expect, test, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KV } from '../src/kv.ts'
import { key } from '../src/core/ids.ts'
import { pollNativeWeixin, nativeWeixinKind, NATIVE_SEEN_MAX } from '../src/sources/weixin-native.ts'
import { messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'
import { Engine, MemoryRepositories, type Candidate, type OutboundMessage, type Policy, type ReceiveResult, type Repositories, type Trigger } from '../src/core/index.ts'
import { Store } from '../src/app/store.ts'
import { SourceRegistry } from '../src/sources/registry.ts'
import { SettingsSchema } from '../src/policy.ts'
import type { SourceContext } from '../src/sources/host.ts'

const tempPaths: string[] = []
afterEach(() => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks()
  for (const folder of tempPaths.splice(0)) rmSync(folder, { recursive: true, force: true })
})

const TOKEN = 'SYNTHETIC_OL055_DEDUP_TOKEN_ONLY_NEVER_REAL'
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex')
const triggerId = (messageId: string) => key('weixin', messageId)

function incoming(peer: string, messageId: string) {
  return {
    message_id: messageId, from_user_id: peer, message_type: 1, message_state: 2,
    create_time_ms: 1783488000000, context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
    item_list: [{ type: 1, text_item: { text: '/project ol055-fixture' } }],
  }
}

function fakeLoop(messages: unknown[], initial?: Map<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ol055-dedup-'))
  tempPaths.push(dir)
  const file = join(dir, 'fake-credentials.json')
  writeFileSync(file, JSON.stringify({ token: TOKEN, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', file)
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    if (url !== 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates' || init.method !== 'POST')
      throw Error('S2.2 OFFLINE TEST FORBIDS OUTBOUND: ' + url)
    return new Response(JSON.stringify({ ret: 0, errcode: 0, msgs: messages, get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000 }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  const controller = new AbortController()
  const records = initial ?? new Map<string, unknown>([
    [KV.weixin.nativeAccount, hashOf(TOKEN)],
    [KV.weixin.nativeCursor, 'cursor-before-page'],
  ])
  const received: unknown[] = []
  const ctx = {
    ready: Promise.resolve(),
    configured: () => true,
    config: () => nativeWeixinKind.schema.parse({ allowedPeers: ['peer-allowed', 'peer-two'].map(id => ({ id })) }),
    state: {
      get: (k: string) => records.get(k),
      set: (k: string, v: unknown) => { if (v === undefined) records.delete(k); else records.set(k, v) },
    },
    receive: async (trigger: unknown) => { received.push(trigger); return { status: 'stored' } },
    threads: { describe: vi.fn() },
    report: (_: string, item: { state: string }) => {
      if (item.state === 'ready' && !controller.signal.aborted) controller.abort()
      if (item.state === 'error') controller.abort()
    },
  } as unknown as SourceContext
  return { ctx, controller, records, received, file }
}

/** Paused-executor engine harness: only an explicit accept creates a Ticket and its acknowledgement. */
function engineHarness(repos: Repositories = new MemoryRepositories()) {
  const requests: Candidate[] = []
  const assessor = { request: vi.fn((candidate: Candidate) => { requests.push(candidate) }), release: vi.fn() }
  const executor = { start: vi.fn(), deliver: vi.fn(), stop: vi.fn() }
  const outbound: OutboundMessage[] = []
  const outbox = { send: vi.fn((message: OutboundMessage) => { outbound.push(message) }), status: vi.fn(), withdraw: vi.fn() }
  const policy: Policy = { version: 'v1', paused: true, evalTimeoutMs: 60_000,
    gate: () => ({ admissible: true, strength: 'explicit', basis: { source: 'weixin', scope: {}, addressed: 'direct', via: 'addressed' } }),
    revalidate: () => true, admitsInferred: () => true }
  const registry = new SourceRegistry(() => SettingsSchema.parse({
    paused: true,
    sources: { weixin: { enabled: true, config: { allowedPeers: [{ id: 'peer-allowed' }, { id: 'peer-two' }].map(id => ({ id })) } } },
    policy: { sources: { weixin: { allowed: [{ id: 'peer-allowed', name: 'Operator' }, { id: 'peer-two', name: 'Two' }] } } } }))
  registry.register(nativeWeixinKind)
  const engine = new Engine({ repo: repos, scope: registry, policy: () => policy, assessor, executor, outbox })
  return { engine, requests, outbound, countTickets: () => repos.tickets.list().length }
}

test('S2.2: replaying more than NATIVE_SEEN_MAX distinct updates, then an old update, creates NO second executable Ticket', { timeout: 60_000 }, async () => {
  const { engine, outbound, countTickets } = engineHarness()
  // 1. The old update enters through the real source poller into the real Engine, and the operator accepts it.
  const first = fakeLoop([incoming('peer-allowed', 'old-1')])
  first.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(first.ctx, first.controller.signal)
  engine.decide(triggerId('old-1'), { kind: 'accept', title: 'Old', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(1)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1)

  // 2. Replay NATIVE_SEEN_MAX + 500 distinct fresh updates: the FIFO seen set evicts 'old-1'.
  const many = Array.from({ length: NATIVE_SEEN_MAX + 500 }, (_, i) => incoming('peer-allowed', 'bulk-' + i))
  const bulk = fakeLoop(many, first.records)
  bulk.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(bulk.ctx, bulk.controller.signal)
  const seen = bulk.records.get(KV.weixin.nativeSeen(hashOf(TOKEN))) as string[]
  expect(seen).toContain(triggerId('bulk-' + (many.length - 1))) // newest kept
  expect(seen).not.toContain(triggerId('old-1')) // the old ID was evicted from the FIFO window

  // 3. Replay the OLD update again. The seen set cannot suppress it (it was evicted), so the source
  // hands it to the Engine, whose durable trigger-ID backstop answers 'duplicate' — no second Ticket,
  // no second outbound claim, no second assessment.
  const replay = fakeLoop([incoming('peer-allowed', 'old-1')], bulk.records)
  let engineResult: ReceiveResult | undefined
  replay.ctx.receive = async (t: unknown) => { engineResult = engine.receive(t as Trigger); return engineResult }
  await pollNativeWeixin(replay.ctx, replay.controller.signal)
  expect(engineResult).toBe('duplicate') // Engine backstop fired; the source never swallowed it either
  expect(countTickets()).toBe(1) // still exactly one executable Ticket
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1) // no second acknowledgement

  // 4. A replayed accept of the old trigger returns the EARLIER decision and spawns nothing new.
  engine.decide(triggerId('old-1'), { kind: 'accept', title: 'Old', scope: 'fixture', reason: 'request' })
  expect(countTickets()).toBe(1)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1)

  // 5. Fresh legitimate messages are NOT silently dropped by the bounded set: a brand-new ID after
  // full eviction still enters exactly once and can open exactly one new Ticket.
  const fresh = fakeLoop([incoming('peer-allowed', 'fresh-after-eviction')], replay.records)
  fresh.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(fresh.ctx, fresh.controller.signal)
  engine.decide(triggerId('fresh-after-eviction'), { kind: 'accept', title: 'Fresh', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(2)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(2)
})

test('S2.2: the trigger-ID backstop is DURABLE across a store restart, not just in-memory', { timeout: 60_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ol055-durable-dedup-'))
  tempPaths.push(dir)
  const dbPath = join(dir, 'orchestrator.sqlite')
  const store = new Store(dbPath)
  const { engine, outbound, countTickets } = engineHarness(store)
  const first = fakeLoop([incoming('peer-allowed', 'old-1')])
  first.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(first.ctx, first.controller.signal)
  engine.decide(triggerId('old-1'), { kind: 'accept', title: 'Old', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(1)
  store.close()
  // Replay over a FRESH handle: the same process restart model as the outbox spec.
  const reopened = new Store(dbPath)
  const { engine: engine2, countTickets: count2 } = engineHarness(reopened)
  expect(engine2.receive(messageToTrigger(incoming('peer-allowed', 'old-1'), hashOf(TOKEN))!)).toBe('duplicate')
  expect(count2()).toBe(1) // the one durable Ticket survives; the replayed trigger spawns no second one
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1) // the earlier accept's ack, unchanged
  reopened.close()
})

test('S2.2: provider message-ID collision — the same ID from a second peer cannot create a second Ticket', { timeout: 30_000 }, async () => {
  const { engine, outbound, countTickets } = engineHarness()
  const a = fakeLoop([incoming('peer-allowed', 'collide-7')])
  a.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(a.ctx, a.controller.signal)
  engine.decide(triggerId('collide-7'), { kind: 'accept', title: 'C', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(1)

  // Same provider message_id, different peer, replayed through a live seen set:
  // the source dedups by trigger ID, so the second peer's collision never re-enters.
  const b = fakeLoop([incoming('peer-two', 'collide-7')], a.records)
  b.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(b.ctx, b.controller.signal)
  expect(b.received).toHaveLength(0) // source-level suppression on the seen ID
  expect(countTickets()).toBe(1)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1)
})

test('S2.2: absent provider message-ID falls back to a stable item msg_id identity; replay is suppressed once and only once', { timeout: 30_000 }, async () => {
  const { engine, countTickets, outbound } = engineHarness()
  const noId = { from_user_id: 'peer-allowed', message_type: 1, message_state: 2,
    create_time_ms: 1783488000000, context_token: 'SYNTHETIC', item_list: [{ type: 1, msg_id: 'item-77', text_item: { text: 'hi' } }] }
  const byItem = { ...noId, item_list: [{ type: 1, msg_id: 'item-77', text_item: { text: 'hi' } }] }
  const a = fakeLoop([byItem])
  const seen: unknown[] = []
  a.ctx.receive = async (t: unknown) => { seen.push(t); return engine.receive(t as Trigger) }
  await pollNativeWeixin(a.ctx, a.controller.signal)
  expect(seen).toHaveLength(1)
  engine.decide(triggerId('item-77'), { kind: 'accept', title: 'I', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(1)

  // Replay with the item ID evicted from the seen window: the Engine trigger-ID backstop still returns duplicate.
  const replay = fakeLoop([byItem])
  replay.records.set(KV.weixin.nativeSeen(hashOf(TOKEN)), []) // force eviction
  let result: ReceiveResult | undefined
  replay.ctx.receive = async (t: unknown) => { result = engine.receive(t as Trigger); return result }
  await pollNativeWeixin(replay.ctx, replay.controller.signal)
  expect(result).toBe('duplicate')
  expect(countTickets()).toBe(1)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1)
})

test('S2.2: malformed provider message-ID (over-long) is dropped by the protocol and never becomes a Ticket', { timeout: 30_000 }, async () => {
  const { engine, countTickets } = engineHarness()
  const huge = incoming('peer-allowed', 'x'.repeat(257))
  expect(messageToTrigger(huge, hashOf(TOKEN))).toBeUndefined() // protocol refuses it
  const a = fakeLoop([huge])
  a.ctx.receive = async (t: unknown) => engine.receive(t as Trigger)
  await pollNativeWeixin(a.ctx, a.controller.signal)
  expect(a.received).toHaveLength(0) // the source skipped it before intake; cursor still advances
  expect(a.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(countTickets()).toBe(0) // no phantom Ticket from a malformed ID
})
