/** Staging-only durable relay ledger for original DSH 3080 Workspaces/Sessions.
 * Tables are created ONLY by explicit construction; this does not touch the original host.
 */
import {createHash} from 'node:crypto'
import type {DatabaseSync} from 'node:sqlite'
import type {Trigger,OutboundMessage} from '../core/index.ts'
import type {ExistingDshProject} from './existing-dsh-projects.ts'
import {continuationReceipt,continuationWeixinReply,type DshContinuationReceipt,
  type DshContinuationResult} from './dsh-3080-output.ts'

const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
export type RelayStatus='prepared'|'admitted'|'uncertain'|'completed'|'reply-expired'
export interface RelayRecord extends DshContinuationReceipt {
  status:RelayStatus
  textHash:string
  createdAt:string
  updatedAt:string
  outboxId?:string
}
export interface ConfirmedBinding {
  thread:string;peer:string;hostId:string;projectId:string
  workspaceId:string;sessionId:string;confirmedTriggerId:string;confirmedAt:string
}
export interface RelayStorageHost {
  db:Pick<DatabaseSync,'exec'|'prepare'>
  atomic<T>(run:()=>T):T
  triggers:{get(id:string):Trigger|undefined}
}
/** Conservative upper bound on a relay reply's original inbound context token age.
 * iLink does not promise this is its true TTL; earlier server expiry is still possible.
 */
export const MAX_RELAY_CONTEXT_AGE_MS=5*60*1000
/** Never silently borrow the contextToken from a later unrelated Weixin message. */
export function weixinContextFresh(trigger:Trigger,nowMs:number):boolean {
  const at=Date.parse(trigger.at)
  return trigger.source==='weixin'&&trigger.human&&trigger.channel?.source==='weixin'&&
    !!trigger.channel.address.peer&&!!trigger.channel.address.messageId&&
    !!trigger.channel.address.contextToken&&Number.isFinite(at)&&
    Number.isFinite(nowMs)&&at<=nowMs&&nowMs-at<=MAX_RELAY_CONTEXT_AGE_MS
}
/** SQLite-backed per-Weixin-thread binding and durable pre-prompt relay receipts.
 * Existing prepared/admitted/uncertain rows are READ for reconciliation after restart,
 * never automatically resubmitted into 3080.
 */
export class DshRelayStore {
  constructor(private readonly host:RelayStorageHost) {
    host.db.exec(
      'CREATE TABLE IF NOT EXISTS dsh_relay_binding (thread TEXT PRIMARY KEY,value TEXT NOT NULL);'+
      'CREATE TABLE IF NOT EXISTS dsh_relay_receipt (request_id TEXT PRIMARY KEY,'+
      'trigger_id TEXT NOT NULL UNIQUE,value TEXT NOT NULL);'
    )
  }
  /** Bind the precise original Session only after a persisted, human-confirmed Weixin Trigger. */
  confirmBinding(trigger:Trigger,project:ExistingDshProject,sessionId:string,
    explicitlyConfirmed:boolean):ConfirmedBinding {
    if(!explicitlyConfirmed||!project.sessionIds.includes(sessionId)||
      trigger.source!=='weixin'||!trigger.human||trigger.channel?.source!=='weixin'||
      !trigger.channel.address.peer||trigger.channel.thread!==trigger.threads[0]?.id)
      throw Error('Cannot bind an unconfirmed Weixin thread to an original DSH Session')
    return this.host.atomic(()=>{
      const original=this.host.triggers.get(trigger.id)
      if(!original||original.source!==trigger.source||
        original.actor.id!==trigger.channel!.address.peer||original.channel?.thread!==trigger.channel!.thread)
        throw Error('Original confirmation was not ingested by the native Weixin Source')
      const binding:ConfirmedBinding={
        thread:trigger.channel!.thread,peer:trigger.channel!.address.peer,
        hostId:project.hostId,projectId:project.projectId,workspaceId:project.workspaceId,
        sessionId,confirmedTriggerId:trigger.id,confirmedAt:new Date().toISOString()
      }
      this.host.db.prepare('INSERT INTO dsh_relay_binding(thread,value) VALUES(?,?) ON CONFLICT(thread) DO UPDATE SET value=excluded.value')
        .run(binding.thread,JSON.stringify(binding))
      return binding
    })
  }
  /** Look up only the same peer/thread and a catalog-current original Workspace/Session. */
  boundProject(trigger:Trigger,projects:readonly ExistingDshProject[]):{project:ExistingDshProject;sessionId:string}|undefined {
    if(trigger.source!=='weixin'||trigger.channel?.source!=='weixin'||
      !trigger.channel.address.peer||trigger.channel.thread!==trigger.threads[0]?.id)return
    const row=this.host.db.prepare('SELECT value FROM dsh_relay_binding WHERE thread=?').get(trigger.channel.thread)
    if(!row)return
    const binding=JSON.parse(String(row.value)) as ConfirmedBinding
    if(binding.thread!==trigger.channel.thread||
      binding.peer!==trigger.actor.id||binding.peer!==trigger.channel.address.peer)return
    const project=projects.find(p=>p.hostId===binding.hostId&&p.projectId===binding.projectId&&
      p.workspaceId===binding.workspaceId&&p.sessionIds.includes(binding.sessionId))
    return project?{project,sessionId:binding.sessionId}:undefined
  }
  /** Permanent per-trigger dedupe, even if a DSH prompt's HTTP outcome was uncertain. */
  byTrigger(id:string):RelayRecord|undefined {
    const row=this.host.db.prepare('SELECT value FROM dsh_relay_receipt WHERE trigger_id=?').get(id)
    return row?JSON.parse(String(row.value)) as RelayRecord:undefined
  }
  get(id:string):RelayRecord|undefined {
    const row=this.host.db.prepare('SELECT value FROM dsh_relay_receipt WHERE request_id=?').get(id)
    return row?JSON.parse(String(row.value)) as RelayRecord:undefined
  }
  /** Transactionally persist exact original Trigger and DSH cursor BEFORE sending.
   * Any prior record for the same Trigger rejects retransmission and must be reconciled.
   */
  reserve(trigger:Trigger,project:ExistingDshProject,sessionId:string,afterSeq:number):RelayRecord {
    if(!project.sessionIds.includes(sessionId)||trigger.source!=='weixin'||
      !trigger.human||trigger.channel?.source!=='weixin'||!trigger.channel.address.contextToken)
      throw Error('Invalid original Weixin Trigger/DSH Session relay target')
    return this.host.atomic(()=>{
      const original=this.host.triggers.get(trigger.id)
      if(!original||original.actor.id!==trigger.actor.id||original.text!==trigger.text||
        original.channel?.address.messageId!==trigger.channel!.address.messageId)
        throw Error('Relay Trigger does not match the original persisted Source message')
      if(this.byTrigger(trigger.id))
        throw Error('Relay receipt exists; reconcile original request before retry')
      const receipt=continuationReceipt({triggerId:trigger.id,workspaceId:project.workspaceId,sessionId,afterSeq})
      const now=new Date().toISOString()
      const row:RelayRecord={...receipt,status:'prepared',textHash:hash(trigger.text),createdAt:now,updatedAt:now}
      this.host.db.prepare('INSERT INTO dsh_relay_receipt(request_id,trigger_id,value) VALUES(?,?,?)')
        .run(row.requestId,row.triggerId,JSON.stringify(row))
      return row
    })
  }
  /** Record an affirmative DSH inbox admission. */
  admitted(id:string):RelayRecord {
    return this.update(id,row=>row.status==='prepared'?{...row,status:'admitted'}:row)
  }
  /** Record an ambiguous network result without triggering an automatic retry. */
  uncertain(id:string):RelayRecord {
    return this.update(id,row=>row.status==='prepared'?{...row,status:'uncertain'}:row)
  }
  /** Recover unresolved receipts read-only; NEVER auto-resend a prepared record. */
  unresolved():RelayRecord[] {
    return this.host.db.prepare('SELECT value FROM dsh_relay_receipt ORDER BY rowid').all()
      .map(row=>JSON.parse(String(row.value)) as RelayRecord)
      .filter(row=>['prepared','admitted','uncertain'].includes(row.status))
  }
  /** Atomically enqueue verified completion through the existing Outbox and mark its status.
   * Cannot send a reply if the original Weixin context is too old to trust.
   */
  enqueueCompletion(receipt:DshContinuationReceipt,outcome:DshContinuationResult,
    outbox:{send(message:OutboundMessage):void},nowMs=Date.now()):
    {status:'enqueued'|'expired'|'already-enqueued';outboxId?:string} {
    if(outcome.status!=='completed'||outcome.requestId!==receipt.requestId)
      throw Error('Only a completed and exactly correlated DSH result is deliverable')
    return this.host.atomic(()=>{
      const row=this.get(receipt.requestId)
      if(!row||row.triggerId!==receipt.triggerId||row.workspaceId!==receipt.workspaceId||
        row.sessionId!==receipt.sessionId||row.afterSeq!==receipt.afterSeq)
        throw Error('No original durable relay receipt for the requested reply')
      if(row.status==='completed')return{status:'already-enqueued',outboxId:row.outboxId}
      if(row.status==='reply-expired')return{status:'expired'}
      const original=this.host.triggers.get(receipt.triggerId)
      if(!original)throw Error('Original Weixin Trigger is no longer stored')
      if(!weixinContextFresh(original,nowMs)) {
        this.write({...row,status:'reply-expired',updatedAt:new Date(nowMs).toISOString()})
        return{status:'expired'}
      }
      const message=continuationWeixinReply(original,receipt,outcome)
      message.channel.address.expiresAt=
        new Date(Date.parse(original.at)+MAX_RELAY_CONTEXT_AGE_MS).toISOString()
      outbox.send(message)
      this.write({...row,status:'completed',outboxId:message.id,
        updatedAt:new Date(nowMs).toISOString()})
      return{status:'enqueued',outboxId:message.id}
    })
  }
  private update(id:string,modify:(row:RelayRecord)=>RelayRecord):RelayRecord {
    return this.host.atomic(()=>{
      const old=this.get(id)
      if(!old)throw Error('Unknown original DSH relay')
      const next=modify(old)
      if(next!==old)this.write({...next,updatedAt:new Date().toISOString()})
      return next
    })
  }
  private write(row:RelayRecord):void {
    this.host.db.prepare('UPDATE dsh_relay_receipt SET value=? WHERE request_id=?').run(JSON.stringify(row),row.requestId)
  }
}
