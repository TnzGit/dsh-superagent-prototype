/** Fail-closed model-route decision. Provider adapters/LLM calls are supplied elsewhere. */
export type DataPolicy = 'local-only' | 'cloud-allowed'
export interface ProviderRoute {
  id: string; model: string; priority: number; local: boolean
  costPerMillionOutputTokensUsd: number; capabilities: readonly string[]
  healthy: boolean; enabled: boolean
}
export interface RoutingRequest {
  requiredCapabilities?: readonly string[]; dataPolicy?: DataPolicy; allowPaid?: boolean
  maxOutputCostUsd?: number; expectedOutputTokens?: number
}
export interface RoutingDecision {
  selected: ProviderRoute | null; reason: string
  considered: { id: string; eligible: boolean; reason: string }[]
}
export function selectRoute(routes: readonly ProviderRoute[], request: RoutingRequest = {}): RoutingDecision {
  const expectedOutput = request.expectedOutputTokens ?? 2048
  if (!Number.isFinite(expectedOutput) || expectedOutput < 0) throw new TypeError('Invalid expected output tokens')
  const ordered = [...routes].sort((a,b) => a.priority - b.priority || a.id.localeCompare(b.id))
  const considered = ordered.map(route => {
    const missing = request.requiredCapabilities?.filter(cap => !route.capabilities.includes(cap)) ?? []
    const estimatedCost = route.costPerMillionOutputTokensUsd * expectedOutput / 1_000_000
    let reason = 'eligible'
    if (!route.enabled) reason = 'disabled'
    else if (!route.healthy) reason = 'unhealthy'
    else if (missing.length) reason = 'missing_capability:' + missing.join(',')
    else if (!route.local && request.dataPolicy !== 'cloud-allowed') reason = 'private_data'
    else if (!route.local && !request.allowPaid) reason = 'paid_not_approved'
    else if (!route.local && (!Number.isFinite(request.maxOutputCostUsd) || (request.maxOutputCostUsd ?? 0) <= 0)) reason = 'missing_budget'
    else if (!route.local && estimatedCost > (request.maxOutputCostUsd ?? 0)) reason = 'over_budget'
    return { id: route.id, eligible: reason === 'eligible', reason }
  })
  const winner = considered.find(x => x.eligible)
  return { selected: ordered.find(x => x.id === winner?.id) ?? null,
    reason: winner ? 'ordered_eligible_route' : 'no_authorized_capable_route', considered }
}
