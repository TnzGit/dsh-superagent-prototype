/** Outbox delivery when processing is paused or a Source kind registers late, plus OL-052 P1 synthetic fault injection:
 * restart-over-same-SQLite replay, interrupted writes, worker races, late responses, account rotation and backpressure bounds. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import type { OutboundMessage } from '../src/core/index.ts'
import { Commands } from '../src/infra/commands.ts'
import type { SourceKind } from '../src/sources/kind.ts'
import { Effects } from '../src/app/effects.ts'
import { Outbox } from '../src/app/outbox.ts'
import { Store } from '../src/app/store.ts'
import { SettingsSchema } from '../src/policy.ts'
import { HealthBoard } from '../src/infra/health.ts'
import { SourceRegistry } from '../src/sources/registry.ts'
import { deferred, waitUntil } from './fixtures/async.ts'
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
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('ambiguous_send')
  await at(5000)
  expect(sent).toEqual([id])
  h.runtime.outbox.withdraw(id)
  expect(h.runtime.store.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
})

it.each(['reply', 'acknowledgement', 'notice'] as const)('all Weixin %s messages are durable one-shot after ambiguous acceptance', async kindName => {
  let attempts=0
  const kind: SourceKind<Record<string, never>> = {
    kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' },
    health: [], schema: z.object({}).strict(), fields: [],
    channel: { send: async () => {
      attempts++
      throw Error('synthetic HTTP accepted then connection lost')
    }, link: () => ({ url: '', label: { zh: '', en: '' } }) },
  }
  h.runtime.sources.register(kind)
  const id='ordinary-weixin-'+kindName
  const message: OutboundMessage={id,kind:kindName,text:'test',
    channel:{source:'weixin',thread:'weixin:test',address:{peer:'test'}}}
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  expect(attempts).toBe(1)
  expect(h.runtime.outbox.status(id)).toBe('pending')
  expect(h.runtime.store.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('ambiguous_send')
  // A duplicate queue command or delayed Effects replay cannot trigger another external request.
  h.runtime.outbox.send(message)
  await at(5000)
  expect(attempts).toBe(1)
  h.runtime.outbox.withdraw(id)
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('ambiguous_send')
})

it('a crash after a persisted one-shot claim but before send is reconciled without sending', async () => {
  let attempts=0
  const kind: SourceKind<Record<string, never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},health:[],
    schema:z.object({}).strict(),fields:[],
    channel:{send:async()=>{attempts++;return 'sent'},link:()=>({url:'',label:{zh:'',en:''}})}
  }
  h.runtime.sources.register(kind)
  const id='crashed-between-claim-and-HTTP'
  h.runtime.outbox.send({id,kind:'acknowledgement',text:'test',
    channel:{source:'weixin',thread:'weixin:test',address:{peer:'test'}}})
  expect(h.runtime.store.receipts.claimOneShotSend(id)).toBe(true)
  await h.runtime.sendReplies()
  expect(attempts).toBe(0)
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('ambiguous_send')
  await at(5000)
  expect(attempts).toBe(0)
})

it('Weixin preflight review blocks the network with a durable reason and no claim', async () => {
  let sends=0
  const kind: SourceKind<Record<string, never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},health:[],
    schema:z.object({}).strict(),fields:[],
    channel:{
      preflight:()=>({status:'review',reason:'account_mismatch'}),
      send:async()=>{sends++;return 'sent'},
      link:()=>({url:'',label:{zh:'',en:''}})
    }
  }
  h.runtime.sources.register(kind)
  h.runtime.outbox.send({id:'account-review',kind:'reply',text:'test',
    channel:{source:'weixin',thread:'weixin:test',address:{peer:'test'}}})
  await h.runtime.sendReplies()
  expect(sends).toBe(0)
  expect(h.runtime.store.receipts.get('account-review')).toMatchObject({
    status:'pending',review:{reason:'account_mismatch'}
  })
  expect(h.runtime.store.receipts.get('account-review')?.singleSendAttemptAt).toBeUndefined()
  await at(5000)
  expect(sends).toBe(0)
})

it('a disabled or missing Weixin adapter never consumes the one-shot send claim', async () => {
  const message: OutboundMessage={id:'not-installed-yet',kind:'reply',text:'test',
    channel:{source:'weixin',thread:'weixin:test',address:{peer:'test'}}}
  h.runtime.outbox.send(message)
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get(message.id)?.singleSendAttemptAt).toBeUndefined()
  let attempts=0
  const kind: SourceKind<Record<string, never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},health:[],
    schema:z.object({}).strict(),fields:[],
    channel:{
      preflight:()=>({status:'waiting'}),
      send:async()=>{attempts++;return 'sent'},
      link:()=>({url:'',label:{zh:'',en:''}})
    }
  }
  h.runtime.sources.register(kind)
  await at(5000)
  expect(h.runtime.store.receipts.get(message.id)?.singleSendAttemptAt).toBeUndefined()
  expect(attempts).toBe(0)
})

it('an asynchronous peer revoke during preflight prevents a send and claim', async () => {
  let allowed=true,sends=0
  const kind: SourceKind<Record<string, never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},health:[],
    schema:z.object({}).strict(),fields:[],
    channel:{
      allowed:()=>allowed,
      preflight:async()=>{allowed=false;return {status:'ready'}},
      send:async()=>{sends++;return 'sent'},
      link:()=>({url:'',label:{zh:'',en:''}})
    }
  }
  h.runtime.sources.register(kind)
  h.runtime.outbox.send({id:'revoked-during-preflight',kind:'reply',text:'test',
    channel:{source:'weixin',thread:'weixin:test',address:{peer:'test'}}})
  await h.runtime.sendReplies()
  expect(sends).toBe(0)
  expect(h.runtime.store.receipts.get('revoked-during-preflight')).toMatchObject({
    status:'dropped',dropped:{reason:'channelIgnored'}
  })
  expect(h.runtime.store.receipts.get('revoked-during-preflight')?.singleSendAttemptAt).toBeUndefined()
})

it('non-Weixin Sources retain their transient-failure retry contract', async () => {
  let attempts=0
  const kind: SourceKind<Record<string, never>>={
    kind:'retry-probe',title:{zh:'',en:''},description:{zh:'',en:''},health:[],
    schema:z.object({}).strict(),fields:[],
    channel:{send:async()=>{if(++attempts===1)throw Error('transient');return 'sent'},
      link:()=>({url:'',label:{zh:'',en:''}})}
  }
  h.runtime.sources.register(kind)
  h.runtime.outbox.send({id:'retry-probe-message',kind:'reply',text:'test',
    channel:{source:'retry-probe',thread:'retry-probe:test',address:{}}})
  await h.runtime.sendReplies()
  expect(attempts).toBe(1)
  await at(5000)
  expect(attempts).toBe(2)
  expect(h.runtime.outbox.status('retry-probe-message')).toBe('sent')
})

it('an unclaimed Weixin manual-review hold survives withdraw, duplicate ID and later restored authorization', async () => {
  let ready=false, sends=0
  const kind: SourceKind<Record<string, never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},
    health:[],schema:z.object({}).strict(),fields:[],
    channel:{
      preflight:()=>ready?{status:'ready'}:{status:'review',reason:'account_mismatch'},
      send:async()=>{sends++;return 'sent'},
      link:()=>({url:'',label:{zh:'',en:''}})
    }
  }
  h.runtime.sources.register(kind)
  const original: OutboundMessage={id:'persistent-review-across-withdraw',kind:'reply',text:'first',
    channel:{source:'weixin',thread:'weixin:synthetic',address:{peer:'synthetic'}}}
  h.runtime.outbox.send(original)
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get(original.id)).toMatchObject({
    status:'pending',review:{reason:'account_mismatch'}
  })
  expect(h.runtime.store.receipts.get(original.id)?.singleSendAttemptAt).toBeUndefined()
  h.runtime.outbox.withdraw(original.id)
  expect(h.runtime.store.receipts.get(original.id)?.review?.reason).toBe('account_mismatch')
  ready=true
  h.runtime.outbox.send({...original,text:'second-injection-must-not-replace'})
  await at(5000)
  expect(sends).toBe(0)
  expect(h.runtime.store.receipts.get(original.id)?.text).toBe('first')
  expect(h.runtime.store.receipts.reviewSummary()).toEqual({
    total:1,reasons:{account_mismatch:1}
  })
})

it('review hold and state summary whitelist reason codes, including legacy stored unknown reason', async () => {
  const canary='PRIVATE_TOKEN_SHOULD_NOT_APPEAR_IN_PUBLIC_REVIEW_XXXX'
  const kind: SourceKind<Record<string, never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},
    health:[],schema:z.object({}).strict(),fields:[],
    channel:{
      preflight:()=>({status:'review',reason:canary}),
      send:async()=>{throw Error('review must not invoke the network')},
      link:()=>({url:'',label:{zh:'',en:''}})
    }
  }
  h.runtime.sources.register(kind)
  const id='review-safe-code-only'
  h.runtime.outbox.send({id,kind:'notice',text:'test',
    channel:{source:'weixin',thread:'weixin:synthetic',address:{peer:'synthetic'}}})
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get(id)?.review?.reason).toBe('unclassified_hold')
  // Even a legacy SQLite receipt with untrusted persisted metadata cannot leak via GET state.
  h.runtime.store.db.prepare("UPDATE outbox SET value=json_set(value, '$.review.reason', ?) WHERE id=?")
    .run(canary,id)
  expect(h.runtime.store.receipts.reviewSummary()).toEqual({
    total:1,reasons:{unclassified_hold:1}
  })
  const view=await h.api('GET','state')
  expect(view.status).toBe(200)
  expect(view.body.weixinOutboxReview).toEqual({total:1,reasons:{unclassified_hold:1}})
  expect(JSON.stringify(view.body.weixinOutboxReview)).not.toContain(canary)
})

it('a reviewed Weixin acknowledgement holds later same-ticket outbound work behind it', async () => {
  let sends=0
  const kind:SourceKind<Record<string,never>>={
    kind:'weixin',title:{zh:'',en:''},description:{zh:'',en:''},
    health:[],schema:z.object({}).strict(),fields:[],
    channel:{
      preflight:message=>message.id==='reviewed-ack'?{status:'review',reason:'account_mismatch'}:{status:'ready'},
      send:async()=>{sends++;return 'sent'},
      link:()=>({url:'',label:{zh:'',en:''}})
    }
  }
  h.runtime.sources.register(kind)
  const channel={source:'weixin',thread:'weixin:synthetic',address:{peer:'synthetic'}}
  h.runtime.outbox.send({id:'reviewed-ack',kind:'acknowledgement',text:'ack',ticketId:'synthetic-ticket',channel})
  h.runtime.outbox.send({id:'later-reply',kind:'reply',text:'reply',ticketId:'synthetic-ticket',channel})
  await h.runtime.sendReplies()
  expect(h.runtime.store.receipts.get('reviewed-ack')?.review?.reason).toBe('account_mismatch')
  expect(h.runtime.outbox.status('later-reply')).toBe('pending')
  expect(h.runtime.store.receipts.get('later-reply')?.singleSendAttemptAt).toBeUndefined()
  expect(sends).toBe(0)
  await at(5000)
  expect(sends).toBe(0)
  expect(h.runtime.outbox.status('later-reply')).toBe('pending')
})

// --- OL-052 P1: synthetic fault injection over a test-owned mini harness.
// Fresh disposable SQLite in a test-owned temp dir; fake Sources only; no real Weixin send, model inference,
// original 3080/3083/8123 host, or production SQLite/Session anywhere below.
interface Mini { directory: string; store: Store; commands: Commands
  build: (store: Store) => { effects: Effects; outbox: Outbox; sources: SourceRegistry } }
function miniHarness(): Mini {
  const directory = mkdtempSync(join(tmpdir(), 'ol052-outbox-'))
  const store = new Store(join(directory, 'orchestrator.sqlite'))
  store.saveSettings(SettingsSchema.parse({ sources: { weixin: { enabled: true, config: {} } } }))
  const commands = {} as Commands
  return { directory, store, commands, build: (store: Store) => {
    const board = new HealthBoard()
    const effects = new Effects(store, board)
    const sources = new SourceRegistry(() => store.settings(), board)
    const outbox = new Outbox({ store, effects, sources, commands, paused: () => false })
    return { effects, outbox, sources }
  } }
}
function closeMini(mini: Mini) { try { mini.store.close() } catch { /* already closed by the restart phase */ } rmSync(mini.directory, { recursive: true, force: true }) }
async function runMini(effects: Effects, ms: number) {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + ms })
  try { await effects.idle('reply') } finally { vi.useRealTimers() }
}
const weixinMessage = (id: string, kind: OutboundMessage['kind'] = 'reply'): OutboundMessage =>
  ({ id, kind, text: 'synthetic', channel: { source: 'weixin', thread: 'weixin:synthetic', address: { peer: 'synthetic' } } })

it('a restart over the same disposable SQLite holds a claimed-but-unsent Weixin row for review with no second adapter attempt', async () => {
  const mini = miniHarness()
  const first = mini.build(mini.store)
  let firstAttempts = 0
  first.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }), send: async () => { firstAttempts++; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  first.effects.start()
  const message = weixinMessage('restarted-durable-claim')
  first.outbox.send(message)
  // Process cut off AFTER the durable one-shot claim and BEFORE the HTTP request: claim, then close every handle without dispatching.
  expect(mini.store.atomic(() => mini.store.receipts.claimOneShotSend(message.id))).toBe(true)
  expect(first.effects.pending('reply', message.id)).toBe(true)
  mini.store.close()
  // A restart: a fresh Store over the same disposable SQLite with a fresh Effects/Outbox/Registry; the durable effect row survives.
  const reopened = new Store(join(mini.directory, 'orchestrator.sqlite'))
  expect(reopened.receipts.get(message.id)?.singleSendAttemptAt).toBeTruthy()
  const second = mini.build(reopened)
  let secondAttempts = 0
  second.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }), send: async () => { secondAttempts++; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  second.effects.start()
  await second.outbox.sent()
  // Never falsely marked delivered, and AT MOST ONE external attempt for an already-claimed ID (here zero: the claim is spent).
  expect(secondAttempts).toBe(0)
  expect(reopened.receipts.get(message.id)).toMatchObject({ status: 'pending', review: { reason: 'ambiguous_send' } })
  expect(reopened.receipts.claimOneShotSend(message.id)).toBe(false)
  expect(second.effects.pending('reply', message.id)).toBe(false)
  await runMini(second.effects, 300_000)
  expect(secondAttempts).toBe(0)
  reopened.close()
  closeMini(mini)
})

it('two Outbox workers racing one Weixin message ID consume at most one durable claim and one adapter attempt', async () => {
  const mini = miniHarness()
  const gate = deferred<void>()
  const attempts: string[] = []
  const racingKind = (worker: string): SourceKind<Record<string, never>> => ({
    kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }),
      send: async () => { attempts.push(worker); await gate.promise; return 'sent' },
      link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  const worker1 = mini.build(mini.store)
  const worker2 = mini.build(mini.store)
  worker1.sources.register(racingKind('worker-1'))
  worker2.sources.register(racingKind('worker-2'))
  const message = weixinMessage('two-workers-one-claim')
  worker1.outbox.send(message)
  worker1.effects.start(); worker2.effects.start()
  // Worker 1 claims and its send is in flight; worker 2 dispatches the same durable row and loses the claim race.
  const first = worker1.effects.idle('reply')
  const second = worker2.effects.idle('reply')
  gate.resolve()
  await Promise.all([first, second])
  expect(attempts).toEqual(['worker-1'])
  expect(mini.store.receipts.get(message.id)).toMatchObject({ status: 'sent' })
  expect(mini.store.receipts.get(message.id)?.singleSendAttemptAt).toBeTruthy()
  expect(mini.store.receipts.claimOneShotSend(message.id)).toBe(false)
  closeMini(mini)
})

it('an interrupted SQLite write rolls back and cannot leave a half-written receipt, claim, or settled delivery', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  worker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }), send: async () => 'sent', link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  const message = weixinMessage('interrupted-write')
  expect(() => mini.store.atomic(() => { mini.store.receipts.add(message); throw Error('synthetic cut-off write') })).toThrow('cut-off')
  expect(mini.store.receipts.get(message.id)).toBeUndefined()
  expect(worker.effects.pending('reply', message.id)).toBe(false)
  // The interrupted claim leaves the receipt unclaimed, so the one-shot claim is still available and nothing was delivered.
  expect(() => mini.store.atomic(() => { mini.store.receipts.claimOneShotSend(message.id); throw Error('synthetic cut-off claim') })).toThrow('cut-off')
  expect(mini.store.receipts.get(message.id)?.singleSendAttemptAt).toBeUndefined()
  // An interrupted settle keeps the receipt pending (never falsely marked as delivered).
  worker.outbox.send(message)
  expect(() => mini.store.atomic(() => { mini.store.receipts.settle(message, 'sent'); throw Error('synthetic cut-off settle') })).toThrow('cut-off')
  expect(mini.store.receipts.get(message.id)?.status).toBe('pending')
  // An interruption inside `send` (the enqueue step) rolls the receipt back with it, and a later retry queues cleanly.
  const enqueue = vi.spyOn(worker.effects, 'enqueue').mockImplementation(() => { throw Error('synthetic cut-off enqueue') })
  expect(() => worker.outbox.send(weixinMessage('interrupted-send'))).toThrow('cut-off')
  expect(mini.store.receipts.get('interrupted-send')).toBeUndefined()
  expect(worker.effects.pending('reply', 'interrupted-send')).toBe(false)
  enqueue.mockRestore()
  worker.outbox.send(weixinMessage('interrupted-send'))
  await worker.outbox.sent()
  expect(mini.store.receipts.get('interrupted-send')?.status).toBe('sent')
  expect(worker.effects.pending('reply', 'interrupted-send')).toBe(false)
  closeMini(mini)
})

it('a response delivered after its message was withdrawn settles once and the ID cannot be queued or sent again', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  const gate = deferred<void>()
  let sends = 0
  worker.sources.register({ kind: 'late-probe', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { send: async () => { sends++; await gate.promise; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  const message: OutboundMessage = { id: 'late-response', kind: 'reply', text: 'first', ticketId: 'synthetic-ticket',
    channel: { source: 'late-probe', thread: 'late-probe:synthetic', address: {} } }
  worker.outbox.send(message)
  await waitUntil(() => sends === 1) // the send is in flight against the unclaimed, unreviewed receipt
  expect(sends).toBe(1)
  worker.outbox.withdraw(message.id)
  expect(mini.store.receipts.get(message.id)).toBeUndefined()
  gate.resolve()
  await worker.outbox.sent()
  // The late response recreates the receipt as sent, so the message ID stays idempotent and cannot be re-queued.
  expect(mini.store.receipts.get(message.id)).toMatchObject({ status: 'sent', text: 'first' })
  worker.outbox.send({ ...message, text: 're-queued' })
  await runMini(worker.effects, 600_000)
  expect(sends).toBe(1)
  expect(mini.store.receipts.get(message.id)?.text).toBe('first')
  expect(worker.effects.pending('reply', message.id)).toBe(false)
  closeMini(mini)
})

it('the same Weixin message ID queued twice before delivery keeps the first payload and one effect row', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  let sends = 0
  worker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }), send: async () => { sends++; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  const message = { ...weixinMessage('idempotency-key-collision'), text: 'first' }
  worker.outbox.send(message)
  worker.outbox.send({ ...message, text: 'second-injection-must-not-replace' })
  expect(mini.store.receipts.add({ ...message, text: 'third' })).toBe(false)
  expect(worker.effects.pending('reply', message.id)).toBe(true)
  await worker.outbox.sent()
  expect(sends).toBe(1)
  expect(mini.store.receipts.get(message.id)).toMatchObject({ status: 'sent', text: 'first', channel: message.channel })
  closeMini(mini)
})

it('an already-claimed Weixin ID survives re-queue and long backoff with exactly one adapter attempt', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  let sends = 0
  worker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }),
      send: async () => { sends++; throw Error('synthetic HTTP accepted then connection lost') },
      link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  const message = weixinMessage('claimed-one-shot-long-backoff', 'acknowledgement')
  worker.outbox.send(message)
  await worker.outbox.sent()
  expect(sends).toBe(1)
  worker.outbox.send(message)
  for (const ms of [5_000, 10_000, 20_000, 60_000, 300_000, 600_000]) {
    await runMini(worker.effects, ms)
    expect(sends).toBe(1)
    expect(mini.store.receipts.get(message.id)?.status).toBe('pending')
  }
  expect(mini.store.receipts.get(message.id)).toMatchObject({ review: { reason: 'ambiguous_send' }, singleSendAttemptAt: expect.any(String) })
  // No unsafe cancellation: a withdrawn claimed row keeps both its durable claim and its effect row.
  worker.outbox.withdraw(message.id)
  expect(mini.store.receipts.get(message.id)?.singleSendAttemptAt).toBeTruthy()
  expect(mini.store.receipts.get(message.id)?.review?.reason).toBe('ambiguous_send')
  closeMini(mini)
})

it('a Weixin receipt is dropped by default when its peer is not on the live allowlist, without egress or claim', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  let sends = 0
  const kind: SourceKind<{ allowedPeers: { id: string }[] }> = { kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({ allowedPeers: z.array(z.object({ id: z.string() }).strict()).default([]) }).strict(), fields: [],
    channel: { allowed: (address, config) => config.allowedPeers.some(row => row.id === address.peer),
      preflight: () => ({ status: 'ready' }), send: async () => { sends++; return 'sent' },
      link: () => ({ url: '', label: { zh: '', en: '' } }) } }
  worker.sources.register(kind)
  worker.effects.start()
  const message = weixinMessage('deny-by-default-peer')
  worker.outbox.send(message)
  await worker.outbox.sent()
  expect(sends).toBe(0)
  expect(mini.store.receipts.get(message.id)).toMatchObject({ status: 'dropped', dropped: { reason: 'channelIgnored' } })
  expect(mini.store.receipts.get(message.id)?.singleSendAttemptAt).toBeUndefined()
  expect(mini.store.receipts.reviewSummary()).toEqual({ total: 0, reasons: {} })
  closeMini(mini)
})

it('a reviewed earlier same-ticket Weixin message is never bypassed, while a persistently failing one releases the later message after the bound', async () => {
  // Fail-closed backpressure: a durable review hold has no retry effect, so it holds later same-ticket work indefinitely
  // (real live resolution stays GATED: only a human with a genuine peer and server-side idempotency may resolve it).
  const reviewed = miniHarness()
  const reviewedWorker = reviewed.build(reviewed.store)
  reviewedWorker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: m => m.id === 'reviewed-earlier' ? { status: 'review', reason: 'account_mismatch' } : { status: 'ready' },
      send: async () => 'sent', link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  reviewedWorker.effects.start()
  const channel = { source: 'weixin', thread: 'weixin:synthetic', address: { peer: 'synthetic' } }
  reviewedWorker.outbox.send({ id: 'reviewed-earlier', kind: 'acknowledgement', text: 'ack', ticketId: 'bounded-ticket', channel })
  reviewedWorker.outbox.send({ id: 'later-than-review', kind: 'reply', text: 'reply', ticketId: 'bounded-ticket', channel })
  await reviewedWorker.outbox.sent()
  for (const ms of [5_000, 60_000, 300_000, 600_000]) {
    await runMini(reviewedWorker.effects, ms)
    expect(reviewed.store.receipts.get('later-than-review')?.status).toBe('pending')
    expect(reviewed.store.receipts.behind('later-than-review', 3)).toBe(true)
  }
  closeMini(reviewed)
  // Bounded, not deadlocked: an earlier message that keeps failing outright stops holding the later one at the failure threshold.
  const failing = miniHarness()
  const failingWorker = failing.build(failing.store)
  let sends = 0
  failingWorker.sources.register({ kind: 'failing-probe', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { send: async (_host, message) => { sends++; if (message.id === 'earlier-failing') throw Error('synthetic transient'); return 'sent' },
      link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  failingWorker.effects.start()
  const probe = { source: 'failing-probe', thread: 'failing-probe:synthetic', address: {} }
  failingWorker.outbox.send({ id: 'earlier-failing', kind: 'reply', text: 'one', ticketId: 'bounded-ticket', channel: probe })
  failingWorker.outbox.send({ id: 'later-released', kind: 'reply', text: 'two', ticketId: 'bounded-ticket', channel: probe })
  await runMini(failingWorker.effects, 0)
  await runMini(failingWorker.effects, 5_000)
  expect(sends).toBe(2)
  expect(failing.store.receipts.behind('later-released', 3)).toBe(true)
  await runMini(failingWorker.effects, 15_000)
  // The earlier message has now failed three times, matching FAILURES_BEFORE_ERROR: the later one is released, not bypassed.
  expect(sends).toBe(4)
  expect(failing.store.receipts.behind('later-released', 3)).toBe(false)
  expect(failing.store.receipts.get('later-released')?.status).toBe('sent')
  expect(failing.store.receipts.get('earlier-failing')?.status).toBe('pending')
  closeMini(failing)
})

it('the read-only review ledger projects sanitized audit fields, caps its scan, and mutates nothing', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  const canary = 'PRIVATE_PROVIDER_TEXT_SHOULD_NOT_APPEAR_YYYY'
  worker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'review', reason: 'account_mismatch' }),
      send: async () => { throw Error('review must not reach the network') }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  worker.outbox.send(weixinMessage('ledger-unclaimed-review', 'notice'))
  await worker.outbox.sent()
  // A claimed, ambiguous row and a legacy row whose stored reason text is untrusted.
  const claimed = weixinMessage('ledger-claimed-review')
  mini.store.receipts.add(claimed)
  mini.store.receipts.claimOneShotSend(claimed.id)
  mini.store.receipts.holdForReview(claimed.id, 'ambiguous_send')
  mini.store.receipts.add(weixinMessage('ledger-legacy-reason'))
  mini.store.db.prepare("UPDATE outbox SET value=json_set(value, '$.review', json(json_object('at', ?, 'reason', ?))) WHERE id=?")
    .run(new Date().toISOString(), canary, 'ledger-legacy-reason')
  // Non-Weixin and already-sent rows are excluded from the ledger.
  mini.store.receipts.add({ id: 'ledger-not-weixin', kind: 'reply', text: 'x', channel: { source: 'feishu', thread: 'feishu:1', address: {} } })
  mini.store.receipts.holdForReview('ledger-not-weixin', 'account_mismatch')
  mini.store.receipts.add({ id: 'ledger-sent', kind: 'reply', text: 'x', channel: { source: 'weixin', thread: 'weixin:synthetic', address: { peer: 'synthetic' } } })
  mini.store.receipts.settle({ id: 'ledger-sent', kind: 'reply', text: 'x', channel: { source: 'weixin', thread: 'weixin:synthetic', address: { peer: 'synthetic' } } }, 'sent')
  const ledger = mini.store.receipts.reviewLedger()
  expect(ledger.map(row => [row.id, row.reason, row.claimed])).toEqual([
    ['ledger-unclaimed-review', 'account_mismatch', false],
    ['ledger-claimed-review', 'ambiguous_send', true],
    ['ledger-legacy-reason', 'unclassified_hold', false] ])
  expect(ledger.every(row => row.reviewAt && row.kind)).toBe(true)
  expect(mini.store.receipts.reviewLedger(2).map(row => row.id)).toEqual(['ledger-unclaimed-review', 'ledger-claimed-review'])
  expect(JSON.stringify(ledger)).not.toContain(canary)
  expect(JSON.stringify(ledger)).not.toContain('synthetic')
  expect(JSON.stringify(ledger)).not.toContain('synthetic-peer-token')
  // Strictly read-only: the same rows again, byte-identical, with no mutation of status, claim, or review.
  const before = mini.store.db.prepare('SELECT id, value FROM outbox ORDER BY rowid').all()
  expect(mini.store.receipts.reviewLedger()).toEqual(ledger)
  expect(mini.store.db.prepare('SELECT id, value FROM outbox ORDER BY rowid').all()).toEqual(before)
  // Test-only dry-run: reports what a manual terminal marking WOULD write (audit fields included) without sending or mutating.
  const dry = mini.store.receipts.reviewResolveDryRun('ledger-claimed-review')
  expect(dry).toMatchObject({ found: true, status: 'pending', wouldSettle: { status: 'sent' },
    audit: { reason: 'ambiguous_send', claimed: true, claimedAt: expect.any(String), reviewAt: expect.any(String) } })
  expect(mini.store.db.prepare('SELECT id, value FROM outbox ORDER BY rowid').all()).toEqual(before)
  expect(mini.store.receipts.reviewResolveDryRun('ledger-not-weixin').found).toBe(false)
  expect(mini.store.receipts.reviewResolveDryRun('ledger-sent').found).toBe(false)
  closeMini(mini)
})

it('the installed runtime exposes only the read-only review summary and no mutating reconcile, reset, or resend route', async () => {
  // Real live resolution is GATED (docs/018): no reconcile/claim-reset/resend is wired into the installed management API.
  for (const path of ['outbox/reconcile', 'outbox/review/resolve', 'outbox/claim/reset', 'outbox/resend', 'receipts/review/resolve']) {
    const response = await h.api('POST', path, {})
    expect(response.status).toBe(404)
  }
  const view = await h.api('GET', 'state')
  expect(view.status).toBe(200)
  expect(view.body.weixinOutboxReview).toEqual({ total: 0, reasons: {} })
})

// --- OL-20261125-053 subagent B: durable-receipt, review-reconciliation and replay invariants for the real-I3 pilot.
// Same disposable-SQLite mini harness as above: synthetic sources only, no real Weixin, model, or host service.

it('a duplicate or racing holdForReview can never overwrite the first durable review reason', async () => {
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  worker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'review', reason: 'account_mismatch' }), send: async () => 'sent', link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  const message = weixinMessage('duplicate-hold-frozen')
  worker.outbox.send(message)
  await worker.outbox.sent()
  const held = mini.store.receipts.get(message.id)
  expect(held?.review).toMatchObject({ reason: 'account_mismatch' })
  const reviewAt = held?.review?.at
  // A later race (different reason, second hold, direct store write) must not rewrite the first durable reason.
  mini.store.receipts.holdForReview(message.id, 'context_missing')
  mini.store.atomic(() => mini.store.receipts.holdForReview(message.id, 'ambiguous_send'))
  expect(mini.store.receipts.get(message.id)).toMatchObject({ status: 'pending', review: { reason: 'account_mismatch', at: reviewAt } })
  expect(mini.store.receipts.reviewSummary()).toEqual({ total: 1, reasons: { account_mismatch: 1 } })
  closeMini(mini)
})

it('the automatic delivery path can never bypass a durable review hold on replay', async () => {
  // The hold is the only sanctioned non-terminal durable state for operator reconciliation (docs/018):
  // a re-queued (replayed) row with a hold must bail before the network and keep its first reason intact.
  const mini = miniHarness()
  const worker = mini.build(mini.store)
  let sends = 0
  worker.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'review', reason: 'account_mismatch' }), send: async () => { sends++; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  worker.effects.start()
  const message = weixinMessage('settle-cannot-clear-hold')
  worker.outbox.send(message)
  await worker.outbox.sent()
  const held = mini.store.receipts.get(message.id)
  expect(held).toMatchObject({ status: 'pending', review: { reason: 'account_mismatch' } })
  expect(sends).toBe(0)
  // Replay the row directly through the store API: a second hold cannot rewrite the first reason.
  mini.store.receipts.holdForReview(message.id, 'context_missing')
  expect(mini.store.receipts.get(message.id)?.review).toMatchObject({ reason: 'account_mismatch', at: held?.review?.at })
  // A duplicate queue of the same ID (the replay path) stays held with zero egress, even after the long backoff.
  worker.outbox.send({ ...message, text: 're-queued' })
  for (const ms of [5_000, 60_000, 300_000]) await runMini(worker.effects, ms)
  expect(sends).toBe(0)
  expect(mini.store.receipts.get(message.id)).toMatchObject({ status: 'pending', review: { reason: 'account_mismatch' }, text: 'synthetic' })
  expect(mini.store.receipts.reviewSummary()).toEqual({ total: 1, reasons: { account_mismatch: 1 } })
  closeMini(mini)
})

it('a replayed settle never rewrites an already-terminal receipt and a late response cannot re-open a withdrawn ID', async () => {
  const mini = miniHarness()
  const sent = weixinMessage('replayed-settle-sent')
  mini.store.receipts.add(sent)
  mini.store.receipts.settle(sent, 'sent')
  const dropped = weixinMessage('replayed-settle-dropped')
  mini.store.receipts.add(dropped)
  mini.store.receipts.settle(dropped, 'channelGone')
  // Replay with the OPPOSITE outcome: terminal states are never rewritten, and the drop audit survives.
  mini.store.receipts.settle(sent, 'channelIgnored')
  mini.store.receipts.settle(dropped, 'sent')
  expect(mini.store.receipts.get(sent.id)).toMatchObject({ status: 'sent' })
  expect(mini.store.receipts.get(sent.id)?.dropped).toBeUndefined()
  expect(mini.store.receipts.get(dropped.id)).toMatchObject({ status: 'dropped', dropped: { reason: 'channelGone' } })
  // The forensic claim + review audit survive terminalization (json_patch keeps them on the row).
  const audited = weixinMessage('replayed-settle-audit-kept')
  mini.store.receipts.add(audited)
  mini.store.receipts.claimOneShotSend(audited.id)
  mini.store.receipts.holdForReview(audited.id, 'ambiguous_send')
  mini.store.receipts.settle(audited, 'sent')
  expect(mini.store.receipts.get(audited.id)).toMatchObject({ status: 'sent', singleSendAttemptAt: expect.any(String) })
  // A row withdrawn while its send is in flight is recreated terminal by the late response so the ID stays idempotent.
  const withdrawn = weixinMessage('replayed-settle-withdrawn')
  mini.store.receipts.add(withdrawn)
  expect(mini.store.receipts.withdraw(withdrawn.id)).toBe(true)
  mini.store.receipts.settle(withdrawn, 'sent')
  expect(mini.store.receipts.get(withdrawn.id)).toMatchObject({ status: 'sent' })
  // and that recreated ID is never re-queueable as pending again.
  expect(mini.store.receipts.add({ ...withdrawn, text: 're-queued' })).toBe(false)
  expect(mini.store.receipts.get(withdrawn.id)?.status).toBe('sent')
  closeMini(mini)
})

it('durable terminal classification (sent, dropped, review-held) survives a restart over the same SQLite and is never auto-retried', async () => {
  const mini = miniHarness()
  const first = mini.build(mini.store)
  first.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: m => m.id === 'terminal-review' ? { status: 'review', reason: 'account_mismatch' } : { status: 'ready' },
      send: async () => 'sent', link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  first.effects.start()
  first.outbox.send(weixinMessage('terminal-sent'))
  first.outbox.send(weixinMessage('terminal-review'))
  await first.outbox.sent()
  const dropped = weixinMessage('terminal-dropped')
  mini.store.receipts.add(dropped)
  mini.store.receipts.settle(dropped, 'channelGone')
  // Crash-after-claim: claimed, pending, no review yet (the restart reconciles it, never replays it).
  const crashed = weixinMessage('terminal-crashed-claim')
  mini.store.receipts.add(crashed)
  expect(mini.store.atomic(() => mini.store.receipts.claimOneShotSend(crashed.id))).toBe(true)
  mini.store.close()
  const reopened = new Store(join(mini.directory, 'orchestrator.sqlite'))
  expect(reopened.receipts.get('terminal-sent')?.status).toBe('sent')
  expect(reopened.receipts.get('terminal-dropped')).toMatchObject({ status: 'dropped', dropped: { reason: 'channelGone' } })
  expect(reopened.receipts.get('terminal-review')).toMatchObject({ status: 'pending', review: { reason: 'account_mismatch' } })
  expect(reopened.receipts.get('terminal-crashed-claim')).toMatchObject({ status: 'pending', singleSendAttemptAt: expect.any(String) })
  // Force a reply effect for every durable row: dispatch must bail on terminal/reviewed states and consume zero attempts.
  const second = mini.build(reopened)
  let attempts = 0
  second.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }), send: async () => { attempts++; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  second.effects.start()
  for (const id of ['terminal-sent', 'terminal-dropped', 'terminal-review', 'terminal-crashed-claim']) {
    const receipt = reopened.receipts.get(id)!
    second.effects.enqueue('reply', id, {})
    reopened.receipts.add({ ...receipt, id } as OutboundMessage) // no-op add proves dedupe over the existing row
  }
  await second.outbox.sent()
  expect(attempts).toBe(0)
  expect(reopened.receipts.get('terminal-sent')?.status).toBe('sent')
  expect(reopened.receipts.get('terminal-dropped')?.status).toBe('dropped')
  expect(reopened.receipts.get('terminal-review')?.review?.reason).toBe('account_mismatch')
  // The crash-claim row is reconciled into an ambiguous hold, still never replayed, and enumerable in the ledger.
  await runMini(second.effects, 300_000)
  expect(attempts).toBe(0)
  expect(reopened.receipts.get('terminal-crashed-claim')).toMatchObject({ status: 'pending', review: { reason: 'ambiguous_send' } })
  expect(reopened.receipts.reviewLedger().map(row => row.id)).toContain('terminal-crashed-claim')
  expect(reopened.receipts.claimOneShotSend('terminal-crashed-claim')).toBe(false)
  reopened.close()
  closeMini(mini)
})

it('same-ticket backpressure stays durable across a restart over the same disposable SQLite', async () => {
  const mini = miniHarness()
  const first = mini.build(mini.store)
  first.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: m => m.id === 'bp-reviewed-earlier' ? { status: 'review', reason: 'account_mismatch' } : { status: 'ready' },
      send: async () => 'sent', link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  first.effects.start()
  const channel = { source: 'weixin', thread: 'weixin:synthetic', address: { peer: 'synthetic' } }
  first.outbox.send({ id: 'bp-reviewed-earlier', kind: 'acknowledgement', text: 'ack', ticketId: 'bp-ticket', channel })
  first.outbox.send({ id: 'bp-later', kind: 'reply', text: 'reply', ticketId: 'bp-ticket', channel })
  await first.outbox.sent()
  expect(mini.store.receipts.behind('bp-later', 3)).toBe(true)
  mini.store.close()
  // Restart: a fresh Store handle over the same file; the durable review hold alone must still gate the later row.
  const reopened = new Store(join(mini.directory, 'orchestrator.sqlite'))
  expect(reopened.receipts.behind('bp-later', 3)).toBe(true)
  const second = mini.build(reopened)
  let attempts = 0
  second.sources.register({ kind: 'weixin', title: { zh: '', en: '' }, description: { zh: '', en: '' }, health: [],
    schema: z.object({}).strict(), fields: [],
    channel: { preflight: () => ({ status: 'ready' }), send: async () => { attempts++; return 'sent' }, link: () => ({ url: '', label: { zh: '', en: '' } }) } })
  second.effects.start()
  await second.outbox.sent()
  for (const ms of [5_000, 60_000, 300_000]) {
    await runMini(second.effects, ms)
    expect(reopened.receipts.get('bp-later')?.status).toBe('pending')
    expect(reopened.receipts.behind('bp-later', 3)).toBe(true)
    expect(attempts).toBe(0)
  }
  reopened.close()
  closeMini(mini)
})

it('the manual-resolve dry-run projects a DropReason outcome and never finds an unreviewed pending row', async () => {
  const mini = miniHarness()
  const claimed = weixinMessage('dryrun-drop-outcome')
  mini.store.receipts.add(claimed)
  mini.store.receipts.claimOneShotSend(claimed.id)
  mini.store.receipts.holdForReview(claimed.id, 'ambiguous_send')
  const dry = mini.store.receipts.reviewResolveDryRun(claimed.id, 'channelGone')
  expect(dry).toMatchObject({ found: true, status: 'pending', wouldSettle: { status: 'channelGone' },
    audit: { reason: 'ambiguous_send', claimed: true, claimedAt: expect.any(String), reviewAt: expect.any(String) } })
  // An unreviewed pending row (claimed or not) is not a reconciliation candidate: found must be false.
  const unreviewed = weixinMessage('dryrun-no-review')
  mini.store.receipts.add(unreviewed)
  expect(mini.store.receipts.reviewResolveDryRun(unreviewed.id, 'channelGone').found).toBe(false)
  expect(mini.store.receipts.reviewResolveDryRun(unreviewed.id).found).toBe(false)
  const claimedUnreviewed = weixinMessage('dryrun-claimed-unreviewed')
  mini.store.receipts.add(claimedUnreviewed)
  mini.store.receipts.claimOneShotSend(claimedUnreviewed.id)
  expect(mini.store.receipts.reviewResolveDryRun(claimedUnreviewed.id, 'channelIgnored').found).toBe(false)
  // Strictly read-only across every variant: rows stay byte-identical.
  const before = mini.store.db.prepare('SELECT id, value FROM outbox ORDER BY rowid').all()
  mini.store.receipts.reviewResolveDryRun(claimed.id, 'channelIgnored')
  mini.store.receipts.reviewResolveDryRun(claimed.id, 'sent')
  expect(mini.store.db.prepare('SELECT id, value FROM outbox ORDER BY rowid').all()).toEqual(before)
  closeMini(mini)
})
