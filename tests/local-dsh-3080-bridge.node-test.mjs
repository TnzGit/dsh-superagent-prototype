import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDshCatalog } from '../src/local-first/existing-dsh-projects.ts'
import { Dsh3080Bridge, DshBridgeBlocked, continuationRequestId, normalizeBridgeOrigin } from '../src/local-first/dsh-3080-bridge.ts'
const [project]=parseDshCatalog({version:1,origin:'dsh-host',hostId:'mac-dsh-3080',collectedAt:'2026-11-08T00:00:00.000Z',
  workspaces:[{workspaceId:'original-workspace-1',title:'Existing Program',path:'/Users/example/original',
    sessionIds:['disposable-test-session','historical-session']}]})
const s={sessionId:'disposable-test-session',running:false,blank:false,formatStatus:'current',
  cwd:project.path,projections:{kind:'cached',values:{
    modelSelection:{next:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'},lastUsed:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'}},
    permissions:{currentValue:'workspace-write'}}}}
const createFake=(session=s)=>{
  const calls=[]
  const fetcher=async(url,init)=>{
    const {type,rpcId,method,payload}=JSON.parse(init.body)
    calls.push({url,init,type,rpcId,method,payload})
    assert.equal(type,'client-request')
    assert.equal(url,'http://127.0.0.1:3080/api/'+method)
    assert.equal(init.redirect,'error')
    assert.equal(init.headers.origin,'http://127.0.0.1:3080')
    assert.ok('args' in payload)
    assert.ok('_request' in payload.args)
    const result=method==='session/list'?{items:[session]}
      :method==='session/prompt'?{accepted:true}
      :method==='session/state'?{cursor:123,active:false,running:false,queue:[],pendingInput:[]}
      :method==='session/wait'?{reason:'timeout',state:{cursor:123,active:false,running:false,pendingInput:[]},
        output:{records:[],truncated:false}}
      :method==='session/page'?{cursor:123,hasMore:false,records:[]}:null
    return new Response(JSON.stringify({type:'server-response',rpcId,result:{ok:true,value:result}}),
      {status:200,headers:{'content-type':'application/json'}})
  }
  return {fetcher,calls}
}
const bridge=(opts={})=>new Dsh3080Bridge({explicitlyEnabled:true,
  allowedSessionIds:['disposable-test-session'],queueProxyVerified:true,verifyRoute:async()=>true,...opts})
test('bridge does not resolve LAN URLs or accept localhost aliases, credentials or alternate ports',()=>{
  assert.equal(normalizeBridgeOrigin('http://127.0.0.1:3080'),'http://127.0.0.1:3080')
  for (const url of ['http://localhost:3080','http://192.168.1.15:3080',
    'http://127.0.0.1:3083','http://127.0.0.1:3080/some-path',
    'http://user:pass@127.0.0.1:3080','https://127.0.0.1:3080']) {
    assert.throws(()=>normalizeBridgeOrigin(url),{code:'endpoint_not_loopback'})
  }
})
test('read-only preflight uses real DSH session/list protocol and does not mutate host',async()=>{
  const fake=createFake()
  const b=bridge({fetcher:fake.fetcher})
  const result=await b.inspect(project,'disposable-test-session')
  assert.deepEqual(result.reasons,[])
  assert.equal(result.allowed,true)
  assert.equal(result.originalSessionVerified,true)
  assert.equal(fake.calls.length,1)
  assert.equal(fake.calls[0].method,'session/list')
  assert.deepEqual(fake.calls[0].payload.args,{_request:{}})
})
test('operator-approved disposable Session queues exactly one text prompt with stable replay ID',async()=>{
  const fake=createFake(),b=bridge({fetcher:fake.fetcher}),req={project,sessionId:'disposable-test-session',
    sourceMessageId:'weixin-trigger-123',text:'do one approved test in this workspace',operatorApproved:true}
  const result=await b.submit(req)
  assert.equal(result.accepted,true)
  assert.equal(result.requestId,continuationRequestId(req.sessionId,req.sourceMessageId))
  const prompt=fake.calls.find(c=>c.method==='session/prompt')
  assert.ok(prompt)
  assert.deepEqual(prompt.payload.args._request,{
    requestId:result.requestId,sessionId:req.sessionId,mode:'queue',content:[{type:'text',text:req.text}]
  })
  await b.submit(req)
  assert.equal(fake.calls.filter(c=>c.method==='session/prompt').length,2)
  const ids=fake.calls.filter(c=>c.method==='session/prompt').map(c=>c.payload.args._request.requestId)
  assert.equal(ids[0],ids[1], 'a retry after ambiguous outcome must reuse its durable requestId')
})
test('no explicit human approval, disabled bridge or unapproved target never sends a prompt',async()=>{
  const fake=createFake()
  await assert.rejects(bridge({fetcher:fake.fetcher}).submit({project,sessionId:'disposable-test-session',
    sourceMessageId:'message',text:'do something',operatorApproved:false}),{code:'operator_approval_required'})
  assert.equal(fake.calls.length,0)
  const b=new Dsh3080Bridge({fetcher:fake.fetcher})
  const r=await b.inspect(project,'disposable-test-session')
  assert.equal(r.allowed,false)
  assert.ok(r.reasons.includes('bridge_not_explicitly_enabled'))
  assert.ok(r.reasons.includes('session_not_operator_approved'))
  assert.ok(r.reasons.includes('queue_proxy_not_verified_on_3080'))
})
test('preflight rejects cloud provider, busy/migrating Session, overly broad permissions and wrong workspace',async()=>{
  const cases=[
    [{projections:{values:{modelSelection:{next:{provider:'workbuddy-ai',model:'hy4-preview-f'},lastUsed:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'}},
      permissions:{currentValue:'workspace-write'}}}},'session_model_not_approved_local_qwen'],
    [{running:true},'session_busy'],
    [{formatStatus:'migration-required'},'session_format_unverified_or_migration_required'],
    [{projections:{values:{modelSelection:{next:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'},lastUsed:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'}},
      permissions:{currentValue:'danger-full-access'}}}},'session_permission_not_workspace_write'],
    [{cwd:'/Users/example/somewhere-else'},'workspace_path_mismatch'],
    [{sessionId:'different-session'},'session_not_in_host'],
  ]
  for (const [delta,reason] of cases){
    const fake=createFake({...s,...delta}),b=bridge({fetcher:fake.fetcher})
    const result=await b.inspect(project,'disposable-test-session')
    assert.ok(result.reasons.includes(reason),'expected '+reason+': '+JSON.stringify(result.reasons))
    assert.equal(result.allowed,false)
    assert.ok(fake.calls.every(c=>c.method==='session/list'))
  }
})
test('lastUsed is only historical: cloud next must be rejected even with a safe local lastUsed',async()=>{
  const sample={...s,projections:{kind:'cached',values:{
    modelSelection:{lastUsed:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'},
      next:{provider:'workbuddy-ai',model:'hy4-preview-f'}},
    permissions:{currentValue:'workspace-write'}}}}
  const fake=createFake(sample)
  const check=await bridge({fetcher:fake.fetcher}).inspect(project,'disposable-test-session')
  assert.ok(check.reasons.includes('session_model_not_approved_local_qwen'))
  assert.equal(check.allowed,false)
})
test('a dedicated proxy provider can be explicitly allowlisted but never substitutes for route verification',async()=>{
  const proxy={...s,projections:{kind:'sequenced',values:{
    modelSelection:{lastUsed:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'},
      next:{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next'}},
    permissions:{currentValue:'workspace-write'}}}}
  const fake=createFake(proxy)
  const approved=bridge({fetcher:fake.fetcher,
    approvedModel:{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next'},
    verifyRoute:async()=>true})
  assert.equal((await approved.inspect(project,'disposable-test-session')).allowed,true)
  const notApproved=bridge({fetcher:fake.fetcher})
  assert.equal((await notApproved.inspect(project,'disposable-test-session')).allowed,false)
  const noRoute=bridge({fetcher:fake.fetcher,verifyRoute:async()=>false,
    approvedModel:{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next'}})
  assert.equal((await noRoute.inspect(project,'disposable-test-session')).allowed,false)
})
test('even approved local model refuses send if 3080 bypasses one-slot queue',async()=>{
  const fake=createFake()
  const b=new Dsh3080Bridge({fetcher:fake.fetcher,explicitlyEnabled:true,
    allowedSessionIds:['disposable-test-session']})
  await assert.rejects(b.submit({project,sessionId:'disposable-test-session',
    sourceMessageId:'m1',text:'work',operatorApproved:true}),error=>
      error instanceof DshBridgeBlocked && error.code==='preflight_blocked' &&
      /queue_proxy_not_verified_on_3080/.test(error.message))
  assert.ok(fake.calls.every(c=>c.method==='session/list'))
})
test('explicit queue route attestation failure blocks any send',async()=>{
  const fake=createFake(),b=bridge({fetcher:fake.fetcher,verifyRoute:async()=>false})
  assert.equal((await b.inspect(project,'disposable-test-session')).allowed,false)
  assert.equal(fake.calls.length,1)
})
test('only explicitly approved Sessions can use bounded state/wait/page history APIs',async()=>{
  const fake=createFake()
  const blocked=new Dsh3080Bridge({fetcher:fake.fetcher})
  await assert.rejects(blocked.sessionCursor('disposable-test-session'),{code:'session_not_operator_approved'})
  await assert.rejects(blocked.pageSession('disposable-test-session',123),{code:'session_not_operator_approved'})
  assert.equal(fake.calls.length,0)
  const b=bridge({fetcher:fake.fetcher})
  assert.equal(await b.sessionCursor('disposable-test-session'),123)
  await b.waitForSession('disposable-test-session',120)
  await b.pageSession('disposable-test-session',123)
  assert.deepEqual(fake.calls.map(x=>x.method),['session/state','session/wait','session/page'])
  assert.deepEqual(fake.calls[1].payload.args._request,{
    sessionId:'disposable-test-session',afterSeq:120,timeoutMs:8000,maxMessages:64
  })
  assert.deepEqual(fake.calls[2].payload.args._request,{
    address:{kind:'session',sessionId:'disposable-test-session'},throughSeq:123,maxMessages:128
  })
})
test('bad RPC response, mismatched ID and RPC errors fail closed',async()=>{
  const scenarios=[
    ({rpcId})=>({type:'server-response',rpcId:'wrong',result:{ok:true,value:{items:[]}}}),
    ({rpcId})=>({type:'server-response',rpcId,result:{ok:false,error:{code:'session/not-found',message:'missing',details:{}}}}),
    ()=>({message:'not a DSH response'})
  ]
  for(const scenario of scenarios){
    const fetcher=async(_,opts)=>new Response(JSON.stringify(scenario(JSON.parse(opts.body))),{status:200})
    const b=bridge({fetcher})
    await assert.rejects(b.listSessions(),error=>error instanceof DshBridgeBlocked)
  }
})
