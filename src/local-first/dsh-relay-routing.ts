/** One-shot, operator-approved native Weixin -> original DSH 3080 selection.
 * Exact text hashes and original Session allowlists are independent of any LLM.
 * A selected Workspace is never silently treated as a selected historical Session.
 */
import {createHash} from 'node:crypto'
import {lstatSync,readFileSync} from 'node:fs'
import {isAbsolute} from 'node:path'
import type {Trigger} from '../core/index.ts'
import {chooseExistingDshProject,type ExistingDshProject} from './existing-dsh-projects.ts'
import type {DshRelayStore} from './dsh-relay-store.ts'

const id=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=256
export const textHash=(text:string):string=>createHash('sha256').update(text).digest('hex')
/** Private operator-approved, exactly-one-message grant. It cannot be supplied by Weixin text. */
export interface NativeRelayApproval {
  version:1
  approvalId:string
  operation:'prompt'|'bind'
  peer:string
  projectId:string
  sessionId:string
  textSha256:string
  expiresAt:string
  operatorApproved:true
  /** For an approved test prompt, caller separately verifies a recent route attestation. */
  routeAttestationFile?:string
}
/** Read 0600 file ONLY when the operator sets an explicit staging environment variable. */
export function readNativeRelayApproval(file=process.env.DSH_SUPERAGENT_DSH_RELAY_APPROVAL_FILE):NativeRelayApproval|undefined {
  if(!file)return
  if(!isAbsolute(file))throw Error('Native DSH relay approval path must be absolute')
  const stat=lstatSync(file)
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
    throw Error('Native DSH relay approval must be an owner-only non-symlink file')
  const p=JSON.parse(readFileSync(file,'utf8')) as NativeRelayApproval
  if(p.version!==1||p.operatorApproved!==true||!['prompt','bind'].includes(p.operation)||
    !id(p.approvalId)||!id(p.peer)||!id(p.projectId)||!id(p.sessionId)||
    !/^[a-f0-9]{64}$/.test(p.textSha256)||!Number.isFinite(Date.parse(p.expiresAt))||
    (p.routeAttestationFile!==undefined&&(!isAbsolute(p.routeAttestationFile)||p.operation!=='prompt')))
    throw Error('Invalid operator-approved DSH relay grant')
  return p
}
export interface NativeRelaySelection {
  operation:'prompt'|'bind'
  project:ExistingDshProject
  sessionId:string
  /** Strip explicit router command lines when forwarding an authorized task. */
  task:string
}
/** Select only from the validated catalog and an already human-confirmed binding
 * or an explicit Session selector. Never use similarity or recent Session activity.
 */
export function chooseApprovedNativeRelay(trigger:Trigger,approval:NativeRelayApproval,
  projects:readonly ExistingDshProject[],ledger:Pick<DshRelayStore,'boundProject'>,
  nowMs=Date.now()):NativeRelaySelection|undefined {
  if(trigger.source!=='weixin'||!trigger.human||!trigger.addressed||
    trigger.actor.id!==approval.peer||trigger.channel?.address.peer!==approval.peer||
    trigger.channel.source!=='weixin'||!trigger.channel.address.contextToken||
    approval.operatorApproved!==true||textHash(trigger.text)!==approval.textSha256||
    !Number.isFinite(nowMs)||nowMs>=Date.parse(approval.expiresAt))return
  const project=projects.find(p=>p.projectId===approval.projectId&&
    p.sessionIds.includes(approval.sessionId))
  if(!project)return
  const lines=trigger.text.split(/\r?\n/).map(v=>v.trim())
  if(approval.operation==='bind'){
    const match=/^\/bind-project\s+([a-z0-9][a-z0-9_-]{0,63})\s+(\S{1,256})\s*$/.exec(lines[0]??'')
    if(!match||match[1]!==project.projectId||match[2]!==approval.sessionId)return
    return{operation:'bind',project,sessionId:approval.sessionId,task:''}
  }
  const prior=ledger.boundProject(trigger,projects)
  const selected=chooseExistingDshProject(trigger.text,projects,prior?.project.projectId)
  if(selected.kind!=='existing'||selected.projectId!==project.projectId)return
  const sessionMatch=/^\/session\s+(\S{1,256})$/.exec(lines[1]??'')
  const explicitSession=sessionMatch?.[1]
  // The confirmed-thread route must remain anchored to its exact Session.
  if(selected.evidence==='confirmed-thread'&&prior?.sessionId!==approval.sessionId)return
  if(explicitSession!==undefined&&explicitSession!==approval.sessionId)return
  if(!prior&&project.sessionIds.length>1&&explicitSession!==approval.sessionId)return
  if(prior&&prior.sessionId!==approval.sessionId&&explicitSession!==approval.sessionId)return
  const task=(lines[0]?.startsWith('/project')||lines[0]?.startsWith('项目：')
    ?lines.slice(explicitSession?2:1).join('\n'):trigger.text).trim()
  if(!task||task.length>16000)return
  return{operation:'prompt',project,sessionId:approval.sessionId,task}
}
/** Independently operator-attested local one-slot proxy route. Static attestation
 * cannot replace real host observation; expiry limits stale authorization.
 */
export interface DshRouteAttestation {
  version:1;sessionId:string;provider:'llm-local-proxy'
  model:'Qwen3.8-Flash-Next';baseURL:'http://127.0.0.1:8123/v1'
  verifiedAt:string;operatorObserved:true
}
export function routeAttested(file:string|undefined,sessionId:string,nowMs=Date.now()):boolean {
  if(!file||!isAbsolute(file))return false
  try {
    const stat=lstatSync(file)
    if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)return false
    const a=JSON.parse(readFileSync(file,'utf8')) as DshRouteAttestation
    const at=Date.parse(a.verifiedAt)
    return a.version===1&&a.sessionId===sessionId&&a.provider==='llm-local-proxy'&&
      a.model==='Qwen3.8-Flash-Next'&&a.baseURL==='http://127.0.0.1:8123/v1'&&
      a.operatorObserved===true&&Number.isFinite(at)&&at<=nowMs&&nowMs-at<=5*60*1000
  }catch{return false}
}
