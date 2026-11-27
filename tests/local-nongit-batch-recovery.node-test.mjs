import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync,symlinkSync,realpathSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot,projectFingerprint,previewNonGitProjectChanges} from '../src/local-first/project-workspaces.ts'
import {stageNonGitChangeBatch} from '../src/local-first/non-git-batch-stage.ts'
import {inspectNonGitBatchRecovery,classifyNonGitBatchObservations} from '../src/local-first/non-git-batch-recovery.ts'
async function fixture(fn){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'c6b2b1-synthetic-')))
  const projects=join(base,'projects'),workspaces=join(base,'work'),journals=join(base,'journals')
  mkdirSync(projects,{mode:0o700})
  mkdirSync(workspaces,{mode:0o700})
  mkdirSync(journals,{mode:0o700})
  const source=join(projects,'notes');mkdirSync(source,{mode:0o700})
  const reg=new LocalProjectRegistry([projects],[{id:'notes',root:source,kind:'local'}])
  const input={registry:reg,projectId:'notes',
    directory:join(workspaces,'ticket'),fingerprint:projectFingerprint(reg.get('notes'))}
  try{
    writeFileSync(join(source,'modify.txt'),'before')
    writeFileSync(join(source,'delete.txt'),'remove')
    await createProjectSnapshot(input)
    writeFileSync(join(input.directory,'modify.txt'),'after')
    writeFileSync(join(input.directory,'new.txt'),'created')
    rmSync(join(input.directory,'delete.txt'))
    const plan=await previewNonGitProjectChanges(input)
    const file=join(base,'stage-approval.json')
    writeFileSync(file,JSON.stringify({version:1,operation:'stage-batch',approvalId:'approved-batch-0001',
      batchId:'recovery-batch-001',projectId:'notes',rootFingerprint:input.fingerprint,
      previewDigest:plan.digest,expiresAt:new Date(Date.now()+60_000).toISOString(),operatorApproved:true}),{mode:0o600})
    const seal=await stageNonGitChangeBatch(input,{journalRoot:journals,approvalFile:file})
    await fn({source,input,seal})
  }finally{rmSync(base,{recursive:true,force:true})}
}
test('all original file states classify unchanged; read-only inspection does not write source',async()=>fixture(async({source,input,seal})=>{
  const r=await inspectNonGitBatchRecovery(input,seal)
  assert.equal(r.state,'unchanged')
  assert.equal(r.autoApplyAllowed,false)
  assert.equal(r.needsHumanReview,true)
  assert.deepEqual(r.files.map(x=>x.position),['before','before','before'])
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
}))
test('one changed file is partial; all after-images are full applied (still never authorized)',async()=>fixture(async({source,input,seal})=>{
  writeFileSync(join(source,'modify.txt'),'after')
  chmodSync(join(source,'modify.txt'),0o644)
  let result=await inspectNonGitBatchRecovery(input,seal)
  assert.equal(result.state,'partially-applied')
  assert.deepEqual(result.files.map(x=>x.position),['before','after','before'])
  rmSync(join(source,'delete.txt'))
  writeFileSync(join(source,'new.txt'),'created')
  result=await inspectNonGitBatchRecovery(input,seal)
  assert.equal(result.state,'fully-applied')
  assert.equal(result.files.every(x=>x.position==='after'),true)
  assert.equal(result.autoApplyAllowed,false)
}))
test('foreign edits and source mode drift are diverged, not safe to retry',async()=>fixture(async({source,input,seal})=>{
  writeFileSync(join(source,'modify.txt'),'external change')
  let status=await inspectNonGitBatchRecovery(input,seal)
  assert.equal(status.state,'diverged')
  assert.equal(status.files.find(x=>x.path==='modify.txt').position,'diverged')
  writeFileSync(join(source,'modify.txt'),'before')
  chmodSync(join(source,'modify.txt'),0o600)
  status=await inspectNonGitBatchRecovery(input,seal)
  assert.equal(status.state,'diverged')
  assert.equal(status.autoApplyAllowed,false)
}))
test('symlink in observed registered source is rejected rather than followed',async()=>fixture(async({source,input,seal})=>{
  rmSync(join(source,'modify.txt'))
  symlinkSync(join(input.directory,'modify.txt'),join(source,'modify.txt'))
  await assert.rejects(inspectNonGitBatchRecovery(input,seal),/Symlink traversal denied|Unsafe/)
}))
test('missing, duplicated, out-of-order and forged observation evidence fail closed',async()=>fixture(async({input,seal})=>{
  const result=await inspectNonGitBatchRecovery(input,seal)
  const list=seal.changes.map((row,i)=>({
    path:row.path,oid:row.before,mode:row.beforeMode
  }))
  assert.equal(list.length,3)
  assert.throws(()=>classifyNonGitBatchObservations(seal,list.slice(1)),/Incomplete/)
  assert.throws(()=>classifyNonGitBatchObservations(seal,[list[0],list[0],list[2]]),/Invalid/)
  assert.throws(()=>classifyNonGitBatchObservations(seal,[list[1],list[0],list[2]]),/Invalid/)
  assert.throws(()=>classifyNonGitBatchObservations(seal,[{path:list[0].path,mode:0o600},list[1],list[2]]),/Invalid/)
  assert.equal(result.state,'unchanged')
}))
test('tampered seal digest or file action are rejected without writing source',async()=>fixture(async({input,seal})=>{
  const corrupt={...seal,digest:'e'.repeat(64)}
  await assert.rejects(inspectNonGitBatchRecovery(input,corrupt),/integrity/)
  const forged={...seal,changes:seal.changes.map(x=>({...x}))}
  forged.changes[0].action='modify'
  await assert.rejects(inspectNonGitBatchRecovery(input,forged),/integrity/)
}))
test('identical before/after content AND mode is explicitly indeterminate',async()=>fixture(async({input,seal})=>{
  const duplicate={...seal,changes:seal.changes.map(x=>({...x}))}
  const row=duplicate.changes[1]
  row.after=row.before
  row.afterMode=row.beforeMode
  row.afterExecutable=row.beforeExecutable
  const {createHash}=await import('node:crypto')
  const {digest,...rest}=duplicate
  duplicate.digest=createHash('sha256').update(JSON.stringify(rest)).digest('hex')
  const observations=duplicate.changes.map(c=>({path:c.path,oid:c.before,mode:c.beforeMode}))
  const result=classifyNonGitBatchObservations(duplicate,observations)
  assert.equal(result.state,'indeterminate')
  assert.equal(result.files[1].position,'indeterminate')
  assert.equal(result.autoApplyAllowed,false)
}))
