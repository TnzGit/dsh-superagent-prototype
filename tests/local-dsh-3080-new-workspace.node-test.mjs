import test from 'node:test'
import assert from 'node:assert/strict'
import {planNewDshWorkspace,createApprovedNativeDshWorkspace,
  NativeWorkspaceProvisionBlocked} from '../src/local-first/dsh-3080-new-workspace.ts'

const grant={operatorApproved:true,approvalId:'human-grant-test-001',
  parent:'/Users/example/approved-new-projects',slug:'new_sandbox_01'}
const expected='/Users/example/approved-new-projects/new_sandbox_01'
const fixture=(options={})=>{
  const calls=[],ledger=[],claimed=new Set(),directories=new Set()
  let workspace,session
  const port={
    async inspectParent(path){calls.push(['inspectParent',path]);return{
      canonicalPath:options.badParent?'/Users/example/other-place':path,
      directory:true,symlinkSafe:!options.unsafeParent,writable:true}},
    async childExists(path){calls.push(['childExists',path]);return options.childExists===true||directories.has(path)},
    async claimApproval(id){calls.push(['claimApproval',id]);if(claimed.has(id))return false;claimed.add(id);return true},
    async persistStep(stage,data){calls.push(['persistStep',stage]);ledger.push({stage,...data})},
    async mkdirExclusive(path){calls.push(['mkdirExclusive',path]);if(directories.has(path))throw Error('exists');directories.add(path)},
    async registerWorkspace(path){calls.push(['registerWorkspace',path]);
      if(options.ambiguousWorkspace)return{created:false,workspace:{workspaceId:'old',path,sessionIds:[]}}
      workspace={workspaceId:'new-dsh-workspace',path,sessionIds:[]}
      return{created:true,workspace:{...workspace}}},
    async createSession(workspaceId){calls.push(['createSession',workspaceId])
      if(options.sessionError)throw Error('uncertain remote Session create')
      session='new-dsh-session'
      workspace.sessionIds.push(session)
      return{sessionId:session}},
    async inspectWorkspace(workspaceId){calls.push(['inspectWorkspace',workspaceId])
      if(options.wrongMembership)return{workspaceId,path:expected,sessionIds:['someone-else']}
      return{...workspace}},
  }
  return{port,calls,ledger,claimed,directories}
}
const methods=f=>f.calls.map(c=>c[0])
test('safe new project planner refuses traversal, old root, foreign or unapproved grants',()=>{
  assert.deepEqual(planNewDshWorkspace(grant),{approvalId:grant.approvalId,parent:grant.parent,path:expected})
  for(const delta of [
    {slug:'../../steal'},{slug:'../old'},{slug:'/absolute'},{slug:'OLD'},
    {slug:'a/b'},{slug:'.'},{slug:'tmp'},{parent:'relative/path'},
    {parent:'/Users/example/../other'},{operatorApproved:false},{approvalId:'a'}
  ])assert.throws(()=>planNewDshWorkspace({...grant,...delta}),NativeWorkspaceProvisionBlocked)
})
test('one approved original 3080 Workspace, one fresh Session and no prior history reuse',async()=>{
  const f=fixture()
  const result=await createApprovedNativeDshWorkspace(grant,f.port)
  assert.deepEqual(result,{workspaceId:'new-dsh-workspace',sessionId:'new-dsh-session',path:expected})
  assert.deepEqual(f.ledger.map(e=>e.stage),
    ['planned','directory-created','workspace-created','session-created'])
  assert.deepEqual(f.ledger[0],{stage:'planned',approvalId:grant.approvalId,path:expected})
  assert.deepEqual(f.ledger.at(-1),{
    stage:'session-created',approvalId:grant.approvalId,path:expected,
    workspaceId:'new-dsh-workspace',sessionId:'new-dsh-session'})
  const flow=methods(f)
  assert.ok(flow.indexOf('claimApproval')<flow.indexOf('mkdirExclusive'))
  assert.ok(flow.indexOf('persistStep')<flow.indexOf('mkdirExclusive'))
  assert.ok(flow.indexOf('registerWorkspace')<flow.indexOf('createSession'))
  assert.deepEqual(f.calls.filter(c=>c[0]==='createSession'),[['createSession','new-dsh-workspace']])
  await assert.rejects(createApprovedNativeDshWorkspace(grant,f.port),{code:'project_already_exists'})
  assert.equal(methods(f).filter(x=>x==='createSession').length,1)
})
test('unsafe or noncanonical parent refuses ALL disk and Session mutations',async()=>{
  for(const flags of [{badParent:true},{unsafeParent:true},{childExists:true}]){
    const f=fixture(flags)
    await assert.rejects(createApprovedNativeDshWorkspace(grant,f.port),
      e=>e instanceof NativeWorkspaceProvisionBlocked &&
      ['parent_unverified','project_already_exists'].includes(e.code))
    assert.ok(!methods(f).some(m=>['mkdirExclusive','registerWorkspace','createSession'].includes(m)))
  }
})
test('ambiguous workspace registration stops without creating a Session or deleting directory',async()=>{
  const f=fixture({ambiguousWorkspace:true})
  await assert.rejects(createApprovedNativeDshWorkspace(grant,f.port),
    {code:'workspace_registration_ambiguous'})
  assert.ok(f.directories.has(expected))
  assert.ok(!methods(f).includes('createSession'))
  assert.equal(f.ledger.at(-1).stage,'directory-created')
  assert.ok(f.claimed.has(grant.approvalId))
})
test('ambiguous session/create is never repeated, old Workspace preserved for human reconciliation',async()=>{
  const f=fixture({sessionError:true})
  await assert.rejects(createApprovedNativeDshWorkspace(grant,f.port),
    /uncertain remote Session create/)
  assert.deepEqual(f.ledger.map(e=>e.stage),['planned','directory-created','workspace-created'])
  assert.equal(methods(f).filter(x=>x==='createSession').length,1)
  await assert.rejects(createApprovedNativeDshWorkspace(grant,f.port),{
    code:'project_already_exists'
  })
  assert.equal(methods(f).filter(x=>x==='createSession').length,1)
})
test('unexpected Session membership fails closed, never returns a false successful link',async()=>{
  const f=fixture({wrongMembership:true})
  await assert.rejects(createApprovedNativeDshWorkspace(grant,f.port),{
    code:'session_membership_unverified'
  })
  assert.equal(f.ledger.at(-1).stage,'session-created')
})
