import test from 'node:test'
import assert from 'node:assert/strict'
import { createBridgeServer } from '../src/local-first/weixin-http.ts'
import { actorId, asTrigger, parseEvent, signBody } from '../src/local-first/weixin-envelope.ts'
const SECRET='unit-test-secret-with-minimum-32-characters'
const event={ accountId:'a1',peerId:'wx:user_01',messageId:'m1',receivedAt:'2026-11-07T10:00:00Z',text:'fix test' }
function signed(raw,timestamp=String(Date.now())) {
  return {'x-dsh-timestamp':timestamp,'x-dsh-signature':signBody(SECRET,timestamp,Buffer.from(raw))}
}
async function running(fn) {
  const ingested=[]
  const server=createBridgeServer({secret:SECRET,allowPeers:[actorId(event.accountId,event.peerId)],ingest:async e=>{ingested.push(e)}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{return await fn({base:'http://127.0.0.1:'+server.address().port,ingested})}
  finally{await new Promise(resolve=>server.close(resolve))}
}
test('stable actor, thread and message IDs; untrusted extra fields rejected',()=>{
  const a=asTrigger(parseEvent(event)),b=asTrigger(parseEvent({...event,messageId:'m2'}))
  assert.equal(a.source,'openclaw-weixin');assert.equal(a.human,true)
  assert.equal(a.actor.id,actorId(event.accountId,event.peerId))
  assert.equal(a.threads[0].id,b.threads[0].id)
  assert.notEqual(a.id,b.id)
  assert.throws(()=>parseEvent({...event,role:'admin'}),/Unexpected/)
  assert.throws(()=>parseEvent({...event,peerId:'x\nadmin'}),/peerId/)
})
test('valid signed loopback request reaches DSH only after verification',()=>running(async({base,ingested})=>{
  const raw=JSON.stringify(event)
  const res=await fetch(base+'/v1/weixin/inbound',{method:'POST',headers:signed(raw),body:raw})
  assert.equal(res.status,202);assert.equal(ingested.length,1);assert.equal(ingested[0].text,event.text)
}))
test('bad MAC, stale timestamp and unknown path reject',()=>running(async({base,ingested})=>{
  const raw=JSON.stringify(event)
  const bad=await fetch(base+'/v1/weixin/inbound',{method:'POST',headers:{...signed(raw),'x-dsh-signature':'sha256='+'0'.repeat(64)},body:raw})
  assert.equal(bad.status,401)
  const stale=String(Date.now()-6*60_000)
  assert.equal((await fetch(base+'/v1/weixin/inbound',{method:'POST',headers:signed(raw,stale),body:raw})).status,401)
  assert.equal((await fetch(base+'/')).status,404)
  assert.equal(ingested.length,0)
}))
test('unauthorized peer and injected roles do not enter DSH',()=>running(async({base,ingested})=>{
  const unlisted=JSON.stringify({...event,peerId:'attacker'})
  assert.equal((await fetch(base+'/v1/weixin/inbound',{method:'POST',headers:signed(unlisted),body:unlisted})).status,403)
  const role=JSON.stringify({...event,actor:'owner'})
  assert.equal((await fetch(base+'/v1/weixin/inbound',{method:'POST',headers:signed(role),body:role})).status,400)
  assert.equal(ingested.length,0)
}))
test('ingest failures remain retryable and are not acknowledged',async()=>{
  const server=createBridgeServer({secret:SECRET,allowPeers:[actorId(event.accountId,event.peerId)],ingest:()=>{throw Error('db down')}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{
    const raw=JSON.stringify(event)
    assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/v1/weixin/inbound',
      {method:'POST',headers:signed(raw),body:raw})).status,503)
  }finally{await new Promise(resolve=>server.close(resolve))}
})
