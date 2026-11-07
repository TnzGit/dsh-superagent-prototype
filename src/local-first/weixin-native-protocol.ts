/** Direct Weixin iLink bot protocol. No OpenClaw runtime or plugin SDK. */
import { createHash, randomBytes } from 'node:crypto'
import type { Trigger } from '../core/index.ts'
import { key } from '../core/index.ts'

export const WEIXIN_SOURCE = 'weixin'
export const DEFAULT_BASE = 'https://ilinkai.weixin.qq.com'
export const WEIXIN_CLIENT_VERSION = '2.4.10'
export interface WeixinCredentials { token: string; baseUrl: string; botId?: string }
export interface UpdatePage { msgs?: unknown[]; get_updates_buf?: string; longpolling_timeout_ms?: number; ret?: number; errcode?: number; errmsg?: string }
/** Error code from an iLink response; plain field works with Node's TypeScript strip-only loader. */
export class WeixinProtocolError extends Error {
  readonly code?: number
  constructor(message: string, code?: number) { super(message); this.name = 'WeixinProtocolError'; this.code = code }
}
/** Reject anything except HTTPS; login-returned URLs still require validation. */
export function secureBase(input: string): string {
  const url = new URL(input)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port ||
    !(url.hostname === 'ilinkai.weixin.qq.com' || url.hostname.endsWith('.weixin.qq.com')))
    throw Error('Weixin base must be an approved Tencent HTTPS host')
  return url.origin + url.pathname.replace(/\/+$/, '')
}
function clientVersion(version: string): number {
  const [major=0,minor=0,patch=0]=version.split('.').map(x=>Number.parseInt(x,10)||0)
  return (major << 16)|(minor << 8)|patch
}
export const headers = (token?: string): Record<string,string> => ({
  'Content-Type':'application/json','AuthorizationType':'ilink_bot_token',
  'X-WECHAT-UIN':Buffer.from(String(randomBytes(4).readUInt32BE()),'utf8').toString('base64'),
  'iLink-App-Id':'bot','iLink-App-ClientVersion':String(clientVersion(WEIXIN_CLIENT_VERSION)),
  ...(token?{Authorization:'Bearer '+token}:{})
})
const metadata = () => ({channel_version:WEIXIN_CLIENT_VERSION,bot_agent:'dsh-superagent'})
function assertOk(result: {ret?: number;errcode?:number;errmsg?:string},action: string): void {
  const code=Number(result.ret ?? result.errcode ?? 0)
  if(code!==0 || Number(result.errcode ?? 0)!==0) throw new WeixinProtocolError('Weixin '+action+' refused: '+String(code),code)
}
/** Poll keeps the raw server cursor opaque. Caller persists it only AFTER all Triggers are durably received. */
export async function receivePage(creds: WeixinCredentials, cursor: string, signal: AbortSignal,
  fetcher: typeof fetch=fetch, waitMs=35_000): Promise<{messages:unknown[];cursor:string;waitMs:number}> {
  const timeout=AbortSignal.timeout(waitMs+5_000)
  const combined=AbortSignal.any([signal,timeout])
  let page: UpdatePage
  try {
    const res=await fetcher(secureBase(creds.baseUrl)+'/ilink/bot/getupdates',{
      method:'POST',redirect:'error',headers:headers(creds.token),
      body:JSON.stringify({get_updates_buf:cursor,base_info:metadata()}),signal:combined
    })
    if(!res.ok)throw new WeixinProtocolError('Weixin poll HTTP '+res.status)
    page=await res.json() as UpdatePage
  } catch(e) {
    if(signal.aborted)throw e
    if(timeout.aborted)return {messages:[],cursor,waitMs}
    throw e
  }
  assertOk(page,'poll')
  return {messages:Array.isArray(page.msgs)?page.msgs:[],cursor:page.get_updates_buf??cursor,
    waitMs:Number.isFinite(page.longpolling_timeout_ms)&&Number(page.longpolling_timeout_ms)>0
      ?Math.max(1000,Math.min(120000,Number(page.longpolling_timeout_ms))):waitMs}
}
const stringOf=(x:unknown): string | undefined => typeof x==='string'||typeof x==='number'?String(x):undefined
/** Discard bot echoes and partial updates, keep stable IDs and original context token for safe reply. */
export function messageToTrigger(input:unknown): Trigger | undefined {
  if(!input||typeof input!=='object'||Array.isArray(input))return
  const m=input as Record<string,unknown>
  const peer=typeof m.from_user_id==='string'?m.from_user_id:''
  if(!peer||stringOf(m.message_type)==='2'||stringOf(m.message_state)==='1'||m.group_id)return
  const items=Array.isArray(m.item_list)?m.item_list:[]
  const validItems=items.filter((x):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x))
  const id=stringOf(m.message_id)??stringOf(validItems.find(x=>stringOf(x.msg_id))?.msg_id)
  if(!id || id.length>256 || peer.length>256) return
  const contextToken=typeof m.context_token==='string'?m.context_token:undefined
  const textItem=validItems.find(x=>stringOf(x.type)==='1' && typeof (x.text_item as Record<string,unknown>|undefined)?.text==='string')
  const voiceItem=validItems.find(x=>stringOf(x.type)==='3' && typeof (x.voice_item as Record<string,unknown>|undefined)?.text==='string')
  const text=String((textItem?.text_item as Record<string,unknown>|undefined)?.text
    ?? (voiceItem?.voice_item as Record<string,unknown>|undefined)?.text
    ?? '[未支持的微信消息]')
  if(text.length>64000)return
  const at=Number(m.create_time_ms)
  const iso=Number.isFinite(at)&&at>0&&at<=8.64e15?new Date(at).toISOString():new Date().toISOString()
  const thread=WEIXIN_SOURCE+':'+peer
  return {id:key(WEIXIN_SOURCE,id),source:WEIXIN_SOURCE,
    threads:[{source:WEIXIN_SOURCE,id:thread}],actor:{source:WEIXIN_SOURCE,id:peer},
    human:true,addressed:'direct',at:iso,text,
    channel:{source:WEIXIN_SOURCE,thread,address:{peer,messageId:id,...contextToken?{contextToken}:{}}},
    meta:{peer,messageId:id,direct:true,...contextToken?{contextToken}:{}}}
}
/** Stable ID for the Outbox message: a retry reuses it instead of generating a fresh client_id. */
export function clientMessageId(outboxId:string):string {
  return 'dsh-'+createHash('sha256').update(outboxId).digest('hex').slice(0,32)
}
/** Weixin replies must use the context_token from the received message. Never log tokens. */
export async function sendText(creds:WeixinCredentials, outboxId:string, peer:string, contextToken:string, text:string,
  fetcher:typeof fetch=fetch):Promise<void> {
  if(!peer||!contextToken||!outboxId||!text.trim())throw Error('Weixin reply missing peer/token/id/text')
  const res=await fetcher(secureBase(creds.baseUrl)+'/ilink/bot/sendmessage',{
    method:'POST',redirect:'error',headers:headers(creds.token),
    body:JSON.stringify({msg:{from_user_id:'',to_user_id:peer,client_id:clientMessageId(outboxId),
      message_type:2,message_state:2,context_token:contextToken,
      item_list:[{type:1,text_item:{text}}]},base_info:metadata()}),
    signal:AbortSignal.timeout(60_000)
  })
  if(!res.ok)throw new WeixinProtocolError('Weixin send HTTP '+res.status)
  const body=await res.json() as {ret?:number;errcode?:number;errmsg?:string}
  assertOk(body,'send')
}
