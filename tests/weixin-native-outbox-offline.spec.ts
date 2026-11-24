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
import { deferred, track, waitUntil } from './fixtures/async.ts'

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

it('installed native send that was accepted but loses its response is never sent twice',async()=>{
  const outbound=message('native-ambiguous-response','acknowledgement',trigger().channel!)
  vi.mocked(globalThis.fetch).mockImplementationOnce(async(input:unknown,init:RequestInit={})=>{
    if(String(input)!=='https://ilinkai.weixin.qq.com/ilink/bot/sendmessage')
      throw Error('OFFLINE EGRESS TRIPWIRE: '+String(input))
    replies.push({url:String(input),auth:String((init.headers as Record<string,string>)?.Authorization),
      body:JSON.parse(String(init.body)) as Record<string,unknown>})
    // The fake endpoint accepted the client_id, then the connection failed.
    throw Error('synthetic accepted-then-EOF')
  })
  h.runtime.outbox.send(outbound)
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(1)
  expect(h.runtime.store.receipts.get(outbound.id)).toMatchObject({
    status:'pending',review:{reason:'ambiguous_send'}
  })
  const audit=new Store(join(h.directory,'orchestrator.sqlite'))
  try{expect(audit.receipts.get(outbound.id)?.singleSendAttemptAt).toBeTruthy()}
  finally{audit.close()}
  await at(10_000)
  expect(replies).toHaveLength(1)
  expect(h.runtime.outbox.status(outbound.id)).toBe('pending')
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
  const view=await h.api('GET','state')
  expect(view.status).toBe(200)
  expect(view.body.weixinOutboxReview).toEqual({
    total:1,reasons:{account_mismatch:1}
  })
  // The public API must expose only counts/reason codes, never receipt payload or peer.
  expect(JSON.stringify(view.body.weixinOutboxReview)).not.toContain('approved-peer')
  expect(JSON.stringify(view.body.weixinOutboxReview)).not.toContain('SYNTHETIC_CONTEXT')
  const reread=new Store(join(h.directory,'orchestrator.sqlite'))
  try{expect(reread.receipts.get(old.id)?.review?.reason).toBe('account_mismatch')}
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

it('the same native message ID queued twice issues exactly one HTTP send with the first payload kept',async()=>{
  const original=trigger()
  const outbound=message('installed-native-dup', 'reply', original.channel!)
  h.runtime.outbox.send(outbound)
  h.runtime.outbox.send({...outbound,text:'second-injection-must-not-replace'})
  await h.runtime.sendReplies()
  // Idempotency-key collision: the durable receipt and the client_id both keep the original queue only.
  expect(replies).toHaveLength(1)
  expect(h.runtime.store.receipts.get(outbound.id)).toMatchObject({status:'sent',text:'synthetic reply'})
  const body=replies[0]!.body.msg as Record<string,unknown>
  expect(body.client_id).toBe(clientMessageId(outbound.id))
  const item=(body.item_list as Record<string,unknown>[])[0]!.text_item as Record<string,unknown>
  expect(item.text).toBe('synthetic reply') // the first payload travels to the adapter, not a later injection
  h.runtime.outbox.send({...outbound,text:'third'})
  await at(5000)
  expect(replies).toHaveLength(1)
})

it('a response delivered after a withdraw attempt during flight settles sent once and the ID stays idempotent',async()=>{
  const outbound=message('late-delivered-native','acknowledgement',trigger().channel!)
  const gate=deferred<void>()
  vi.mocked(globalThis.fetch).mockImplementationOnce(async(input:unknown,init:RequestInit={})=>{
    if(String(input)!=='https://ilinkai.weixin.qq.com/ilink/bot/sendmessage')
      throw Error('OFFLINE EGRESS TRIPWIRE: '+String(input))
    replies.push({url:String(input),auth:String((init.headers as Record<string,string>)?.Authorization),
      body:JSON.parse(String(init.body)) as Record<string,unknown>})
    await gate.promise // the response arrives long after the queue step began
    return new Response(JSON.stringify({ret:0,errcode:0}),{status:200,
      headers:{'content-type':'application/json'}})
  })
  h.runtime.outbox.send(outbound)
  const inFlight=track(h.runtime.sendReplies())
  await waitUntil(()=>replies.length===1)
  // Withdraw cannot remove an already-claimed native receipt (deny unsafe cancellation).
  h.runtime.outbox.withdraw(outbound.id)
  expect(h.runtime.store.receipts.get(outbound.id)?.status).toBe('pending')
  expect(h.runtime.store.receipts.get(outbound.id)?.singleSendAttemptAt).toBeTruthy()
  gate.resolve()
  await inFlight.promise
  expect(h.runtime.outbox.status(outbound.id)).toBe('sent')
  expect(replies).toHaveLength(1)
  const audit=new Store(join(h.directory,'orchestrator.sqlite'))
  try{expect(audit.receipts.get(outbound.id)).toMatchObject({status:'sent',text:'synthetic reply'})
    expect(audit.receipts.claimOneShotSend(outbound.id)).toBe(false)}
  finally{audit.close()}
  h.runtime.outbox.send(outbound)
  await at(5000)
  expect(replies).toHaveLength(1) // no second egress for a settled ID
})

it('a duplicate receipt re-queued over the same disposable SQLite after a crash is held for review with zero egress',async()=>{
  // OL-052 restart model: a fresh Store handle over the same disposable SQLite is the replayed state of a crashed process.
  // The simulated crash happens AFTER the durable one-shot claim and BEFORE the HTTP request; the effect row survives.
  // Real live resolution stays GATED: only human reconciliation against a genuine peer with server-side idempotency may settle it.
  const channel=trigger().channel!
  const id='restart-reclaimed-native'
  h.runtime.outbox.send({id,kind:'acknowledgement',text:'synthetic reply',channel})
  expect(h.runtime.store.receipts.claimOneShotSend(id)).toBe(true)
  const reopened=new Store(join(h.directory,'orchestrator.sqlite'))
  try{
    expect(reopened.receipts.get(id)).toMatchObject({status:'pending'})
    expect(reopened.receipts.get(id)?.singleSendAttemptAt).toBeTruthy()
    // Duplicate queue (same ID) over the replayed store cannot re-open a claim: INSERT OR IGNORE keeps the original row and payload.
    expect(reopened.receipts.add({id,kind:'reply',text:'duplicate-injection',channel})).toBe(false)
    expect(reopened.receipts.get(id)?.text).toBe('synthetic reply')
    expect(reopened.receipts.claimOneShotSend(id)).toBe(false)
    expect(reopened.receipts.reviewSummary()).toEqual({total:0,reasons:{}})
  } finally{reopened.close()}
  // The running process's next pump holds the claimed row for manual review and never replays it.
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(0)
  const row=h.runtime.store.receipts.get(id)!
  expect(row.status).toBe('pending')
  expect(row.review?.reason).toBe('ambiguous_send')
  expect(row.singleSendAttemptAt).toBeTruthy()
  h.runtime.outbox.send({id,kind:'reply',text:'late-duplicate',channel})
  await at(10_000)
  expect(replies).toHaveLength(0)
  expect(h.runtime.store.receipts.get(id)?.text).toBe('synthetic reply')
})

it('peer revocation and source disable deny delivery fail-closed without claim or egress',async()=>{
  const outbound=message('peer-revoked-native','notice',trigger().channel!)
  h.runtime.outbox.send(outbound)
  const settings=h.runtime.store.settings()
  h.runtime.store.saveSettings({...settings,sources:{...settings.sources,
    weixin:{enabled:true,config:{allowedPeers:[]}}}})
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(0)
  expect(h.runtime.store.receipts.get(outbound.id)).toMatchObject({
    status:'dropped',dropped:{reason:'channelIgnored'}
  })
  expect(h.runtime.store.receipts.get(outbound.id)?.singleSendAttemptAt).toBeUndefined()
  // Source disabled mid-queue: the receipt waits with no claim and no egress, and sends after re-enable.
  const waiting=message('source-disabled-native','reply',trigger().channel!)
  h.runtime.outbox.send(waiting)
  const off=h.runtime.store.settings()
  h.runtime.store.saveSettings({...off,sources:{...off.sources,weixin:{enabled:false,config:{allowedPeers:[{id:'approved-peer'}]}}}})
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(0)
  expect(h.runtime.store.receipts.get(waiting.id)?.status).toBe('pending')
  expect(h.runtime.store.receipts.get(waiting.id)?.singleSendAttemptAt).toBeUndefined()
  const on=h.runtime.store.settings()
  h.runtime.store.saveSettings({...on,sources:{...on.sources,weixin:{enabled:true,config:{allowedPeers:[{id:'approved-peer'}]}}}})
  await at(5000)
  expect(replies).toHaveLength(1)
  expect(h.runtime.outbox.status(waiting.id)).toBe('sent')
})

it('a reviewed native acknowledgement holds a later same-ticket reply behind it with zero egress',async()=>{
  const channel=trigger().channel!
  const ack=message('reviewed-native-ack','acknowledgement',channel)
  h.runtime.outbox.send({...ack,ticketId:'synthetic-ticket'})
  h.runtime.outbox.send({id:'later-native-reply',kind:'reply',text:'later',channel,ticketId:'synthetic-ticket'})
  // Rotate A->B before pumping: the acknowledgement is held (account_mismatch) and the reply waits behind it.
  writeCred(TOKEN_B)
  await h.runtime.sendReplies()
  expect(replies).toHaveLength(0)
  expect(h.runtime.store.receipts.get(ack.id)?.review?.reason).toBe('account_mismatch')
  expect(h.runtime.store.receipts.get('later-native-reply')?.status).toBe('pending')
  expect(h.runtime.store.receipts.get('later-native-reply')?.singleSendAttemptAt).toBeUndefined()
  await at(30_000)
  expect(replies).toHaveLength(0)
  expect(h.runtime.outbox.status('later-native-reply')).toBe('pending')
})
