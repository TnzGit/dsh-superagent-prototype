/** Default-OFF native Weixin ingress -> original DSH 3080 Session relay.
 * It consumes ONLY a one-shot operator-approved, exact-hash Weixin message.
 * All unrelated Weixin messages remain on the existing DSH Engine chat route.
 * The original 3080's LAN listener/auth, Workspaces and history are untouched.
 */
import type {Trigger} from '../core/index.ts'
import type {Store} from '../app/store.ts'
import type {Effects} from '../app/effects.ts'
import {Later} from '../app/later.ts'
import type {Outbox} from '../app/outbox.ts'
import type {ExistingDshProject} from './existing-dsh-projects.ts'
import {Dsh3080Bridge} from './dsh-3080-bridge.ts'
import {trackDshContinuation} from './dsh-3080-output.ts'
import {DshRelayStore,weixinContextFresh,MAX_RELAY_CONTEXT_AGE_MS} from './dsh-relay-store.ts'
import {chooseApprovedNativeRelay,routeAttested,type NativeRelayApproval} from './dsh-relay-routing.ts'

export interface NativeRelayCoordinatorHost {
  store:Store
  effects:Effects
  outbox:Outbox
  projects:readonly ExistingDshProject[]
  approval:NativeRelayApproval
  /** Must check BOTH native Weixin Source allowlist and DSH Policy member list. */
  authorized(trigger:Trigger):boolean
  /** Optional mock network transport for isolated unit tests only. */
  fetcher?:typeof fetch
}
/** Owns the one-shot approval, durable source receipt, read-only output tracking and Outbox handoff.
 * The caller must never instantiate this class without an operator-owned grant file.
 */
export class NativeRelayCoordinator {
  readonly ledger:DshRelayStore
  private readonly bridge:Dsh3080Bridge
  private readonly host:NativeRelayCoordinatorHost
  constructor(host:NativeRelayCoordinatorHost) {
    this.host=host
    this.ledger=new DshRelayStore(host.store)
    this.bridge=new Dsh3080Bridge({
      explicitlyEnabled:host.approval.operatorApproved,
      allowedSessionIds:[host.approval.sessionId],
      approvedModel:{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next'},
      queueProxyVerified:!!host.approval.routeAttestationFile,
      verifyRoute:async()=>routeAttested(host.approval.routeAttestationFile,host.approval.sessionId),
      ...(host.fetcher?{fetcher:host.fetcher}:{})
    })
    host.effects.handle('dsh-relay',async(payload)=>this.process(payload.triggerId),{
      limit:()=>1,retry:[3000,30_000],ordered:true,quiet:true
    })
  }
  /** First-line router: never alters normal chat unless an exact one-shot signed-off grant matches.
   * Store Trigger+approval+effect in ONE local SQLite transaction BEFORE advancing Weixin cursor.
   */
  receive(trigger:Trigger):boolean {
    const {store,effects,projects,approval}=this.host
    if(!this.host.authorized(trigger)||!weixinContextFresh(trigger,Date.now()))return false
    const chosen=chooseApprovedNativeRelay(trigger,approval,projects,this.ledger)
    if(!chosen)return false
    return store.atomic(()=>{
      if(store.triggers.get(trigger.id))return true
      // Do not route a message into both the ordinary Engine evaluation and 3080.
      if(!this.ledger.claimApproval(approval.approvalId,trigger.id)){
        // Identical follow-on messages do not reuse the one-shot approval and
        // must not accidentally become a second ordinary Engine Worker task.
        store.triggers.save(trigger)
        store.triggers.saveDisposition(trigger.id,{fanout:[],at:new Date().toISOString()})
        return true
      }
      store.triggers.save(trigger)
      store.triggers.saveDisposition(trigger.id,{fanout:[],at:new Date().toISOString()})
      if(chosen.operation==='bind'){
        this.ledger.confirmBinding(trigger,chosen.project,chosen.sessionId,true)
        const message=this.bindingAcknowledgement(trigger)
        this.host.outbox.send(message)
      }else {
        effects.enqueue('dsh-relay',trigger.id,{triggerId:trigger.id})
      }
      return true
    })
  }
  private bindingAcknowledgement(trigger:Trigger){
    return{
      id:'dsh-binding-'+trigger.id,kind:'notice' as const,
      channel:{...trigger.channel!,address:{...trigger.channel!.address,
        expiresAt:new Date(Date.parse(trigger.at)+MAX_RELAY_CONTEXT_AGE_MS).toISOString()}},
      text:'已确认：此微信会话已绑定到指定的原 DSH 项目与 Session；后续续做仍需逐次授权。'
    }
  }
  /** Recover only by reading the original Session after a crash. Never repeat
   * an uncertain HTTP admission automatically, even with a stable request ID.
   */
  private async process(triggerId:string):Promise<void> {
    const {store,approval,projects}=this.host
    const trigger=store.triggers.get(triggerId)
    if(!trigger)throw Error('Original Weixin Trigger disappeared from 3083 SQLite')
    if(!this.host.authorized(trigger))throw Error('Native Weixin peer/Policy authorization revoked')
    const selection=chooseApprovedNativeRelay(trigger,approval,projects,this.ledger)
    const existing=this.ledger.byTrigger(triggerId)
    if(!existing&&!selection)return
    if(existing&&['completed','reply-expired','review-required'].includes(existing.status))return
    let receipt=existing
    if(!receipt) {
      if(!selection||selection.operation!=='prompt')return
      // The HTTP send can be delayed by restart/effect queue; do not submit
      // after the ORIGINAL Weixin reply context has become stale.
      if(!weixinContextFresh(trigger,Date.now()))return
      // No new prompts after the one-shot authorization expires, even if queued.
      if(Date.now()>=Date.parse(approval.expiresAt))return
      if(!routeAttested(approval.routeAttestationFile,selection.sessionId))
        throw new Later('Awaiting explicit, fresh one-slot 8123 route attestation')
      try{
        const accepted=await this.bridge.submit({
          project:selection.project,sessionId:selection.sessionId,
          sourceMessageId:triggerId,text:selection.task,operatorApproved:true,
          persistBeforeSend:async before=>{
            if(before.triggerId!==triggerId||before.sessionId!==selection.sessionId||
              before.workspaceId!==selection.project.workspaceId)
              throw Error('Refusing mismatched pre-prompt correlation receipt')
            this.ledger.reserve(trigger,selection.project,selection.sessionId,before.afterSeq)
          }
        })
        this.ledger.admitted(accepted.requestId)
      }catch(error){
        const durable=this.ledger.byTrigger(triggerId)
        if(durable)this.ledger.uncertain(durable.requestId)
        // No retry if the network may have already delivered the prompt.
        if(!durable)throw error
      }
      receipt=this.ledger.byTrigger(triggerId)
    }
    if(!receipt)return
    // Never poll for days and accidentally attach an old Weixin context.
    // Expired results are review-only and must use a fresh human request.
    if(Date.now()-Date.parse(receipt.createdAt)>15*60*1000){
      this.ledger.reviewRequired(receipt.requestId)
      return
    }
    const result=await trackDshContinuation(this.bridge,receipt)
    if(result.status==='pending')throw new Later('Original DSH Session result not yet committed')
    if(result.status!=='completed'){
      this.ledger.reviewRequired(receipt.requestId)
      return
    }
    this.ledger.enqueueCompletion(receipt,result,this.host.outbox)
  }
}
