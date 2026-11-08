import test from 'node:test'
import assert from 'node:assert/strict'
import {DshOwnerRpc,DshOwnerRpcBlocked,originalDshModelGatePort} from '../src/local-first/dsh-3080-operator-rpc.ts'

const ORIGINAL={provider:'cmp170hx',model:'Qwen3.8-Flash-Next',reasoningEffort:'xhigh'}
const PROXY={provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next',reasoningEffort:'high'}
const SID='only-new-disposable-session'
const WID='only-new-disposable-workspace'
const P='/Users/example/new-disposable-workspace'
const snapshot={
  list:{items:[{sessionId:SID,running:false,blank:false,cwd:P,formatStatus:'current'}]},
  projections:{kind:'sequenced',asOfSeq:71,values:{
    modelSelection:{next:ORIGINAL},permissions:{currentValue:'workspace-write'}}},
  state:{cursor:71,running:false,active:false,queue:[],pendingInput:[]},
  describe:{writable:true,namespaces:[{ns:'agent-default-model',user:ORIGINAL,
    value:ORIGINAL,revision:15,applies:true}]},
  catalog:{routableProviders:['cmp170hx','llm-local-proxy'],groups:[
    {id:'llm-local-proxy',models:[{id:'Qwen3.8-Flash-Next',
      reasoning:{efforts:[{id:'low',name:'Low'},{id:'high',name:'High'}]}}]}],failures:[]}
}
const copy=value=>structuredClone(value)
function fixture(options={}){
  const requests=[]
  const fetcher=async(url,init)=>{
    const request=JSON.parse(init.body)
    requests.push({url,init,request})
    const {method,rpcId,payload}=request
    let value
    switch(method){
      case 'session/list':value=copy(snapshot.list);break
      case 'session/projections':value=copy(snapshot.projections);break
      case 'session/state':value=copy(snapshot.state);break
      case 'settings/describe':value=copy(snapshot.describe);break
      case 'session/modelCatalog':value=copy(snapshot.catalog);break
      case 'settings/replace':value={ns:'agent-default-model',user:copy(payload.args.section),
        value:copy(payload.args.section),revision:16,applies:true};break
      case 'session/selectModel':value={selected:copy(payload.args.request)};break
      case 'workspace/create':value={created:true,workspace:{workspaceId:WID,path:P,sessionIds:[]}};break
      case 'session/create':value={sessionId:SID};break
      default:throw Error('Unknown official RPC '+method)
    }
    if(options.mismatchedRpc) return new Response(JSON.stringify({type:'server-response',
      rpcId:'other-request',result:{ok:true,value}}),{status:200})
    if(options.remoteRefused&&method===options.remoteRefused)
      return new Response(JSON.stringify({type:'server-response',rpcId,
        result:{ok:false,error:{code:'settings/conflict',message:'private cannot leak'}}}),{status:200})
    return new Response(JSON.stringify({type:'server-response',rpcId,result:{ok:true,value}}),{status:200})
  }
  const rpc=new DshOwnerRpc({fetcher,grants:options.grants??{}})
  return {rpc,requests}
}
const methods=f=>f.requests.map(r=>r.request.method)
test('live wire for read-only official session/list, projections, state, settings/describe and modelCatalog is exact',async()=>{
  const f=fixture(),gate=originalDshModelGatePort({rpc:f.rpc,workspaceId:WID,
    verifyMembership:async(w,s)=>w===WID&&s===SID,settle:async()=>{}})
  const session=await gate.readSession(SID)
  assert.equal(session.sessionId,SID)
  assert.equal(session.workspaceId,WID)
  assert.deepEqual(session.next,ORIGINAL)
  assert.equal(session.projectionSeq,71)
  assert.equal(session.running,false)
  assert.equal(session.permission,'workspace-write')
  const setting=await gate.readDefault()
  assert.deepEqual(setting.user,ORIGINAL)
  assert.equal(setting.revision,15)
  const catalog=await gate.readCatalog()
  assert.deepEqual(catalog.reasoningEfforts,['low','high'])
  assert.deepEqual(methods(f),['session/list','session/projections','session/state',
    'settings/describe','session/modelCatalog'])
  for(const r of f.requests){
    assert.equal(r.url,'http://127.0.0.1:3080/api/'+r.request.method)
    assert.equal(r.init.redirect,'error')
    assert.equal(r.init.headers.origin,'http://127.0.0.1:3080')
    assert.equal(r.request.type,'client-request')
    assert.ok('args' in r.request.payload)
  }
  assert.deepEqual(f.requests[0].request.payload.args,{_request:{}})
  assert.deepEqual(f.requests[1].request.payload.args,{request:{sessionId:SID}})
  assert.deepEqual(f.requests[2].request.payload.args,{request:{sessionId:SID}})
  assert.deepEqual(f.requests[3].request.payload.args,{})
})
test('a copied Workspace catalog cannot substitute for current real host membership',async()=>{
  const f=fixture(),gate=originalDshModelGatePort({rpc:f.rpc,workspaceId:WID,
    verifyMembership:async()=>false,settle:async()=>{}})
  await assert.rejects(gate.readSession(SID),{code:'workspace_membership_unverified'})
  assert.deepEqual(methods(f),['session/list'],'refuse before reading Session projection')
})
test('all writes are separately denied by default, even with correct route and path',async()=>{
  const f=fixture()
  await assert.rejects(f.rpc.selectModel(SID,PROXY),{code:'write_not_granted'})
  await assert.rejects(f.rpc.replaceDefault(ORIGINAL,15),{code:'write_not_granted'})
  await assert.rejects(f.rpc.registerNewWorkspace(P),{code:'write_not_granted'})
  await assert.rejects(f.rpc.createNewSession(WID),{code:'write_not_granted'})
  assert.deepEqual(methods(f),[])
})
test('model grant admits selectModel+revision CAS only; Workspace grant cannot borrow it',async()=>{
  const f=fixture({grants:{sessionModelWrites:{sessionId:SID}}})
  const gate=originalDshModelGatePort({rpc:f.rpc,workspaceId:WID,
    verifyMembership:async()=>true,settle:async()=>{}})
  assert.deepEqual(await gate.selectModel(SID,PROXY),PROXY)
  await gate.replaceDefault(ORIGINAL,15)
  assert.deepEqual(methods(f),['session/selectModel','settings/replace'])
  assert.deepEqual(f.requests[0].request.payload.args,{request:{sessionId:SID,...PROXY}})
  assert.deepEqual(f.requests[1].request.payload.args,{
    ns:'agent-default-model',section:ORIGINAL,expectedRevision:15})
  await assert.rejects(f.rpc.createNewSession(WID),{code:'write_not_granted'})
})
test('new-Workspace-only grant uses official workspace/create and session/create request objects',async()=>{
  const f=fixture({grants:{newWorkspaceWrites:{path:P}}})
  assert.equal((await f.rpc.registerNewWorkspace(P)).workspace.workspaceId,WID)
  assert.equal((await f.rpc.createNewSession(WID)).sessionId,SID)
  assert.deepEqual(f.requests.map(r=>r.request.payload.args),[
    {request:{path:P}},{request:{workspaceId:WID}}])
  await assert.rejects(f.rpc.selectModel(SID,PROXY),{code:'write_not_granted'})
  await assert.rejects(f.rpc.replaceDefault(ORIGINAL,15),{code:'write_not_granted'})
})
test('no settings replace without a full section and finite expectedRevision',async()=>{
  const f=fixture({grants:{sessionModelWrites:{sessionId:SID}}})
  await assert.rejects(f.rpc.replaceDefault(ORIGINAL,undefined),{code:'invalid_settings_revision'})
  await assert.rejects(f.rpc.replaceDefault(ORIGINAL,-1),{code:'invalid_settings_revision'})
  await assert.rejects(f.rpc.replaceDefault({},Number.NaN),{code:'invalid_settings_revision'})
  assert.deepEqual(methods(f),[])
})
test('wrong 3080 origin, cross-correlation and remote errors fail closed',async()=>{
  assert.throws(()=>new DshOwnerRpc({origin:'http://192.168.1.5:3080'}),
    {code:'endpoint_not_loopback'})
  const a=fixture({mismatchedRpc:true})
  await assert.rejects(a.rpc.modelCatalog(),{code:'invalid_rpc_envelope'})
  const b=fixture({remoteRefused:'settings/replace',grants:{sessionModelWrites:{sessionId:SID}}})
  await b.rpc.selectModel(SID,PROXY)
  await assert.rejects(b.rpc.replaceDefault(ORIGINAL,15),err=>
    err instanceof DshOwnerRpcBlocked&&err.code==='remote_refused'&&
      !err.message.includes('private cannot leak'))
})
test('bad test-only model routes and unverified Session state never reach writes',async()=>{
  const f=fixture({grants:{sessionModelWrites:{sessionId:SID}}})
  await assert.rejects(f.rpc.selectModel(SID,{
    provider:'cmp170hx',model:'Qwen3.8-Flash-Next'}),{code:'invalid_model_route'})
  await assert.rejects(f.rpc.selectModel(SID,{
    provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next',reasoningEffort:'xhigh'}),{
      code:'invalid_model_route'})
  assert.deepEqual(methods(f),[])
})

test('one-shot owner mutation grant forbids changing a second Session or repeating a network attempt',async()=>{
  const f=fixture({grants:{sessionModelWrites:{sessionId:SID}}})
  await assert.rejects(f.rpc.selectModel('historical-session',PROXY),
    {code:'session_not_granted_or_replayed'})
  assert.deepEqual(methods(f),[])
  await f.rpc.selectModel(SID,PROXY)
  await assert.rejects(f.rpc.selectModel(SID,PROXY),
    {code:'session_not_granted_or_replayed'})
  await f.rpc.replaceDefault(ORIGINAL,15)
  await assert.rejects(f.rpc.replaceDefault(ORIGINAL,16),
    {code:'restore_out_of_order'})
  assert.deepEqual(methods(f),['session/selectModel','settings/replace'])
})
test('workspace grant permits only one exact approved child and cannot create Session in old workspace',async()=>{
  const f=fixture({grants:{newWorkspaceWrites:{path:P}}})
  await assert.rejects(f.rpc.registerNewWorkspace('/Users/example/existing'),
    {code:'workspace_not_granted_or_replayed'})
  assert.deepEqual(methods(f),[])
  await f.rpc.registerNewWorkspace(P)
  await assert.rejects(f.rpc.registerNewWorkspace(P),
    {code:'workspace_not_granted_or_replayed'})
  await assert.rejects(f.rpc.createNewSession('old-workspace'),
    {code:'session_create_not_granted_or_replayed'})
  await f.rpc.createNewSession(WID)
  await assert.rejects(f.rpc.createNewSession(WID),
    {code:'session_create_not_granted_or_replayed'})
  assert.deepEqual(methods(f),['workspace/create','session/create'])
})
