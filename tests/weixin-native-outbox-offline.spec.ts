/** Installed native Source + real durable Outbox + synthetic credential/HTTP tests ONLY.
 * Offline egress tripwire forbids real network/QR/peer, model, originals and Apply. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { chmodSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OutboundMessage } from '../src/core/index.ts'
import { Store } from '../src/app/store.ts'
import { messageToTrigger, clientMessageId, WEIXIN_REPLY_MAX_AGE_MS } from '../src/local-first/weixin-native-protocol.ts'
import { nativeWeixinKind, readNativeCredentials } from '../src/sources/weixin-native.ts'
import { startRuntime, type Host } from './fixtures/host.ts'

let h:Host
let file:string
const TOKEN_A='SYNTHETIC_WEIXIN_ACCOUNT_A_ONLY_NEVER_REAL'
const TOKEN_B='SYNTHETIC_WEIXIN_ACCOUNT_B_ONLY_NEVER_REAL'
const fingerprint=(token:string)=>createHash('sha256').update(token).digest('hex')
const writeCred=(token:string)=>{
  writeFileSync(file,JSON.stringify({token,baseUrl:'https://ilinkai.weixin.qq.com'}),{mode:0o600})
}
const replies: Array<{url:string;auth:string;body:Record<string,unknown>}>=[]
beforeEach(async()=>{
  h=await startRuntime()
  file=join(h.directory,'synthetic-weixin-credentials.json')
  writeCred(TOKEN_A)
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE',file)
  replies.length=0
  vi.stubGlobal('fetch',vi.fn(async(input:unknown,init:RequestInit={})=>{
    const url=String(input)
    if(url!=='https://ilinkai.weixin.qq.com/ilink/bot/sendmessage' || init.method!=='POST')
      throw Error('OFFLINE EGRESS TRIPWIRE: '+url)
    replies.push({url,auth:String((init.headers as Record<string,string>)?.Authorization),
      body:JSON.parse(String(init.body)) as Record<string,unknown>})
    return new Response(JSON.stringify({ret:0,errcode:0}),{status:200,
      headers:{'content-type':'application/json'}})
  }))
  h.runtime.sources.register(nativeWeixinKind)
  const settings=h.runtime.store.settings()
  h.runtime.store.saveSettings({...settings,sources:{...settings.sources,
    weixin:{enabled:true,config:{allowedPeers:[{id:'approved-peer'}]}}}})
  expect(h.runtime.sources.instance('weixin')?.enabled).toBe(true)
})
afterEach(async()=>{
  await h.stop()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function trigger(token=TOKEN_A,ageMs=0){
  const t=messageToTrigger({
    message_id:'synthetic-native-incoming-1',from_user_id:'approved-peer',
    message_type:1,message_state:2,create_time_ms:Date.now()-ageMs,
    context_token:'SYNTHETIC_CONTEXT_NOT_A_REAL_TOKEN',
    item_list:[{type:1,text_item:{text:'synthetic inbound'}}]
  },fingerprint(token))!
  expect(t.channel).toBeTruthy()
  return t
}
function message(id:string, kind:OutboundMessage['kind']='reply', channel=trigger().channel!):OutboundMessage {
  return {id,kind,text:'synthetic reply',channel}
}
async function at(ms:number){
  vi.useFakeTimers({toFake:['Date'],now:Date.now()+ms})
  try{await h.runtime.pump();await h.runtime.sendReplies()}finally{vi.useRealTimers()}
}

it('installed Source sends one safe reply with its original credential-bound token and stable client ID',async()=>{
  const original=trigger()
  expect(original.channel!.address.accountHash).toBe(fingerprint(TOKEN_A))
  expect(Number.isFinite(Date.parse(original.channel!.address.expiresAt!))).toBe(true)
  const outbound=message('installed-native-success','reply',original.channel!)
  h.runtime.outbox.send(outbound)
  await h.runtime.sendReplies()
  expect(h.runtime.outbox.status(outbound.id)).toBe('sent')
  expect(replies).toHaveLength(1)
  const body=replies[0]!.body.msg as Record<string,unknown>
  expect(body.to_user_id).toBe('approved-peer')
  expect(body.client_id).toBe(clientMessageId(outbound.id))
  expect(body.context_token).toBe('SYNTHETIC_CONTEXT_NOT_A_REAL_TOKEN')
  expect(replies[0]!.auth).toBe('Bearer '+TOKEN_A)
  expect(h.runtime.store.receipts.get(outbound.id)?.singleSendAttemptAt).toBeTruthy()
  h.runtime.outbox.send(outbound)
  await at(5000)
  expect(replies).toHaveLength(1)
})

it('account A pending receipt is held for review after A-to-B rotation, never sent with B credentials',async()=>{
  const old=message('old-account-A', 'acknowledgement',trigger(TOKEN_A).channel!)
  h.runtime.outbox.send(old)
  // No queue pumping before rotation: this is a truly pending SQLite receipt.
  writeCred(TOKEN_B)
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(0)
  const row=h.runtime.store.receipts.get(old.id)!
  expect(row.status).toBe('pending')
  expect(row.review?.reason).toBe('account_mismatch')
  expect(row.singleSendAttemptAt).toBeUndefined()
  const reread=new Store(join(h.directory,'orchestrator.sqlite'))
  try{expect(reread.receipts.get(old.id)?.review?.reason).toBe('account_mismatch'}
  finally{reread.close()}
  writeCred(TOKEN_A)
  h.runtime.outbox.send(old)
  await at(5000)
  expect(replies).toHaveLength(0)
})

it('expired, missing-expiry, missing-context, and unbound legacy receipts fail closed',async()=>{
  const expired=trigger(TOKEN_A,WEIXIN_REPLY_MAX_AGE_MS+10_000).channel!
  const good=trigger().channel!
  const cases=[
    {id:'expired-native',channel:expired,reason:'context_expired_or_unbounded'},
    {id:'no-expiry-native',channel:{...good,address:{...good.address,expiresAt:''}},reason:'context_expired_or_unbounded'},
    {id:'missing-context-native',channel:{...good,address:{...good.address,contextToken:''}},reason:'context_missing'},
    {id:'legacy-unbound-native',channel:{...good,address:{...good.address,accountHash:''}},reason:'account_unbound'},
  ]
  for(const c of cases){
    h.runtime.outbox.send(message(c.id,'notice',c.channel))
    await h.runtime.sendReplies()
    expect(h.runtime.store.receipts.get(c.id)?.review?.reason).toBe(c.reason)
    expect(h.runtime.store.receipts.get(c.id)?.singleSendAttemptAt).toBeUndefined()
  }
  expect(replies).toHaveLength(0)
})

it('missing credentials remain pending without claim and become sendable only after operator-provided file returns',async()=>{
  const outbound=message('missing-file-before-claim')
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE','')
  h.runtime.outbox.send(outbound)
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(0)
  expect(h.runtime.store.receipts.get(outbound.id)?.singleSendAttemptAt).toBeUndefined()
  expect(h.runtime.store.receipts.get(outbound.id)?.review).toBeUndefined()
  vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE',file)
  await at(5000)
  expect(replies).toHaveLength(1)
  expect(h.runtime.outbox.status(outbound.id)).toBe('sent')
})

it('native credential fd guard rejects final symlinks, world-readable files and oversized data',()=>{
  const link=join(h.directory,'symlinked-credentials')
  symlinkSync(file,link)
  expect(()=>readNativeCredentials(link)).toThrow()
  chmodSync(file,0o644)
  expect(()=>readNativeCredentials(file)).toThrow()
  chmodSync(file,0o600)
  expect(readNativeCredentials(file)?.token).toBe(TOKEN_A)
  writeFileSync(file,'x'.repeat(65537),{mode:0o600})
  expect(()=>readNativeCredentials(file)).toThrow()
})

it('native channel send cannot bypass account guard even if called directly',async()=>{
  const old=message('direct-adapter-old-account','reply',trigger(TOKEN_A).channel!)
  writeCred(TOKEN_B)
  await expect(nativeWeixinKind.channel!.send({commands:null as never},old)).rejects.toThrow('safety gate')
  expect(replies).toHaveLength(0)
})
