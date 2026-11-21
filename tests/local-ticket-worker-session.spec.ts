// @ts-nocheck
/**
 * I1B fake-host vertical acceptance: real Engine intake/decision/Ticket,
 * real DshExecutor effect/launch/prepareDirectory, real Git/non-Git snapshots,
 * but fake DSH Session transport, no model, no native Weixin or source Apply.
 *
 * All filesystem writes are confined to disposable OS temp fixtures.
 */
import { test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Engine, MemoryRepositories } from '../src/core/index.ts'
import { DshExecutor, workerSessionId } from '../src/executor/dsh.ts'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
import { previewNonGitProjectChanges, verifyProjectSnapshot } from '../src/local-first/project-workspaces.ts'
import { SettingsSchema } from '../src/policy.ts'

const outcome = { kind: 'accept', title: 'Disposable review', scope: 'review isolated edits',
  reason: 'explicit fixture request', name: 'disposable-review', acknowledgement: 'Accepted for isolated review' }
const settings = SettingsSchema.parse({ sources: { github: { enabled: false, config: {} } } })
const now = '2026-11-18T00:00:00.000Z'
const runGit = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {
  encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' } }).trim()

async function scenario(kind, run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-i1b-fake-host-')))
  const registered = join(root, 'registered'), stateDir = join(root, 'state')
  const source = join(registered, 'demo')
  for (const path of [registered, stateDir, source]) mkdirSync(path, { mode: 0o700 })
  writeFileSync(join(source, 'modify.txt'), 'source-before\n')
  writeFileSync(join(source, 'delete.txt'), 'delete-before\n')
  writeFileSync(join(source, '.env'), 'fixture-secret-excluded\n', { mode: 0o600 })
  if (kind === 'git') {
    rmSync(join(source, '.env'))
    runGit(source, 'init', '-q')
    runGit(source, 'add', '.')
    runGit(source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost',
      '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture baseline')
  }
  const registry = new LocalProjectRegistry([registered], [{ id: 'demo', root: source, kind }])
  const repo = new MemoryRepositories(), handlers = new Map(), queue = []
  const prompts = [], ensured = [], relays = [], messages = [], candidates = [], cancelled = []
  const acceptedIds = new Set(), activeAgents = new Map()
  let engine
  const store = {
    settings: () => settings, tickets: repo.tickets, triggers: repo.triggers,
    atomic: fn => repo.atomic(fn), afterCommit: fn => fn()
  }
  // verifyDirectory runs the real guard, while the subprocess transport deliberately
  // emulates git-config exit 1 (no matching credential keys). This is NOT OS sandbox proof.
  const subprocess = { spawn: ({ argv, cwd }) => {
    expect(argv.slice(0, 3)).toEqual(['git', 'config', '-z'])
    expect(cwd.startsWith(stateDir)).toBe(true)
    return { done: Promise.resolve({ exitCode: 1 }), collected: {
      stdout: { readFrom: () => ({ text: '' }) },
      stderr: { readFrom: () => ({ text: '' }) }
    } }
  } }
  const context = {
    subprocess, agents: { get: id => activeAgents.get(id) },
    get: () => undefined
  }
  const sessions = {
    ensure: async (id, cwd, title, role) => {
      ensured.push({ id, cwd, role })
      let agent = activeAgents.get(id)
      if (!agent) {
        agent = { id, status: 'idle', inbox: { remove: () => {} },
          cancel: () => cancelled.push(id), whenIdle: async () => {} }
        activeAgents.set(id, agent)
      }
      return agent
    },
    holds: async () => false,
    promptedId: id => id,
    prompt: async (id, requestId, text, mode, authorize, accepted) => {
      authorize?.()
      // Emulate AgentDelivery durable request-ID deduplication at transport boundary,
      // recording both the attempt and whether the fake transport actually accepted it.
      const duplicate = acceptedIds.has(requestId)
      prompts.push({ id, requestId, text, mode, duplicate })
      if (!duplicate) { acceptedIds.add(requestId); accepted?.() }
    },
    relay: (id, text) => relays.push({ id, text })
  }
  const effects = {
    handle: (name, callback) => handlers.set(name, callback),
    enqueue: (name, key, payload) => queue.push({ name, key, payload })
  }
  const host = {
    context, store, sessions, effects, machine: { stateDir }, localProjects: registry,
    localOnly: () => true, lifetime: new AbortController().signal,
    closing: () => false, paused: () => false,
    environment: () => [], sourceLink: async () => ({}),
    repliedTo: () => undefined, health: { get: () => undefined, set: () => {} },
    get engine() { return engine }
  }
  const executor = new DshExecutor(host)
  const policy = { version: 'fixture-v1', paused: false, evalTimeoutMs: 60_000,
    gate: () => ({ admissible: true, strength: 'explicit', basis: { via: 'listed' } }),
    revalidate: () => true, admitsInferred: () => false }
  const outbox = {
    send: message => { if (!messages.some(m => m.id === message.id)) messages.push(message) },
    status: id => messages.some(m => m.id === id) ? 'pending' : undefined,
    withdraw: () => {}
  }
  engine = new Engine({
    repo, policy: () => policy, scope: { scope: () => ({ listened: true, observed: false }) },
    assessor: { request: c => candidates.push(c), release: () => {} },
    executor, outbox, prepareTicket: (ticket, decision) => executor.prepare(ticket, decision),
    now: () => now
  })
  const trigger = (id, text) => ({ id, source: 'chat',
    threads: [{ source: 'chat', id: 'fixture-thread' }],
    actor: { source: 'chat', id: 'operator-fixture' }, human: true, addressed: 'direct',
    at: now, text, channel: { source: 'chat', thread: 'fixture-thread',
      address: { peer: 'synthetic-only' } }, meta: {} })
  const accept = (id = 'msg-1', text = '/project demo\nEdit disposable files') => {
    const received = engine.receive(trigger(id, text))
    engine.evaluateDue()
    const candidate = candidates.at(-1)
    expect(candidate?.triggers.some(t => t.id === id)).toBe(true)
    const decision = engine.decide(id, { ...outcome, evalId: candidate.evalId })
    expect(decision.kind).toBe('accept')
    return { received, ticket: repo.tickets.get(decision.ticketId), decision }
  }
  const drain = async () => {
    while (queue.length) {
      const item = queue.shift()
      const callback = handlers.get(item.name)
      expect(callback).toBeTypeOf('function')
      await callback(item.payload)
    }
  }
  try {
    await run({ root, source, registry, repo, engine, executor, accept, drain, queue,
      prompts, ensured, relays, messages, cancelled, trigger })
  } finally {
    executor.dispose()
    rmSync(root, { recursive: true, force: true })
  }
}

test('I1B non-Git Engine Ticket -> actual Executor launch -> Session transport -> review preview -> unique Outbox result', () =>
  scenario('local', async h => {
    const { ticket } = h.accept()
    expect(ticket.execution.projectId).toBe('demo')
    expect(ticket.assignments[0].state).toBe('pending')
    expect(h.messages.map(m => m.kind)).toEqual(['acknowledgement'])
    expect(h.ensured).toHaveLength(0)
    await h.drain()
    const workspace = ticket.execution.directory
    expect(h.ensured).toMatchObject([{ id: workerSessionId(ticket.id), cwd: workspace, role: 'worker' }])
    expect(h.prompts).toHaveLength(1)
    expect(h.prompts[0].requestId).toBe('assignment:' + ticket.id)
    expect(JSON.parse(h.prompts[0].text)).toMatchObject({ ticket_id: ticket.id,
      project_id: 'demo', workspace_mode: 'isolated-snapshot', source_write: 'forbidden' })
    expect(h.repo.tickets.get(ticket.id).assignments[0].state).toBe('running')
    expect(readFileSync(join(workspace, 'modify.txt'), 'utf8')).toBe('source-before\n')
    expect(existsSync(join(workspace, '.env'))).toBe(false)
    writeFileSync(join(workspace, 'modify.txt'), 'worker-after\n')
    rmSync(join(workspace, 'delete.txt'))
    writeFileSync(join(workspace, 'add.txt'), 'new fixture\n')
    const preview = await previewNonGitProjectChanges({
      registry: h.registry, projectId: 'demo',
      directory: workspace, fingerprint: ticket.execution.projectFingerprint
    })
    expect(preview.changes.map(x => [x.path, x.action])).toEqual([
      ['add.txt', 'add'], ['delete.txt', 'delete'], ['modify.txt', 'modify']
    ])
    h.engine.report(ticket.id, { state: 'ready', summary: 'Review changes; original untouched' })
    const first = h.engine.reply({ purpose: 'result', ticketId: ticket.id,
      text: 'Review required; three isolated changes. No source Apply.' })
    const replay = h.engine.reply({ purpose: 'result', ticketId: ticket.id,
      text: 'Review required; three isolated changes. No source Apply.' })
    expect(replay.id).toBe(first.id)
    expect(replay.reused).toBe(true)
    expect(h.messages.filter(m => m.kind === 'reply')).toHaveLength(1)
    expect(h.messages.find(m => m.kind === 'reply').ticketId).toBe(ticket.id)
    expect(readFileSync(join(h.source, 'modify.txt'), 'utf8')).toBe('source-before\n')
    expect(readFileSync(join(h.source, 'delete.txt'), 'utf8')).toBe('delete-before\n')
    expect(existsSync(join(h.source, 'add.txt'))).toBe(false)
    expect(readFileSync(join(h.source, '.env'), 'utf8')).toBe('fixture-secret-excluded\n')
  }))

test('I1B Git Ticket uses a real clean local offline clone with no origin and no source changes', () =>
  scenario('git', async h => {
    const { ticket } = h.accept()
    await h.drain()
    const workspace = ticket.execution.directory
    expect(h.ensured).toHaveLength(1)
    expect(runGit(workspace, 'remote')).toBe('')
    expect(runGit(workspace, 'rev-parse', 'HEAD')).toBe(runGit(h.source, 'rev-parse', 'HEAD'))
    writeFileSync(join(workspace, 'modify.txt'), 'worker-only\n')
    expect(runGit(workspace, 'status', '--porcelain')).toContain('modify.txt')
    expect(runGit(h.source, 'status', '--porcelain')).toBe('')
    expect(readFileSync(join(h.source, 'modify.txt'), 'utf8')).toBe('source-before\n')
  }))

test('I1B replayed Trigger and stale effect do not create a second Ticket or Worker Session', () =>
  scenario('local', async h => {
    const { ticket } = h.accept()
    expect(h.engine.receive(h.trigger('msg-1', '/project demo\nEdit disposable files'))).toBe('duplicate')
    await h.drain()
    h.executor.start(h.repo.tickets.get(ticket.id), h.repo.tickets.get(ticket.id).assignments[0])
    await h.drain()
    expect(h.repo.tickets.list()).toHaveLength(1)
    expect(h.ensured).toHaveLength(1)
    expect(h.prompts).toHaveLength(1)
    expect(h.messages.filter(m => m.kind === 'acknowledgement')).toHaveLength(1)
  }))

test('I1B stopped Ticket never starts a stale queued Worker effect', () =>
  scenario('local', async h => {
    const { ticket } = h.accept()
    h.engine.stopTicket(ticket.id, 'fixture cancelled before launch')
    await h.drain()
    expect(h.ensured).toHaveLength(0)
    expect(h.prompts).toHaveLength(0)
    expect(existsSync(ticket.execution.directory)).toBe(false)
    expect(readFileSync(join(h.source, 'modify.txt'), 'utf8')).toBe('source-before\n')
  }))

test('I1B unknown or missing project refuses Session launch and reports failed', () =>
  scenario('local', async h => {
    const { ticket } = h.accept('msg-unknown', '/project nonexistent\nEdit')
    expect(ticket.execution.localProjectError).toMatch(/not registered/)
    await h.drain()
    expect(h.ensured).toHaveLength(0)
    expect(h.prompts).toHaveLength(0)
    expect(h.repo.tickets.get(ticket.id).assignments.at(-1).report.state).toBe('failed')
    expect(readFileSync(join(h.source, 'modify.txt'), 'utf8')).toBe('source-before\n')
  }))

test('I1B dirty Git source fails closed before Session creation or write-back', () =>
  scenario('git', async h => {
    writeFileSync(join(h.source, 'uncommitted.txt'), 'do not omit this')
    const { ticket } = h.accept()
    await h.drain()
    expect(h.ensured).toHaveLength(0)
    expect(h.prompts).toHaveLength(0)
    expect(h.repo.tickets.get(ticket.id).assignments.at(-1).report.state).toBe('failed')
    expect(existsSync(ticket.execution.directory)).toBe(false)
    expect(readFileSync(join(h.source, 'uncommitted.txt'), 'utf8')).toBe('do not omit this')
  }))

test('I1B pre-existing counterfeit workspace manifest refuses launch', () =>
  scenario('local', async h => {
    const { ticket } = h.accept()
    mkdirSync(ticket.execution.directory, { recursive: true, mode: 0o700 })
    writeFileSync(join(ticket.execution.directory, '.dsh-project.json'),
      JSON.stringify({ projectId: 'other-project', rootFingerprint: 'fake', kind: 'local',
        sourceRevision: 'fake' }) + '\n')
    await h.drain()
    expect(h.ensured).toHaveLength(0)
    expect(h.prompts).toHaveLength(0)
    expect(h.repo.tickets.get(ticket.id).assignments.at(-1).report.state).toBe('failed')
    expect(readFileSync(join(h.source, 'modify.txt'), 'utf8')).toBe('source-before\n')
  }))
