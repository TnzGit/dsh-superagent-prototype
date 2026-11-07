import { test as nodeTest } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { createOutboundHandler, peerKey, OUTBOUND_PATH } from '../integrations/openclaw-weixin-dsh/outbound.mjs'
import { createPlugin } from '../integrations/openclaw-weixin-dsh/plugin.mjs'
const test=(name,fn)=>nodeTest(name,{timeout:5000},fn)
const secret='demo-dsh-weixin-test-bridge-secret-32-characters'
const event={ id:'dsh-ack-123',accountId:'wx-account',peerId:'wx-peer',text:'任务完成' }
const store=()=>{const records=new Map();return {
  async register(k,v){records.set(k,v)},
  async lookup(k){return records.get(k)},
  records
}}
function signed(raw,timestamp=String(Date.now())) {
  return { 'content-type':'application/json','x-dsh-timestamp':timestamp,
    'x-dsh-signature':'sha256='+createHmac('sha256',secret).update(timestamp).update('.').update(raw).digest('hex') }
}
async function fixture(opts, fn) {
  const s=createServer(async(req,res)=>{await createOutboundHandler(opts)(req,res)})
  await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve))
  try{await fn('http://127.0.0.1:'+s.address().port+OUTBOUND_PATH)}
  finally{ s.closeAllConnections();await new Promise(resolve=>s.close(resolve)) }
}
const post=(url,record,ts) => {const body=JSON.stringify(record);return fetch(url,{method:'POST',headers:signed(body,ts),body})}
test('signed native send persists success and deduplicates repeated id',async()=>{
  const receipts=store(),peers=store(),sends=[]
  await peers.register(peerKey(event.accountId,event.peerId),{seenAt:Date.now()})
  await fixture({secret,store:receipts,peerStore:peers,sendText:async x=>{sends.push(x)}},async url=>{
    assert.equal((await post(url,event)).status,200)
    assert.equal((await post(url,event)).status,200)
    assert.equal(sends.length,1)
    assert.deepEqual(sends[0],{accountId:event.accountId,peerId:event.peerId,text:event.text})
    assert.equal((await post(url,{...event,text:'altered'})).status,409)
    assert.equal(sends.length,1)
  })
})
test('invalid MAC, stale timestamp and unobserved peer reject without native send',async()=>{
  const receipts=store(),peers=store(),sends=[]
  await fixture({secret,store:receipts,peerStore:peers,sendText:async x=>{sends.push(x)}},async url=>{
    assert.equal((await post(url,event)).status,403)
    const raw=JSON.stringify(event)
    assert.equal((await fetch(url,{method:'POST',headers:{...signed(raw),'x-dsh-signature':'sha256='+'0'.repeat(64)},body:raw})).status,401)
    const old=String(Date.now()-360000)
    assert.equal((await post(url,event,old)).status,401)
    assert.equal((await post(url,{...event,peerId:'unknown'})).status,403)
    assert.equal(sends.length,0)
  })
})
test('native delivery failure is uncertain and remains blocked on retry',async()=>{
  const receipts=store(),peers=store();await peers.register(peerKey(event.accountId,event.peerId),{seenAt:Date.now()})
  let sends=0
  await fixture({secret,store:receipts,peerStore:peers,sendText:async()=>{sends++;throw Error('unknown_send_result')}},
    async url=>{
      assert.equal((await post(url,event)).status,409)
      assert.equal((await post(url,event)).status,409)
      assert.equal(sends,1)
    })
})
test('long messages split below Tencent 4000 codepoint limit, preserving text',async()=>{
  const receipts=store(),peers=store();await peers.register(peerKey(event.accountId,event.peerId),{seenAt:Date.now()})
  const text='🧪'.repeat(4100),parts=[]
  await fixture({secret,store:receipts,peerStore:peers,sendText:async p=>parts.push(p.text)},async url=>{
    assert.equal((await post(url,{...event,text})).status,200)
    assert.equal(parts.join(''),text)
    assert.ok(parts.every(p=>Array.from(p).length<=3500))
    assert.equal(parts.length,2)
  })
})
test('Gateway plugin registers opt-in native outbound and admits only peers seen in inbound',async()=>{
  const hooks=new Map(),routes=[],peers=store(),receipts=store(),native=[]
  const p=createPlugin({env:{
    DSH_WEIXIN_BRIDGE_SECRET:secret,
    DSH_WEIXIN_BRIDGE_URL:'http://127.0.0.1:9999/v1/weixin/inbound',
    DSH_WEIXIN_BRIDGE_OUTBOUND_ENABLED:'1'
  },fetcher:async()=>({status:202})})
  p.register({
    on:(name,fn)=>hooks.set(name,fn),
    registerHttpRoute:route=>routes.push(route),
    config:{channels:{}},logger:{warn:()=>{}},
    runtime:{state:{openKeyedStore:({namespace})=> namespace.includes('peers')?peers:receipts},
      channel:{outbound:{loadAdapter:async id=>{
        assert.equal(id,'openclaw-weixin')
        return {sendText:async payload=>{native.push(payload);return {messageId:'native-receipt-1'}}}
      }}}}
  })
  assert.equal(routes.length,1);assert.equal(routes[0].auth,'plugin')
  const admitted=await hooks.get('before_dispatch')({
    channel:'openclaw-weixin',senderId:event.peerId,messageId:'inbound-1',
    content:'please fix this',timestamp:Date.now()
  },{channelId:'openclaw-weixin',accountId:event.accountId})
  assert.equal(admitted.handled,true)
  assert.ok(await peers.lookup(peerKey(event.accountId,event.peerId)))
  const server=createServer((req,res)=>{void routes[0].handler(req,res)})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try {
    const url='http://127.0.0.1:'+server.address().port+OUTBOUND_PATH
    assert.equal((await post(url,event)).status,200)
    assert.equal(native.length,1)
    assert.equal(native[0].to,event.peerId)
    assert.equal(native[0].accountId,event.accountId)
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})
