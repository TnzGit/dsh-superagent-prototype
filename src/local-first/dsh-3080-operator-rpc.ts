/** Narrow official DSH 0.2.2-alpha.2 loopback RPC adapter for an explicitly
 * approved, disposable original-Host test. NEVER exported into Weixin routing.
 * This module owns only one-shot model selection and *new* Workspace registration:
 * history, Session prompts, credentials and Host config do not pass through it.
 */
import {randomUUID} from 'node:crypto'
import {normalizeBridgeOrigin,DSH_3080_ORIGIN} from './dsh-3080-bridge.ts'
import type {GateCatalog,GateDefault,GateModel,GateSession,ModelGatePort} from './dsh-3080-model-gate.ts'

type Dict=Record<string,unknown>
const object=(v:unknown):v is Dict=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const nonempty=(v:unknown):v is string=>typeof v==='string'&&v.length>0
type Method='session/list'|'session/projections'|'session/state'|'session/modelCatalog'|
  'settings/describe'|'settings/replace'|'session/selectModel'|'workspace/create'|'session/create'
const WRITE_METHODS=new Set<Method>(['settings/replace','session/selectModel','workspace/create','session/create'])
/** Explicit mutation admission; two independent grants are not inferred from one another. */
export interface OwnerRpcGrants {
  /** Exact fresh disposable Session identity; never an arbitrary historical Session. */
  sessionModelWrites?: {sessionId:string}
  /** Exact safe new Workspace directory, independently designated by operator. */
  newWorkspaceWrites?: {path:string}
}
/** Fail-closed endpoint/correlation or operator-grant error without private Host payloads. */
export class DshOwnerRpcBlocked extends Error {
  readonly code:string
  constructor(code:string,detail:string){super(detail);this.name='DshOwnerRpcBlocked';this.code=code}
}
const fail=(code:string,message:string):never=>{throw new DshOwnerRpcBlocked(code,message)}
export interface OwnerRpcOptions {
  fetcher?:typeof fetch
  origin?:string
  grants?:OwnerRpcGrants
}
/** Exact loopback-only official DSH RPC owner with separately scoped one-shot writes. */
export class DshOwnerRpc {
  private readonly origin:string
  private readonly fetcher:typeof fetch
  private readonly grants:OwnerRpcGrants
  private selectedOnce=false
  private restoredOnce=false
  private registeredOnce=false
  private sessionCreatedOnce=false
  private createdWorkspaceId?:string
  constructor(options:OwnerRpcOptions={}){
    this.origin=normalizeBridgeOrigin(options.origin??DSH_3080_ORIGIN)
    this.fetcher=options.fetcher??fetch
    this.grants={...options.grants}
  }
  /** Only declared DSH Remote methods with their actual named wire arguments.
   * No redirects; per-request ID; bounded reply; fail closed on malformed replies.
   */
  private async invoke(method:Method,args:Dict):Promise<unknown> {
    if(WRITE_METHODS.has(method)){
      const modelMutation=method==='settings/replace'||method==='session/selectModel'
      if(modelMutation?!this.grants.sessionModelWrites:!this.grants.newWorkspaceWrites)
        return fail('write_not_granted','Original DSH mutation has no explicit independent host grant')
    }
    const rpcId=randomUUID()
    const response=await this.fetcher(this.origin+'/api/'+method,{
      method:'POST',redirect:'error',
      headers:{'content-type':'application/json','accept':'application/json','origin':this.origin},
      body:JSON.stringify({type:'client-request',rpcId,method,payload:{args}}),
      signal:AbortSignal.timeout(15_000),
    })
    if(!response.ok)return fail('rpc_http_failure','Original DSH HTTP status '+response.status)
    const size=Number(response.headers.get('content-length')??0)
    if(!Number.isFinite(size)||size<0||size>4*1024*1024)
      return fail('rpc_reply_too_large','Original Host RPC reply size is invalid')
    const raw=await response.text()
    if(Buffer.byteLength(raw,'utf8')>4*1024*1024)
      return fail('rpc_reply_too_large','Original Host RPC reply exceeded 4 MiB')
    let body:unknown
    try{body=JSON.parse(raw)}catch{return fail('invalid_rpc_envelope','Original DSH RPC returned non-JSON data')}
    if(!object(body)||body.type!=='server-response'||body.rpcId!==rpcId||
      !object(body.result)||typeof body.result.ok!=='boolean')
      return fail('invalid_rpc_envelope','Original DSH RPC envelope or ID mismatched')
    if(body.result.ok!==true){
      const error=object(body.result.error)?body.result.error:undefined
      return fail('remote_refused','Original DSH rejected '+method+' ('+
        (typeof error?.code==='string'?error.code:'unknown')+')')
    }
    return body.result.value
  }
  async listSessions():Promise<unknown>{return this.invoke('session/list',{_request:{}})}
  async projections(sessionId:string):Promise<unknown>{
    if(!nonempty(sessionId))return fail('invalid_session_id','Missing Session ID')
    return this.invoke('session/projections',{request:{sessionId}})
  }
  async state(sessionId:string):Promise<unknown>{
    if(!nonempty(sessionId))return fail('invalid_session_id','Missing Session ID')
    return this.invoke('session/state',{request:{sessionId}})
  }
  async modelCatalog():Promise<unknown>{return this.invoke('session/modelCatalog',{})}
  async describeSettings():Promise<unknown>{return this.invoke('settings/describe',{})}
  async replaceDefault(section:Record<string,unknown>,expectedRevision:number):Promise<unknown>{
    if(!object(section)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
      return fail('invalid_settings_revision','Cannot replace default without a full section and safe CAS revision')
    if(!this.grants.sessionModelWrites)return fail('write_not_granted','No approved Session restoration grant')
    if(!this.selectedOnce||this.restoredOnce)
      return fail('restore_out_of_order','The one-shot restore requires exactly one earlier model selection')
    this.restoredOnce=true
    return this.invoke('settings/replace',{ns:'agent-default-model',section,expectedRevision})
  }
  async selectModel(sessionId:string,selection:GateModel):Promise<unknown>{
    if(!nonempty(sessionId)||selection.provider!=='llm-local-proxy'||
      selection.model!=='Qwen3.8-Flash-Next'||
      (selection.reasoningEffort!==undefined&&!['low','high'].includes(selection.reasoningEffort)))
      return fail('invalid_model_route','Only the operator-approved test Qwen route may be selected')
    if(!this.grants.sessionModelWrites)return fail('write_not_granted','No approved Session selection grant')
    if(sessionId!==this.grants.sessionModelWrites.sessionId||this.selectedOnce)
      return fail('session_not_granted_or_replayed','Only one model-selection attempt on the exact disposable Session is allowed')
    // Mark BEFORE any network I/O. An ambiguous HTTP reply must not be retried.
    this.selectedOnce=true
    return this.invoke('session/selectModel',{request:{sessionId,...selection}})
  }
  async registerNewWorkspace(path:string):Promise<unknown>{
    if(!nonempty(path)||!path.startsWith('/'))return fail('invalid_workspace_path','Absolute new Workspace path required')
    if(!this.grants.newWorkspaceWrites)return fail('write_not_granted','No approved new Workspace grant')
    if(path!==this.grants.newWorkspaceWrites.path||this.registeredOnce)
      return fail('workspace_not_granted_or_replayed','Only one registration attempt for the exact new path is allowed')
    this.registeredOnce=true
    const result=await this.invoke('workspace/create',{request:{path}})
    if(object(result)&&result.created===true&&object(result.workspace)&&
      nonempty(result.workspace.workspaceId)&&result.workspace.path===path)
      this.createdWorkspaceId=result.workspace.workspaceId
    return result
  }
  async createNewSession(workspaceId:string):Promise<unknown>{
    if(!nonempty(workspaceId))return fail('invalid_workspace_id','Workspace ID required')
    if(!this.grants.newWorkspaceWrites)return fail('write_not_granted','No approved new Workspace grant')
    if(!this.registeredOnce||this.sessionCreatedOnce||
      workspaceId!==this.createdWorkspaceId)
      return fail('session_create_not_granted_or_replayed','Can create one Session only inside the newly registered Workspace')
    this.sessionCreatedOnce=true
    return this.invoke('session/create',{request:{workspaceId}})
  }
}

function mustObject(value:unknown,label:string):Dict {
  if(!object(value))return fail('bad_'+label,'Unexpected original DSH '+label+' payload')
  return value
}
function mustModel(value:unknown):GateModel {
  const v=mustObject(value,'model')
  if(!nonempty(v.provider)||!nonempty(v.model))
    return fail('bad_model','Original DSH model selection is missing provider/model')
  if(v.reasoningEffort!==undefined&&typeof v.reasoningEffort!=='string')
    return fail('bad_model','Original DSH model reasoningEffort is not a string')
  return {provider:v.provider,model:v.model,
    ...(typeof v.reasoningEffort==='string'?{reasoningEffort:v.reasoningEffort}:{})}
}
/** Real official RPC implementation of the injected model-switch gate.
 * Session-to-Workspace membership is an independent authoritative host
 * observation (workspace/follow or equivalent installed DSH API); never infer
 * membership from cwd, a copied catalog, or the prompt's text.
 */
export function originalDshModelGatePort(options:{
  rpc:DshOwnerRpc
  workspaceId:string
  /** Must verify current original-host Workspace membership on each read. */
  verifyMembership:(workspaceId:string,sessionId:string)=>Promise<boolean>
  settle:(ms:number)=>Promise<void>
}):ModelGatePort {
  const {rpc,workspaceId,verifyMembership,settle}=options
  return {
    async readSession(sessionId):Promise<GateSession>{
      const result=mustObject(await rpc.listSessions(),'session_list')
      if(!Array.isArray(result.items))return fail('bad_session_list','Original Host Session listing missing')
      const item=result.items.find((v:unknown)=>object(v)&&v.sessionId===sessionId)
      if(!item)return fail('missing_session','Chosen disposable Session is absent from original DSH')
      const summary=mustObject(item,'session_summary')
      if(!await verifyMembership(workspaceId,sessionId))
        return fail('workspace_membership_unverified','Original DSH Workspace does not contain the exact Session')
      const projections=mustObject(await rpc.projections(sessionId),'session_projections')
      if(projections.kind!=='sequenced'||!Number.isSafeInteger(projections.asOfSeq)||
        !object(projections.values))
        return fail('sequenced_projection_unavailable','Original Session has no safe sequenced projection')
      const values=projections.values
      const selection=mustObject(values.modelSelection,'model_selection')
      const permissions=mustObject(values.permissions,'permissions')
      const state=mustObject(await rpc.state(sessionId),'session_state')
      if(!Array.isArray(state.pendingInput)||
        !(state.queue===null||Array.isArray(state.queue))||
        typeof state.running!=='boolean'||typeof state.active!=='boolean')
        return fail('session_state_unavailable','Session busy/queue state cannot be verified')
      return {
        sessionId,workspaceId,
        formatStatus:summary.formatStatus==='current'?'current':
          summary.formatStatus==='migration-required'?'migration-required':'unknown',
        running:summary.running!==false||state.running!==false||state.active!==false||
          (Array.isArray(state.queue)&&state.queue.length>0),
        subagent:summary.origin==='subagent'||nonempty(summary.parentSessionId),
        pendingInput:state.pendingInput.length>0,
        permission:typeof permissions.currentValue==='string'?permissions.currentValue:'unverified',
        next:mustModel(selection.next),projectionSeq:projections.asOfSeq as number,
      }
    },
    async readDefault():Promise<GateDefault>{
      const payload=mustObject(await rpc.describeSettings(),'settings_describe')
      if(!Array.isArray(payload.namespaces))return fail('settings_unavailable','No settings namespaces')
      const namespace=payload.namespaces.find((v:unknown)=>object(v)&&v.ns==='agent-default-model')
      const ns=mustObject(namespace,'default_namespace')
      if(!Number.isSafeInteger(ns.revision)||!object(ns.user))
        return fail('default_snapshot_unavailable','Original default has no writable complete user section')
      return{writable:payload.writable===true&&ns.applies!==false,
        revision:ns.revision as number,
        user:structuredClone(ns.user) as GateDefault['user'],
        effective:mustModel(ns.value)}
    },
    async readCatalog():Promise<GateCatalog>{
      const catalog=mustObject(await rpc.modelCatalog(),'model_catalog')
      if(!Array.isArray(catalog.routableProviders)||
        !catalog.routableProviders.includes('llm-local-proxy')||
        !Array.isArray(catalog.groups)||!Array.isArray(catalog.failures))
        return fail('proxy_not_routable','Original Host has no routable test Qwen provider')
      const group=catalog.groups.find((v:unknown)=>object(v)&&v.id==='llm-local-proxy')
      const g=mustObject(group,'proxy_catalog')
      if(!Array.isArray(g.models))return fail('proxy_catalog_unavailable','Missing test model group')
      const model=g.models.find((v:unknown)=>object(v)&&v.id==='Qwen3.8-Flash-Next')
      const m=mustObject(model,'proxy_model')
      const reasoning=object(m.reasoning)?m.reasoning:undefined
      const efforts=reasoning?.efforts
      if(efforts!==undefined&&(!Array.isArray(efforts)||
        !efforts.every((v:unknown)=>object(v)&&typeof v.id==='string')))
        return fail('bad_reasoning_metadata','Invalid test route reasoning effort metadata')
      return{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next',
        reasoningEfforts:Array.isArray(efforts)?efforts.map(v=>v.id as string):[],
        failures:catalog.failures.map((v:unknown)=>object(v)&&typeof v.id==='string'?v.id:'unknown'),
      }
    },
    async selectModel(sessionId,selection):Promise<GateModel>{
      const reply=mustObject(await rpc.selectModel(sessionId,selection),'select_model')
      return mustModel(reply.selected)
    },
    async replaceDefault(section,revision):Promise<GateDefault>{
      const response=mustObject(await rpc.replaceDefault(section,revision),'default_replace')
      if(!Number.isSafeInteger(response.revision)||!object(response.user))
        return fail('default_replace_unverified','Original Host did not return the expected namespace view')
      return{writable:true,revision:response.revision as number,
        user:structuredClone(response.user) as GateDefault['user'],
        effective:mustModel(response.value)}
    },
    settle,
  }
}
