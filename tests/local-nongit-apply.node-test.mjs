import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync,chmodSync,realpathSync,linkSync,statSync} from 'node:fs'
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
    approvalFile:grant('rollback',preview.digest,{rollbackOfTransactionId:applied.transactionId})}),/Source content or mode changed/)
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

test('executable file restored with original mode after independent rollback approval',async()=>fixture(async({source,request,journal,grant})=>{
  const file=join(source,'run.sh')
  writeFileSync(file,'#!/bin/sh\necho old\n',{mode:0o700});chmodSync(file,0o700)
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'run.sh'),'#!/bin/sh\necho new\n')
  chmodSync(join(request.directory,'run.sh'),0o600)
  const plan=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant('apply',plan.digest)})
  assert.equal(readFileSync(file,'utf8'),'#!/bin/sh\necho new\n')
  const rolled=await rollbackOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('rollback',plan.digest,{rollbackOfTransactionId:applied.transactionId})})
  assert.equal(rolled.beforeExecutable,true)
  assert.equal(readFileSync(file,'utf8'),'#!/bin/sh\necho old\n')
  const {statSync}=await import('node:fs')
  assert.equal(statSync(file).mode&0o111,0o100)
}))
test('unreconciled write-ahead journal blocks fresh apply without touching source',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const plan=await previewNonGitProjectChanges(request)
  const dir=join(journal,'tx-stale-transaction-00001')
  mkdirSync(dir,{mode:0o700})
  writeFileSync(join(dir,'journal.json'),JSON.stringify({status:'applying'}),{mode:0o600})
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('apply',plan.digest)}),/Unreconciled/)
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'before')
}))

test('source executable-mode drift after apply blocks rollback without overwriting',async()=>fixture(async({source,request,journal,grant})=>{
  const file=join(source,'a.txt');writeFileSync(file,'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const plan=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant('apply',plan.digest)})
  chmodSync(file,0o700)
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('rollback',plan.digest,{rollbackOfTransactionId:applied.transactionId})}),/mode changed/)
  assert.equal(readFileSync(file,'utf8'),'after')
}))
test('tampering with journal patch scope is rejected before rollback',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const plan=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant('apply',plan.digest)})
  const file=join(journal,'tx-'+applied.transactionId,'journal.json')
  const row=JSON.parse(readFileSync(file,'utf8'))
  row.change.path='another.txt'
  row.path='another.txt'
  writeFileSync(file,JSON.stringify(row))
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('rollback',plan.digest,{rollbackOfTransactionId:applied.transactionId})}),/journal change no longer matches/)
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'after')
}))

test('mode-only Worker change is reverted even when Git blob OIDs are identical',async()=>fixture(async({source,request,journal,grant})=>{
  const file=join(source,'script.sh')
  writeFileSync(file,'#!/bin/sh\nexit 0\n',{mode:0o700})
  chmodSync(file,0o700)
  await createProjectSnapshot(request)
  const worker=join(request.directory,'script.sh')
  chmodSync(worker,0o600)
  const plan=await previewNonGitProjectChanges(request)
  assert.equal(plan.changes.length,1)
  assert.equal(plan.changes[0].action,'modify')
  assert.equal(plan.changes[0].before,plan.changes[0].after)
  const result=await applyOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('apply',plan.digest)})
  const {statSync}=await import('node:fs')
  assert.equal(statSync(file).mode&0o777,0o600)
  const rolled=await rollbackOneNonGitFile(request,{journalDirectory:journal,
    approvalFile:grant('rollback',plan.digest,{rollbackOfTransactionId:result.transactionId})})
  assert.equal(rolled.status,'rolled-back')
  assert.equal(statSync(file).mode&0o777,0o700)
  assert.equal(readFileSync(file,'utf8'),'#!/bin/sh\nexit 0\n')
}))

test('expired, unapproved or altered operator file never authorizes source mutation',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'original')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'worker')
  const plan=await previewNonGitProjectChanges(request)
  const expired=grant('apply',plan.digest,{expiresAt:new Date(Date.now()-1000).toISOString()})
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:expired}),/Invalid or expired/)
  const notApproved=grant('apply',plan.digest,{operatorApproved:false})
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:notApproved}),/Invalid or expired/)
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'original')
}))

test('orphaned owner-only apply lock redacts private journal path and never steals or mutates source',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  const lock=join(journal,'.single-file-apply.lock')
  writeFileSync(lock,'orphaned synthetic lock',{mode:0o600})
  await assert.rejects(
    applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant('apply',preview.digest)}),
    error=>{
      assert.equal(error.message,'Single-file apply lock exists; human reconciliation required')
      assert.equal(error.message.includes(journal),false)
      assert.equal(error.message.includes(source),false)
      return true
    }
  )
  assert.equal(readFileSync(lock,'utf8'),'orphaned synthetic lock','orphan must not be stolen')
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'before')
  assert.equal(existsSync(join(journal,'tx-apply-transaction-00001')),false,'no attempt journal may be created')
}))
test('orphaned owner-only rollback lock redacts path and leaves applied synthetic bytes unchanged',async()=>fixture(async({source,request,journal,grant})=>{
  writeFileSync(join(source,'a.txt'),'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('apply',preview.digest)
  })
  assert.equal(applied.status,'applied')
  const lock=join(journal,'.single-file-apply.lock')
  writeFileSync(lock,'orphaned synthetic rollback lock',{mode:0o600})
  await assert.rejects(
    rollbackOneNonGitFile(request,{
      journalDirectory:journal,
      approvalFile:grant('rollback',preview.digest,{rollbackOfTransactionId:applied.transactionId})
    }),
    error=>{
      assert.equal(error.message,'Single-file apply lock exists; human reconciliation required')
      assert.equal(error.message.includes(journal),false)
      assert.equal(error.message.includes(source),false)
      return true
    }
  )
  assert.equal(readFileSync(lock,'utf8'),'orphaned synthetic rollback lock')
  assert.equal(readFileSync(join(source,'a.txt'),'utf8'),'after')
  assert.equal(readFileSync(join(journal,'tx-'+applied.transactionId,'journal.json'),'utf8').includes('"status":"applied"'),true)
}))

test('hardlink alias preflight rejects synthetic apply without changing either source path',async()=>fixture(async({source,request,journal,grant})=>{
  const original=join(source,'a.txt'),alias=join(source,'alias.txt')
  writeFileSync(original,'before',{mode:0o600})
  linkSync(original,alias)
  assert.equal(statSync(original).ino,statSync(alias).ino)
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  assert.equal(preview.changes.length,1)
  await assert.rejects(applyOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('apply',preview.digest)
  }),/Hardlinked source path requires manual review/)
  assert.equal(readFileSync(original,'utf8'),'before')
  assert.equal(readFileSync(alias,'utf8'),'before')
  assert.equal(statSync(original).ino,statSync(alias).ino)
  assert.equal(existsSync(join(journal,'tx-apply-transaction-00001')),false)
}))
test('external hardlink alias after synthetic apply blocks rollback without consuming rollback journal',async()=>fixture(async({source,request,journal,grant})=>{
  const original=join(source,'a.txt'),alias=join(source,'alias.txt')
  writeFileSync(original,'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('apply',preview.digest)
  })
  linkSync(original,alias)
  assert.equal(statSync(original).nlink,2)
  await assert.rejects(rollbackOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('rollback',preview.digest,{
      rollbackOfTransactionId:applied.transactionId
    })
  }),/Hardlinked source path requires manual review/)
  assert.equal(readFileSync(original,'utf8'),'after')
  assert.equal(readFileSync(alias,'utf8'),'after')
  assert.equal(statSync(original).nlink,2)
  const journalRow=JSON.parse(readFileSync(join(journal,'tx-'+applied.transactionId,'journal.json'),'utf8'))
  assert.equal(journalRow.status,'applied')
  assert.equal(journalRow.rollbackApprovalId,undefined)
}))
test('special POSIX mode bits, where supported, refuse synthetic apply without metadata loss',async(t)=>fixture(async({source,request,journal,grant})=>{
  const original=join(source,'a.txt')
  writeFileSync(original,'before',{mode:0o600})
  chmodSync(original,0o1644)
  const mode=statSync(original).mode&0o7777
  if((mode&0o7000)===0){t.skip('special POSIX mode not supported on fixture filesystem');return}
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  await assert.rejects(applyOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('apply',preview.digest)
  }),/Special source mode bits require manual review/)
  assert.equal(readFileSync(original,'utf8'),'before')
  assert.equal(statSync(original).mode&0o7777,mode)
  assert.equal(existsSync(join(journal,'tx-apply-transaction-00001')),false)
}))
test('special POSIX mode added after synthetic apply blocks rollback, preserving external metadata',async(t)=>fixture(async({source,request,journal,grant})=>{
  const original=join(source,'a.txt')
  writeFileSync(original,'before')
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'after')
  const preview=await previewNonGitProjectChanges(request)
  const applied=await applyOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('apply',preview.digest)
  })
  chmodSync(original,0o1644)
  const mode=statSync(original).mode&0o7777
  if((mode&0o7000)===0){t.skip('special POSIX mode not supported on fixture filesystem');return}
  await assert.rejects(rollbackOneNonGitFile(request,{
    journalDirectory:journal,approvalFile:grant('rollback',preview.digest,{rollbackOfTransactionId:applied.transactionId})
  }),/Special source mode bits require manual review/)
  assert.equal(readFileSync(original,'utf8'),'after')
  assert.equal(statSync(original).mode&0o7777,mode)
  const journalRow=JSON.parse(readFileSync(join(journal,'tx-'+applied.transactionId,'journal.json'),'utf8'))
  assert.equal(journalRow.status,'applied')
}))
