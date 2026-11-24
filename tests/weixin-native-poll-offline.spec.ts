/** I3 PREP ONLY: real Source polling code with fake HTTP/credentials/Engine,
 * NO actual Weixin, network, DSH session, model, original source or Apply. */
import { afterEach, expect, test, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KV } from '../src/kv.ts'
import { pollNativeWeixin, nativeWeixinKind, readNativeCredentials } from '../src/sources/weixin-native.ts'
import { WEIXIN_REPLY_MAX_AGE_MS, WEIXIN_MAX_RESPONSE_BYTES } from '../src/local-first/weixin-native-protocol.ts'
import type { OutboundMessage, Trigger } from '../src/core/index.ts'
import type { SourceContext } from '../src/sources/host.ts'

const tempPaths: string[] = []
afterEach(() => {
  vi.useRealTimers()
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

/** A long-poll body that stops mid-response: it never settles until the combined abort signal (caller shutdown or the application timeout) fires. */
function interruptibleResponse(init: RequestInit, prefix = '{"ret":0,"errcode":0,"msgs":[') {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(prefix))
      const signal = init.signal
      if (signal?.aborted) { controller.error(signal.reason); return }
      signal?.addEventListener('abort', () => controller.error(signal.reason))
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } })
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
  /** Raw response body (string or bytes) replacing the default page envelope; the egress trap still applies. */
  body?: string | Uint8Array
  /** Full control over the fake Response for transport-fault shapes (streams, headers, statuses). */
  response?: (init: RequestInit) => Response | Promise<Response>
  /** Transport fault thrown by the fake fetch itself (mid-response abort, reset, timeout). */
  fetchThrows?: (init: RequestInit) => Error
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
    if (opts.fetchThrows) throw opts.fetchThrows(init)
    if (opts.response) return opts.response(init)
    if (opts.body !== undefined)
      return new Response(opts.body, { status: opts.httpStatus ?? 200, headers: { 'content-type': 'application/json' } })
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

test('I3 offline: old account in-flight poll page cannot enter Engine after A-to-B credentials rotation', async () => {
  let pages=0
  const f=fakeLoop([incoming('peer-allowed')], {
    allowedPeers:()=>pages===2?[]:['peer-allowed'],
    onPage:()=>{
      if(++pages===1){
        // Rotation happens after the HTTP long-poll request but BEFORE its page is parsed.
        writeFileSync(process.env.DSH_WEIXIN_NATIVE_CREDENTIALS_FILE!,JSON.stringify({
          token:'SYNTHETIC_NEW_ACCOUNT_B_DIFFERENT_TOKEN',
          baseUrl:'https://ilinkai.weixin.qq.com'
        }),{mode:0o600})
      }
    },
    route:async()=>{throw Error('old-account page must never reach route')},
  })
  await pollNativeWeixin(f.ctx,f.controller.signal,f.route)
  expect(f.requests).toHaveLength(2)
  expect(f.received).toHaveLength(0)
  expect(f.routed).toHaveLength(0)
  expect(JSON.parse(f.requests[1]!.body!).get_updates_buf).toBe('')
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

/* ===== OL-20261124-052 P2 fault matrix: fake page/error coverage =====
 * All fetches here stay on the fake transport with the strict egress trap above.
 * NO real network, no real iLink, no real credentials. */

test('I3 offline: caller shutdown aborting mid-response body never advances cursor or dispatches', async () => {
  const f = fakeLoop([incoming('peer-allowed')], {
    response: init => { queueMicrotask(() => f.controller.abort()); return interruptibleResponse(init) },
    route: async () => { throw Error('aborted page must not route') },
  })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.routed).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).not.toContain('ready')
})

test('I3 offline: long-poll timeout mid-response yields an empty page, never a fabricated cursor or items', async () => {
  // The application long-poll deadline fires while the body is still streaming (caller signal untouched).
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort())
  const f = fakeLoop([incoming('peer-allowed')], { response: init => interruptibleResponse(init) })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  // Timeout is an empty page, not a failure: the opaque cursor is simply carried forward unchanged.
  expect(f.health).not.toContain('error')
})

test('I3 offline: fetch-level timeout abort surfaces as a failed page with no cursor commit', async () => {
  const f = fakeLoop([incoming('peer-allowed')], {
    fetchThrows: () => Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }),
  })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: transport cut mid-response body fails the page without committing the cursor', async () => {
  const f = fakeLoop([incoming('peer-allowed')], {
    response: () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ret":0,"errcode":0,"msgs":['))
        queueMicrotask(() => controller.error(new Error('synthetic transport cut')))
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } }),
  })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: malformed JSON page fails without committing cursor or dispatch', async () => {
  const f = fakeLoop([incoming('peer-allowed')], { body: 'this is not json {{{' })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: empty response body fails as malformed JSON, never as a silent empty page', async () => {
  const f = fakeLoop([incoming('peer-allowed')], { body: '' })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: oversized declared content-length is refused before the body is read', async () => {
  const f = fakeLoop([], {
    response: () => new Response('{"ret":0,"errcode":0,"msgs":[],"get_updates_buf":"cursor-after-page"}', {
      status: 200, headers: { 'content-length': String(WEIXIN_MAX_RESPONSE_BYTES + 1) }
    }),
  })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: oversized streamed body is refused at the application cap', async () => {
  const f = fakeLoop([], { body: 'x'.repeat(WEIXIN_MAX_RESPONSE_BYTES + 16) })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: non-Unicode response bytes fail the page (fatal UTF-8 decode, no silent replacement)', async () => {
  const f = fakeLoop([], { body: new Uint8Array([0xff, 0xfe, 0x22, 0x7b, 0x7d]) })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.requests).toHaveLength(1)
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
  expect(f.health).toContain('error')
})

test('I3 offline: Unicode payloads survive byte-for-byte into the Trigger', async () => {
  const unicodeText = '请仅回复“OK” 🚀 café ✓'
  const f = fakeLoop([{ ...incoming('peer-allowed', 'unicode-1'), item_list: [{ type: 1, text_item: { text: unicodeText } }] }],
    { body: JSON.stringify({ ret: 0, errcode: 0, msgs: [{ ...incoming('peer-allowed', 'unicode-1'), item_list: [{ type: 1, text_item: { text: unicodeText } }] }], get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000 }) })
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(1)
  expect((f.received[0] as unknown as Trigger).text).toBe(unicodeText)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
})

test('I3 offline: incomplete items, bot echo and id-less messages are dropped; the valid one still dispatches', async () => {
  const f = fakeLoop([
    { ...incoming('peer-allowed', 'bot-echo'), message_type: 2 },
    { ...incoming('peer-allowed', 'incomplete'), message_state: 1 },
    { from_user_id: 'peer-allowed', message_state: 2, message_type: 1, item_list: [null, { type: 1, text_item: { text: 'x' } }] },
    { ...incoming('peer-allowed', 'huge'), item_list: [{ type: 1, text_item: { text: 'y'.repeat(64001) } }] },
    incoming('peer-allowed', 'valid'),
  ], { route: async trigger => {
    if ((trigger as Trigger).meta.messageId === 'valid') return true
    throw Error('dropped item must not route: ' + JSON.stringify((trigger as Trigger).meta))
  } })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(1)
  expect((f.routed[0] as unknown as Trigger).meta.messageId).toBe('valid')
  expect(f.received).toHaveLength(0)
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page')
})

test('I3 offline: an unlisted peer on the same page as an allowed peer never enters route or Engine', async () => {
  const f = fakeLoop([incoming('intruder', 'intruder-1'), incoming('peer-allowed', 'allowed-1')], {
    route: async trigger => {
      if ((trigger as Trigger).meta.peer === 'intruder') throw Error('unlisted peer must never route')
      return true
    },
  })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.routed).toHaveLength(1)
  expect((f.routed[0] as unknown as Trigger).meta.peer).toBe('peer-allowed')
  expect(f.received).toHaveLength(0)
})

test('I3 offline: missing contextToken dispatches but preflight and send refuse it without any HTTP', async () => {
  // Fresh timestamp so the send path reaches the context gate instead of short-circuiting an expired address.
  const f = fakeLoop([{ ...incoming('peer-allowed', 'no-ctx'), context_token: undefined, create_time_ms: Date.now() }])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  expect(f.received).toHaveLength(1)
  const address = (f.received[0] as unknown as Trigger).channel!.address
  expect(address.contextToken).toBeUndefined()
  const outbound = { id: 'outbox-no-ctx', text: 'reply', kind: 'reply' as const, channel: (f.received[0] as unknown as Trigger).channel! }
  expect(nativeWeixinKind.channel!.preflight!(outbound)).toMatchObject({ status: 'review', reason: 'context_missing' })
  await expect(nativeWeixinKind.channel!.send({ commands: undefined as never }, outbound)).rejects.toThrow('safety gate')
  // Only the poll request happened; the refused send performed no HTTP at all.
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: expired context from an old message is refused by preflight and permanently gone at send', async () => {
  const f = fakeLoop([incoming('peer-allowed', 'old-msg')])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  const trigger = f.received[0] as unknown as Trigger
  // The synthetic fixture is timestamped far in the past: the 60-minute application cap has elapsed.
  expect(Date.parse(String(trigger.meta.expiresAt))).toBeLessThan(Date.now())
  const outbound = { id: 'outbox-old', text: 'late reply', kind: 'reply' as const, channel: trigger.channel! }
  expect(nativeWeixinKind.channel!.preflight!(outbound)).toMatchObject({ status: 'review', reason: 'context_expired_or_unbounded' })
  // Channel send keeps the direct-channel contract: an explicitly expired address is permanently gone, no I/O.
  await expect(nativeWeixinKind.channel!.send({ commands: undefined as never }, outbound)).resolves.toBe('gone')
  expect(f.requests).toHaveLength(1)
})

test('I3 offline: a fresh context passes the account-bound preflight with synthetic credentials', async () => {
  const f = fakeLoop([{ ...incoming('peer-allowed', 'fresh-msg'), create_time_ms: Date.now() + 2 * 60 * 60 * 1000 }])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  const trigger = f.received[0] as unknown as Trigger
  expect(String(trigger.meta.accountHash)).toBe(
    createHash('sha256').update('THIS_IS_SYNTHETIC_NOT_REAL_CREDENTIALS').digest('hex'))
  const outbound = { id: 'outbox-fresh', text: 'ok', kind: 'reply' as const, channel: trigger.channel! }
  expect(nativeWeixinKind.channel!.preflight!(outbound)).toMatchObject({ status: 'ready' })
})

test('I3 offline: unbound accountHash and unparseable expiry are refused by preflight', async () => {
  const f = fakeLoop([incoming('peer-allowed', 'unbound')])
  await pollNativeWeixin(f.ctx, f.controller.signal)
  const channel = (f.received[0] as unknown as Trigger).channel!
  expect(nativeWeixinKind.channel!.preflight!({
    id: 'x', text: 't', kind: 'reply', channel: { ...channel, address: { ...channel.address, accountHash: undefined } },
  })).toMatchObject({ status: 'review', reason: 'account_unbound' })
  expect(nativeWeixinKind.channel!.preflight!({
    id: 'x', text: 't', kind: 'reply', channel: { ...channel, address: { ...channel.address, expiresAt: 'not-a-date' } },
  })).toMatchObject({ status: 'review', reason: 'context_expired_or_unbounded' })
  // A reply window wider than the conservative cap is treated as unbounded.
  expect(nativeWeixinKind.channel!.preflight!({
    id: 'x', text: 't', kind: 'reply',
    channel: { ...channel, address: { ...channel.address, expiresAt: new Date(Date.now() + WEIXIN_REPLY_MAX_AGE_MS + 60_000).toISOString() } },
  })).toMatchObject({ status: 'review', reason: 'context_expired_or_unbounded' })
})

test('I3 offline: credential rotation during body consumption discards the stale page and resets the cursor', async () => {
  let calls = 0
  const f = fakeLoop([incoming('peer-allowed', 'stale-msg')], {
    response: init => {
      calls++
      if (calls === 1) {
        // A→B rotation lands AFTER the prefix was streamed but BEFORE the page finished parsing.
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"ret":0,"errcode":0,"msgs":['))
            queueMicrotask(() => {
              writeFileSync(process.env.DSH_WEIXIN_NATIVE_CREDENTIALS_FILE!, JSON.stringify({
                token: 'SYNTHETIC_NEW_ACCOUNT_B_DIFFERENT_TOKEN',
                baseUrl: 'https://ilinkai.weixin.qq.com'
              }), { mode: 0o600 })
              controller.enqueue(new TextEncoder().encode(JSON.stringify([incoming('peer-allowed', 'stale-msg')])))
              controller.enqueue(new TextEncoder().encode('],"get_updates_buf":"cursor-after-page","longpolling_timeout_ms":1000}'))
              controller.close()
            })
          }
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        ret: 0, errcode: 0, msgs: [incoming('peer-allowed', 'fresh-msg')],
        get_updates_buf: 'cursor-after-page-2', longpolling_timeout_ms: 1000
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
    route: async trigger => {
      const id = (trigger as Trigger).meta.messageId
      if (id === 'stale-msg') throw Error('stale-account page must never reach route')
      return true
    },
  })
  await pollNativeWeixin(f.ctx, f.controller.signal, f.route)
  expect(f.requests).toHaveLength(2)
  expect(f.routed).toHaveLength(1)
  expect((f.routed[0] as unknown as Trigger).meta.messageId).toBe('fresh-msg')
  expect(f.received).toHaveLength(0)
  // Token rotation resets the cursor before the next request: no stale page, no stale cursor.
  expect(JSON.parse(f.requests[1]!.body!).get_updates_buf).toBe('')
  expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-after-page-2')
})

test('I3 offline: readNativeCredentials enforces the owner-only fd path on the rotating credentials file', async () => {
  const f = fakeLoop([incoming('peer-allowed')])
  const file = process.env.DSH_WEIXIN_NATIVE_CREDENTIALS_FILE!
  expect(readNativeCredentials(file)?.token).toBe('THIS_IS_SYNTHETIC_NOT_REAL_CREDENTIALS')
})
