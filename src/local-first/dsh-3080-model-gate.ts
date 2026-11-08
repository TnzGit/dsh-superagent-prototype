/** Opt-in, host-agnostic gate for a disposable original-DSH Session model switch.
 * No live RPC transport is wired here. A human-approved host test must inject
 * official SessionController and SettingsController operations as a narrow port.
 * This is NOT reachable from Weixin text or the running 3083 Relay.
 */
type Value = null | boolean | number | string | Value[] | { [key: string]: Value }
type Section = Record<string, Value>
export interface GateModel {
  provider: string
  model: string
  reasoningEffort?: string
}
export interface GateSession {
  sessionId: string
  workspaceId: string
  formatStatus: 'current' | 'migration-required' | 'unknown'
  running: boolean
  subagent: boolean
  pendingInput: boolean
  permission: string
  next: GateModel
  /** Sequenced projection position, not a cached list hint. */
  projectionSeq: number
}
export interface GateDefault {
  writable: boolean
  revision: number
  /** Entire current user section; settings/replace overwrites this whole section. */
  user: Section
  effective: GateModel
}
export interface GateCatalog {
  provider: string
  model: string
  /** Read from live session/modelCatalog, NEVER guessed from old provider. */
  reasoningEfforts: readonly string[]
  failures: readonly string[]
}
export interface ModelGatePort {
  readSession(sessionId: string): Promise<GateSession>
  readDefault(): Promise<GateDefault>
  readCatalog(): Promise<GateCatalog>
  /** Official session/selectModel on one operator-designated disposable Session. */
  selectModel(sessionId: string, selection: GateModel): Promise<GateModel>
  /** Official settings/replace('agent-default-model', fullUserSection, expectedRevision).
   * Must NOT use undefined as expectedRevision: that would disable CAS.
   */
  replaceDefault(section: Section, expectedRevision: number): Promise<GateDefault>
  /** Host/test-controlled delay between readbacks; no background work is scheduled. */
  settle(delayMs: number): Promise<void>
}
export interface ModelGateSnapshot {
  session: GateSession
  originalDefault: GateDefault
  target: GateModel
}
export interface ModelGateApproval {
  /** Must come from a private operator approval, never arbitrary Weixin text. */
  operatorApproved: true
  disposableSessionId: string
  exactWorkspaceId: string
  /** No broad permission for other Sessions or model/provider routes. */
  allowedReasoningEffort?: 'low' | 'high'
}
export class DshModelGateBlocked extends Error {
  constructor(readonly code: string, detail: string) {
    super(detail)
    this.name = 'DshModelGateBlocked'
  }
}
const block = (code: string, detail: string): never => { throw new DshModelGateBlocked(code, detail) }
const isRevision = (x: number): boolean => Number.isSafeInteger(x) && x >= 0
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const modelMatches = (a: GateModel, b: GateModel): boolean =>
  a.provider === b.provider && a.model === b.model &&
  a.reasoningEffort === b.reasoningEffort
function validSection(section: Section): boolean {
  return !!section && typeof section === 'object' && !Array.isArray(section) &&
    typeof section.provider === 'string' && typeof section.model === 'string'
}
function checkDefault(value: GateDefault): void {
  if (!value.writable || !isRevision(value.revision) || !validSection(value.user) ||
    !modelMatches(value.effective, value.user as unknown as GateModel))
    block('default_not_writable_or_consistent', 'Default settings snapshot is not writable or consistent')
}
/** No writes. Verify official live Session, default and model-catalog observations.
 * Deliberately limits this first use case to a *different* test-only provider.
 */
export async function inspectDisposableModelGate(
  port: ModelGatePort, approval: ModelGateApproval,
): Promise<ModelGateSnapshot> {
  if (approval.operatorApproved !== true ||
    !approval.disposableSessionId || !approval.exactWorkspaceId)
    return block('missing_operator_approval', 'One exact disposable Session needs an owner grant')
  const session = await port.readSession(approval.disposableSessionId)
  if (session.sessionId !== approval.disposableSessionId ||
    session.workspaceId !== approval.exactWorkspaceId ||
    session.formatStatus !== 'current' || session.running || session.subagent ||
    session.pendingInput || session.permission !== 'workspace-write' ||
    !isRevision(session.projectionSeq))
    return block('session_not_disposable_ready', 'Session identity, format, permissions or idle state unsuitable')
  if (session.next.provider !== 'cmp170hx' ||
    session.next.model !== 'Qwen3.8-Flash-Next')
    return block('unexpected_session_model', 'Test Session no longer has the expected local baseline')
  const defaultView = await port.readDefault()
  checkDefault(defaultView)
  if (defaultView.effective.provider !== 'cmp170hx' ||
    defaultView.effective.model !== 'Qwen3.8-Flash-Next' ||
    defaultView.effective.reasoningEffort !== 'xhigh')
    return block('unexpected_global_default', 'Original global model default has drifted')
  const catalog = await port.readCatalog()
  if (catalog.failures.length || catalog.provider !== 'llm-local-proxy' ||
    catalog.model !== 'Qwen3.8-Flash-Next')
    return block('proxy_catalog_unavailable', 'Target model is not advertised by the exact test provider')
  const effort = approval.allowedReasoningEffort
  if (effort !== undefined && !['low', 'high'].includes(effort))
    return block('effort_not_allowed', 'Gate allows only explicitly granted low/high')
  if (effort !== undefined && !catalog.reasoningEfforts.includes(effort))
    return block('effort_not_advertised', 'Do not assume the test provider supports a thinking level')
  const target: GateModel = {provider: 'llm-local-proxy', model: 'Qwen3.8-Flash-Next',
    ...(effort === undefined ? {} : {reasoningEffort: effort})}
  return {
    session: structuredClone(session),
    originalDefault: structuredClone(defaultView),
    target,
  }
}
function sameUserApartFromModel(user: Section, original: Section): boolean {
  for (const [key, value] of Object.entries(user)) {
    if (['provider', 'model', 'reasoningEffort'].includes(key)) continue
    if (!Object.hasOwn(original, key) || !equal(value, original[key])) return false
  }
  for (const key of Object.keys(original)) {
    if (['provider', 'model', 'reasoningEffort'].includes(key)) continue
    if (!Object.hasOwn(user, key)) return false
  }
  return true
}
/** Actual mutation boundary. Exactly one selectModel and at most one CAS replace.
 *
 * Invariants: manual disposable-Session approval, persisted private baseline
 * BEFORE selection, no competing model/default writers, verified async default
 * save before CAS restore, and repeated default readback. On any uncertainty,
 * STOP and return a reason for manual host recovery. Never blindly retry a
 * selectModel after a transport timeout. Never submit a model prompt here.
 */
export async function selectDisposableModelAndRestoreDefault(
  port: ModelGatePort,
  approval: ModelGateApproval,
  persistBeforeSelect: (snapshot: ModelGateSnapshot) => Promise<void>,
): Promise<{sessionId: string; selected: GateModel; restoredRevision: number}> {
  if (typeof persistBeforeSelect !== 'function')
    return block('durable_snapshot_required', 'A durable private rollback record is required')
  const snapshot = await inspectDisposableModelGate(port, approval)
  await persistBeforeSelect(structuredClone(snapshot))
  // Close a baseline race before the irreversible Session-local model mutation.
  const recheck = await inspectDisposableModelGate(port, approval)
  if (!equal(recheck, snapshot))
    return block('baseline_changed', 'Session, catalog or global default changed before selection')
  const selected = await port.selectModel(approval.disposableSessionId, snapshot.target)
  if (!modelMatches(selected, snapshot.target))
    return block('select_model_ambiguous', 'Unexpected selectModel receipt: manual recovery required')
  const updatedSession = await port.readSession(approval.disposableSessionId)
  if (updatedSession.sessionId !== snapshot.session.sessionId ||
    updatedSession.workspaceId !== snapshot.session.workspaceId ||
    !modelMatches(updatedSession.next, snapshot.target) ||
    !isRevision(updatedSession.projectionSeq) ||
    updatedSession.projectionSeq <= snapshot.session.projectionSeq)
    return block('session_selection_unverified', 'Session next model was not committed as expected')
  // selectModel saves the default asynchronously. Replacing it before this save
  // lands can be overwritten by the late background save.
  let saved: GateDefault | undefined
  for (let attempt = 0; attempt < 12; attempt++) {
    const current = await port.readDefault()
    checkDefault(current)
    if (current.revision === snapshot.originalDefault.revision &&
      equal(current.user, snapshot.originalDefault.user)) {
      await port.settle(250)
      continue
    }
    if (current.revision !== snapshot.originalDefault.revision + 1 ||
      !modelMatches(current.effective, snapshot.target) ||
      !modelMatches(current.user as unknown as GateModel, snapshot.target) ||
      !sameUserApartFromModel(current.user, snapshot.originalDefault.user))
      return block('default_save_conflict', 'Unexpected global default mutation; do not overwrite another writer')
    // A second settled observation guards against a transient intermediate view.
    await port.settle(250)
    const stable = await port.readDefault()
    if (!equal(current, stable))
      return block('default_save_unstable', 'Background model-default save is not stable')
    saved = stable
    break
  }
  if (!saved)
    return block('default_save_not_observed', 'Background default save not observed; manual recovery required')
  // CAS targets only the one settings namespace; never write a whole profile.
  const restored = await port.replaceDefault(
    structuredClone(snapshot.originalDefault.user), saved.revision)
  checkDefault(restored)
  if (restored.revision <= saved.revision ||
    !equal(restored.user, snapshot.originalDefault.user) ||
    !modelMatches(restored.effective, snapshot.originalDefault.effective))
    return block('default_restore_unverified', 'Settings CAS response does not prove original default restored')
  await port.settle(250)
  const finalRead = await port.readDefault()
  if (!equal(finalRead, restored))
    return block('default_restore_unstable', 'Original default changed after restore; manual review required')
  return {sessionId: approval.disposableSessionId, selected, restoredRevision: finalRead.revision}
}
