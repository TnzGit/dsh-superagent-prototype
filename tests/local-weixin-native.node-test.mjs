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
