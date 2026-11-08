import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {Later} from '../src/app/later.ts'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parseDshCatalog} from '../src/local-first/existing-dsh-projects.ts'
import {NativeRelayCoordinator} from '../src/local-first/dsh-relay-coordinator.ts'
import {continuationRequestId} from '../src/local-first/dsh-3080-bridge.ts'
import {textHash} from '../src/local-first/dsh-relay-routing.ts'
const [project]=parseDshCatalog({version:1,origin:'dsh-host',hostId:'mac-dsh-3080',
  collectedAt:'2026-11-08T00:00:00.000Z',
  workspaces:[{workspaceId:'original-ws',title:'task01',path:'/tmp/original-project',
    sessionIds:['session-1','session-2']}]})
const task='/project '+project.projectId+'\n/session session-1\n只做隔离测试，回复通过'
function fixture(overrides={}){
  const db=new DatabaseSync(':memory:'),triggers=new Map(),dispositions=new Map(),queued=[],outbound=[],calls=[]
  let depth=0,handler
  const store={
    db,
    atomic(work){const name='savepoint_'+depth++;db.exec('SAVEPOINT '+name)
      try{const result=work();db.exec('RELEASE '+name);return result}
      catch(e){db.exec('ROLLBACK TO '+name);db.exec('RELEASE '+name);throw e}
      finally{depth--}
    },
    triggers:{get:id=>triggers.get(id),save:t=>{triggers.set(t.id,t)},
      saveDisposition:(id,v)=>{dispositions.set(id,v)}}
  }
  const effects={handle:(kind,run)=>{assert.equal(kind,'dsh-relay');handler=run},
    enqueue:(kind,key,payload)=>{queued.push({kind,key,payload})}}
  const outbox={send:message=>{outbound.push(message)}}
  const dir=mkdtempSync(join(tmpdir(),'dsh-relay-e2e-mock-'))
  const attFile=join(dir,'route.json'),now=Date.now()
  const att={version:1,sessionId:'session-1',provider:'llm-local-proxy',
    model:'Qwen3.8-Flash-Next',baseURL:'http://127.0.0.1:8123/v1',
    operatorObserved:true,verifiedAt:new Date(now).toISOString()}
  if(!overrides.noAttestation)writeFileSync(attFile,JSON.stringify(att),{mode:0o600})
  const approval={version:1,approvalId:'operator-one-shot-1',operation:'prompt',peer:'peer-a',
    projectId:project.projectId,sessionId:'session-1',textSha256:textHash(task),
    expiresAt:new Date(now+60_000).toISOString(),operatorApproved:true,
    routeAttestationFile:attFile}
  const input={id:'weixin-trigger-original',source:'weixin',human:true,addressed:'direct',
    text:task,actor:{source:'weixin',id:'peer-a'},meta:{peer:'peer-a'},
    threads:[{source:'weixin',id:'weixin:peer-a'}],at:new Date(now).toISOString(),
    channel:{source:'weixin',thread:'weixin:peer-a',address:{peer:'peer-a',
      messageId:'server-msg-1',contextToken:'original-private-context'}}}
  const fetcher=async(url,init)=>{
    const packet=JSON.parse(init.body),method=packet.method
    calls.push({method,packet})
    let value
    if(method==='session/list'){
      value={items:[{sessionId:'session-1',running:false,blank:false,
        cwd:project.path,formatStatus:'current'}]}
    }else if(method==='session/projections'){
      value=overrides.invalidProjection?{kind:'cached'}:{kind:'sequenced',asOfSeq:20,values:{
        modelSelection:{next:{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next'}},
        permissions:{currentValue:'workspace-write'}}}
    }else if(method==='session/state'){
      value={cursor:20,running:false,active:false,queue:[],pendingInput:[]}
    }else if(method==='session/prompt'){
      value={accepted:true}
    }else if(method==='session/wait'){
      value={reason:'idle',state:{cursor:24,running:false,active:false,pendingInput:[]},
        output:{records:[],truncated:false}}
    }else if(method==='session/page'){
      const id=continuationRequestId('session-1',input.id)
      const e=(seq,type,data,append=false)=>({type:'event',event:{
        seq,type,time:now,data,...append?{surfaceOp:'append'}:{}}})
      value=packet.payload.args.request.throughSeq===20
        ?{cursor:20,hasMore:false,records:[]}
        :{cursor:24,hasMore:false,records:[
          e(21,'user/message',{role:'user',source:{kind:'user',rpcId:id},content:[]},true),
          e(23,'assistant/message',{message:{content:[{type:'text',text:'测试通过'}]}},true),
          e(24,'turn/end',{reason:{kind:'completed'},turn:1})
        ]}
    }else throw Error('Unexpected DSH RPC '+method)
    return new Response(JSON.stringify({type:'server-response',rpcId:packet.rpcId,
      result:{ok:true,value}}),{status:200,headers:{'content-type':'application/json'}})
  }
  const coordinator=new NativeRelayCoordinator({store,effects,outbox,projects:[project],
    approval,authorized:()=>overrides.authorized!==false,fetcher})
  return{coordinator,approval,store,queued,outbound,calls,input,trigger:id=>triggers.get(id),
    process:async()=>handler(queued[0].payload),close:()=>{db.close();rmSync(dir,{recursive:true,force:true})}}
}
test('offline end-to-end: one approved Weixin Trigger is consumed once and returned by correlated Outbox',async()=>{
  const f=fixture()
  try{
    assert.equal(f.coordinator.receive(f.input),true)
    assert.equal(f.queued.length,1)
    assert.equal(f.trigger(f.input.id)?.id,f.input.id)
    await f.process()
    assert.equal(f.calls.filter(c=>c.method==='session/prompt').length,1)
    assert.equal(f.outbound.length,1)
    assert.equal(f.outbound[0].text,'测试通过')
    assert.equal(f.outbound[0].channel.address.contextToken,'original-private-context')
    assert.equal(f.coordinator.ledger.byTrigger(f.input.id)?.status,'completed')
    await f.process()
    assert.equal(f.outbound.length,1,'repeat effect cannot resend Outbox reply')
    assert.equal(f.calls.filter(c=>c.method==='session/prompt').length,1,'repeat effect cannot re-prompt DSH')
    assert.equal(f.coordinator.receive(f.input),true,'duplicate original message remains consumed')
    assert.equal(f.queued.length,1)
    const repeated={...f.input,id:'another-weixin-message',
      channel:{...f.input.channel,address:{...f.input.channel.address,messageId:'server-msg-2'}}}
    assert.equal(f.coordinator.receive(repeated),true,'reusing the one-shot text cannot start an Engine Ticket')
    assert.equal(f.queued.length,1)
  }finally{f.close()}
})
test('revoked DSH Weixin Policy member or Source allowlist prevents all special routing',()=>{
  const f=fixture({authorized:false})
  try{assert.equal(f.coordinator.receive(f.input),false);assert.equal(f.queued.length,0)}
  finally{f.close()}
})
test('route attestation unavailable: no real or mock DSH prompt is dispatched',async()=>{
  const f=fixture({noAttestation:true})
  try{
    assert.equal(f.coordinator.receive(f.input),true)
    await assert.rejects(f.process(),error=>error instanceof Later)
    assert.equal(f.calls.filter(c=>c.method==='session/prompt').length,0)
    assert.equal(f.coordinator.ledger.byTrigger(f.input.id),undefined)
  }finally{f.close()}
})

test('deterministic preflight rejection becomes terminal without prompt or reply',async()=>{
  const x=fixture({invalidProjection:true})
  try{
    assert.equal(x.coordinator.receive(x.input),true)
    await x.process()
    assert.equal(x.coordinator.ledger.notSubmittedByTrigger(x.input.id)?.reason,'preflight-rejected')
    await x.process()
    assert.equal(x.calls.filter(c=>c.method==='session/prompt').length,0)
    assert.equal(x.outbound.length,0)
  }finally{x.close()}
})
test('expired grant leaves terminal evidence before receipt',async()=>{
  const x=fixture()
  try{
    assert.equal(x.coordinator.receive(x.input),true)
    x.approval.expiresAt=new Date(Date.now()-10).toISOString()
    await x.process()
    assert.equal(x.coordinator.ledger.notSubmittedByTrigger(x.input.id)?.reason,'approval-expired')
    assert.equal(x.calls.filter(c=>c.method==='session/prompt').length,0)
  }finally{x.close()}
})
