import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,chmod,readFile,realpath,rm,lstat,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DshOwnerRpc} from '../src/local-first/dsh-3080-operator-rpc.ts'
import {originalDshProvisionPort} from '../src/local-first/dsh-3080-operator-provision.ts'
import {createApprovedNativeDshWorkspace} from '../src/local-first/dsh-3080-new-workspace.ts'
const setup=async(options={})=>{
  const root=await mkdtemp(join(await realpath(tmpdir()),'dsh-operator-provision-'))
  const parent=join(root,'workspace-parent'),privateLedgerRoot=join(root,'ledger')
  await mkdir(parent,{mode:0o700})
  await mkdir(privateLedgerRoot,{mode:0o700})
  const calls=[]
  let view={workspaceId:'ws-test-1',path:join(parent,'test-sandbox'),sessionIds:[]}
  const fetcher=async(url,init)=>{
    const p=JSON.parse(init.body),name=p.method,cursor=p.rpcId
    calls.push({name,args:p.payload.args})
    let value
    if(name==='workspace/create') {
      value={workspace:{...view,sessionIds:[...view.sessionIds]},created:true}
    } else if(name==='session/create'){
      view={...view,sessionIds:[...view.sessionIds,'session-test-1']}
      value={sessionId:'session-test-1'}
    }else throw Error('Unexpected mutation '+name)
    return new Response(JSON.stringify({type:'server-response',rpcId:cursor,
      result:{ok:true,value}}),{status:200})
  }
  const rpc=new DshOwnerRpc({fetcher,grants:{newWorkspaceWrites:options.granted!==false}})
  const port=originalDshProvisionPort({rpc,privateLedgerRoot,
    readWorkspace:async id=>{assert.equal(id,view.workspaceId);return {...view,sessionIds:[...view.sessionIds]}}})
  const approval={operatorApproved:true,approvalId:'operator-human-confirmed-01',parent,slug:'test-sandbox'}
  return {root,parent,privateLedgerRoot,calls,approval,port,
    close:async()=>rm(root,{recursive:true,force:true})}
}
test('approved on-disk original DSH Workspace one-shot registers one new Session via official RPC',async()=>{
  const f=await setup()
  try{
    const result=await createApprovedNativeDshWorkspace(f.approval,f.port)
    assert.deepEqual(result,{workspaceId:'ws-test-1',sessionId:'session-test-1',
      path:join(f.parent,'test-sandbox')})
    assert.deepEqual(f.calls.map(x=>x.name),['workspace/create','session/create'])
    assert.deepEqual(f.calls[0].args,{request:{path:result.path}})
    assert.deepEqual(f.calls[1].args,{request:{workspaceId:result.workspaceId}})
    const entries=await (await import('node:fs/promises')).readdir(f.privateLedgerRoot)
    assert.equal(entries.length,1)
    const ledger=await readFile(join(f.privateLedgerRoot,entries[0],'ledger.jsonl'),'utf8')
    assert.deepEqual(ledger.trim().split('\n').map(line=>JSON.parse(line).step),
      ['planned','directory-created','workspace-created','session-created'])
    const dir=await lstat(join(f.parent,'test-sandbox'))
    assert.equal(dir.isDirectory(),true)
    assert.equal(dir.mode&0o077,0)
    await assert.rejects(createApprovedNativeDshWorkspace(f.approval,f.port),
      {code:'project_already_exists'})
    assert.equal(f.calls.filter(x=>x.name==='session/create').length,1)
  }finally{await f.close()}
})
test('permission on private ledger root must be owner-only',async()=>{
  const f=await setup()
  try{
    await chmod(f.privateLedgerRoot,0o755)
    await assert.rejects(createApprovedNativeDshWorkspace(f.approval,f.port),
      /private ledger root must be/)
    assert.equal(f.calls.length,0)
  }finally{await f.close()}
})
test('unsafe symlinked parent is rejected before any original DSH write',async()=>{
  const f=await setup()
  try{
    const link=join(f.root,'symlink-parent')
    await symlink(f.parent,link)
    const approval={...f.approval,parent:link}
    await assert.rejects(createApprovedNativeDshWorkspace(approval,f.port),
      {code:'parent_unverified'})
    assert.equal(f.calls.length,0)
  }finally{await f.close()}
})
test('missing independent Workspace write grant does not send workspace/create',async()=>{
  const f=await setup({granted:false})
  try{
    await assert.rejects(createApprovedNativeDshWorkspace(f.approval,f.port),
      {code:'write_not_granted'})
    assert.equal(f.calls.length,0)
    const names=await (await import('node:fs/promises')).readdir(f.parent)
    assert.deepEqual(names,['test-sandbox'],'ambiguous provision never deletes the directory')
  }finally{await f.close()}
})
