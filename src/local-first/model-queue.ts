/** Per-endpoint admission queue. Share one registry across DSH eval and worker sessions. */
export type Priority = 'interactive' | 'normal' | 'background'
export type ModelTask<T> = (signal: AbortSignal) => Promise<T>
export interface EnqueueOptions { signal?: AbortSignal; waitTimeoutMs?: number; priority?: Priority }
export interface QueueSnapshot { running: number; pending: number; pendingByPriority: Record<Priority, number> }
interface Entry<T> {
  fn: ModelTask<T>; priority: Priority; resolve: (value: T) => void; reject: (error: unknown) => void
  signal?: AbortSignal; cleanup?: () => void; state: 'pending' | 'running' | 'done'
}
const PRIORITIES: Priority[] = ['interactive','normal','background']
/** The endpoint cannot admit another waiting request. */
export class QueueBusyError extends Error { constructor(message: string) { super(message); this.name = 'QueueBusyError' } }
/** A queued request exceeded its configured waiting budget. */
export class QueueWaitTimeoutError extends Error { constructor() { super('Waited too long for a model slot'); this.name = 'QueueWaitTimeoutError' } }
const cancelled = (): Error => new DOMException('Model request cancelled', 'AbortError')

/** Running requests hold their slot until promise settlement, even if cancellation was requested. */
export class ModelEndpointQueue {
  private pending: Entry<any>[] = []
  private running = 0
  private highBurst = 0
  readonly concurrency: number
  readonly maxPending: number
  readonly maxHighBurst: number
  constructor(concurrency = 1, maxPending = 256, maxHighBurst = 3) {
    this.concurrency = concurrency; this.maxPending = maxPending; this.maxHighBurst = maxHighBurst
    if (![concurrency, maxPending, maxHighBurst].every(n => Number.isSafeInteger(n) && n > 0)) throw new TypeError('Queue limits must be positive integers')
  }
  snapshot(): QueueSnapshot {
    return { running: this.running, pending: this.pending.length, pendingByPriority:
      Object.fromEntries(PRIORITIES.map(p => [p, this.pending.filter(e => e.priority === p).length])) as Record<Priority, number> }
  }
  run<T>(fn: ModelTask<T>, options: EnqueueOptions = {}): Promise<T> {
    const priority = options.priority ?? 'normal'
    if (!PRIORITIES.includes(priority)) return Promise.reject(new TypeError('Unknown priority'))
    if (options.signal?.aborted) return Promise.reject(cancelled())
    if (options.waitTimeoutMs !== undefined && (!Number.isFinite(options.waitTimeoutMs) || options.waitTimeoutMs < 0))
      return Promise.reject(new TypeError('waitTimeoutMs must be nonnegative'))
    if (this.pending.length >= this.maxPending && this.running >= this.concurrency)
      return Promise.reject(new QueueBusyError('Model queue is full'))
    return new Promise<T>((resolve, reject) => {
      const entry: Entry<T> = { fn, priority, resolve, reject, signal: options.signal, state: 'pending' }
      const onAbort = () => this.remove(entry, cancelled())
      let timer: ReturnType<typeof setTimeout> | undefined
      options.signal?.addEventListener('abort', onAbort, { once: true })
      if (options.waitTimeoutMs !== undefined) timer = setTimeout(() => this.remove(entry, new QueueWaitTimeoutError()), options.waitTimeoutMs)
      entry.cleanup = () => { options.signal?.removeEventListener('abort', onAbort); if (timer) clearTimeout(timer) }
      this.pending.push(entry); this.drain()
    })
  }
  private remove(entry: Entry<any>, reason: Error): void {
    if (entry.state !== 'pending') return
    const pos = this.pending.indexOf(entry)
    if (pos < 0) return
    this.pending.splice(pos, 1); entry.state = 'done'; entry.cleanup?.(); entry.reject(reason); this.drain()
  }
  private nextIndex(): number {
    const hasLower = this.pending.some(e => e.priority !== 'interactive')
    // After N urgent calls, serve the oldest non-urgent call. Never preempt an in-flight request.
    if (hasLower && this.highBurst >= this.maxHighBurst) return this.pending.findIndex(e => e.priority !== 'interactive')
    for (const p of PRIORITIES) { const i = this.pending.findIndex(e => e.priority === p); if (i >= 0) return i }
    return -1
  }
  private drain(): void {
    while (this.running < this.concurrency && this.pending.length) {
      const index = this.nextIndex(); if (index < 0) return
      const entry = this.pending.splice(index, 1)[0]!
      if (entry.signal?.aborted) { entry.state = 'done'; entry.cleanup?.(); entry.reject(cancelled()); continue }
      entry.cleanup?.(); entry.state = 'running'; this.running++
      this.highBurst = entry.priority === 'interactive' ? this.highBurst + 1 : 0
      const controller = new AbortController()
      const abort = () => controller.abort(entry.signal?.reason)
      entry.signal?.addEventListener('abort', abort, { once: true })
      void Promise.resolve().then(() => entry.fn(controller.signal)).then(entry.resolve, entry.reject).finally(() => {
        entry.signal?.removeEventListener('abort', abort)
        entry.state = 'done'; this.running--; this.drain()
      })
    }
  }
}
/** This registry MUST be owned by a single process-wide service, not instantiated per worker. */
export class ModelQueueRegistry {
  private readonly queues = new Map<string, ModelEndpointQueue>()
  private readonly limits: Readonly<Record<string, { concurrency: number; maxPending?: number }>>
  constructor(limits: Readonly<Record<string, { concurrency: number; maxPending?: number }>>) { this.limits = limits }
  queue(endpointId: string): ModelEndpointQueue {
    const config = this.limits[endpointId]
    if (!config) throw new Error('Unregistered model endpoint')
    let queue = this.queues.get(endpointId)
    if (!queue) { queue = new ModelEndpointQueue(config.concurrency, config.maxPending); this.queues.set(endpointId, queue) }
    return queue
  }
}
