/** OL-054 M1 OFFLINE ONLY: fenced per-account poll/cursor owner + durable replay suppression,
 * with fake HTTP/credentials/Engine, NO actual Weixin, network, real credentials or sends. */
import { afterEach, expect, test, vi } from 'vitest'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { KV } from '../src/kv.ts'
import { key } from '../src/core/ids.ts'
import { pollNativeWeixin, nativeWeixinKind, NATIVE_SEEN_MAX } from '../src/sources/weixin-native.ts'
import { acquireWeixinPollOwnerLease } from '../src/local-first/weixin-poll-lease.ts'
import { messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'
import { Engine, MemoryRepositories, type Candidate, type OutboundMessage, type Policy } from '../src/core/index.ts'
import { SourceRegistry } from '../src/sources/registry.ts'
import { SettingsSchema } from '../src/policy.ts'
import type { Trigger } from '../src/core/index.ts'
import type { SourceContext } from '../src/sources/host.ts'

const tempPaths: string[] = []
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const folder of tempPaths.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function incoming(peer: string, messageId = 'm1') {
  return {
    message_id: messageId, from_user_id: peer, message_type: 1, message_state: 2,
    create_time_ms: 1783488000000, context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
    item_list: [{ type: 1, text_item: { text: '/project ol054-fixture' } }],
  }
}
const TOKEN = 'SYNTHETIC_OL054_LEASE_TOKEN_ONLY_NEVER_REAL'
const TOKEN_B = 'SYNTHETIC_OL054_ACCOUNT_B_DIFFERENT_TOKEN_ONLY'
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex')
const triggerId = (messageId: string) => key('weixin', messageId)

function fakeLoop(messages: unknown[], opts: {
  allowedPeers?: string[] | (() => string[])
  sourceEnabled?: () => boolean
  onPage?: () => void
  stopOnPause?: boolean
  stopOnError?: boolean
  receive?: (trigger: unknown) => Promise<unknown>
  route?: (trigger: unknown) => Promise<boolean>
  httpStatus?: number
  initial?: Map<string, unknown>
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-ol054-fake-native-weixin-'))
  tempPaths.push(dir)
  const file = join(dir, 'fake-credentials.json')
  writeFileSync(file, JSON.stringify({ token: TOKEN, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', file)
  const requests: Array<{ url: string; method: unknown; body?: string }> = []
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    if (url !== 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates' || init.method !== 'POST')
      throw Error('M1 OFFLINE TEST FORBIDS OUTBOUND: ' + url)
    requests.push({ url, method: init.method, body: String(init.body) })
    opts.onPage?.()
    if (opts.httpStatus) return new Response('{"ret":0}', { status: opts.httpStatus, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ ret: 0, errcode: 0, msgs: messages, get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000 }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  const controller = new AbortController()
  const records = opts.initial ?? new Map<string, unknown>([
    [KV.weixin.nativeAccount, hashOf(TOKEN)],
    [KV.weixin.nativeCursor, 'cursor-before-page'],
  ])
  const received: unknown[] = [], routed: unknown[] = [], health: string[] = []
  let receiveAttempts = 0
  const ctx = {
    ready: Promise.resolve(),
    configured: () => true,
    config: () => opts.sourceEnabled?.() === false ? undefined : nativeWeixinKind.schema.parse({
      allowedPeers: (typeof opts.allowedPeers === 'function' ? opts.allowedPeers() : opts.allowedPeers ?? ['peer-allowed']).map(id => ({ id })),
    }),
    state: {
      get: (key: string) => records.get(key),
      set: (key: string, value: unknown) => { if (value === undefined) records.delete(key); else records.set(key, value) },
    },
    receive: async (trigger: unknown) => {
      receiveAttempts++
      received.push(trigger)
      if (opts.receive) return opts.receive(trigger)
      return { status: 'stored' }
    },
    threads: { describe: vi.fn() },
    report: (_: string, item: { state: string }) => {
      health.push(item.state)
      if (item.state === 'ready' && !controller.signal.aborted) controller.abort()
      if (item.state === 'paused' && opts.stopOnPause) controller.abort()
      if (item.state === 'error' && opts.stopOnError !== false) controller.abort()
    },
  } as unknown as SourceContext
  const route = opts.route ? async (trigger: unknown) => { routed.push(trigger); return opts.route!(trigger) } : undefined
  return { ctx, controller, route, records, received, routed, health, requests, file, attemptCount: () => receiveAttempts }
}

/** A child process holding the account lease, so contention is proven across real OS processes. */
function childHolder(credsFile: string, accountHash: string) {
  const child = spawn(process.execPath, ['--experimental-strip-types', '-e', `
    import { acquireWeixinPollOwnerLease } from '${join(process.cwd(), 'src/local-first/weixin-poll-lease.ts')}'
    const lease = acquireWeixinPollOwnerLease(${JSON.stringify(credsFile)}, ${JSON.stringify(accountHash)})
    console.log('HELD:' + lease.generation)
    setInterval(() => {}, 1000)
  `], { stdio: ['ignore', 'pipe', 'pipe'] })
  return new Promise<{ child: ReturnType<typeof spawn>; generation: number }>((resolve, reject) => {
    let buffer = ''
    child.stdout.on('data', chunk => {
      buffer += chunk
      const line = buffer.split('\n').find(l => l.startsWith('HELD:'))
      if (line) resolve({ child, generation: Number(line.slice(5)) })
    })
    child.stderr.on('data', chunk => { if (!buffer.includes('HELD:')) reject(Error('holder child failed: ' + chunk)) })
    child.on('error', reject)
  })
}

test('M1: a duplicate poller fails closed AT STARTUP while a live cross-process owner holds the lease: zero egress, zero cursor writes', async () => {
  const f = fakeLoop([incoming('peer-allowed')])
  const holder = await childHolder(f.file, hashOf(TOKEN))
  try {
    await pollNativeWeixin(f.ctx, f.controller.signal)
    expect(f.requests).toHaveLength(0) // never polled: it failed closed before any egress
    expect(f.received).toHaveLength(0)
    expect(f.routed).toHaveLength(0)
    expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page') // never wrote a cursor
    expect(f.health).toContain('error') // reported contention, not a false 'ready'
  } finally { holder.child.kill('SIGKILL'); await new Promise(r => holder.child.on('exit', r)) }
})

test('M1: an in-process duplicate poller also fails closed while the first owner holds the lease across all pages', async () => {
  const f = fakeLoop([incoming('peer-allowed')])
  const owner = acquireWeixinPollOwnerLease(f.file, hashOf(TOKEN))
  try {
    await pollNativeWeixin(f.ctx, f.controller.signal)
    expect(f.requests).toHaveLength(0)
    expect(f.health).toContain('error')
    expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  } finally { owner.release() }
})

test('M1: bounded takeover after the live owner aborts: shutdown releases the held transaction immediately', async () => {
  const f = fakeLoop([incoming('peer-allowed')])
  await pollNativeWeixin(f.ctx, f.controller.signal) // the owner holds the lease for its whole run
  expect(f.requests).toHaveLength(1)
  // Takeover is bounded: the moment the owner aborts, a new owner acquires with an advanced fence.
  const taken = acquireWeixinPollOwnerLease(f.file, hashOf(TOKEN))
  expect(taken.fenceCurrent()).toBe(true)
  taken.release()
})

test('M1: takeover after a crashed (SIGKILL) owner is bounded; the stale lock is recovered and fenced forward', async () => {
  const f = fakeLoop([], { stopOnError: false })
  const holder = await childHolder(f.file, hashOf(TOKEN))
  expect(() => acquireWeixinPollOwnerLease(f.file, hashOf(TOKEN))).toThrow(/locked/)
  holder.child.kill('SIGKILL')
  await new Promise(r => holder.child.on('exit', r))
  const taken = acquireWeixinPollOwnerLease(f.file, hashOf(TOKEN))
  expect(taken.generation).toBeGreaterThan(holder.generation)
  expect(taken.fenceCurrent()).toBe(true)
  taken.release()
})

test('M1: credential rotation resets the cursor under the fence; the old account lease is released, never used to route', async () => {
  let pages = 0
  const f = fakeLoop([incoming('peer-allowed')], {
    allowedPeers: () => pages === 2 ? [] : ['peer-allowed'],
    onPage: () => {
      if (++pages === 1) {
        // Rotation happens after the HTTP long-poll request but BEFORE its page is parsed.
        writeFileSync(f.file, JSON.stringify({ token: TOKEN_B, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
        chmodSync(f.file, 0o600)
      }
    },
    route: async () => { throw Error('old-account page must never reach route') },
  })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.requests).toHaveLength(2)
  expect(f.received).toHaveLength(0)
  expect(f.routed).toHaveLength(0)
  expect(JSON.parse(f.requests[1]!.body!).get_updates_buf).toBe('') // cursor reset under the fresh fence
  expect(f.records.get(KV.weixin.nativeAccount)).toBe(hashOf(TOKEN_B))
  // The fence is per account fingerprint: both lease databases exist side by side.
  expect(existsSync(join(dirname(f.file), '.dsh-weixin-poll-lease', `account-${hashOf(TOKEN)}.sqlite`))).toBe(true)
})

test('M1: a delayed page in flight while cancel is requested never commits a partial cursor and releases the lease', async () => {
  const f = fakeLoop([incoming('peer-allowed')], {
    receive: async () => { f.controller.abort(); return { status: 'stored' } },
  })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page') // never committed after cancel
  // Lease released by the loop's finally: a new owner acquires immediately (bounded takeover).
  const taken = acquireWeixinPollOwnerLease(f.file, hashOf(TOKEN))
  expect(taken.fenceCurrent()).toBe(true)
  taken.release()
})

test('M1: peer revoke during route under the fence blocks Engine intake for that trigger', async () => {
  const f = fakeLoop([incoming('peer-allowed')], {
    allowedPeers: ['peer-allowed'],
    route: async () => { f.ctx.config = () => nativeWeixinKind.schema.parse({ allowedPeers: [] }) as never; return false },
  })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(1)
  expect(f.received).toHaveLength(0)
})

test.each([401, 429, 500, 503])('M1: HTTP %i under the held lease fails closed: no cursor commit, no send, no forced resend', async status => {
  const f = fakeLoop([incoming('peer-allowed')], { httpStatus: status })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.health).toContain('error')
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.requests).toHaveLength(1) // one bounded attempt; the loop never forces another send
  expect(f.received).toHaveLength(0)
})

test('M1: lease reacquire after contention clears resumes ownership; the contended phase never egressed', async () => {
  const f = fakeLoop([incoming('peer-allowed')], { stopOnError: false })
  const external = acquireWeixinPollOwnerLease(f.file, hashOf(TOKEN))
  const delays: number[] = []
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: (...args: unknown[]) => void, delay?: number) => {
    delays.push(Number(delay))
    queueMicrotask(() => callback())
    return 0 as unknown as ReturnType<typeof setTimeout>
  }) as never)
  const running = pollNativeWeixin(f.ctx, f.controller.signal)
  await Promise.resolve() // let the fail-closed first pass run
  expect(f.requests).toHaveLength(0) // contended: zero egress while the external owner holds
  expect(f.health).toContain('error')
  external.release() // the external owner lets go
  await running
  expect(f.requests).toHaveLength(1) // after bounded takeover the poller owns the lease and polls
  expect(f.received).toHaveLength(1)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(delays).toContain(2000) // bounded backoff, never a forced zero-cursor reset
})

// ---- Durable deduplication -------------------------------------------------

test('M1: durable seen-set lives in the KV persistence layer (via ctx.state), not an ephemeral memory set', async () => {
  const f = fakeLoop([incoming('peer-allowed')])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  const seen = f.records.get(KV.weixin.nativeSeen(hashOf(TOKEN))) as string[]
  expect(seen).toEqual([triggerId('m1')])
})

test('M1: a replayed acknowledged message cannot route or receive twice; a fresh message still works', async () => {
  const f = fakeLoop([incoming('peer-allowed', 'm1'), incoming('peer-allowed', 'm1'), incoming('peer-allowed', 'm2')])
  f.records.set(KV.weixin.nativeSeen(hashOf(TOKEN)), [triggerId('m1')]) // already acknowledged durably
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(1) // only m2 entered Engine
  expect((f.received[0] as Trigger).meta.messageId).toBe('m2')
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page') // skip is idempotent: cursor still advances
  const seen = f.records.get(KV.weixin.nativeSeen(hashOf(TOKEN))) as string[]
  expect(seen).toEqual([triggerId('m1'), triggerId('m2')])
})

test('M1: a relay-routed acknowledged message is never routed a second time on replay', async () => {
  const f = fakeLoop([incoming('peer-allowed', 'm1')], { route: async () => true })
  f.records.set(KV.weixin.nativeSeen(hashOf(TOKEN)), [triggerId('m1')])
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(0)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
})

test('M1: a failed receive leaves the message unacknowledged so a bounded retry can still ingest it exactly once', async () => {
  const f = fakeLoop([incoming('peer-allowed', 'm1')], {
    receive: async () => { if (f.attemptCount() === 1) throw Error('transient intake failure'); return { status: 'stored' } },
    stopOnError: false,
  })
  const delays: number[] = []
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: (...args: unknown[]) => void, delay?: number) => {
    delays.push(Number(delay)); queueMicrotask(() => callback())
    return 0 as unknown as ReturnType<typeof setTimeout>
  }) as never)
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.attemptCount()).toBe(2) // the retry happened after the bounded backoff, then succeeded
  const seen = f.records.get(KV.weixin.nativeSeen(hashOf(TOKEN))) as string[]
  expect(seen).toEqual([triggerId('m1')]) // acknowledged exactly once
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(delays).toContain(2000)
})

test('M1: provider messages without a reliable unique ID are dropped before dedup can apply (documented limit)', async () => {
  // messageToTrigger mints its ID from message_id (or the first item's msg_id); with neither, the input is
  // dropped BEFORE dedup can apply, so no duplicate Ticket can be created either. The identity used by the
  // durable set is the trigger key (key('weixin', id)) derived from the provider message identity.
  const noId = { from_user_id: 'peer-allowed', message_type: 1, message_state: 2,
    create_time_ms: 1783488000000, context_token: 'SYNTHETIC', item_list: [{ type: 1, text_item: { text: 'hi' } }] }
  const f = fakeLoop([noId])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(0) // dropped: no identity => neither a Ticket nor a dedup entry
  // An item-level msg_id still gives a stable identity that dedups across replays.
  const byItem = { ...noId, item_list: [{ type: 1, msg_id: 'item-9', text_item: { text: 'hi' } }] }
  const g = fakeLoop([byItem, byItem])
  g.records.set(KV.weixin.nativeSeen(hashOf(TOKEN)), [triggerId('item-9')])
  await pollNativeWeixin(g.ctx, g.controller.signal)
  expect(g.received).toHaveLength(0)
})

test('M1: the durable seen-set is FIFO-bounded and never grows unbounded across many pages', async () => {
  const many = Array.from({ length: NATIVE_SEEN_MAX + 50 }, (_, i) => incoming('peer-allowed', 'm' + i))
  const f = fakeLoop(many)
  await pollNativeWeixin(f.ctx, f.controller.signal)
  const seen = f.records.get(KV.weixin.nativeSeen(hashOf(TOKEN))) as string[]
  expect(seen.length).toBeLessThanOrEqual(NATIVE_SEEN_MAX)
  expect(seen.at(-1)).toBe(triggerId('m' + (many.length - 1))) // newest kept, oldest trimmed first
})

test('M1: dedup is per account fingerprint; a rotated account treats the same message ID as a fresh identity', async () => {
  const f = fakeLoop([incoming('peer-allowed', 'm1')])
  f.records.set(KV.weixin.nativeSeen(hashOf(TOKEN)), [triggerId('m1')])
  await pollNativeWeixin(f.ctx, f.controller.signal) // account A: m1 already seen => skipped, cursor committed
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  // Rotate to account B: its seen-set is empty, so the same provider message ID enters Engine once.
  writeFileSync(f.file, JSON.stringify({ token: TOKEN_B, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
  chmodSync(f.file, 0o600)
  const controller = new AbortController()
  const fresh: unknown[] = []
  f.ctx.receive = async (trigger: Trigger) => { fresh.push(trigger); return 'stored' as const }
  f.ctx.report = ((_: string, item: { state: string }) => {
    f.health.push(item.state)
    if (item.state === 'ready') controller.abort()
  }) as never
  await pollNativeWeixin(f.ctx, controller.signal)
  expect(fresh).toHaveLength(1) // exactly one intake of the replayed ID under the new account
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page') // fresh fence, then the page's cursor commits
  const seenB = f.records.get(KV.weixin.nativeSeen(hashOf(TOKEN_B))) as string[]
  expect(seenB).toEqual([triggerId('m1')])
})

// ---- OL-053 regression: the 11-to-12 replay pattern -----------------------

test('OL-053 regression: a replayed acknowledged pilot message into a source-only paused-executor instance creates NO executable duplicate Ticket; a fresh message creates exactly one', async () => {
  const repo = new MemoryRepositories()
  const requests: Candidate[] = []
  const assessor = { request: vi.fn((candidate: Candidate) => { requests.push(candidate) }), release: vi.fn() }
  const executor = { start: vi.fn(), deliver: vi.fn(), stop: vi.fn() }
  const outbound: OutboundMessage[] = []
  const outbox = { send: vi.fn((message: OutboundMessage) => { outbound.push(message) }), status: vi.fn(), withdraw: vi.fn() }
  // Paused executor: nothing is launched automatically; only an explicit accept creates a Ticket.
  const policy: Policy = { version: 'v1', paused: true, evalTimeoutMs: 60_000,
    gate: () => ({ admissible: true, strength: 'explicit', basis: { source: 'weixin', scope: {}, addressed: 'direct', via: 'addressed' } }),
    revalidate: () => true, admitsInferred: () => true }
  const registry = new SourceRegistry(() => SettingsSchema.parse({
    paused: true,
    sources: { weixin: { enabled: true, config: { allowedPeers: [{ id: 'peer-allowed' }, { id: 'fresh-peer' }] } } },
    policy: { sources: { weixin: { allowed: [{ id: 'peer-allowed', name: 'Operator' }, { id: 'fresh-peer', name: 'Fresh' }] } } } }))
  registry.register(nativeWeixinKind)
  const engine = new Engine({ repo, scope: registry, policy: () => policy, assessor, executor, outbox })
  const countTickets = () => repo.tickets.list().length

  // The source-only poller ingests the pilot message through the REAL Engine intake.
  const f = fakeLoop([incoming('peer-allowed', 'pilot-1')])
  f.ctx.receive = async (trigger: unknown) => engine.receive(trigger as Trigger)
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(repo.triggers.get(triggerId('pilot-1'))).toBeTruthy() // durably stored trigger
  // Paused executor: the trigger waits queued in its Thread; no assessment and no Ticket until an explicit accept.
  expect(requests).toHaveLength(0)
  expect(countTickets()).toBe(0)

  // The operator accepts the pilot: one Ticket and one acknowledgement egress.
  engine.decide(triggerId('pilot-1'), { kind: 'accept', title: 'Pilot', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(1)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1)

  // OL-053 replay, layer 1 (source): the acknowledged message replayed into the SAME source-only instance
  // is skipped by the durable seen-set and never reaches the Engine a second time.
  const replay = fakeLoop([incoming('peer-allowed', 'pilot-1')])
  replay.ctx.receive = async (trigger: unknown) => engine.receive(trigger as Trigger)
  replay.records.set(KV.weixin.nativeCursor, 'cursor-before-page')
  replay.records.set(KV.weixin.nativeSeen(hashOf(TOKEN)), f.records.get(KV.weixin.nativeSeen(hashOf(TOKEN))) as string[])
  await pollNativeWeixin(replay.ctx, replay.controller.signal)
  expect(replay.received).toHaveLength(0) // skipped before intake: no trigger-row growth, no re-queue
  expect(countTickets()).toBe(1) // still exactly one executable Ticket
  expect(requests).toHaveLength(0) // the paused executor was never asked again

  // OL-053 replay, layer 2 (Engine): even a replay that bypasses the source dedup cannot create a second Ticket.
  expect(engine.receive(messageToTrigger(incoming('peer-allowed', 'pilot-1'), hashOf(TOKEN))!)).toBe('duplicate')
  expect(countTickets()).toBe(1)
  expect(engine.decide(triggerId('pilot-1'), { kind: 'accept', title: 'Pilot', scope: 'fixture', reason: 'request' }))
    .toMatchObject({ kind: 'accept' }) // replayed accept returns the EARLIER decision, spawning no second Ticket
  expect(countTickets()).toBe(1)
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(1) // no second acknowledgement send

  // A fresh message still works end to end: one new trigger, one new Ticket.
  // (A different peer: its own thread, so no existing ticket's worker decides it.)
  expect(engine.receive(messageToTrigger(incoming('fresh-peer', 'fresh-2'), hashOf(TOKEN))!)).toBe('stored')
  engine.decide(triggerId('fresh-2'), { kind: 'accept', title: 'Fresh', scope: 'fixture', reason: 'request', acknowledgement: 'recvd' })
  expect(countTickets()).toBe(2) // exactly one NEW Ticket, from the fresh message only
  expect(outbound.filter(m => m.kind === 'acknowledgement')).toHaveLength(2)
})
