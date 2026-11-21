/** Outbox delivery when processing is paused or a Source kind registers late. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { OutboundMessage } from '../src/core/index.ts'
import { Commands } from '../src/infra/commands.ts'
import type { SourceKind } from '../src/sources/kind.ts'
import { feishu, startRuntime, type Host } from './fixtures/host.ts'

let h: Host
beforeEach(async () => { h = await startRuntime() })
afterEach(async () => { await h.stop() })
async function at(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + ms })
  try { await h.runtime.pump(); await h.runtime.sendReplies() } finally { vi.useRealTimers() }
}

it('holds every message while processing is paused, and sends it once processing resumes', async () => {
  const lark = vi.mocked(Commands.prototype.lark)
  await h.runtime.settings.pause(true, 'panel')
  lark.mockClear()
  h.runtime.outbox.send({ id: 'held', channel: feishu('1', 'x').channel!, text: '已合并。', kind: 'notice' })
  await h.runtime.sendReplies()
  expect([h.runtime.outbox.status('held'), lark.mock.calls.length]).toEqual(['pending', 0])
  await h.runtime.settings.pause(false, 'panel')
  await h.runtime.pump(); await h.runtime.sendReplies()
  expect(h.runtime.outbox.status('held')).toBe('sent')
  expect(JSON.stringify(lark.mock.calls)).toContain('已合并。')
})

it('keeps a message for a Source that is not installed waiting, and sends it once the Source\'s kind registers', async () => {
  const sent: OutboundMessage[] = []
  const probe: SourceKind<Record<string, never>> = { kind: 'probe', title: { zh: '探针', en: 'Probe' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { send: async (_host, message) => { sent.push(message); return 'sent' }, link: () => ({ url: '', label: { zh: '探针', en: 'Probe' } }) } }
  h.runtime.outbox.send({ id: 'waiting', channel: { source: 'probe', thread: 'probe:1', address: {} }, text: 'Done', kind: 'reply' })
  await h.runtime.sendReplies()
  expect([h.runtime.outbox.status('waiting'), h.runtime.health.reply?.state]).toEqual(['pending', 'ready'])
  h.runtime.sources.register(probe)
  // A message whose Source was not installed is tried again after 5 seconds.
  await at(5000)
  expect([h.runtime.outbox.status('waiting'), sent.map(message => message.id)]).toEqual(['sent', ['waiting']])
})

it('C5 relay Weixin reply never retries network send after ambiguous failure', async () => {
  const sent: string[] = []
  const kind: SourceKind<Record<string, never>> = {
    kind: 'weixin', title: { zh: '测试微信', en: 'Test Weixin' },
    description: { zh: '', en: '' }, health: [], schema: z.object({}).strict(), fields: [],
    channel: { send: async (_ctx, message) => {
      sent.push(message.id)
      throw Error('ambiguous network failure after possible acceptance')
    }, link: () => ({ url: '', label: { zh: '', en: '' } }) },
  }
  h.runtime.sources.register(kind)
  const id = 'dsh-3080-reply-' + 'a'.repeat(40)
  h.runtime.outbox.send({ id, kind: 'reply', text: 'test',
    channel: { source: 'weixin', thread: 'weixin:test', address: { peer: 'test', contextToken: 'test-context' } } })
  await h.runtime.sendReplies()
  expect(sent).toEqual([id])
  expect(h.runtime.outbox.status(id)).toBe('pending')
  expect(h.runtime.store.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
  await at(5000)
  expect(sent).toEqual([id])
  h.runtime.outbox.withdraw(id)
  expect(h.runtime.store.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
})

it('ordinary Weixin replies still retry transient failures', async () => {
  let attempts=0
  const kind: SourceKind<Record<string, never>> = {
    kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' },
    health: [], schema: z.object({}).strict(), fields: [],
    channel: { send: async () => {
      attempts++
      if(attempts===1)throw Error('transient')
      return 'sent' as const
    }, link: () => ({ url: '', label: { zh: '', en: '' } }) },
  }
  h.runtime.sources.register(kind)
  h.runtime.outbox.send({ id: 'ordinary-weixin', kind: 'reply', text: 'test',
    channel: { source: 'weixin', thread: 'weixin:test', address: { peer: 'test' } } })
  await h.runtime.sendReplies()
  expect(attempts).toBe(1)
  await at(5000)
  expect(attempts).toBe(2)
  expect(h.runtime.outbox.status('ordinary-weixin')).toBe('sent')
})
