// @ts-nocheck
/**
 * I1C: actual AgentDelivery implementation under an injected disposable DSH
 * session/persistence event transport. No real SessionController, model, Weixin,
 * production state, workspace write or source Apply occurs here.
 */
import { test, expect } from 'vitest'
import { AgentDelivery, messageId } from '../src/app/delivery.ts'
import { key } from '../src/core/index.ts'

function fakeDsh() {
  const callbacks = new Map()
  const agents = new Map()
  const history = new Map()
  const transmissions = []
  let flushes = 0, reads = 0
  let badFlush = false
  const context = {
    on(name, callback) {
      callbacks.set(name, [...callbacks.get(name) ?? [], callback])
      return () => callbacks.set(name, (callbacks.get(name) ?? []).filter(fn => fn !== callback))
    },
    agents: { get: id => agents.get(id) },
    sessionPersistence: {
      async flush() { flushes++; if (badFlush) throw Error('private mock persistence unavailable') },
      async open(id, mode) {
        expect(mode).toBe('read')
        return {
          async read(offset, limit) {
            reads++
            return { events: (history.get(id) ?? []).slice(offset, offset + limit) }
          },
          async [Symbol.asyncDispose]() {}
        }
      }
    }
  }
  const agent = id => {
    const session = { id }
    const inbox = { nextTurn: [], nextStep: [] }
    const a = {
      id, session, status: 'idle', inbox,
      followup: message => { inbox.nextTurn.push(message); transmissions.push({ id, kind: 'queue', message }) },
      steer: message => { inbox.nextStep.push(message); transmissions.push({ id, kind: 'steer', message }) },
      inject: message => { transmissions.push({ id, kind: 'inject', message }) }
    }
    agents.set(id, a)
    return a
  }
  const record = (a, message) => {
    history.set(a.id, [...history.get(a.id) ?? [], { type: 'user/message', data: message }])
    for (const fn of callbacks.get('session/event') ?? []) fn(a.session, { type: 'user/message', data: message })
  }
  return { context, agent, agents, record, history, transmissions,
    get flushes() { return flushes }, get reads() { return reads },
    failFlush: value => { badFlush = value } }
}

test('I1C real AgentDelivery queues once per request ID with DSH source and pending-inbox replay suppression', async () => {
  const host = fakeDsh(), delivered = new AgentDelivery(host.context)
  const worker = host.agent('worker-fixture-ticket')
  const abort = new AbortController()
  const accepted = []
  const requestId = key('assignment:fixture-ticket')
  await delivered.send(worker, requestId, '{"ticket_id":"fixture-ticket"}', 'queue',
    abort.signal, () => accepted.push('authorized'), () => accepted.push('accepted'))
  await delivered.send(worker, requestId, 'MALICIOUS DIFFERENT REPLAY', 'queue',
    abort.signal, () => accepted.push('authorized-again'), () => accepted.push('already-accepted'))
  expect(host.transmissions).toHaveLength(1)
  expect(host.transmissions[0].message).toMatchObject({
    id: messageId(requestId), role: 'user', source: { kind: 'dsh-superagent', form: 'relay' }
  })
  expect(host.transmissions[0].message.content[0].text).toContain('fixture-ticket')
  expect(await delivered.holds(worker, requestId)).toBe(true)
  expect(accepted).toEqual(['authorized', 'accepted', 'authorized-again', 'already-accepted'])
  expect(host.flushes).toBeGreaterThanOrEqual(3)
})

test('I1C real AgentDelivery survives Session replacement by reading durable user/message history', async () => {
  const host = fakeDsh(), initial = new AgentDelivery(host.context)
  const first = host.agent('worker-fixture-ticket')
  const controller = new AbortController()
  await initial.send(first, 'assignment:ticket-1', 'first', 'queue', controller.signal)
  host.record(first, first.inbox.nextTurn[0])
  const second = host.agent('worker-fixture-ticket') // new Session object, empty inbox
  const recovered = new AgentDelivery(host.context)
  await recovered.send(second, 'assignment:ticket-1', 'should never duplicate', 'queue', controller.signal)
  expect(host.transmissions).toHaveLength(1)
  expect(await recovered.holds(second, 'assignment:ticket-1')).toBe(true)
  await recovered.send(second, 'assignment:ticket-2', 'authorized next turn', 'steer', controller.signal)
  expect(second.inbox.nextStep).toHaveLength(1)
  expect(host.transmissions).toHaveLength(2)
  expect(host.transmissions[1].kind).toBe('steer')
  expect(host.reads).toBeGreaterThanOrEqual(1)
})

test('I1C persisted idempotency keys from legacy plugin and user RPC sources are recognized', async () => {
  const host = fakeDsh()
  const agent = host.agent('worker-old-history')
  const idOld = messageId('legacy-1')
  const idRpc = messageId('rpc-2')
  host.history.set(agent.id, [
    { type: 'user/message', data: { id: idOld, source: { kind: 'plugin', plugin: 'dsh-superagent' } } },
    { type: 'user/message', data: { id: idRpc, source: { kind: 'user', rpcId: 'rpc-2' } } }
  ])
  const delivery = new AgentDelivery(host.context)
  expect(await delivery.holds(agent, 'legacy-1')).toBe(true)
  expect(await delivery.holds(agent, 'rpc-2')).toBe(true)
  await delivery.send(agent, 'legacy-1', 'replay', 'queue', new AbortController().signal)
  await delivery.send(agent, 'rpc-2', 'replay', 'queue', new AbortController().signal)
  expect(host.transmissions).toHaveLength(0)
})

test('I1C authorization, cancellation, disposed target and persistence errors fail closed', async () => {
  const host = fakeDsh()
  const agent = host.agent('worker-fixture-guard')
  const delivery = new AgentDelivery(host.context)
  const rejected = new AbortController()
  rejected.abort('fixture cancellation')
  await expect(delivery.send(agent, 'cancelled', 'text', 'queue', rejected.signal)).rejects.toBeDefined()
  await expect(delivery.send(agent, 'unauthorized', 'text', 'queue',
    new AbortController().signal, () => { throw Error('authorization changed') })).rejects.toThrow('authorization changed')
  expect(host.transmissions).toHaveLength(0)
  host.agents.delete(agent.id)
  await expect(delivery.send(agent, 'disposed', 'text', 'queue',
    new AbortController().signal)).rejects.toThrow(/disposed/)
  expect(host.transmissions).toHaveLength(0)
  const other = host.agent('worker-fixture-down')
  host.failFlush(true)
  await expect(delivery.send(other, 'unpersisted', 'text', 'queue',
    new AbortController().signal)).rejects.toThrow(/persistence unavailable/)
  expect(host.transmissions).toHaveLength(0)
})

test('I1C notice injection marks a request seen and does not queue a Worker turn', async () => {
  const host = fakeDsh()
  const agent = host.agent('worker-fixture-notice')
  const delivery = new AgentDelivery(host.context)
  const controller = new AbortController()
  await delivery.send(agent, 'notice:fixture', 'injected facts',
    { inject: 'Synthetic notification' }, controller.signal)
  await delivery.send(agent, 'notice:fixture', 'duplicate',
    { inject: 'Duplicate notice' }, controller.signal)
  expect(host.transmissions).toHaveLength(1)
  expect(host.transmissions[0].kind).toBe('inject')
  expect(host.transmissions[0].message.source).toMatchObject({
    kind: 'dsh-superagent', form: 'notice', summary: 'Synthetic notification'
  })
  expect(agent.inbox.nextTurn).toHaveLength(0)
  expect(agent.inbox.nextStep).toHaveLength(0)
  expect(await delivery.holds(agent, 'notice:fixture')).toBe(true)
})
