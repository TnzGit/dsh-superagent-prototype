/** I3 PREP ONLY: real Source polling code with fake HTTP/credentials/Engine,
 * NO actual Weixin, network, DSH session, model, original source or Apply. */
import { afterEach, expect, test, vi } from 'vitest'
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
  allowedPeers?: string[]
  receive?: (trigger: unknown, abort: () => void) => Promise<unknown>
  route?: (trigger: unknown, abort: () => void) => Promise<boolean>
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-i3-fake-native-weixin-'))
  tempPaths.push(dir)
  const file = join(dir, 'fake-credentials.json')
  writeFileSync(file, JSON.stringify({
    token: 'THIS_IS_SYNTHETIC_NOT_REAL_CREDENTIALS',
    baseUrl: 'https://ilinkai.weixin.qq.com'
  }), { mode: 0o600 })
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', file)
  const requests: Array<{ url: string; method: unknown }> = []
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init: RequestInit = {}) => {
    const url = String(input)
    // Strict egress trap: an accidental send endpoint must fail the test.
    if (url !== 'https://ilinkai.weixin.qq.com/ilink/bot/getupdates' || init.method !== 'POST')
      throw Error('I3 OFFLINE TEST FORBIDS OUTBOUND: ' + url)
    requests.push({ url, method: init.method })
    return new Response(JSON.stringify({ ret: 0, errcode: 0, msgs: messages,
      get_updates_buf: 'cursor-after-page', longpolling_timeout_ms: 1000 }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  const controller = new AbortController()
  const records = new Map<string, unknown>([[KV.weixin.nativeCursor, 'cursor-before-page']])
  const received: unknown[] = [], routed: unknown[] = [], health: string[] = []
  const ctx = {
    ready: Promise.resolve(),
    configured: () => true,
    config: () => nativeWeixinKind.schema.parse({
      allowedPeers: (opts.allowedPeers ?? ['peer-allowed']).map(id => ({ id }))
    }),
    state: {
      get: (key: string) => records.get(key),
      set: (key: string, value: unknown) => { if (value === undefined) records.delete(key); else records.set(key, value) },
    },
    receive: async (trigger: unknown) => {
      received.push(trigger)
      if (opts.receive) return opts.receive(trigger, () => controller.abort())
      controller.abort()
      return { status: 'stored' }
    },
    threads: { describe: vi.fn() },
    report: (_: string, item: { state: string }) => {
      health.push(item.state)
      if (item.state === 'ready' && !controller.signal.aborted) controller.abort()
      if (item.state === 'error') controller.abort()
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

test('I3 offline: allowed inbound commits cursor only AFTER durable Engine receive settles', async () => {
  let sawOldCursor = false
  const f = fakeLoop([incoming('peer-allowed')], { receive: async (_trigger, abort) => {
    sawOldCursor = f.records.get(KV.weixin.nativeCursor) === 'cursor-before-page'
    await Promise.resolve()
    expect(f.records.get(KV.weixin.nativeCursor)).toBe('cursor-before-page')
    abort()
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
  const f = fakeLoop([incoming('peer-allowed')], { route: async (_trigger, abort) => {
    abort()
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
