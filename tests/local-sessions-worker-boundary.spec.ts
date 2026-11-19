// @ts-nocheck
/**
 * I1D: REAL Sessions.ensure + REAL AgentDelivery + REAL initializeRoleModel
 * in a disposable simulated DSH SessionController, Registry and Agent context.
 * No local inference, original 3080, native Weixin, system changes or source Apply.
 *
 * The dsh-scope parent lookup is deliberately mocked because the fake Agent is
 * not an installed Cordis Scope. Host tool restriction/guards still run through
 * the real Sessions.workOnly implementation.
 */
import { expect, test, vi } from 'vitest'
vi.mock('@deepseek-ai/dsh-scope', async importOriginal => ({
  ...await importOriginal(), scopeParentOf: () => undefined
}))
import { Sessions, WORKER_PRESET } from '../src/app/sessions.ts'
import { workerSessionId } from '../src/executor/dsh.ts'
import { key } from '../src/core/index.ts'

function fixture(options = {}) {
  const ticketId = 'ticket-offline-1', workspace = '/disposable-fixture/project/ticket'
  const ticket = {
    id: ticketId, title: 'Offline snapshot Worker',
    execution: { projectId: 'fixture-project', directory: workspace },
    mandate: { strength: 'explicit', scope: 'fixture-only', policyVersion: 'fixture-v1', basis: {}, actor: { source: 'test', id: 'operator-fixture' } },
    assignments: [], channels: [], inputs: [], undelivered: []
  }
  const tickets = new Map(options.noTicket ? [] : [[ticketId, ticket]])
  const agents = new Map(), history = new Map(), listeners = new Map()
  const workspaceRecord = { id: 'workspace-fixture-1', path: workspace, sessionIds: [] }
  const workspaces = [], created = [], renamed = [], delivery = [], permissions = [], toolRestrictions = [], toolGuards = [], modelResolutions = [], notifications = []
  const globalDefault = Object.freeze({ provider: 'existing-production-default', model: 'unchanged' })
  let flushes = 0
  const settings = () => ({
    executor: { model: options.noRoleModel ? null : { provider: 'fixture-local-only', model: 'qwen-test' } },
    eval: { model: null }
  })
  const makeAgent = (id, cwd = workspace) => {
    const events = [], cleanup = [], agentHandlers = new Map()
    const session = {
      id, header: { agentPreset: WORKER_PRESET, cwd },
      snapshotEvents: () => [...events], requestHeader: () => null,
      append: (type, data) => { const ev = { type, data }; events.push(ev); return ev }
    }
    const inbox = { nextTurn: [], nextStep: [], remove: id => {
      for (const list of [inbox.nextTurn, inbox.nextStep]) {
        const index = list.findIndex(message => message.id === id)
        if (index >= 0) list.splice(index, 1)
      }
    } }
    const agentCtx = {
      systemPrompt: { section: item => { notifications.push({ id, name: item.name }); return () => {} } },
      inject: (_services, callback) => {
        const scope = { skills: { register: () => () => {} } }
        callback(scope)
        return Object.assign(Promise.resolve(), { dispose: async () => {} })
      },
      tools: {
        get: name => ['read', 'write', 'edit', 'glob', 'grep', 'bash', 'subagent', 'schedule_task', 'send_session'].includes(name),
        register: () => () => {},
        restrict: opts => { toolRestrictions.push({ id, allow: [...opts.allow] }); return () => {} },
        guard: fn => { toolGuards.push({ id, fn }); return () => {} }
      },
      on: (name, handler) => { agentHandlers.set(name, handler); return () => agentHandlers.delete(name) },
      effect: callback => { cleanup.push(callback()) }
    }
    const agent = {
      id, session, status: 'idle', ctx: agentCtx, inbox,
      followup: message => { inbox.nextTurn.push(message); delivery.push({ id, mode: 'queue', message }) },
      steer: message => { inbox.nextStep.push(message); delivery.push({ id, mode: 'steer', message }) },
      inject: message => { delivery.push({ id, mode: 'inject', message }) },
      cancel: () => {}, whenIdle: async () => {}
    }
    agents.set(id, agent)
    return agent
  }
  const context = {
    agents: { get: id => agents.get(id) },
    inject: () => {},

    on: (name, callback) => {
      listeners.set(name, [...listeners.get(name) ?? [], callback])
      return () => listeners.set(name, (listeners.get(name) ?? []).filter(fn => fn !== callback))
    },
    get: () => undefined,
    logger: { warn: () => {} },
    sessionController: {
      resolveAgent: async id => agents.has(id) ? { agent: agents.get(id) } : { error: { code: 'session/not-found' } },
      create: async args => { created.push(args); makeAgent(args.sessionId); workspaceRecord.sessionIds.push(args.sessionId) },
      rename: async args => { renamed.push(args) }
    },
    workspaceRegistry: {
      create: async cwd => { workspaces.push(cwd); if (options.failWorkspace) throw Error('workspace registration unavailable'); return workspaceRecord },
      resolveByPath: async cwd => cwd === workspace && !options.missingWorkspace ? workspaceRecord : undefined,
      list: () => options.missingWorkspace ? [] : [workspaceRecord]
    },
    permissionPresets: { set: (session, value) => permissions.push({ id: session.id, value }) },
    llm: { resolveCallConfig: async route => { modelResolutions.push(route); if (options.badRoute) throw Error('No local-only model route'); return route } },
    sessionPersistence: {
      flush: async () => { flushes++ },
      open: async (id, mode) => ({
        read: async (offset, limit) => ({ events: (history.get(id) ?? []).slice(offset, offset+limit) }),
        async [Symbol.asyncDispose]() {}
      })
    }
  }
  const cfg = { revision: 0, config: { skills: {} } }
  const effects = { handle: () => {}, enqueue: () => {}, pending: () => false, idle: async () => {} }
  const host = {
    context, masterId: 'original-master-unmodified',
    lifetime: new AbortController().signal, closing: () => false,
    store: {
      tickets: { get: id => tickets.get(id) },
      settings, get: () => undefined, set: () => {}, keys: () => []
    },
    effects, health: { set: () => {} }, environment: () => [], tools: () => [],
    prompts: { current: () => cfg, version: () => cfg, skills: () => [], compose: () => 'only-fixture-prompt' }
  }
  const sessions = new Sessions(host)
  return { sessions, ticketId, workspace, tickets, agents, context, history,
    created, renamed, delivery, permissions, toolRestrictions, toolGuards, modelResolutions, workspaces, workspaceRecord, listeners, globalDefault,
    get flushes() { return flushes }, makeAgent, ticket }
}

test('I1D actual Sessions.ensure creates role-bound worker with exact workspace, safe preset and local-only role model', async () => {
  const f = fixture()
  const id = workerSessionId(f.ticketId)
  const agent = await f.sessions.ensure(id, f.workspace, 'Fixture Worker', 'worker')
  expect(f.created).toMatchObject([{ sessionId: id, workspaceId: 'workspace-fixture-1', agentPreset: WORKER_PRESET }])
  expect(f.workspaces).toEqual([f.workspace])
  expect(f.renamed).toEqual([{ sessionId: id, title: 'Fixture Worker' }])
  expect(f.permissions).toEqual([{ id, value: 'workspace-write' }])
  expect(f.modelResolutions).toEqual([{ provider: 'fixture-local-only', model: 'qwen-test' }])
  expect(agent.session.snapshotEvents()).toContainEqual({ type: 'model/selection',
    data: { provider: 'fixture-local-only', model: 'qwen-test' } })
  expect(f.globalDefault).toEqual({ provider: 'existing-production-default', model: 'unchanged' })
  const tools = f.toolRestrictions.find(x => x.id === id)?.allow
  expect(tools).toContain('read')
  expect(tools).toContain('write')
  expect(tools).not.toContain('schedule_task')
  expect(tools).not.toContain('send_session')
  expect(f.flushes).toBeGreaterThan(0)
  f.sessions.dispose()
})

test('I1D actual Sessions.prompt + AgentDelivery deliver exactly one assignment on replay', async () => {
  const f = fixture()
  const id = workerSessionId(f.ticketId)
  const agent = await f.sessions.ensure(id, f.workspace, 'Fixture Worker', 'worker')
  let authorized = 0, accepted = 0
  const request = 'assignment:'+f.ticketId
  await f.sessions.prompt(id, request, '{"ticket_id":"'+f.ticketId+'"}', 'queue', () => { authorized++ }, () => { accepted++ })
  expect(f.delivery).toHaveLength(1)
  expect(f.delivery[0].message.id).toBe(f.sessions.promptedId(request))
  expect(f.delivery[0].message.source).toMatchObject({ kind: 'dsh-superagent', form: 'relay' })
  expect(await f.sessions.holds(id, request)).toBe(true)
  await f.sessions.prompt(id, request, 'replayed different body', 'queue', () => { authorized++ }, () => { accepted++ })
  expect(f.delivery).toHaveLength(1)
  expect([authorized, accepted]).toEqual([2, 2])
  expect(agent.inbox.nextTurn).toHaveLength(1)
  f.sessions.dispose()
})

test('I1D real Sessions with durable AgentDelivery restore suppresses same assignment in replaced agent', async () => {
  const f = fixture()
  const id = workerSessionId(f.ticketId)
  const first = await f.sessions.ensure(id, f.workspace, 'Fixture Worker', 'worker')
  const request = 'assignment:'+f.ticketId
  await f.sessions.prompt(id, request, 'original', 'queue')
  const message = first.inbox.nextTurn[0]
  f.history.set(id, [{ type: 'user/message', data: message }])
  f.makeAgent(id) // Emulates restart and a new Session identity, not a real DSH restart.
  expect(await f.sessions.holds(id, request)).toBe(true)
  await f.sessions.prompt(id, request, 'duplicate after restart', 'queue')
  expect(f.delivery).toHaveLength(1)
  f.sessions.dispose()
})

test('I1D ended/missing project Worker Ticket and mismatched project snapshot refuse before Session creation', async () => {
  const missing = fixture({ noTicket: true })
  const id = workerSessionId(missing.ticketId)
  await expect(missing.sessions.ensure(id, missing.workspace, 'Worker', 'worker')).rejects.toThrow(/active existing Ticket/)
  expect(missing.created).toHaveLength(0)
  expect(missing.workspaces).toHaveLength(0)
  const ended = fixture()
  ended.ticket.ended = { by: 'human', outcome: 'stopped', at: '2026-11-18T00:00:00Z' }
  await expect(ended.sessions.ensure(id, ended.workspace, 'Worker', 'worker')).rejects.toThrow(/active existing Ticket/)
  expect(ended.created).toHaveLength(0)
  const wrongRoot = fixture()
  await expect(wrongRoot.sessions.ensure(id, '/different-root/other-ticket', 'Worker', 'worker')).rejects.toThrow(/does not match/)
  expect(wrongRoot.created).toHaveLength(0)
  expect(wrongRoot.permissions).toHaveLength(0)
})

test('I1D actual worker tool guard rejects actions after Ticket ended (no host Apply)', async () => {
  const f = fixture(), id = workerSessionId(f.ticketId)
  await f.sessions.ensure(id, f.workspace, 'Worker', 'worker')
  expect(f.toolGuards).toHaveLength(1)
  expect(f.toolGuards[0].fn()).toBeUndefined()
  f.ticket.ended = { by: 'human', outcome: 'stopped', at: '2026-11-18T00:00:00Z' }
  expect(f.toolGuards[0].fn()).toMatch(/Ticket ended/)
  f.sessions.dispose()
})

test('I1D bad model route fails before grant, rename or AgentDelivery', async () => {
  const f = fixture({ badRoute: true }), id = workerSessionId(f.ticketId)
  await expect(f.sessions.ensure(id, f.workspace, 'Worker', 'worker')).rejects.toThrow(/No local-only model route/)
  expect(f.modelResolutions).toHaveLength(1)
  expect(f.permissions).toHaveLength(0)
  expect(f.delivery).toHaveLength(0)
  expect(f.renamed).toHaveLength(0)
  expect(f.globalDefault.model).toBe('unchanged')
})

test('I1F restored foreign Worker Session fails before model init, tools, permissions or rename', async () => {
  const f = fixture(), id = workerSessionId(f.ticketId)
  f.makeAgent(id, '/foreign-registered-project/other-workspace')
  f.workspaceRecord.sessionIds.push(id)
  await expect(f.sessions.ensure(id, f.workspace, 'Worker', 'worker')).rejects.toThrow(/Workspace identity/)
  expect(f.modelResolutions).toHaveLength(0)
  expect(f.permissions).toHaveLength(0)
  expect(f.renamed).toHaveLength(0)
  expect(f.toolRestrictions).toHaveLength(0)
  expect(f.created).toHaveLength(0)
  await expect(f.sessions.prompt(id, 'assignment:'+f.ticketId, 'wrong target', 'queue')).rejects.toThrow(/Workspace identity/)
  expect(f.delivery).toHaveLength(0)
  await expect(f.sessions.holds(id, 'assignment:'+f.ticketId)).rejects.toThrow(/Workspace identity/)
})

test('I1F matching cwd but no WorkspaceRegistry membership or missing registered workspace fails closed', async () => {
  const f = fixture(), id=workerSessionId(f.ticketId)
  f.makeAgent(id)
  await expect(f.sessions.ensure(id, f.workspace, 'Worker','worker')).rejects.toThrow(/Workspace identity/)
  expect(f.permissions).toHaveLength(0)
  const missing = fixture({ missingWorkspace: true })
  const mid=workerSessionId(missing.ticketId)
  await expect(missing.sessions.ensure(mid, missing.workspace, 'Worker','worker')).rejects.toThrow(/Workspace identity/)
  expect(missing.created).toHaveLength(1) // Explicit create may occur; never proceed to role model or permission.
  expect(missing.permissions).toHaveLength(0)
  expect(missing.modelResolutions).toHaveLength(0)
})

test('I1F workspace registration failure refuses without creating a Session or granting permissions', async () => {
  const f=fixture({ failWorkspace: true }), id=workerSessionId(f.ticketId)
  await expect(f.sessions.ensure(id, f.workspace, 'Worker','worker')).rejects.toThrow(/workspace registration unavailable/)
  expect(f.created).toHaveLength(0)
  expect(f.permissions).toHaveLength(0)
  expect(f.delivery).toHaveLength(0)
})

test('I1F project Worker agent/created event never decorates before ownership attestation', async () => {
  const f=fixture(), id=workerSessionId(f.ticketId)
  f.sessions.install()
  const agent=f.makeAgent(id,'/other-project')
  const listeners=f.listeners.get('agent/created') ?? []
  expect(listeners.length).toBeGreaterThanOrEqual(1)
  for (const listener of listeners) await listener({agent})
  expect(f.toolRestrictions).toHaveLength(0)
  expect(f.toolGuards).toHaveLength(0)
  expect(f.permissions).toHaveLength(0)
  expect(f.modelResolutions).toHaveLength(0)
})

test('I1F worker tool guard fails closed when Workspace membership is deleted after ensure', async () => {
  const f=fixture(), id=workerSessionId(f.ticketId)
  await f.sessions.ensure(id,f.workspace,'Worker','worker')
  expect(f.toolGuards).toHaveLength(1)
  expect(f.toolGuards[0].fn()).toBeUndefined()
  f.workspaceRecord.sessionIds.splice(0)
  expect(f.toolGuards[0].fn()).toMatch(/lost its registered Workspace/)
  await expect(f.sessions.prompt(id,'assignment:'+f.ticketId,'replay','queue')).rejects.toThrow(/Workspace identity/)
  expect(f.delivery).toHaveLength(0)
  f.sessions.dispose()
})
