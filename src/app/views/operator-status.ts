/**
 * Operator-private status view (OL-055 S3.1): the installed build and manifest, the paused Executor, source health, the native
 * Weixin poll owner's durable lease generation, effect-queue health, the redacted review-hold state, model-route health and the
 * last durable checkpoint. It carries NO secret: the account is a fingerprint, health is reduced to state plus a fixed code, and
 * no token, peer ID, payload or provider error text is ever projected here.
 */
import { existsSync, readFileSync } from 'node:fs'
import { packagePath } from '../../infra/paths.ts'
import { readWeixinPollLeaseGeneration } from '../../local-first/weixin-poll-lease.ts'
import { KV } from '../../kv.ts'
import { policyVersion } from '../../policy.ts'
import type { Health } from '../../sources/host.ts'
import { executorLoad } from './tickets.ts'
import { sourcesStatus, type SetupState } from './sources.ts'
import type { ViewHost } from './records.ts'
import type { Store } from '../store.ts'
import type { HttpHost } from '../http.ts'

/** The installed build and its manifest: what the operator is actually running, read from the package that owns this code. */
function build() {
  try {
    const value = JSON.parse(readFileSync(packagePath('package.json'), 'utf8')) as Record<string, unknown>
    const engines = value.engines as Record<string, unknown> | undefined
    return { name: String(value.name ?? ''), version: String(value.version ?? ''),
      manifestVersion: typeof value.manifestVersion === 'number' ? value.manifestVersion : undefined,
      node: typeof engines?.node === 'string' ? engines.node : undefined }
  } catch { return { name: '', version: '', manifestVersion: undefined, node: undefined } }
}
/** A health entry reduced to what an operator can act on: its state and, when there is one, its fixed code. The detail is never shown, so no provider error text or credential leaks here. */
const redacted = (entry: Health | undefined) => entry
  ? { state: entry.state, ...entry.code ? { code: entry.code } : {} } : { state: 'starting' as const }
/** Native Weixin poll ownership: the non-secret account fingerprint and the durable fencing generation, never the credentials. */
function pollOwner(store: Store) {
  const account = store.get(KV.weixin.nativeAccount)
  const credentialsFile = process.env.DSH_WEIXIN_NATIVE_CREDENTIALS_FILE
  if (!account || !credentialsFile || !existsSync(credentialsFile)) return { account, generation: undefined as number | undefined }
  return { account, generation: readWeixinPollLeaseGeneration(credentialsFile, account) }
}
/** Effect-queue health per kind: how much waits, since when, and whether the queue itself reports an error. */
function queueHealth(store: Store, health: Record<string, Health>) {
  const rows = store.db.prepare('SELECT kind, COUNT(*) AS waiting, MIN(since) AS oldest FROM effect GROUP BY kind ORDER BY kind').all()
  return (rows as { kind: string; waiting: number; oldest: string }[]).map(row => ({
    kind: row.kind, waiting: Number(row.waiting), oldest: String(row.oldest), state: health[row.kind]?.state ?? 'ready' as const }))
}
/**
 * Builds the operator status response: what is installed, whether the Executor is paused, how each Source and the model route are
 * doing, who owns the Weixin poll, what the queues hold, what review holds are pending, and the last durable checkpoint.
 */
export function operatorStatus(runtime: HttpHost) {
  const { store } = runtime
  const settings = store.settings()
  const host: ViewHost = { store, sources: runtime.sources, links: runtime.links() }
  const setup: SetupState = { deployment: runtime.configured() ? runtime.deployment : undefined,
    problem: runtime.setupProblem, feishuProblem: runtime.feishuProblem }
  const audit = store.operatorAudit.list(200)
  const last = audit.at(-1)
  const review = runtime.operatorReview
  const reviewState = store.receipts.reviewSummary()
  return {
    build: build(),
    stateDir: runtime.machine.stateDir,
    executor: { paused: settings.paused, ...executorLoad(store, runtime.executor.activeCount()),
      maxWorkers: settings.executor.maxWorkers, health: redacted(runtime.health.worker) },
    sources: sourcesStatus(host, runtime.health, setup).map(source => ({
      id: source.id, state: source.state,
      health: source.health.map(part => ({ name: part.name, state: part.state, ...part.code ? { code: part.code } : {} })) })),
    poll: pollOwner(store),
    queue: queueHealth(store, runtime.health),
    review: { total: reviewState.total, reasons: reviewState.reasons, ...review ? { journal: review.journalStatus() } : {} },
    // Model-route health with no secret: state and code only, never the provider's error detail.
    models: redacted(runtime.health.models),
    policyVersion: policyVersion(settings),
    checkpoint: { lastSeq: last?.seq, lastAt: last?.at, durableEntries: store.operatorAudit.count(),
      projectionCurrent: review ? review.journalStatus().current : undefined },
  }
}
export type OperatorStatusView = ReturnType<typeof operatorStatus>
