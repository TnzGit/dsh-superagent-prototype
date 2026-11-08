/** Guarded DSH 3083 -> existing DSH 3080 Session bridge.
 * This adapter is NOT mounted on the live Weixin path; use only in a human-approved test.
 * It preserves the original DSH Workspace and Session IDs. It does not read or migrate
 * Session persistence and does not create replacement Agents.
 */
import { createHash, randomUUID } from 'node:crypto'
import type { ExistingDshProject } from './existing-dsh-projects.ts'

export const DSH_3080_ORIGIN = 'http://127.0.0.1:3080'
const MAX_REPLY_BYTES = 4 * 1024 * 1024
const MAX_TEXT = 16_000
const ALLOWED_MODEL = {provider:'cmp170hx',model:'Qwen3.8-Flash-Next'} as const
type RecordObject = Record<string,unknown>
const record = (v:unknown):v is RecordObject=>!!v&&typeof v==='object'&&!Array.isArray(v)
export class DshBridgeBlocked extends Error {
  readonly code:string
  constructor(code:string,detail:string) {super(detail);this.name='DshBridgeBlocked';this.code=code}
}
export interface DshSessionListItem {
  sessionId:string
  running:boolean
  blank:boolean
  formatStatus?:'current'|'migration-required'
  parentSessionId?:string
  origin?:'subagent'
  cwd?:string
  projections?:{values?:RecordObject;kind?:string}
}
export interface ContinuationCheck {
  workspaceId:string
  sessionId:string
  projectId:string
  allowed:boolean
  reasons:string[]
  provider?:string
  model?:string
  permission?:string
  /** True means selected Session is known to the original host and not merely an imported snapshot. */
  originalSessionVerified:boolean
}
/** Stable DSH request identity; retry after ambiguous HTTP must reuse this exact ID. */
export const continuationRequestId=(sessionId:string,sourceMessageId:string):string=>
  'dsh-bridge-'+createHash('sha256').update(JSON.stringify([sessionId,sourceMessageId])).digest('hex').slice(0,40)
export interface DshBridgeOptions {
  /** Literal loopback base only. No hostname DNS, LAN IP, URL credentials or path. */
  origin?:string
  fetcher?:typeof fetch
  /** Defaults to false: anonymous owner trust on the source is not real authentication. */
  explicitlyEnabled?:boolean
  /** Exact Session IDs explicitly approved for the test. Never derive from a model's text. */
  allowedSessionIds?:readonly string[]
  /** True ONLY after the operator has verified this host's provider routes via the 8123 queue proxy. */
  queueProxyVerified?:boolean
  /** Extra host-specific verification, such as a provenance attestation from an approved profile audit. */
  verifyRoute?:()=>Promise<boolean>
}
const fail=(code:string,message:string):never=>{throw new DshBridgeBlocked(code,message)}
export function normalizeBridgeOrigin(raw:string):string {
  const url=new URL(raw)
  if(url.href!==DSH_3080_ORIGIN+'/' || url.username || url.password || url.hash || url.search)
    return fail('endpoint_not_loopback','The DSH bridge may call only the exact 127.0.0.1:3080 origin')
  return url.origin
}
function valueOf<T>(value:unknown):T {
  if (!record(value)||value.type!=='server-response'||typeof value.rpcId!=='string'||
      !record(value.result)||typeof value.result.ok!=='boolean')
    return fail('bad_rpc_response','Invalid DSH server-response')
  return value as T
}
/** Deliberately narrow RPC client: the only methods reachable through this adapter
 * are session/list (read) and session/prompt (one strictly gated message).
 */
export class Dsh3080Bridge {
  private readonly origin:string
  private readonly fetcher:typeof fetch
  private readonly enabled:boolean
  private readonly allowedSessionIds:ReadonlySet<string>
  private readonly queueProxyVerified:boolean
  private readonly verifyRoute?:()=>Promise<boolean>
  constructor(options:DshBridgeOptions={}) {
    this.origin=normalizeBridgeOrigin(options.origin??DSH_3080_ORIGIN)
    this.fetcher=options.fetcher??fetch
    this.enabled=options.explicitlyEnabled===true
    this.allowedSessionIds=new Set(options.allowedSessionIds??[])
    this.queueProxyVerified=options.queueProxyVerified===true
    this.verifyRoute=options.verifyRoute
  }
  private async call<T>(method:'session/list'|'session/prompt',request:RecordObject):Promise<T> {
    const rpcId=randomUUID()
    const endpoint=this.origin+'/api/'+method
    const response=await this.fetcher(endpoint,{
      method:'POST',
      redirect:'error',
      headers:{'content-type':'application/json','accept':'application/json',
        // DSH 3080's Origin admission check is not proof of authentication.
        'origin':this.origin},
      body:JSON.stringify({type:'client-request',rpcId,method,payload:{args:{_request:request}}}),
      signal:AbortSignal.timeout(15_000),
    })
    if(!response.ok) return fail('rpc_http_failure','DSH 3080 returned HTTP '+response.status)
    const advertised=Number(response.headers.get('content-length')??0)
    if(advertised>MAX_REPLY_BYTES)return fail('rpc_reply_too_large','DSH RPC reply exceeds limit')
    const raw=await response.text()
    if(Buffer.byteLength(raw)>MAX_REPLY_BYTES)return fail('rpc_reply_too_large','DSH RPC reply exceeds limit')
    let parsed:unknown
    try{parsed=JSON.parse(raw)}catch{return fail('bad_rpc_response','Non-JSON DSH RPC response')}
    const envelope=valueOf<{type:string;rpcId:string;result:{ok:boolean;value?:unknown;error?:RecordObject}}>(parsed)
    if(envelope.rpcId!==rpcId)return fail('rpc_correlation','DSH reply rpcId did not match request')
    if(!envelope.result.ok){
      const error=envelope.result.error
      return fail('rpc_rejected',typeof error?.code==='string'?'DSH refused '+error.code:'DSH refused the request')
    }
    return envelope.result.value as T
  }
  /** Read-only, does not activate Agents or touch any stored Session. */
  async listSessions():Promise<DshSessionListItem[]> {
    const result=await this.call<{items?:unknown}>('session/list',{})
    if(!record(result)||!Array.isArray(result.items)||result.items.length>20_000)
      return fail('bad_session_list','Invalid DSH Session list')
    return result.items.map((item:unknown)=>{
      if(!record(item)||typeof item.sessionId!=='string'||typeof item.running!=='boolean'||
        typeof item.blank!=='boolean'||item.sessionId.length>256)
        return fail('bad_session_list','Invalid DSH Session summary')
      return item as unknown as DshSessionListItem
    })
  }
  /** Enforce exact Workspace/Session membership plus local-model and permission constraints.
   * Does NOT mutate any session, change default model, or invoke a migration.
   */
  async inspect(project:ExistingDshProject, sessionId:string):Promise<ContinuationCheck> {
    const reasons:string[]=[]
    if(!project.sessionIds.includes(sessionId))reasons.push('session_not_in_original_workspace')
    const current=(await this.listSessions()).find(x=>x.sessionId===sessionId)
    if(!current)reasons.push('session_not_in_host')
    if(current?.running)reasons.push('session_busy')
    if(current?.origin==='subagent'||current?.parentSessionId)reasons.push('subagent_session_not_supported')
    if(current?.formatStatus!=='current')reasons.push('session_format_unverified_or_migration_required')
    if(current?.cwd && current.cwd!==project.path)reasons.push('workspace_path_mismatch')
    const values=current?.projections?.values
    const model=record(values?.modelSelection)?values.modelSelection:undefined
    const permissions=record(values?.permissions)?values.permissions:undefined
    const provider=typeof model?.provider==='string'?model.provider:undefined
    const modelId=typeof model?.model==='string'?model.model:undefined
    const preset=typeof permissions?.currentValue==='string'?permissions.currentValue:undefined
    if(provider!==ALLOWED_MODEL.provider||modelId!==ALLOWED_MODEL.model)
      reasons.push('session_model_not_approved_local_qwen')
    if(preset!=='workspace-write') reasons.push('session_permission_not_workspace_write')
    if(!this.enabled)reasons.push('bridge_not_explicitly_enabled')
    if(!this.allowedSessionIds.has(sessionId))reasons.push('session_not_operator_approved')
    if(!this.queueProxyVerified)reasons.push('queue_proxy_not_verified_on_3080')
    if(!this.verifyRoute)reasons.push('queue_proxy_route_attestation_missing')
    else if(!(await this.verifyRoute()))reasons.push('queue_proxy_route_check_failed')
    // Both the specific original Workspace and its Session identity remain unmodified.
    return {workspaceId:project.workspaceId,sessionId,projectId:project.projectId,allowed:reasons.length===0,
      reasons,provider,model:modelId,permission:preset,
      originalSessionVerified:!!current&&project.sessionIds.includes(sessionId)}
  }
  /** Human-approved one-shot admission only. 'accepted' means in the Session inbox, NOT completed or replied.
   * A network timeout after request dispatch is ambiguous; retry ONLY with the same sourceMessageId.
   */
  async submit(input:{project:ExistingDshProject;sessionId:string;sourceMessageId:string;
    text:string;operatorApproved:boolean}):Promise<{accepted:true;requestId:string;sessionId:string}> {
    if(!input.operatorApproved)return fail('operator_approval_required','User approval is required before any historical Session prompt')
    if(!input.sourceMessageId||input.sourceMessageId.length>256)
      return fail('invalid_source_id','Invalid source message ID')
    if(typeof input.text!=='string'||!input.text.trim()||input.text.length>MAX_TEXT)
      return fail('invalid_content','Expected bounded non-empty text')
    const check=await this.inspect(input.project,input.sessionId)
    if(!check.allowed)return fail('preflight_blocked','DSH 3080 continuation blocked: '+check.reasons.join(','))
    const requestId=continuationRequestId(input.sessionId,input.sourceMessageId)
    const ack=await this.call<{accepted?:unknown}>('session/prompt',{
      requestId,sessionId:input.sessionId,mode:'queue',content:[{type:'text',text:input.text}]})
    if(!record(ack)||ack.accepted!==true)return fail('bad_prompt_receipt','DSH did not acknowledge accepted prompt')
    return {accepted:true,requestId,sessionId:input.sessionId}
  }
}
