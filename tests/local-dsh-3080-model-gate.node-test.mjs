import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectDisposableModelGate,selectDisposableModelAndRestoreDefault,
  DshModelGateBlocked} from '../src/local-first/dsh-3080-model-gate.ts'

const baseline={provider:'cmp170hx',model:'Qwen3.8-Flash-Next',reasoningEffort:'xhigh'}
const target={provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next',reasoningEffort:'high'}
const grant={operatorApproved:true,disposableSessionId:'operator-approved-new-test',
  exactWorkspaceId:'operator-approved-sandbox',allowedReasoningEffort:'high'}
const copy=v=>structuredClone(v)
function fixture(options={}){
  const calls=[],snapshot={
    session:{sessionId:grant.disposableSessionId,workspaceId:grant.exactWorkspaceId,
      formatStatus:'current',running:false,subagent:false,pendingInput:false,
      permission:'workspace-write',next:copy(baseline),projectionSeq:42},
    setting:{writable:true,revision:15,user:copy(baseline),effective:copy(baseline)},
    catalog:{provider:'llm-local-proxy',model:'Qwen3.8-Flash-Next',
      reasoningEfforts:['low','high'],failures:[]}
  }
  Object.assign(snapshot.session,options.session??{})
  Object.assign(snapshot.setting,options.setting??{})
  Object.assign(snapshot.catalog,options.catalog??{})
  let pending=false,selects=0,replaces=0
  const port={
    async readSession(id) {
      calls.push(['readSession',id])
      return copy(snapshot.session)
    },
    async readDefault() {
      calls.push(['readDefault',snapshot.setting.revision])
      return copy(snapshot.setting)
    },
    async readCatalog() {
      calls.push(['readCatalog'])
      return copy(snapshot.catalog)
    },
    async selectModel(id,model) {
      calls.push(['selectModel',id,copy(model)])
      selects++
      if(options.selectError)throw Error('ambiguous RPC timeout')
      snapshot.session.next=copy(model)
      snapshot.session.projectionSeq++
      pending=true
      if(options.competingDefault){
        snapshot.setting.revision=16
        snapshot.setting.user={provider:'cloud-provider',model:'cloud-model'}
        snapshot.setting.effective={provider:'cloud-provider',model:'cloud-model'}
        pending=false
      }
      return options.badReceipt?copy(baseline):copy(model)
    },
    async replaceDefault(section,expectedRevision) {
      calls.push(['replaceDefault',expectedRevision,copy(section)])
      replaces++
      assert.equal(expectedRevision,snapshot.setting.revision,'CAS uses current exact revision')
      assert.deepEqual(section,baseline,'CAS restores exact complete original user section')
      snapshot.setting.revision++
      snapshot.setting.user=copy(section)
      snapshot.setting.effective=copy(section)
      return copy(snapshot.setting)
    },
    async settle(ms) {
      calls.push(['settle',ms])
      if(pending && !options.neverSave){
        snapshot.setting.revision++
        snapshot.setting.user=copy(target)
        snapshot.setting.effective=copy(target)
        pending=false
      } else if(options.restoreDrift && replaces){
        snapshot.setting.revision++
        snapshot.setting.user={provider:'cloud-provider',model:'cloud-model'}
        snapshot.setting.effective={provider:'cloud-provider',model:'cloud-model'}
      }
    },
  }
  return{port,calls,snapshot,
    get selects(){return selects}, get replaces(){return replaces}}
}
const allowed=async(f,g=grant)=>{
  const saved=[]
  const result=await selectDisposableModelAndRestoreDefault(f.port,g,async s=>{
    assert.equal(f.selects,0,'evidence saved BEFORE any Session mutation')
    saved.push(copy(s))
  })
  return{result,saved}
}
test('read-only gate requires exact manually designated disposable Session, workspace, idle, permissions and local baseline',async()=>{
  const f=fixture(),proof=await inspectDisposableModelGate(f.port,grant)
  assert.deepEqual(proof.target,target)
  assert.equal(f.selects,0)
  assert.equal(f.replaces,0)
  for(const [overrides,code] of [
    [{session:{running:true}},'session_not_disposable_ready'],
    [{session:{permission:'danger-full-access'}},'session_not_disposable_ready'],
    [{session:{formatStatus:'migration-required'}},'session_not_disposable_ready'],
    [{session:{subagent:true}},'session_not_disposable_ready'],
    [{session:{workspaceId:'some-old-workspace'}},'session_not_disposable_ready'],
    [{session:{next:{provider:'cloud',model:'maybe'}}},'unexpected_session_model'],
    [{setting:{effective:{provider:'cloud',model:'maybe'}}},'default_not_writable_or_consistent'],
    [{catalog:{reasoningEfforts:[]}},'effort_not_advertised'],
    [{catalog:{failures:['invalid model']}},'proxy_catalog_unavailable']
  ]){
    const t=fixture(overrides)
    await assert.rejects(inspectDisposableModelGate(t.port,grant),
      e=>e instanceof DshModelGateBlocked&&e.code===code)
    assert.equal(t.selects,0)
  }
})
test('missing human approval, unknown effort and missing durable hook never mutate a Session',async()=>{
  const f=fixture()
  await assert.rejects(inspectDisposableModelGate(f.port,{...grant,operatorApproved:false}),
    {code:'missing_operator_approval'})
  await assert.rejects(inspectDisposableModelGate(f.port,{...grant,allowedReasoningEffort:'xhigh'}),
    {code:'effort_not_allowed'})
  await assert.rejects(selectDisposableModelAndRestoreDefault(f.port,grant),
    {code:'durable_snapshot_required'})
  await assert.rejects(selectDisposableModelAndRestoreDefault(f.port,grant,async()=>{throw Error('disk full')}),
    /disk full/)
  assert.equal(f.selects,0)
  assert.equal(f.replaces,0)
})
test('approved single switch persists baseline first, observes async save, then CAS-restores old global default',async()=>{
  const f=fixture()
  const {result,saved}=await allowed(f)
  assert.equal(saved.length,1)
  assert.equal(saved[0].originalDefault.revision,15)
  assert.deepEqual(saved[0].originalDefault.user,baseline)
  assert.equal(result.sessionId,grant.disposableSessionId)
  assert.deepEqual(result.selected,target)
  assert.equal(result.restoredRevision,17)
  assert.deepEqual(f.snapshot.session.next,target,'disposable Session remains on test provider')
  assert.deepEqual(f.snapshot.setting.effective,baseline,'shared default restored')
  assert.deepEqual(f.snapshot.setting.user,baseline)
  assert.equal(f.selects,1)
  assert.equal(f.replaces,1)
  assert.deepEqual(f.calls.filter(c=>['selectModel','replaceDefault'].includes(c[0]))
    .map(c=>c[0]),['selectModel','replaceDefault'])
  assert.ok(f.calls.findIndex(c=>c[0]==='settle')<
    f.calls.findIndex(c=>c[0]==='replaceDefault'),'background save observed before restoring')
})
test('baseline drift in final read-only recheck blocks the write after durable persistence',async()=>{
  const f=fixture()
  await assert.rejects(selectDisposableModelAndRestoreDefault(f.port,grant,async()=>{
    f.snapshot.setting.revision++
  }),{code:'baseline_changed'})
  assert.equal(f.selects,0)
  assert.equal(f.replaces,0)
})
test('post-switch competing default write fails CLOSED; never overwrites another writer',async()=>{
  const f=fixture({competingDefault:true})
  await assert.rejects(allowed(f),{code:'default_save_conflict'})
  assert.equal(f.selects,1)
  assert.equal(f.replaces,0)
})
test('asynchronous save not observed: never CAS-replace or repeat selectModel',async()=>{
  const f=fixture({neverSave:true})
  await assert.rejects(allowed(f),{code:'default_save_not_observed'})
  assert.equal(f.selects,1)
  assert.equal(f.replaces,0)
})
test('ambiguous selectModel or wrong receipt is not retried',async()=>{
  const f=fixture({selectError:true})
  await assert.rejects(allowed(f),/ambiguous RPC timeout/)
  assert.equal(f.selects,1)
  assert.equal(f.replaces,0)
  const g=fixture({badReceipt:true})
  await assert.rejects(allowed(g),{code:'select_model_ambiguous'})
  assert.equal(g.selects,1)
  assert.equal(g.replaces,0)
})
test('late write after restoration is detected; cannot be called a successful test',async()=>{
  const f=fixture({restoreDrift:true})
  await assert.rejects(allowed(f),{code:'default_restore_unstable'})
  assert.equal(f.selects,1)
  assert.equal(f.replaces,1)
})
test('test provider without declared effort can be readied only when operator omits it',async()=>{
  const f=fixture({catalog:{reasoningEfforts:[]}})
  const proof=await inspectDisposableModelGate(f.port,{
    operatorApproved:true,disposableSessionId:grant.disposableSessionId,
    exactWorkspaceId:grant.exactWorkspaceId
  })
  assert.equal(proof.target.reasoningEffort,undefined)
  assert.equal(f.selects,0)
})
