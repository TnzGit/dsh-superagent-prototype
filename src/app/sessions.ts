/** Lifecycle, prompt/tool/skill decoration, message delivery, and budget retry tracking for orchestrator and worker DSH sessions. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { MessageId } from '@deepseek-ai/dsh-llm'
import { scopeParentOf } from '@deepseek-ai/dsh-scope'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { dirname } from 'node:path'
import { z } from 'zod'
import { key, liveTicket, type Ticket } from '../core/index.ts'
import { mandateInstructions, ticketOfSession, workerSessionId } from '../executor/dsh.ts'
import type { HealthEntry } from '../infra/health.ts'
import { AgentDelivery, messageId } from './delivery.ts'
import type { Effects } from './effects.ts'
import type { Variable } from './execution-environment.ts'
import { RetryHealth } from './retry-health.ts'
import { initializeRoleModel } from './role-models.ts'
import { bundledSkills } from './skill-files.ts'
import { SKILL_PREFIX, type PromptVersion, type Prompts } from './prompts.ts'
import type { Store } from './store.ts'
import { KV } from '../kv.ts'
import type { RegisterTool, Tool } from './tools/tool.ts'

/** Host dependencies used by `Sessions`. */
export interface SessionsHost {
  /** DSH Cordis context: sessions, agents, persistence, and their events. */
  readonly context: Context
  readonly store: Pick<Store, 'tickets' | 'settings' | 'get' | 'set' | 'keys'>
  readonly prompts: Pick<Prompts, 'current' | 'version' | 'compose' | 'skills'>
  readonly effects: Pick<Effects, 'enqueue' | 'handle' | 'idle' | 'pending'>
  /** The `models` health entry, which reports managed sessions waiting on a model-budget retry. */
  readonly health: HealthEntry
  readonly masterId: string
  readonly lifetime: AbortSignal
  closing(): boolean
  /** Execution environment variables for `ticket`, rendered into its worker's system prompt. */
  environment(ticket: Ticket): Variable[]
  /** Tools to register on the main Session (`ticket === undefined`) or on `ticket`'s worker Session. */
  tools(agent: Agent, ticket?: Ticket): Tool[]
}

/**
 * What Sessions registered for an agent it decorated: the releases of its prompt section, tools and skill scope, the scope
 * its skills are registered in, and the skills of one prompt revision; for a worker's subagent, only its tool limits.
 */
interface SessionBinding { disposers: (() => void)[]; scope?: Context; skills?: { revision: number; dispose: () => void }; subagent?: true }

/** The agent presets Executor Sessions and the main Session are created with, which the bundle's patch defines. */
export const WORKER_PRESET = 'dsh-superagent-worker', ROUTER_PRESET = 'dsh-superagent-router'
declare module '@deepseek-ai/cordis' {
  interface Events {
    /** DSH's agent preset registry selected `agentPreset` for a Session. */
    'agent-preset/selected'(sessionId: string, agentPreset: string): void
  }
}
/**
 * The DSH tools an Executor Session works with: files, search, the shell and its jobs, the web, skills, its todo list and
 * subagents. It gets no other tool the profile has, whenever it was registered: none that asks or shows a person something,
 * changes the profile, schedules work or starts goals outside the worker slots, the pause and a person's hold, starts or
 * messages other Sessions, or edits documents.
 */
const WORK_TOOLS = ['read', 'write', 'edit', 'read_image', 'glob', 'grep', 'bash', 'pwsh', 'job_output', 'job_list', 'job_kill', 'web_search',
  'web_fetch', 'skill', 'todo_write', 'subagent', 'list_subagent_models', 'send_message', 'list_agents', 'interrupt_agent']
/**
 * DENY-ONLY, EXPLICIT OPT-IN fixture-I2 tool profile. It removes shell, jobs,
 * web, skills and subagent surfaces from registered-project Workers. It does
 * NOT change the DSH permission preset, override its sandbox backend, grant
 * file writes, attest external OS confinement, or authorize any model turn.
 * The one-shot operator + external Seatbelt boundary remain mandatory.
 */
const I2_STAGING_FS_ONLY_ENV = 'DSH_SUPERAGENT_I2_STAGING_FS_ONLY'
const I2_STAGING_FILE_TOOLS = ['read', 'write', 'edit', 'glob', 'grep'] as const
const I2_STAGING_FILE_SET: ReadonlySet<string> = new Set(I2_STAGING_FILE_TOOLS)
/** Exact bundle-owned ticket tools. Unlike inherited shell/web tools these are
 * registered by this application and constrained to the live Ticket. Never
 * allow arbitrary future tool names under the staged policy. */
const I2_STAGING_WORKER_OWNED_TOOLS = [
  'orchestrator_read', 'orchestrator_ack', 'orchestrator_thread_unrelated',
  'orchestrator_thread_follow', 'orchestrator_trigger_handback', 'orchestrator_report'
] as const
const I2_STAGING_WORKER_OWNED_SET: ReadonlySet<string> = new Set(I2_STAGING_WORKER_OWNED_TOOLS)
const I2_STAGING_WORKER_DENIAL = 'I2 isolated fixture Worker permits native file and exact ticket reporting tools only'
const I2_STAGING_UNPREPARED = 'I2 isolated fixture Worker is not prepared and Workspace-attested before inference'
/** The ONLY bundle-local tools a fixture-I2 Router needs. All others, including
 * settings, retry, reply and prompt writes, are withheld in this profile. */
const I2_STAGING_ROUTER_TOOL_SET: ReadonlySet<string> = new Set(['orchestrator_route', 'orchestrator_read'])
const I2_STAGING_ROUTER_DENIAL = 'I2 isolated fixture Router allows routing and read-only ticket context only; shell, jobs, settings and other tools are denied'
/** What the main Session is told when it would wait: what it waits for comes to it, and a waiting step holds back the next. */
const NO_WAIT = 'Reports, follow_up notices, new candidates and a background job\'s end with its output arrive by themselves as messages; '
  + 'end the turn instead of waiting for them.'
/** What a main Session under `standard` is told when its command would wait the shell's default. */
const DEFAULT_WAIT = 'This shell waits up to 60 seconds by default: pass timeoutMs of at most 30000, or run_in_background, '
  + 'as a waiting step holds back new candidates.'
/** `sleep` at a command position: the start, after ; & | ( { ! ` or a newline, or after a keyword or a command that runs it. */
const SLEEP = /(?:^|[;&|({!`\n]|\b(?:do|then|else|elif|if|while|until|time|exec|nohup|command|env)\s)\s*(?:\S*\/)?sleep\b/
/**
 * The main Session's guard: it refuses a bash command that runs sleep or asks to hold the step longer than 30 seconds, and a
 * job wait longer than 5 seconds. Under `standard`, as a main Session created before the router preset runs, the shell holds
 * a command 60 seconds and a job wait lasts 30 seconds by default, so a command needs a timeout or the background, and a
 * job wait its timeout; the router preset ends both after 5 seconds.
 */
function noWait({ name, arguments: input }: { name: string; arguments: unknown }, routed: () => boolean): string | undefined {
  const args = (input ?? {}) as { command?: unknown; timeoutMs?: unknown; run_in_background?: unknown; wait?: unknown; timeout_ms?: unknown }
  if (name === 'bash') {
    const sleeps = typeof args.command === 'string' && SLEEP.test(args.command)
    if (sleeps || typeof args.timeoutMs === 'number' && args.timeoutMs > 30_000) return NO_WAIT
    if (args.timeoutMs === undefined && args.run_in_background !== true && !routed()) return DEFAULT_WAIT
  }
  if (name === 'job_output' && args.wait === true && (typeof args.timeout_ms === 'number' ? args.timeout_ms > 5_000 : !routed())) return NO_WAIT
  return undefined
}

/**
 * Creates and decorates orchestrator and worker DSH `Agent` sessions with role models, system prompt sections from `Prompts`, runtime skills, and restricted tool sets.
 * `Runtime`, `DshExecutor`, `MasterAssessor`, `Settings`, and management routes/tools use it to ensure sessions, deliver deduplicated messages via `AgentDelivery`, and process ordered `relay` and `notice` effects.
 * Feeds session events into `RetryHealth` to report model budget waits on the `models` `HealthEntry`, and durably records which prompt revisions each session has worked under in `Store` (`KV.sessions.prompts`) to authorize prompt version reads.
 */
export class Sessions {
  private readonly agentDelivery: AgentDelivery
  /** Decorated agents mapped to their registered disposers and skill scope until the agent is disposed or `Sessions.dispose()` runs. */
  private readonly bindings = new Map<Agent, SessionBinding>()
  /** Early DENY-ALL on newly created staged project Workers, until ensure()
   * verifies DSH Workspace ownership, registers exact tools and model,
   * selects the workspace-write preset, and explicitly marks the scope ready. */
  private readonly stagedPending = new Map<Agent, (() => void)[]>()
  private readonly stagedBound = new WeakSet<Agent>()
  private readonly stagedReady = new WeakSet<Agent>()
  private readonly retryHealth = new RetryHealth()
  private readonly ctx: Context
  /** Registers ordered `relay` and `notice` effect handlers that deliver to the main Session. */
  constructor(private readonly host: SessionsHost) {
    this.ctx = host.context
    this.agentDelivery = new AgentDelivery(host.context)
    // Deliver relays and notices to the main Session in the order they were queued.
    host.effects.handle('relay', ({ text }, requestId) => this.prompt(host.masterId, requestId, text, 'steer'), { ordered: true })
    host.effects.handle('notice', ({ value, summary }, name) => this.inject(name, value, summary), { ordered: true })
  }
  /** Subscribes to host agent and session events so newly created sessions are decorated and model-budget retries are reflected in health. Call once at startup. */
  install(): void {
    const ctx = this.ctx
    ctx.on('agent/disposed', ({ agent }) => {
      this.release(agent)
      this.retryHealth.clear(agent.id); this.updateModelHealth()
    })
    ctx.on('session/event', (session, event) => {
      const agent = ctx.agents.get(session.id)
      const binding = agent && agent.session === session ? this.bindings.get(agent) : undefined
      if (!agent || !binding || binding.subagent) return
      this.retryHealth.observe(agent.id, event)
      this.updateModelHealth()
    })
    ctx.on('agent/created', async ({ agent }) => {
      const ticketId = ticketOfSession(agent.id)
      const ticket = ticketId === undefined ? undefined : this.host.store.tickets.get(ticketId)
      // A newly created DSH Agent may be emitted BEFORE the workspace account
      // is attached, and a restored Agent may belong to a different workspace.
      // Neither may receive Ticket tools/prompts through this event. Only
      // Sessions.ensure, AFTER the read-only membership attestation, may
      // decorate a registered-project Worker.
      if (ticket?.execution?.projectId) {
        // install a synchronous DENY-ALL even before DSH has attached this
        // newly created Session to the Workspace. Never expose the full DSH
        // preset tools while waiting for the verified ensure() path.
        if (process.env[I2_STAGING_FS_ONLY_ENV] === '1') this.holdStagedWorker(agent)
        return undefined
      }
      await this.decorate(agent)
      return undefined
    })
    // Opening a Session in DSH's Web UI before its first turn may select the default preset for it: select ours again. After
    // its first turn DSH refuses any selection, which leaves it as it is.
    ctx.inject(['agentPresets'], child => {
      child.on('agent-preset/selected', (sessionId, preset) => {
        const ticketId = ticketOfSession(sessionId), agent = ctx.agents.get(sessionId as SessionId)
        const ours = sessionId === this.host.masterId ? ROUTER_PRESET : ticketId && this.host.store.tickets.get(ticketId) ? WORKER_PRESET : undefined
        if (!ours || preset === ours || !agent) return
        const presets = child.get('agentPresets') as { select(agent: Agent, preset: string): Promise<string> }
        presets.select(agent, ours).catch(() => {})
      })
    })
    ctx.on('agent/status', ({ agent, status }) => {
      if (status === 'idle' && !this.host.closing()) { this.retryHealth.clear(agent.id); this.updateModelHealth() }
    })
  }
  /** Called immediately on staged agent/created and again before any
   * asynchronous staged ensure() operation. Neither call can grant tools. */
  private holdStagedWorker(agent: Agent): void {
    if (this.stagedPending.has(agent) || this.stagedReady.has(agent)) return
    const disposers = [
      agent.ctx.tools.restrict({ allow: [] }),
      agent.ctx.tools.guard(() => I2_STAGING_UNPREPARED)
    ]
    this.stagedPending.set(agent, disposers)
  }
  private releaseStagedHold(agent: Agent): void {
    const disposers = this.stagedPending.get(agent)
    if (!disposers) return
    this.stagedPending.delete(agent)
    for (const dispose of [...disposers].reverse()) {
      try { dispose() } catch (error) { this.ctx.logger.warn('dsh-superagent could not release an I2 staged deny guard: %s', String(error)) }
    }
  }
  /**
   * A resolved Worker Session may be a RESTORED DSH session with the same id but
   * a different stored Workspace. Attest its immutable header and the DSH
   * WorkspaceRegistry's ACCOUNTED membership, never just the requested cwd.
   *
   * DSH uses canonical path-string identity, not inode/dev identity. This
   * check closes accidental cross-workspace Session reattachment; it does NOT
   * make snapshot paths race-free, isolate noncooperating writers, or authorize
   * source Apply. The latter still requires a separate native OS helper.
   */
  private async assertProjectWorkerWorkspace(sessionId: string, agent: Agent): Promise<void> {
    const ticketId = ticketOfSession(sessionId)
    if (ticketId === undefined) return
    const ticket = this.host.store.tickets.get(ticketId)
    if (!ticket || !liveTicket(ticket))
      throw new Error('Worker Session requires an active existing Ticket')
    if (!ticket.execution?.projectId) return
    const expected = ticket.execution.directory
    if (!expected) throw new Error('Worker Session has no isolated snapshot directory')
    // resolveByPath is read-only and performs the same realpath canon as DSH's
    // WorkspaceRegistry.create. Do not create/attach a Workspace to repair a
    // missing Session account or silently move a foreign Session.
    const workspace = await this.ctx.workspaceRegistry.resolveByPath(expected)
    if (!workspace || workspace.path !== expected ||
        agent.id !== sessionId || agent.session.header.cwd !== expected ||
        !workspace.sessionIds.includes(sessionId as SessionId))
      throw new Error('Worker Session Workspace identity does not match the Ticket snapshot')
  }
  /** Resolves or creates a role-bound Session. Registered project workers may run only for an active Ticket in its selected snapshot. */
  async ensure(id: string, cwd: string, title: string, role: 'orchestrator' | 'worker'): Promise<Agent> {
    // Fail closed BEFORE creating or resolving an Agent: a name resembling a Worker
    // must not turn an absent/ended Ticket into a danger-full-access Session.
    const workerTicketId = role === 'worker' ? ticketOfSession(id) : undefined
    const workerTicket = workerTicketId ? this.host.store.tickets.get(workerTicketId) : undefined
    if (role === 'worker' && (!workerTicket || !liveTicket(workerTicket)))
      throw new Error('Worker Session requires an active existing Ticket')
    if (role === 'worker' && workerTicket?.execution?.projectId &&
      (!cwd || cwd !== workerTicket.execution.directory))
      throw new Error('Worker Session directory does not match its registered project snapshot')
    const ctx = this.ctx
    let result = await ctx.sessionController.resolveAgent(id as SessionId)
    if ('error' in result && result.error.code === 'session/not-found') {
      const workspace = await ctx.workspaceRegistry.create(cwd)
      // A Session keeps the preset it was created with, one of the bundle's own (cordis.patch.yml).
      await ctx.sessionController.create({ sessionId: id as SessionId, workspaceId: workspace.id,
        agentPreset: role === 'worker' ? WORKER_PRESET : ROUTER_PRESET })
      result = await ctx.sessionController.resolveAgent(id as SessionId)
    }
    if ('error' in result) throw result.error
    if (role === 'worker') await this.assertProjectWorkerWorkspace(id, result.agent)
    const stagedWorker = role === 'worker' && !!workerTicket?.execution?.projectId
      && process.env[I2_STAGING_FS_ONLY_ENV] === '1'
    const settings = this.host.store.settings()
    if (stagedWorker) {
      // An existing Session may already contain a model turn from before
      // this process's control. It cannot be accepted as pre-inference-safe.
      if (result.agent.session.snapshotEvents().some(event =>
        event.type === 'request/header' || event.type === 'turn/start'))
        throw new Error('Staged Worker already started inference before scope attestation')
      this.holdStagedWorker(result.agent)
      if (this.bindings.has(result.agent) && !this.stagedBound.has(result.agent))
        throw new Error('Staged Worker scope is still being prepared')
      // Crucial order: install tool restrictions synchronously, and complete
      // exact owned-tool registration BEFORE role model resolution. The
      // provisional deny-all remains active until all steps finish.
      await this.decorate(result.agent)
      if (!this.stagedBound.has(result.agent)) throw new Error(I2_STAGING_UNPREPARED)
      await initializeRoleModel(ctx, result.agent, settings.executor.model)
    } else {
      await initializeRoleModel(ctx, result.agent, role === 'orchestrator' ? settings.eval.model : settings.executor.model)
      await this.decorate(result.agent)
    }
    // Registered local-project Tickets run only in a disposable snapshot, not with unrestricted host write access.
    // A fresh isolated I2 Router performs routing only; it must never carry
    // the normal unrestricted Session permission preset. This cannot elevate
    // an existing Session's authority and leaves production defaults alone.
    const stagedRouter = role === 'orchestrator' && process.env[I2_STAGING_FS_ONLY_ENV] === '1'
    ctx.permissionPresets.set(result.agent.session, stagedRouter ? 'read-only'
      : workerTicket?.execution?.projectId ? 'workspace-write' : 'danger-full-access')
    await ctx.sessionController.rename({ sessionId: id as SessionId, title })
    if (stagedWorker) {
      this.stagedReady.add(result.agent)
      this.releaseStagedHold(result.agent)
    }
    return result.agent
  }
  /** Returns whether `sessionId` already holds the message delivered under `requestId`, or `false` if the session does not exist. */
  async holds(sessionId: string, requestId: string): Promise<boolean> {
    const result = await this.ctx.sessionController.resolveAgent(sessionId as SessionId)
    if ('error' in result) return false
    await this.assertProjectWorkerWorkspace(sessionId, result.agent)
    return await this.agentDelivery.holds(result.agent, key(requestId))
  }
  /** Deliver a message once per request id: to the next turn, the current one, or `inject`ed with its label without waking the agent. */
  async prompt(sessionId: string, requestId: string, text: string, mode: 'queue' | 'steer' | { inject: string }, authorize?: () => void,
    accepted?: () => void): Promise<void> {
    const result = await this.ctx.sessionController.resolveAgent(sessionId as SessionId)
    if ('error' in result) throw result.error
    await this.assertProjectWorkerWorkspace(sessionId, result.agent)
    const ticketId = ticketOfSession(sessionId)
    if (process.env[I2_STAGING_FS_ONLY_ENV] === '1' && ticketId
      && this.host.store.tickets.get(ticketId)?.execution?.projectId && !this.stagedReady.has(result.agent))
      throw new Error(I2_STAGING_UNPREPARED)
    await this.agentDelivery.send(result.agent, key(requestId), text, mode, this.host.lifetime, authorize, accepted)
  }
  /** The id of the message `prompt` delivers under `requestId`, which DSH's inbox events name it by. */
  promptedId(requestId: string): MessageId { return messageId(key(requestId)) }
  /** Enqueues a steering relay to the main Session; relays are durable and retried by `Effects` until delivered, at most once per `requestId`. */
  relay(requestId: string, text: string): void { this.host.effects.enqueue('relay', requestId, { text }) }
  /** Enqueues a durable background notice for injection into the main Session; a new notice with the same `name` replaces a still-waiting notice of that `name`. */
  notify(name: string, value: Record<string, unknown>, summary: string): void { this.host.effects.enqueue('notice', name, { value, summary }) }
  /** Waits for currently runnable `notice` effects to settle and returns `'injected'` if notice `name` has reached the main Session or `'pending'` if it is still queued. */
  async delivery(name: string): Promise<'injected' | 'pending'> {
    await this.host.effects.idle('notice')
    return this.host.effects.pending('notice', name) ? 'pending' : 'injected'
  }
  /** Injects a notice into the main Session without waking it; no-op if the main Session does not exist yet. */
  private async inject(name: string, value: Record<string, unknown>, summary: string): Promise<void> {
    const resolved = await this.ctx.sessionController.resolveAgent(this.host.masterId as SessionId)
    if ('error' in resolved) return
    // Deduplicate by notice name and payload hash so retries are idempotent while updated payloads still deliver.
    const text = JSON.stringify(value)
    await this.agentDelivery.send(resolved.agent, `notice:${name}:${key(text)}`, text, { inject: summary }, this.host.lifetime)
  }
  /** Returns the current prompt revision, the active prompt revision of each loaded Session, and whether the main Session still has a pending `'prompts'` notice. */
  status() {
    const { store, prompts, effects } = this.host
    const sessions = store.keys(KV.sessions.prompts).flatMap(name => {
      const sessionId = name.slice(KV.sessions.prompts.prefix.length), revision = store.get(name)?.at(-1)
      return this.ctx.agents.get(sessionId as SessionId) && revision !== undefined ? [{ sessionId, revision }] : []
    })
    return { revision: prompts.current().revision, sessions, notificationPending: effects.pending('notice', 'prompts') }
  }
  /** Returns the prompt version a Session runs under (the one bound on its latest model request, or the current version). */
  promptVersion(sessionId: string): PromptVersion {
    const revision = this.host.store.get(KV.sessions.prompts(sessionId))?.at(-1)
    return revision === undefined ? this.host.prompts.current() : this.host.prompts.version(revision)
  }
  /** Whether a Session is authorized to read `revision` (its active revision or any revision it previously ran under). */
  mayRead(sessionId: string, revision: number): boolean {
    return revision === this.promptVersion(sessionId).revision || (this.host.store.get(KV.sessions.prompts(sessionId)) ?? []).includes(revision)
  }
  /** Returns a tool registrar for `agent` that renders tool output as JSON text and attaches `output.image` as an image when present. */
  private registerTool(agent: Agent, binding: SessionBinding): RegisterTool {
    return (name, description, schema, execute) => {
      binding.disposers.push(agent.ctx.tools.register({ name, description, parameters: z.toJSONSchema(schema),
        output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => {
          const text = { type: 'text' as const, text: JSON.stringify(value) }
          const image = value && typeof value === 'object' && 'image' in value ? (value as { image: never }).image : undefined
          return image ? [text, { type: 'image' as const, attachment: image }] : [text]
        } },
        execute: (args, execution) => execute(schema.parse(args), execution.signal) }))
    }
  }
  /** Returns `sessionId`'s active model-budget retry state (`{ model_retry }`) for status listings, or `{}` when not waiting on one. */
  modelRetry(sessionId: string | undefined) {
    const retry = sessionId ? this.retryHealth.get(sessionId) : undefined
    return retry ? { model_retry: retry } : {}
  }
  private updateModelHealth(): void {
    const retries = this.retryHealth.list()
    this.host.health.set(retries.length
      ? { state: 'error', detail: retries.slice(0, 5).map(item => `${item.sessionId}: ${item.provider} is over its model budget; retried ${item.attempts} times, waiting since ${item.since}; the model and retry policy are unchanged`).join('; ') + (retries.length > 5 ? `; ${retries.length - 5} more Sessions` : ''), at: retries.at(-1)!.lastAt }
      : { state: 'ready', detail: 'No managed Session is waiting on a model budget retry' })
  }
  private ticketOf(agent: Agent): Ticket | undefined {
    const ticketId = ticketOfSession(agent.id)
    return ticketId === undefined ? undefined : this.host.store.tickets.get(ticketId)
  }
  private async decorate(agent: Agent): Promise<void> {
    if (this.bindings.has(agent)) return
    const host = this.host
    const master = agent.id === host.masterId
    const ticket = master ? undefined : this.ticketOf(agent)
    if (!master && !ticket) { this.limitSubagent(agent); return }
    const binding: SessionBinding = { disposers: [] }
    this.bindings.set(agent, binding)
    // Staged project Workers must NEVER wait for the asynchronous skill
    // injection before their inherited tool allowlist/guard is bound.
    // This method is invoked by ensure() only AFTER Workspace membership
    // and immutable Session header cwd were attested.
    const stagedWorker = !master && !!ticket?.execution?.projectId
      && process.env[I2_STAGING_FS_ONLY_ENV] === '1'
    if (stagedWorker) binding.disposers.push(...this.workOnly(agent, ticket!.id))
    this.retryHealth.restore(agent.id, agent.session.snapshotEvents())
    if (agent.status === 'idle') this.retryHealth.clear(agent.id)
    this.updateModelHealth()
    // Disable variable interpolation so literal ${{ ... }} expressions in team prompts are preserved.
    binding.disposers.push(agent.ctx.systemPrompt.section({ name: 'dsh-superagent-policy', order: 9999, interpolate: false, text: context => {
      const version = this.promptFor(agent, context.signal !== undefined)
      const current = ticket && host.store.tickets.get(ticket.id)
      const composed = host.prompts.compose(version.config, master ? 'orchestrator' : 'worker', current ? host.environment(current) : undefined)
      return `[dsh-superagent prompt revision ${version.revision}]\n${composed}\n${current ? mandateInstructions(current.mandate) : ''}`
    }, ...(master ? { complete: true } : {}) }))
    // A recreated skill scope (e.g. after the skills service restarts) starts empty, so reset `binding.skills` before rebinding.
    const skillScope = agent.ctx.inject(['skills'], scope => {
      binding.scope = scope
      binding.skills = undefined
      this.bindSkills(binding, host.prompts.current())
    })
    binding.disposers.push(() => { skillScope.dispose().catch((error: unknown) => { this.ctx.logger.warn('dsh-superagent could not release a skill scope: %s', String(error)) }) })
    await skillScope
    // Bail out if the agent was disposed while awaiting the skill scope.
    if (this.bindings.get(agent) !== binding) return
    const register = this.registerTool(agent, binding)
    // The I2 flag is explicit, fixture-only and deny-only; never silently
    // mount original master maintenance/settings/retry/reply surfaces in
    // the isolated model-driven Router. Normal production registration is
    // byte-for-byte equivalent when the flag is absent.
    const stagedRouter = master && process.env[I2_STAGING_FS_ONLY_ENV] === '1'
    for (const tool of host.tools(agent, ticket)) {
      if (stagedRouter && !I2_STAGING_ROUTER_TOOL_SET.has(tool.name)) continue
      // No future bundle tool is silently added to the staging Worker.
      if (stagedWorker && !I2_STAGING_WORKER_OWNED_SET.has(tool.name)) continue
      register(tool.name, tool.description, tool.schema, tool.execute)
    }
    if (stagedWorker) this.stagedBound.add(agent)
    if (master) {
      const inheritAllow = stagedRouter ? [] : ['skill', 'bash', 'read', 'read_image', 'job_output', 'job_list', 'job_kill']
      binding.disposers.push(agent.ctx.tools.restrict({ allow: inheritAllow }),
        agent.ctx.tools.guard(execution => {
          // A stale/hidden direct call must not enter DSH's nested Seatbelt
          // bash runner or an approval escalation even when tool discovery
          // was previously cached. Only the two owned routing tools remain.
          if (stagedRouter)
            return I2_STAGING_ROUTER_TOOL_SET.has(execution?.name ?? '') ? undefined : I2_STAGING_ROUTER_DENIAL
          return noWait(execution, () => this.routed(agent))
        }))
    } else {
      // An Executor Session keeps the profile's work tools it has, which DSH requires to be known; its own tools are not masked.
      if (!stagedWorker) binding.disposers.push(...this.workOnly(agent, ticket!.id))
    }
  }
  /**
   * Whether a Session runs the router preset: as DSH's preset registry last selected it, read through the session projection
   * on a DSH whose registry has no `presetForSession`, else as it was created; `standard`, the safer caps, when unreadable.
   */
  private routed(agent: Agent): boolean {
    try {
      const presets = this.ctx.get('agentPresets') as { presetForSession?: (session: Agent['session']) => string | null } | undefined
      const projections = this.ctx.get('sessionProjections') as { stateOf?: (session: Agent['session'], key: string) => unknown } | undefined
      const selected = typeof presets?.presetForSession === 'function' ? presets.presetForSession(agent.session)
        : projections?.stateOf?.(agent.session, 'agentPreset')
      return (selected ?? agent.session.header.agentPreset) === ROUTER_PRESET
    } catch { return false }
  }
  /**
   * An Executor Session's tools: only the profile's work tools, which DSH requires to be known, and none once its ticket
   * ended. A failed or blocked worker keeps its tools, so a person may continue it in its Session; only automated input waits
   * (see the executor). Read inherited tools through the parent scope, which includes the preset's tools. The global view
   * misses preset tools; the agent's own view also includes local tools such as subagent, which restrict refuses to name.
   */
  private workOnly(agent: Agent, ticketId: string): (() => void)[] {
    const store = this.host.store
    const parent = scopeParentOf(agent)
    const registeredProject = store.tickets.get(ticketId)?.execution?.projectId !== undefined
    const stagedFileToolsOnly = registeredProject && process.env[I2_STAGING_FS_ONLY_ENV] === '1'
    // Selecting an I2 fixture profile can ONLY REMOVE tools. The normal
    // runtime and legacy non-project workers keep their exact former set.
    const names = stagedFileToolsOnly ? I2_STAGING_FILE_TOOLS : WORK_TOOLS
    const allow = names.filter(name => agent.ctx.tools.get(name, parent))
    return [agent.ctx.tools.restrict({ allow }), agent.ctx.tools.guard(execution => {
      // A denied shell MUST NOT reach DSH's nested Seatbelt runner or its
      // danger-full-access approval path, even if tool listing is stale.
      if (stagedFileToolsOnly) {
        // Bundle-owned reporting tools are NOT inherited DSH tools; they are
        // permitted only for the exact root Worker with a valid live Ticket
        // and Workspace. A subagent never receives these owned names.
        const name = execution?.name ?? ''
        const owned = agent.id === workerSessionId(ticketId) && I2_STAGING_WORKER_OWNED_SET.has(name)
        if (!I2_STAGING_FILE_SET.has(name) && !owned) return I2_STAGING_WORKER_DENIAL
        if (!this.stagedReady.has(agent)) return I2_STAGING_UNPREPARED
      }
      const current = store.tickets.get(ticketId)
      if (!current || !liveTicket(current)) return 'Ticket ended; new work needs a new authorized ticket'
      if (current.execution?.projectId) {
        const expected = current.execution.directory
        if (!expected || agent.session.header.cwd !== expected)
          return 'Worker Session no longer has the Ticket snapshot directory'
        // The DSH WorkspaceRegistry list is a synchronous cached, filtered
        // projection. Check it at tool-use time as well as at ensure/prompt;
        // a deleted or reassigned Workspace must not keep old worker tools.
        // Subagents inherit the worker's directory but need not themselves be
        // accounted in the parent's Workspace sessionIds list.
        if (agent.id === workerSessionId(ticketId)) {
          try {
            const owner = this.ctx.workspaceRegistry.list().find(workspace =>
              workspace.path === expected && workspace.sessionIds.includes(agent.id as SessionId))
            if (!owner) return 'Worker Session lost its registered Workspace ownership'
          } catch { return 'Worker Session Workspace ownership cannot be verified' }
        }
      }
      return undefined
    })]
  }
  /**
   * A subagent of an Executor Session, or of one of its subagents, which runs under DSH's `standard` preset with the worker's
   * permissions, gets the same work tools as the worker, and none once the worker's ticket ended. Any other agent is left as
   * it is.
   */
  private limitSubagent(agent: Agent): void {
    let parent = agent.session.header.parentSession
    // Up the subagents' parents to the worker, which are loaded while their subagents run.
    for (let depth = 0; parent !== undefined && ticketOfSession(parent) === undefined && depth < 8; depth++) {
      parent = this.ctx.agents.get(parent)?.session.header.parentSession
    }
    const ticketId = parent === undefined ? undefined : ticketOfSession(parent)
    if (ticketId === undefined || !this.host.store.tickets.get(ticketId)) return
    this.bindings.set(agent, { disposers: this.workOnly(agent, ticketId), subagent: true })
  }
  /** Register the skills of a prompt version in the agent's skill scope, in place of an earlier version's. */
  private bindSkills(binding: SessionBinding, version: PromptVersion): void {
    const { scope, skills: previous } = binding
    if (!scope || previous?.revision === version.revision) return
    previous?.dispose()
    const disposers: (() => void)[] = []
    for (const [name, content] of this.host.prompts.skills(version.config)) {
      const bundled = name === 'feishu' || name === 'github' ? bundledSkills[name] : undefined
      const body = version.config.skills[name] ?? ''
      const description = bundled?.description ?? (body.replace(/\s+/g, ' ').slice(0, 120) || 'Custom dsh-superagent operational skill.')
      disposers.push(scope.skills.register({ name: `${SKILL_PREFIX}${name}`, description, content, source: 'runtime',
        ...(bundled ? { resourceBase: { kind: 'directory' as const, path: dirname(bundled.path) } } : {}) }))
    }
    binding.skills = { revision: version.revision, dispose: () => { disposers.forEach(dispose => dispose()) } }
  }
  /** Return the current prompt version, updating the agent's skills and recording the revision in Store when bound to a model request. */
  private promptFor(agent: Agent, bind: boolean): PromptVersion {
    const version = this.host.prompts.current()
    if (!bind) return version
    const binding = this.bindings.get(agent)
    if (binding) this.bindSkills(binding, version)
    const { store } = this.host
    const revisions = store.get(KV.sessions.prompts(agent.id)) ?? []
    const bound = [...revisions.filter(revision => revision !== version.revision), version.revision]
    if (revisions.at(-1) !== version.revision) store.set(KV.sessions.prompts(agent.id), bound)
    return version
  }
  /** Releases registrations for `agent` in reverse order (LIFO); disposing its skill scope releases its skills as well. */
  private release(agent: Agent): void {
    const binding = this.bindings.get(agent)
    this.stagedReady.delete(agent)
    this.stagedBound.delete(agent)
    if (!binding) { this.releaseStagedHold(agent); return }
    this.bindings.delete(agent)
    binding.skills?.dispose()
    for (const dispose of binding.disposers.splice(0).reverse()) {
      try { dispose() } catch (error) { this.ctx.logger.warn('dsh-superagent could not release what it registered for a Session: %s', String(error)) }
    }
    this.releaseStagedHold(agent)
  }
  /** Releases prompt sections, skills, and tools registered by `Sessions` across all decorated agents. */
  dispose(): void {
    for (const agent of [...new Set([...this.bindings.keys(), ...this.stagedPending.keys()])]) this.release(agent)
  }
}
