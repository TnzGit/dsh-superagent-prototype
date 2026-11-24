/** I3 PREP ONLY: real Source polling code with fake HTTP/credentials/Engine,
 * NO actual Weixin, network, DSH session, model, original source or Apply. */
import { afterEach, expect, test, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KV } from '../src/kv.ts'
import { pollNativeWeixin, nativeWeixinKind } from '../src/sources/weixin-native.ts'
import type { SourceContext } from '../src/sources/host.ts'

const tempPaths: string[] = []
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const folder of tempPaths.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function incoming(peer: string, messageId = 'offline-message-1') {
  return {
    message_id: messageId,
    from_user_id: peer,
    message_type: 1,
    message_state: 2,
    create_time_ms: 1783488000000,
    context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
    item_list: [{ type: 1, text_item: { text: '/project i3-synthetic-fixture' } }],
  }
}

function fakeLoop(messages: unknown[], opts: {
  allowedPeers?: string[] | (() => string[])
  sourceEnabled?: () => boolean
  onPage?: () => void
  stopOnPause?: boolean
  receive?: (trigger: unknown, abort: () => void) => Promise<unknown>
  route?: (trigger: unknown, abort: () => void) => Promise<boolean>
  httpStatus?: number
  responseCode?: number
  stopOnError?: boolean
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-i3-fake-native-weixin-'))
  tempPaths.push(dir)
  const file = join(dir, 'fake-credentials.json')
  writeFileSync(file, JSON.stringify({
    token: 'THIS_IS_SYNTHETIC_NOT_REAL_CREDENTIALS',
    baseUrl: 'https://ilinkai.weixin.qq.com'
  }), { mode: 0o600 })
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', file)
  const requests: Array<{ url: string; method: unknown; body?: string }> = []
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    // Strict egress trap: an accidental send endpoint must fail the test.
    if (url !== 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates' || init.method !== 'POST')
      throw Error('I3 OFFLINE TEST FORBIDS OUTBOUND: ' + url)
    requests.push({ url, method: init.method, body: String(init.body) })
    opts.onPage?.()
    return new Response(JSON.stringify({
      ret: opts.responseCode ?? 0, errcode: opts.responseCode ?? 0,
      msgs: messages, get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000
    }), { status: opts.httpStatus ?? 200, headers: { 'content-type': 'application/json' } })
  }))
  const controller = new AbortController()
  // Simulate an existing already-paired account: a new account correctly
  // resets its cursor before polling, but these tests exercise cursor commit.
  const accountHash = createHash('sha256').update('THIS_IS_SYNTHETIC_NOT_REAL_CREDENTIALS').digest('hex')
  const records = new Map<string, unknown>([
    [KV.weixin.nativeAccount, accountHash],
    [KV.weixin.nativeCursor, 'cursor-before-page']
  ])
  const received: unknown[] = [], routed: unknown[] = [], health: string[] = []
  const ctx = {
    ready: Promise.resolve(),
    configured: () => true,
    config: () => opts.sourceEnabled?.() === false ? undefined : nativeWeixinKind.schema.parse({
      allowedPeers: (typeof opts.allowedPeers === 'function'
        ? opts.allowedPeers() : opts.allowedPeers ?? ['peer-allowed']).map(id => ({ id }))
    }),
    state: {
      get: (key: string) => records.get(key),
      set: (key: string, value: unknown) => { if (value === undefined) records.delete(key); else records.set(key, value) },
    },
    receive: async (trigger: unknown) => {
      received.push(trigger)
      if (opts.receive) return opts.receive(trigger, () => controller.abort())
      return { status: 'stored' }
    },
    threads: { describe: vi.fn() },
    report: (_: string, item: { state: string }) => {
      health.push(item.state)
      if (item.state === 'ready' && !controller.signal.aborted) controller.abort()
      if (item.state === 'paused' && opts.stopOnPause) controller.abort()
      if (item.state === 'error' && opts.stopOnError !== false) controller.abort()
    }
  } as unknown as SourceContext
  const route = opts.route ? async (trigger: unknown) => {
    routed.push(trigger)
    return opts.route!(trigger, () => controller.abort())
  } : undefined
  return { ctx, controller, route, records, received, routed, health, requests }
}

test('I3 offline: unauthorized peer cannot route or enter Engine and cursor advances after safe skip', async () => {
  const f = fakeLoop([incoming('intruder')], { route: async () => {
    throw Error('not allowed to see intruder')
  } })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(0)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: peer revoked while getupdates was awaited never reaches route or Engine', async () => {
  let peers=['peer-allowed']
  const f=fakeLoop([incoming('peer-allowed')], {
    allowedPeers:()=>peers,
    onPage:()=>{peers=[]},
    route:async()=>{throw Error('revoked peer must not route')},
  })
  await pollNativeWeixin(f.ctx,f.controller.signal,f.route)
  expect(f.routed).toHaveLength(0)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: Source disabled during long poll cannot ingest or advance cursor', async () => {
  let enabled=true
  const f=fakeLoop([incoming('peer-allowed')], {
    sourceEnabled:()=>enabled,
    onPage:()=>{enabled=false},
    stopOnPause:true,
  })
  await pollNativeWeixin(f.ctx,f.controller.signal)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('paused')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: revocation during async route blocks later ordinary Engine receive', async () => {
  let peers=['peer-allowed']
  const f=fakeLoop([incoming('peer-allowed')], {
    allowedPeers:()=>peers,
    route:async()=>{peers=[];return false},
  })
  await pollNativeWeixin(f.ctx,f.controller.signal,f.route)
  expect(f.routed).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.requests).toHaveLength(2)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
})

test('I3 offline: allowed inbound commits cursor only AFTER durable Engine receive settles', async () => {
  let sawOldCursor = false
  const f = fakeLoop([incoming('peer-allowed')], { receive: async (_trigger) => {
    sawOldCursor = f.records.get(KV.weixin.nativeCursor) === 'cursor-before-page'
    await Promise.resolve()
    expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
    return { status: 'stored' }
  } })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(sawOldCursor).toBe(true)
  expect(f.received).toHaveLength(1)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: Engine receive failure leaves cursor uncommitted for safe redelivery', async () => {
  const f = fakeLoop([incoming('peer-allowed')], { receive: async () => {
    expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
    throw Error('synthetic persistence failed')
  } })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(1)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: approved one-shot relay consumes the Trigger before ordinary Engine receive', async () => {
  const f = fakeLoop([incoming('peer-allowed')], { route: async () => {
    return true
  } })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: inactive update, bot echo and forbidden peer are skipped without dispatch or send', async () => {
  const f = fakeLoop([
    { ...incoming('peer-allowed', 'bot-echo'), message_type: 2 },
    { ...incoming('peer-allowed', 'incomplete'), message_state: 1 },
    incoming('intruder', 'intruder'),
  ])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(f.requests).toHaveLength(1)
})

test.each([401, 429, 503])('I3 offline: poll HTTP %i reports failure and does not commit cursor', async status => {
  const f = fakeLoop([incoming('peer-allowed')], { httpStatus: status })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
  expect(f.received).toHaveLength(0)
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: account token rotation resets opaque cursor before the next request', async () => {
  const f = fakeLoop([incoming('intruder')])
  f.records.set(KV.weixin.nativeAccount, 'previous-synthetic-account-hash')
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(JSON.parse(f.requests[0]!.body!).get_updates_buf).toBe('')
  expect(f.records.get(KV.weixin.nativeAccount)).toBe(
    createHash('sha256').update('THIS_IS_SYNTHETIC_NOT_REAL_CREDENTIALS').digest('hex'))
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
  expect(f.received).toHaveLength(0)
})

test.each([1, 2])('I3 offline: abort while receiving a page of %i item(s) never commits the partial cursor', async count => {
  const f = fakeLoop(Array.from({length:count},(_,i)=>incoming('peer-allowed','msg-'+i)),
    { receive: async (_trigger, abort) => { abort(); return {status:'stored'} } })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(1)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).not.toContain('ready')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: abort during async route forbids subsequent ordinary Engine intake', async () => {
  const f = fakeLoop([incoming('peer-allowed')], {
    route: async (_trigger, abort) => {abort(); return false}
  })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
})

test('I3 offline: HTTP retries use 2s, 2s, 30s backoff after the third failure', async () => {
  const f = fakeLoop([incoming('peer-allowed')], { httpStatus: 503, stopOnError: false })
  const delays:number[] = []
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: (...args: unknown[]) => void, delay?: number) => {
    const ms=Number(delay)
    delays.push(ms)
    queueMicrotask(() => callback())
    return 0 as unknown as ReturnType<typeof setTimeout>
  }) as typeof setTimeout)
  const originalReport=f.ctx.report
  let errors=0
  f.ctx.report=(key,health)=>{
    originalReport(key,health)
    if(health.state==='error' && ++errors===4) f.controller.abort()
  }
  await pollNativeWeixin(f.ctx,f.controller.signal)
  expect(errors).toBe(4)
  expect(delays.filter(n=>n===2000||n===30000)).toEqual([2000,2000,30000])
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
})

test('I3 offline: -14 stale bot token uses one-hour backoff with no cursor commit', async () => {
  const f = fakeLoop([], { responseCode: -14, stopOnError: false })
  const delays:number[]=[]
  vi.spyOn(globalThis,'setTimeout').mockImplementation(((callback: (...args:unknown[])=>void, delay?:number)=>{
    const ms=Number(delay);delays.push(ms)
    queueMicrotask(()=>f.controller.abort())
    return 0 as unknown as ReturnType<typeof setTimeout>
  }) as typeof setTimeout)
  await pollNativeWeixin(f.ctx,f.controller.signal)
  expect(f.health).toContain('error')
  expect(delays).toContain(3600000)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
})
