import test from 'node:test'
import assert from 'node:assert/strict'
import { receivePage, messageToTrigger, sendText, secureBase, clientMessageId } from '../src/local-first/weixin-native-protocol.ts'
const creds={token:'test-local-only-token-123456789',baseUrl:'https://ilinkai.weixin.qq.com',botId:'bot-test'}
const received={message_id:'m-1',from_user_id:'peer-alice',message_type:1,message_state:2,
  create_time_ms:1783488000000,context_token:'opaque-reply-token',
  item_list:[{type:1,text_item:{text:'hello'}}]}
const fake=(response,requests=[])=>async(url,init)=>{
  requests.push({url,init})
  return new Response(JSON.stringify(response),{status:200,headers:{'content-type':'application/json'}})
}
test('typed iLink message maps to deterministic DSH Trigger and stores reply token',()=>{
  const a=messageToTrigger(received),b=messageToTrigger({...received})
  assert.ok(a);assert.deepEqual(a,b)
  assert.equal(a.source,'weixin');assert.equal(a.human,true)
  assert.equal(a.actor.id,'peer-alice');assert.equal(a.text,'hello')
  assert.equal(a.channel.address.contextToken,'opaque-reply-token')
  assert.equal(messageToTrigger({...received,message_type:2}),undefined)
  assert.equal(messageToTrigger({...received,message_state:1}),undefined)
  assert.equal(messageToTrigger({...received,from_user_id:''}),undefined)
})
test('poll sends opaque cursor and does not commit it in the pure HTTP adapter',async()=>{
  const requests=[]
  const page=await receivePage(creds,'old-cursor',new AbortController().signal,fake({
    ret:0,msgs:[received],get_updates_buf:'new-cursor',longpolling_timeout_ms:12000
  },requests),12000)
  assert.equal(page.cursor,'new-cursor')
  assert.equal(page.messages.length,1)
  assert.equal(JSON.parse(requests[0].init.body).get_updates_buf,'old-cursor')
  assert.equal(requests[0].init.headers.Authorization,'Bearer '+creds.token)
})
test('server rejects stale bot and arbitrary HTTP base is refused',async()=>{
  await assert.rejects(receivePage(creds,'',new AbortController().signal,fake({ret:-14,errmsg:'expired'})),
    error=>error.code===-14)
  assert.throws(()=>secureBase('http://ilinkai.weixin.qq.com'))
  assert.throws(()=>secureBase('https://ilinkai.weixin.qq.com@attacker.test'))
  assert.throws(()=>secureBase('https://ilinkai.weixin.qq.com:8080'))
})
test('outbound contains context token and fixed client id across retries',async()=>{
  const requests=[],send=fake({ret:0},requests)
  await sendText(creds,'outbox-1','peer-alice','reply-token','OK',send)
  await sendText(creds,'outbox-1','peer-alice','reply-token','OK',send)
  const a=JSON.parse(requests[0].init.body),b=JSON.parse(requests[1].init.body)
  assert.equal(a.msg.context_token,'reply-token');assert.equal(a.msg.client_id,b.msg.client_id)
  assert.equal(a.msg.client_id,clientMessageId('outbox-1'))
  await assert.rejects(sendText(creds,'outbox-2','peer-alice','','OK',send),/token/)
})
test('direct chat ignores unsupported group and bot echo updates',()=>{
  assert.equal(messageToTrigger({...received,group_id:'group-1'}),undefined)
  assert.equal(messageToTrigger({...received,message_state:1}),undefined)
  assert.equal(messageToTrigger({...received,message_type:2}),undefined)
})

test('native Weixin Trigger preserves incoming curly quote bytes for strict grant hashing',()=>{
  const text='/project dsh-testalias\n请仅回复“OK”'
  const input={...received,item_list:[{type:1,text_item:{text}}]}
  const result=messageToTrigger(input)
  assert.equal(result?.text,text)
  assert.notEqual(result?.text,'/project dsh-testalias\n请仅回复"OK"')
})
import { WEIXIN_MAX_RESPONSE_BYTES } from '../src/local-first/weixin-native-protocol.ts'

// OL-20261124-052 P2: fake-transport page fault shapes at the protocol adapter level.
// Every fetch below is a fake (in-memory Response); the egress tripwire inside
// `fake`/`fakeStream` forbids any real network, and these tests never reach it.
const abortFake=()=>async(url,init)=>{
  if(init?.signal?.aborted)throw init.signal.reason
  return new Promise((_resolve,reject)=>{
    init.signal.addEventListener('abort',()=>reject(init.signal.reason))
  })
}
test('poll timeout mid-response returns an empty page and keeps the opaque cursor',async()=>{
  // Fake clock: the application long-poll deadline is already expired while the request is still pending;
  // the caller signal is untouched. Same stub technique as the vitest poll spec.
  const original=AbortSignal.timeout
  AbortSignal.timeout=()=>AbortSignal.abort()
  try {
    const page=await receivePage(creds,'old-cursor',new AbortController().signal,abortFake(),1000)
    assert.equal(page.cursor,'old-cursor')
    assert.deepEqual(page.messages,[])
    assert.equal(page.waitMs,1000)
  } finally { AbortSignal.timeout=original }
})
const rawFake=(body,requests=[])=>async(url,init)=>{
  requests.push({url,init})
  return new Response(body,{status:200,headers:{'content-type':'application/json'}})
}
test('poll malformed JSON fails the page and never invents a cursor',async()=>{
  const requests=[]
  await assert.rejects(receivePage(creds,'old-cursor',new AbortController().signal,rawFake('not json {{{',requests)),
    error=>error instanceof SyntaxError)
  assert.equal(requests.length,1)
})
test('poll oversized declared content-length is refused before reading the body',async()=>{
  const over=async()=>new Response('{"ret":0}',{status:200,
    headers:{'content-length':String(WEIXIN_MAX_RESPONSE_BYTES+1)}})
  await assert.rejects(receivePage(creds,'old-cursor',new AbortController().signal,over),
    error=>/application cap/.test(error.message))
})
test('poll oversized streamed body is refused at the application cap',async()=>{
  const over=async()=>new Response('x'.repeat(WEIXIN_MAX_RESPONSE_BYTES+16))
  await assert.rejects(receivePage(creds,'old-cursor',new AbortController().signal,over),
    error=>/application cap/.test(error.message))
})
test('poll non-Unicode response bytes fail with a fatal UTF-8 decode (no silent replacement)',async()=>{
  const bytes=async()=>new Response(new Uint8Array([0xff,0xfe,0x22,0x7b,0x7d]))
  await assert.rejects(receivePage(creds,'old-cursor',new AbortController().signal,bytes),
    error=>error instanceof TypeError&&/not valid for encoding/.test(error.message))
})
test('poll Unicode payload survives byte-for-byte into the Trigger',async()=>{
  const unicode='请仅回复“OK” 🚀 café ✓'
  const page=await receivePage(creds,'',new AbortController().signal,
    fake({ret:0,errcode:0,msgs:[{...received,item_list:[{type:1,text_item:{text:unicode}}]}]}))
  assert.equal(messageToTrigger(page.messages[0])?.text,unicode)
})
test('poll transport cut mid-body rejects instead of hanging the page',async()=>{
  const cut=async()=>new Response(new ReadableStream({start(c){
    c.enqueue(new TextEncoder().encode('{"ret":0,"errcode":0,"msgs":['))
    setTimeout(()=>c.error(new Error('synthetic transport cut')),5)
  }}))
  await assert.rejects(receivePage(creds,'old-cursor',new AbortController().signal,cut),
    error=>/transport cut/.test(error.message))
})
test('incomplete items, bot echo and group updates are dropped at the protocol boundary',()=>{
  assert.equal(messageToTrigger({from_user_id:'peer-alice',message_state:2,message_type:1,item_list:[null,{type:1,text_item:{text:'x'}}]}),undefined)
  // An empty item list still carries a stable message ID: it becomes the unsupported placeholder, never a crash.
  assert.equal(messageToTrigger({...received,item_list:[]})?.text,'[未支持的微信消息]')
  assert.equal(messageToTrigger({...received,message_id:''}),undefined)
  // A non-string context_token is dropped from the address; the Trigger still mints so the
  // send-side preflight can hold the reply for review instead of the poll loop dropping it.
  const noCtx=messageToTrigger({...received,context_token:12345})
  assert.ok(noCtx)
  assert.equal(noCtx.channel.address.contextToken,undefined)
})
test('absent or invalid native timestamp never mints an unbounded reply window',()=>{
  const bare=messageToTrigger({...received,create_time_ms:undefined})
  assert.ok(bare)
  assert.equal(bare.channel.address.expiresAt,undefined)
  assert.equal(bare.meta.expiresAt,undefined)
  // A future timestamp is clamped to now+cap; it must never exceed the conservative 60-minute ceiling.
  const future=messageToTrigger({...received,create_time_ms:Date.now()+24*3600_000})
  assert.ok(future?.channel.address.expiresAt)
  assert.ok(Date.parse(future.channel.address.expiresAt)-Date.now()<=(60*60*1000)+1000)
})
test('send refuses a malformed or oversized response body without trusting content-length',async()=>{
  await assert.rejects(sendText(creds,'outbox-9','peer-alice','reply-token','OK',async()=>new Response('nope{{{')),
    error=>error instanceof SyntaxError)
  await assert.rejects(sendText(creds,'outbox-9','peer-alice','reply-token','OK',async()=>new Response('{"ret":0}',{
    headers:{'content-length':String(WEIXIN_MAX_RESPONSE_BYTES+1)}})),error=>/application cap/.test(error.message))
})
