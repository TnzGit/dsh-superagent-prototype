/** Native Weixin Source: iLink polling and replies, directly inside DSH. Never loads OpenClaw. */
import { createHash } from 'node:crypto'
import { closeSync, constants as fsConstants, fstatSync, openSync, readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import type { OutboundMessage, Trigger } from '../core/index.ts'
import { threadKey } from '../core/index.ts'
import { KV } from '../kv.ts'
import type { SourceKind, SourceSendPreflight } from './kind.ts'
import { sourceContext, type SourceContext } from './host.ts'
import { pause } from './poll.ts'
import { messageToTrigger, receivePage, sendText, WEIXIN_SOURCE, WEIXIN_REPLY_MAX_AGE_MS, secureBase, type WeixinCredentials } from '../local-first/weixin-native-protocol.ts'

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
  // One open file descriptor, O_NOFOLLOW on the final component, and fstat BEFORE read.
  // Do not lstat(path) and later reopen(path): that permits a replacement race.
  const fd=openSync(file,fsConstants.O_RDONLY|fsConstants.O_NOFOLLOW)
  try {
    const stat=fstatSync(fd)
    if(!stat.isFile() || (stat.mode & 0o077)!==0 ||
      (typeof process.getuid==='function' && stat.uid!==process.getuid()) ||
      stat.size>64*1024)
      throw Error('Weixin credentials must be an owner-owned, owner-only regular file (max 64 KiB)')
    const data=z.object({token:z.string().min(16),baseUrl:z.string(),botId:z.string().optional()}).strict()
      .parse(JSON.parse(readFileSync(fd,'utf8')))
    return {...data,baseUrl:secureBase(data.baseUrl)}
  } finally {closeSync(fd)}
}
/** Strict source allowlist is enforced before a Trigger can enter DSH evaluation. */
export function canReceive(config:Config, peer:string): boolean {
  return config.allowedPeers.some(row=>row.id===peer)
}
/** Fail-closed account/context check before a durable Outbox claim; no HTTP and no secrets in audit. */
function nativeSendReadiness(message:OutboundMessage):{decision:SourceSendPreflight;creds?:WeixinCredentials} {
  const {peer,contextToken,accountHash,expiresAt}=message.channel.address
  if(!peer || !contextToken)return {decision:{status:'review',reason:'context_missing'}}
  if(!accountHash || !/^[a-f0-9]{64}$/.test(accountHash))
    return {decision:{status:'review',reason:'account_unbound'}}
  const expiry=expiresAt?Date.parse(expiresAt):NaN
  if(!Number.isFinite(expiry) || expiry<=Date.now() || expiry>Date.now()+WEIXIN_REPLY_MAX_AGE_MS)
    return {decision:{status:'review',reason:'context_expired_or_unbounded'}}
  let creds:WeixinCredentials|undefined
  try {creds=readNativeCredentials()} catch {return {decision:{status:'waiting'}}}
  if(!creds)return {decision:{status:'waiting'}}
  const current=createHash('sha256').update(creds.token).digest('hex')
  if(accountHash!==current)return {decision:{status:'review',reason:'account_mismatch'}}
  return {decision:{status:'ready'},creds}
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
    preflight:(message:OutboundMessage)=>nativeSendReadiness(message).decision,
    send:async(_ctx,message:OutboundMessage)=>{
      // Revalidate on the actual send path even if a caller bypasses Outbox's preflight.
      const {decision,creds}=nativeSendReadiness(message)
      if(decision.status!=='ready' || !creds)throw Error('Native Weixin send safety gate refused')
      const {peer,contextToken}=message.channel.address
      await sendText(creds,message.id,peer!,contextToken!,message.text)
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
  pollLoop: while(!signal.aborted) {
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
        const trigger=messageToTrigger(input,hash)
        // The operator may revoke a peer while the long poll is in flight.
        // Never route or receive using the allowlist captured before await receivePage.
        const liveConfig=ctx.config<Config>(WEIXIN_SOURCE)
        if(!liveConfig || !ctx.configured())continue pollLoop
        if(!trigger || !canReceive(liveConfig,String(trigger.meta.peer??'')))continue
        // Only a strictly approved, already-persisted one-shot relay bypasses
        // the default Engine. Never execute the same Trigger twice.
        const handled=route?await route(trigger):false
        // A route/receive may have awaited an abort. Never continue to Engine
        // ingestion or commit a whole-page cursor after shutdown intervenes.
        if(signal.aborted)return
        // route() can await; a revoke/disable during that await must not leak
        // a now-unapproved Trigger into ordinary Engine ingestion.
        const beforeReceive=ctx.config<Config>(WEIXIN_SOURCE)
        if(!beforeReceive || !ctx.configured() ||
          !canReceive(beforeReceive,String(trigger.meta.peer??'')))continue pollLoop
        if(!handled)await ctx.receive(trigger)
        if(signal.aborted)return
        for(const ref of trigger.threads)ctx.threads.describe(threadKey(ref),
          {facts:{conversation:{value:{zh:'微信私聊',en:'Weixin direct'}}}})
      }
      // Also cover a signal that aborted after the final input: otherwise a
      // partially acknowledged page could be skipped on restart.
      if(signal.aborted)return
      // A Source disabled mid-page must not commit a cursor for work it skipped.
      if(!ctx.config<Config>(WEIXIN_SOURCE) || !ctx.configured())continue pollLoop
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
