/** Strict event-level correlation for a guarded existing DSH 3080 Session continuation.
 * Never assume that an accepted inbox message or the last Assistant text belongs
 * to our request: prove its original Session user/message.source.rpcId first.
 * This module does not send Weixin messages or touch a DSH Session itself.
 */
import { createHash } from 'node:crypto'
import type { OutboundMessage } from '../core/ports.ts'
import type { Trigger } from '../core/model.ts'
import { continuationRequestId } from './dsh-3080-bridge.ts'

type Obj=Record<string,unknown>
const obj=(value:unknown):value is Obj=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const seq=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0
const MAX_TEXT_BYTES=8000
const MAX_RECORDS=2000

/** The durable routing identity that a future caller must persist BEFORE prompt submission. */
export interface DshContinuationReceipt {
  /** Original Weixin Trigger ID in the Superagent store, not an arbitrary user-selected address. */
  triggerId:string
  /** Original DSH Workspace ID; never replaced by an isolated copy. */
  workspaceId:string
  sessionId:string
  requestId:string
  /** Exclusive DSH event cursor observed before the remote prompt was submitted. */
  afterSeq:number
}
/** Create immutable, deterministic correlation details without exposing contextToken. */
export function continuationReceipt(input:{
  triggerId:string;workspaceId:string;sessionId:string;afterSeq:number
}):DshContinuationReceipt {
  if(!input.triggerId||!input.workspaceId||!input.sessionId||!seq(input.afterSeq))
    throw Error('Cannot construct a DSH continuation receipt without exact identities and baseline')
  return {...input,requestId:continuationRequestId(input.sessionId,input.triggerId)}
}
export interface DshEventPage {
  cursor:number
  hasMore:boolean
  records:unknown[]
}
export interface DshWaitResult {
  reason:'idle'|'input-required'|'timeout'
  state:{cursor:number;active:boolean;running:boolean;pendingInput?:unknown[]}
  output:{records:unknown[];truncated:boolean}
}
export type DshContinuationResult =
  | { status:'completed';requestId:string;cursor:number;text:string;assistantSeq:number }
  | { status:'pending'|'blocked'|'ambiguous'|'failed';requestId:string;reason:string }

/** Convert a complete, read-only DSH page to a verifiable continuation outcome.
 * Events must include exactly the matching user-rpc source, no intervening
 * foreign user prompt and a completed turn. Nothing is sent on ambiguous output.
 */
export function correlateDshCompletion(receipt:DshContinuationReceipt,wait:DshWaitResult,
  page:DshEventPage):DshContinuationResult {
  const fail=(status:'pending'|'blocked'|'ambiguous'|'failed',reason:string):DshContinuationResult=>
    ({status,requestId:receipt.requestId,reason})
  if(!seq(receipt.afterSeq)||!seq(wait.state?.cursor)||!seq(page.cursor)||
    page.cursor!==wait.state.cursor||!Array.isArray(page.records)||page.records.length>MAX_RECORDS||
    typeof page.hasMore!=='boolean')
    return fail('ambiguous','invalid_or_mismatched_session_cursor')
  if(wait.reason==='input-required'||wait.state.pendingInput?.length)
    return fail('blocked','target_session_requires_human_input')
  if(wait.reason!=='idle'||wait.state.running)
    return fail('pending','session_not_idle')
  const events:{seq:number;type:string;data:Obj;surfaceOp:unknown}[]=[]
  for(const entry of page.records){
    if(!obj(entry)||entry.type!=='event'||!obj(entry.event)||!seq(entry.event.seq)||
       typeof entry.event.type!=='string'||!obj(entry.event.data))
      return fail('ambiguous','invalid_dsh_history_event')
    const e=entry.event
    if(e.seq>page.cursor)return fail('ambiguous','history_event_after_read_cut')
    if(e.seq>receipt.afterSeq)events.push({seq:e.seq,type:e.type,data:e.data,surfaceOp:e.surfaceOp})
  }
  events.sort((a,b)=>a.seq-b.seq)
  if(events.some((e,i)=>i>0&&events[i-1]!.seq===e.seq))
    return fail('ambiguous','duplicate_history_event_seq')
  if(page.hasMore&&events.length>0&&events[0]!.seq>receipt.afterSeq+1)
    return fail('ambiguous','history_page_does_not_cover_original_request')
  let seen=false,completed=false,text='',assistantSeq=-1
  for(const event of events){
    if(event.type==='user/message'){
      // A user message may have its source directly as event.data.source (normal DSH
      // wire shape). Treat any concurrent human input as an ambiguous response.
      const source=event.data.source
      const id=obj(source)&&typeof source.rpcId==='string'?source.rpcId:undefined
      if(id!==receipt.requestId||seen)
        return fail('ambiguous','unrelated_user_message_in_continuation_window')
      seen=true
      continue
    }
    if(!seen) {
      if(event.type==='assistant/message'||event.type==='turn/end')
        return fail('ambiguous','unrelated_assistant_turn_before_matching_request')
      continue
    }
    if(event.type==='assistant/message'){
      if(event.surfaceOp!=='append')return fail('ambiguous','non_append_assistant_surface_event')
      const message=event.data.message
      if(!obj(message)||!Array.isArray(message.content))
        return fail('ambiguous','assistant_content_unavailable')
      const chunks:string[]=[]
      for(const block of message.content){
        if(!obj(block)||typeof block.type!=='string')
          return fail('ambiguous','unsupported_assistant_block')
        if(block.type==='text'){
          if(typeof block.text!=='string')return fail('ambiguous','invalid_assistant_text')
          chunks.push(block.text)
        }
      }
      // A later Assistant message supersedes intermediate tool/progress steps.
      const visible=chunks.join('\n').trim()
      if(visible) {text=visible;assistantSeq=event.seq}
      continue
    }
    if(event.type==='turn/end'){
      const reason=event.data.reason
      if(!obj(reason)||typeof reason.kind!=='string')
        return fail('ambiguous','unknown_turn_end_reason')
      if(reason.kind!=='completed')return fail('failed','target_turn_'+reason.kind)
      completed=true
    }
  }
  if(!seen)return fail('pending','matching_user_rpc_not_committed')
  if(!completed)return fail('pending','target_turn_not_completed')
  if(!text||assistantSeq<0)return fail('blocked','no_deliverable_assistant_text')
  if(Buffer.byteLength(text,'utf8')>MAX_TEXT_BYTES)
    return fail('blocked','assistant_text_exceeds_channel_budget')
  return{status:'completed',requestId:receipt.requestId,cursor:page.cursor,text,assistantSeq}
}
/** Construct one idempotent Weixin Outbox reply only after correlation and
 * from the actual original stored Trigger. Does NOT enqueue/send it.
 * The existing Source's context token, peer and message ID remain unchanged.
 */
export function continuationWeixinReply(trigger:Trigger,receipt:DshContinuationReceipt,
  outcome:DshContinuationResult):OutboundMessage {
  if(outcome.status!=='completed'||outcome.requestId!==receipt.requestId||
    trigger.id!==receipt.triggerId||trigger.source!=='weixin'||!trigger.human||
    !trigger.channel||trigger.channel.source!=='weixin'||
    !trigger.channel.address.peer||!trigger.channel.address.messageId||
    !trigger.channel.address.contextToken)
    throw Error('Cannot deliver DSH continuation to an unverified Weixin Trigger/Channel')
  const id='dsh-3080-reply-'+createHash('sha256').update(receipt.requestId+'|'+trigger.id).digest('hex').slice(0,40)
  return{id,channel:structuredClone(trigger.channel),text:outcome.text,kind:'reply'}
}
