import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {parseDshCatalog} from '../src/local-first/existing-dsh-projects.ts'
import {DshRelayStore,weixinContextFresh,MAX_RELAY_CONTEXT_AGE_MS}
  from '../src/local-first/dsh-relay-store.ts'
const [project]=parseDshCatalog({version:1,origin:'dsh-host',hostId:'mac-dsh-3080',
  collectedAt:'2026-11-08T00:00:00.000Z',
  workspaces:[{workspaceId:'original-ws',title:'task01',path:'/tmp/dsh-test',
    sessionIds:['session-1','session-2']}]})
const now=Date.parse('2026-11-08T08:00:00.000Z')
const trigger=(id='wechat-1',peer='peer-a',time=now)=>({
  id,source:'weixin',human:true,text:'请续做 task01',at:new Date(time).toISOString(),
  threads:[{source:'weixin',id:'weixin:'+peer}],
  actor:{source:'weixin',id:peer},meta:{},
  channel:{source:'weixin',thread:'weixin:'+peer,address:{
    peer,messageId:'wx-'+id,contextToken:'private-reply-token'}}
})
const fixture=()=>{
  const db=new DatabaseSync(':memory:')
  const seen=new Map()
  let depth=0
  const host={db,triggers:{get:id=>seen.get(id)},
    atomic(run){const save='save'+depth++;db.exec('SAVEPOINT '+save)
      try{const result=run();db.exec('RELEASE '+save);return result}
      catch(e){db.exec('ROLLBACK TO '+save);db.exec('RELEASE '+save);throw e}
      finally{depth--}
    }}
  const store=new DshRelayStore(host)
  return{db,store,seen,host}
}
const completed=r=>({status:'completed',requestId:r.requestId,cursor:42,assistantSeq:42,text:'已完成。'})
test('new relay ledger is opt-in and creates only own staging SQLite tables',()=>{
  const {db}=fixture()
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(x=>x.name)
  assert.deepEqual(tables,['dsh_relay_binding','dsh_relay_receipt'])
  db.close()
})
test('confirmed binding requires persisted human Weixin message and exact Session membership',()=>{
  const {db,store,seen}=fixture(),a=trigger('binding-1')
  assert.throws(()=>store.confirmBinding(a,project,'session-1',true),/not ingested/)
  seen.set(a.id,a)
  assert.throws(()=>store.confirmBinding(a,project,'session-1',false),/unconfirmed/)
  assert.throws(()=>store.confirmBinding(a,project,'unknown',true),/unconfirmed/)
  const bound=store.confirmBinding(a,project,'session-1',true)
  assert.equal(bound.projectId,project.projectId)
  assert.equal(store.boundProject(trigger('later'),[project])?.sessionId,'session-1')
  assert.equal(store.boundProject(trigger('later','peer-b'),[project]),undefined)
  assert.equal(store.boundProject(trigger('later'),[]),undefined)
  assert.equal(store.boundProject(trigger('later'),[{...project,sessionIds:[]}]),undefined)
  db.close()
})
test('one original Trigger can reserve one durable identity; replay cannot reset its cursor',()=>{
  const {db,store,seen,host}=fixture(),a=trigger()
  seen.set(a.id,a)
  const first=store.reserve(a,project,'session-1',20)
  assert.equal(first.afterSeq,20)
  assert.equal(first.status,'prepared')
  assert.equal(first.textHash.length,64)
  assert.equal(JSON.stringify(first).includes('private-reply-token'),false)
  assert.throws(()=>store.reserve(a,project,'session-1',999),/exists/)
  assert.equal(new DshRelayStore(host).byTrigger(a.id)?.afterSeq,20)
  assert.equal(store.uncertain(first.requestId).status,'uncertain')
  assert.equal(store.unresolved().length,1)
  assert.equal(store.admitted(first.requestId).status,'uncertain','uncertain receipts need read-only reconciliation')
  db.close()
})
test('exact completed output enters Outbox once, using original token and absolute expiry',()=>{
  const {db,store,seen,host}=fixture(),a=trigger()
  seen.set(a.id,a)
  const receipt=store.reserve(a,project,'session-1',20)
  store.admitted(receipt.requestId)
  const sent=[]
  const outbox={send(m){sent.push(m)}}
  const first=store.enqueueCompletion(receipt,completed(receipt),outbox,now+10_000)
  assert.equal(first.status,'enqueued')
  assert.equal(sent.length,1)
  assert.equal(sent[0].channel.address.contextToken,'private-reply-token')
  assert.equal(sent[0].channel.address.messageId,'wx-wechat-1')
  assert.equal(sent[0].channel.address.expiresAt,new Date(now+MAX_RELAY_CONTEXT_AGE_MS).toISOString())
  assert.equal(store.enqueueCompletion(receipt,completed(receipt),outbox,now+15_000).status,'already-enqueued')
  assert.equal(sent.length,1)
  assert.equal(store.get(receipt.requestId)?.outboxId,sent[0].id)
  db.close()
})
test('expired original context is NEVER silently refreshed by a later message',()=>{
  const {db,store,seen}=fixture(),a=trigger()
  seen.set(a.id,a);seen.set('newer',trigger('newer'))
  const receipt=store.reserve(a,project,'session-1',20)
  store.admitted(receipt.requestId)
  const sent=[]
  assert.equal(store.enqueueCompletion(receipt,completed(receipt),{send:m=>sent.push(m)},
    now+MAX_RELAY_CONTEXT_AGE_MS+1).status,'expired')
  assert.equal(sent.length,0)
  assert.equal(store.get(receipt.requestId)?.status,'reply-expired')
  assert.equal(store.unresolved().length,0)
  db.close()
})
test('outbox failure rolls back a reply state transition in the same SQLite transaction',()=>{
  const {db,store,seen}=fixture(),a=trigger()
  seen.set(a.id,a)
  const receipt=store.reserve(a,project,'session-1',20)
  store.admitted(receipt.requestId)
  assert.throws(()=>store.enqueueCompletion(receipt,completed(receipt),
    {send(){throw Error('outbox failed')}},now),/outbox failed/)
  assert.equal(store.get(receipt.requestId)?.status,'admitted')
  db.close()
})
test('rejects non-completion, forged target, or a mismatched Session when enqueuing',()=>{
  const {db,store,seen}=fixture(),a=trigger()
  seen.set(a.id,a)
  const receipt=store.reserve(a,project,'session-1',20)
  assert.throws(()=>store.enqueueCompletion(receipt,{status:'pending',
    requestId:receipt.requestId,reason:'waiting'},{send(){}},now),/completed/)
  assert.throws(()=>store.enqueueCompletion({...receipt,sessionId:'session-2'},
    completed(receipt),{send(){}},now),/matching/)
  db.close()
})
test('freshness guard is deliberately conservative and refuses missing timestamp/token',()=>{
  const a=trigger()
  assert.equal(weixinContextFresh(a,now+MAX_RELAY_CONTEXT_AGE_MS),true)
  assert.equal(weixinContextFresh(a,now+MAX_RELAY_CONTEXT_AGE_MS+1),false)
  assert.equal(weixinContextFresh({...a,at:'bad-date'},now),false)
  assert.equal(weixinContextFresh({...a,human:false},now),false)
  assert.equal(weixinContextFresh({...a,channel:{...a.channel,address:{...a.channel.address,contextToken:''}}},now),false)
})
