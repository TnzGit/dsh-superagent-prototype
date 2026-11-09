import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync,chmodSync,realpathSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot,projectFingerprint,previewNonGitProjectChanges} from '../src/local-first/project-workspaces.ts'
import {applyOneNonGitFile,rollbackOneNonGitFile} from '../src/local-first/non-git-apply.ts'

async function fixture(run){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'c6b-synthetic-')))
  const projects=join(base,'registered'),work=join(base,'workers'),journal=join(base,'journals')
  mkdirSync(projects,{mode:0o700});mkdirSync(work,{mode:0o700});mkdirSync(journal,{mode:0o700})
  const source=join(projects,'doc');mkdirSync(source,{mode:0o700})
  const registry=new LocalProjectRegistry([projects],[{id:'doc',root:source,kind:'local'}])
  const request={registry,projectId:'doc',fingerprint:projectFingerprint(registry.get('doc')),
    directory:join(work,'ticket-a')}
  const grant=(kind,digest,other={})=>{
    const id=kind+'-approval-00001',tx=kind+'-transaction-00001'
    const file=join(base,'operator-'+kind+'.json')
    writeFileSync(file,JSON.stringify({version:1,operation:kind,approvalId:id,
      transactionId:tx,projectId:'doc',rootFingerprint:request.fingerprint,
      previewDigest:digest,expiresAt:new Date(Date.now()+60_000).toISOString(),
      operatorApproved:true,...other}),{mode:0o600})
    return file
  }
  try{await run({base,source,request,journal,grant})}
  finally{rmSync(base,{recursive:true,force:true})}
}
test('explicitly approved one-file modify is journaled then rolled back, without duplicate replay',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'note.txt'),'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'note.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  const applyFile=grant('apply',preview.digest)
  const applied=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:applyFile})
  assert.equal(applied.status,'applied')
  assert.equal(readFileSync(join(source,'note.txt'),'utf8'),'after')
  assert.equal(existsSync(join(journal,'tx-apply-transaction-00001','before.bin')),true)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:applyFile}))
  const rollbackFile=grant('rollback',preview.digest,{rollbackOfTransactionId:applied.transactionId})
  const restored=await rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:rollbackFile})
  assert.equal(restored.status,'rolled-back')
  assert.equal(readFileSync(join(source,'note.txt'),'utf8'),'before')
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:rollbackFile}))
}))
test('added file is no-clobber and rollback deletes only exactly matching after-image',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'baseline.txt'),'keep')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'created.bin'),Buffer.from([0,1,2,255]))
  const preview=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant('apply',preview.digest)})
  assert.deepEqual(readFileSync(join(source,'created.bin')),Buffer.from([0,1,2,255]))
  writeFileSync(join(source,'created.bin'),'external change')
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('rollback',preview.digest,{rollbackOfTransactionId:applied.transactionId})}),/Source has changed/)
  assert.equal(readFileSync(join(source,'created.bin'),'utf8'),'external change')
}))
test('one-file delete can restore backed-up original with a new rollback grant',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'remove.txt'),'restore me')
  await createProjectSnapshot(request)
  rmSync(join(request.directory,'remove.txt'))
  const preview=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant('apply',preview.digest)})
  assert.equal(applied.status,'applied')
  assert.equal(existsSync(join(source,'remove.txt')),false)
  const rolled=await rollbackOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('rollback',preview.digest,{rollbackOfTransactionId:applied.transactionId})})
  assert.equal(rolled.status,'rolled-back')
  assert.equal(readFileSync(join(source,'remove.txt'),'utf8'),'restore me')
}))
test('operator grant digest mismatch and multi-file changes never mutate source',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'original')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'worker')
  let preview=await previewNonGitProjectChanges(request)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('apply','f'.repeat(64))}),/digest mismatch/)
  writeFileSync(join(request.directory,'b.txt'),'second change')
  preview=await previewNonGitProjectChanges(request)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('apply',preview.digest)}),/more than one change/)
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'original')
}))
test('source drift and tampered permission file fail closed',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'baseline')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'worker')
  const preview=await previewNonGitProjectChanges(request),file=grant('apply',preview.digest)
  chmodSync(file,0o644)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:file}),/owner-only/)
  chmodSync(file,0o600)
  writeFileSync(join(source,'a.txt'),'another writer')
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:file}),/changed/)
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'another writer')
}))
test('private journal root symlink is refused even with an approved matching plan',async()=>fixture(async({base,source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  const redirect=join(base,'alias');symlinkSync(journal,redirect)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:redirect,
    approvalFile:grant('apply',preview.digest)}),/Journal root/)
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'before')
}))
