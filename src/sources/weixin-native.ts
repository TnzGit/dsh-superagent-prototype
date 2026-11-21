/** Native Weixin Source: iLink polling and replies, directly inside DSH. Never loads OpenClaw. */
import { createHash } from 'node:crypto'
import { readFileSync, lstatSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import type { OutboundMessage, Trigger } from '../core/index.ts'
import { threadKey } from '../core/index.ts'
import { KV } from '../kv.ts'
import type { SourceKind } from './kind.ts'
import { sourceContext, type SourceContext } from './host.ts'
import { pause } from './poll.ts'
import { messageToTrigger, receivePage, sendText, WEIXIN_SOURCE, secureBase, type WeixinCredentials } from '../local-first/weixin-native-protocol.ts'

const ConfigSchema=z.object({
  allowedPeers:z.array(z.object({id:z.string().trim().min(1).max(256)}).strict()).default([])
    .refine(values=>new Set(values.map(v=>v.id)).size===values.length,'Duplicate Weixin peer'),
}).strict()
type Config=z.infer<typeof ConfigSchema>
const IDENTITY=z.object({id:z.string().trim().min(1).max(256),name:z.string().trim().max(100).optional()}).strict()
const PolicySchema=z.object({allowed:z.array(IDENTITY).default([])}).strict()

/** Credentials must live in an operator-controlled file outside this repository and existing OpenClaw profiles. */
export function readNativeCredentials(file=process.env.DSH_WEIXIN_NATIVE_CREDENTIALS_FILE): WeixinCredentials|undefined {
  if(!file)return undefined
  if(!isAbsolute(file)) throw Error('Weixin credentials path must be absolute')
  const stat=lstatSync(file)
  if(!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)!==0)
    throw Error('Weixin credentials must be an owner-only regular file, not a symlink')
  const data=z.object({token:z.string().min(16),baseUrl:z.string(),botId:z.string().optional()}).strict()
    .parse(JSON.parse(readFileSync(file,'utf8')))
  return {...data,baseUrl:secureBase(data.baseUrl)}
}
/** Strict source allowlist is enforced before a Trigger can enter DSH evaluation. */
export function canReceive(config:Config, peer:string): boolean {
  return config.allowedPeers.some(row=>row.id===peer)
}
/** The operator has to configure source-level and DSH policy allowlists independently. */
export const nativeWeixinKind: SourceKind<Config>={
  kind:WEIXIN_SOURCE,
  title:{zh:'微信（DSH 原生）',en:'Weixin (DSH native)'},
  description:{zh:'无需 OpenClaw。通过操作者扫码生成的本机凭据直接长轮询微信 iLink 私聊。',
    en:'Direct iLink private messages using operator-controlled local credentials. No OpenClaw.'},
  schema:ConfigSchema,
  health:[WEIXIN_SOURCE],
  fields:[{key:'allowedPeers',type:'rows',label:{zh:'允许收件人（微信 peer ID）',en:'Allowed Weixin peers'},
    columns:[{key:'id',type:'text',label:{zh:'Peer ID',en:'Peer ID'}}]}],
  scope:({meta},config)=>canReceive(config,typeof meta.peer==='string'?meta.peer:'')
    ?{listened:true,observed:false,row:'direct'}:{listened:false,reason:'weixin_peer_not_allowed'},
  channel:{
    allowed:(address,config)=>typeof address.peer==='string' && canReceive(config,address.peer),
    send:async(_ctx,message:OutboundMessage)=>{
      // Only Stage C3 relay replies carry expiresAt. Never use a later unrelated
      // Weixin Trigger's token after expiry; mark the old Outbox receipt gone.
      const expiresAt=message.channel.address.expiresAt
      if(expiresAt!==undefined){
        const cut=Date.parse(expiresAt)
        if(!Number.isFinite(cut)||Date.now()>=cut)return 'gone'
      }
      const creds=readNativeCredentials()
      if(!creds)throw Error('Weixin credentials are not configured')
      const {peer,contextToken}=message.channel.address
      if(!peer || !contextToken)throw Error('Cannot reply without the original Weixin context token')
      await sendText(creds,message.id,peer,contextToken,message.text)
      return 'sent'
    },
    link:()=>({url:'',label:{zh:'微信私聊',en:'Weixin direct message'}}),
  },
  threadContext:{
    messageId:trigger=>String(trigger.meta.messageId??''),
    read:async(_commands,trigger,part)=>{
      const peer=String(trigger.meta.peer??'')
      const messages=part==='parent'?[]:[{id:String(trigger.meta.messageId??''),from:peer,at:trigger.at,text:trigger.text}]
      return {messages,body:{messages,status:messages.length?'available':'unavailable'},status:messages.length?'available':'unavailable'}
    },
  },
  policy:{
    schema:PolicySchema,
    fields:[{key:'allowed',type:'rows',label:{zh:'允许发起工作的人',en:'Authorized operators'},
      columns:[{key:'id',type:'text',label:{zh:'微信 peer ID',en:'Weixin peer ID'}},
        {key:'name',type:'text',label:{zh:'备注',en:'Name'},optional:true}]}],
    explicit:{zh:'明确允许的微信私聊请求。',en:'An explicitly allowlisted private request.'},
    rows:()=>[{id:'direct',label:{zh:'私聊',en:'Direct'},note:{zh:'只接受白名单',en:'Allowlisted only'},
      cells:{listedUnaddressed:false,unlistedAddressed:true,unlistedUnaddressed:false}}],
  },
}
export const name='dsh-superagent-weixin-native'
export const inject=['orchestrator']
/** Registers the Source but starts no network traffic when disabled. */
export function apply(ctx:Context):void {
  ctx.effect(()=>ctx.orchestrator.sources.register(nativeWeixinKind),'weixin native source')
  ctx.effect(()=>{
    const controller=new AbortController()
    const source=sourceContext(ctx.orchestrator,nativeWeixinKind)
    const route=(trigger:Trigger)=>ctx.orchestrator.routeNativeWeixin?.(trigger)??false
    const running=pollNativeWeixin(source,controller.signal,route).catch(error=>source.report(WEIXIN_SOURCE,
      {state:'error',detail:'Weixin loop failed: '+(error instanceof Error?error.name:'unknown')}))
    return async()=>{controller.abort();await running}
  },'weixin native poll')
}
/** Serial long polling; cursors commit only after acknowledged DSH ingestion. */
export async function pollNativeWeixin(ctx:SourceContext, signal:AbortSignal,
  route?:(trigger:Trigger)=>boolean|Promise<boolean>):Promise<void> {
  await ctx.ready
  let timeoutMs=35000,failures=0,accountHash=''
  while(!signal.aborted) {
    const config=ctx.config<Config>(WEIXIN_SOURCE)
    if(!config || !ctx.configured()){
      ctx.report(WEIXIN_SOURCE,{state:'paused',detail:!config?'Source disabled':'Waiting for DSH setup'})
      await pause(2500,signal);continue
    }
    let creds:WeixinCredentials|undefined
    try{creds=readNativeCredentials()}
    catch{
      ctx.report(WEIXIN_SOURCE,{state:'error',detail:'Invalid local Weixin credentials or owner-only file permissions'})
      await pause(5000,signal);continue
    }
    if(!creds){ctx.report(WEIXIN_SOURCE,{state:'paused',detail:'Awaiting operator QR authorization'});await pause(2500,signal);continue}
    const hash=createHash('sha256').update(creds.token).digest('hex')
    if(hash!==accountHash){
      accountHash=hash
      if(ctx.state.get(KV.weixin.nativeAccount)!==hash){
        ctx.state.set(KV.weixin.nativeCursor,undefined)
        ctx.state.set(KV.weixin.nativeAccount,hash)
      }
    }
    try{
      const page=await receivePage(creds,ctx.state.get(KV.weixin.nativeCursor)??'',signal,fetch,timeoutMs)
      for(const input of page.messages){
        if(signal.aborted)return
        const trigger=messageToTrigger(input)
        if(!trigger || !canReceive(config,String(trigger.meta.peer??'')))continue
        // Only a strictly approved, already-persisted one-shot relay bypasses
        // the default Engine. Never execute the same Trigger twice.
        const handled=route?await route(trigger):false
        if(!handled)await ctx.receive(trigger)
        for(const ref of trigger.threads)ctx.threads.describe(threadKey(ref),
          {facts:{conversation:{value:{zh:'微信私聊',en:'Weixin direct'}}}})
      }
      if(page.cursor!==ctx.state.get(KV.weixin.nativeCursor))ctx.state.set(KV.weixin.nativeCursor,page.cursor)
      timeoutMs=page.waitMs;failures=0
      ctx.report(WEIXIN_SOURCE,{state:'ready',detail:'Weixin iLink long poll connected',at:new Date().toISOString()})
    }catch(error){
      if(signal.aborted)return
      failures++
      const expired=error instanceof Error && 'code' in error && (error as {code?:number}).code===-14
      ctx.report(WEIXIN_SOURCE,{state:'error',detail:expired?'Bot token stale; operator must pair again':'Weixin connection interrupted'})
      await pause(expired?3600000:failures>2?30000:2000,signal)
    }
  }
}
