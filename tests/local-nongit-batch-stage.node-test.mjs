import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync,symlinkSync,existsSync,realpathSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot,projectFingerprint,previewNonGitProjectChanges} from '../src/local-first/project-workspaces.ts'
import {stageNonGitChangeBatch,verifyNonGitStagedBatch} from '../src/local-first/non-git-batch-stage.ts'
async function fixture(fn){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'c6b2-synthetic-')))
  const roots=join(base,'registered'),workers=join(base,'workers'),journalRoot=join(base,'private-journal')
  mkdirSync(roots,{mode:0o700});mkdirSync(workers,{mode:0o700});mkdirSync(journalRoot,{mode:0o700})
  const source=join(roots,'doc');mkdirSync(source,{mode:0o700})
  const registry=new LocalProjectRegistry([roots],[{id:'doc',root:source,kind:'local'}])
  const input={registry,projectId:'doc',directory:join(workers,'ticket'),fingerprint:projectFingerprint(registry.get('doc'))}
  let n=0
  function grant(previewDigest,extra={}){
    n++
    const file=join(base,'grant-'+n+'.json')
    const value={version:1,operation:'stage-batch',approvalId:'approval-c6b2-'+n,
      batchId:'batch-c6b2-'+n,projectId:input.projectId,rootFingerprint:input.fingerprint,
      previewDigest,expiresAt:new Date(Date.now()+60_000).toISOString(),operatorApproved:true,...extra}
    writeFileSync(file,JSON.stringify(value),{mode:0o600})
    return {file,value}
  }
  try{await fn({base,source,input,journalRoot,grant})}
  finally{rmSync(base,{recursive:true,force:true})}
}
async function prepare(source,input){
  mkdirSync(join(source,'sub'))
  writeFileSync(join(source,'change.txt'),'old content')
  writeFileSync(join(source,'sub','delete.txt'),'gone')
  writeFileSync(join(source,'.env'),'keep private')
  await createProjectSnapshot(input)
  writeFileSync(join(input.directory,'change.txt'),'new content')
  rmSync(join(input.directory,'sub','delete.txt'))
  writeFileSync(join(input.directory,'binary.bin'),Buffer.from([0,255,1,2]))
  return previewNonGitProjectChanges(input)
}
test('sealed three-file batch stores immutable private before/after images; original remains untouched',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const preview=await prepare(source,input)
  const {file,value}=grant(preview.digest)
  const sealed=await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  assert.equal(sealed.status,'sealed')
  assert.equal(sealed.previewDigest,preview.digest)
  assert.deepEqual(sealed.changes.map(x=>[x.path,x.action]),[
    ['binary.bin','add'],['change.txt','modify'],['sub/delete.txt','delete']])
  assert.match(sealed.digest,/^[a-f0-9]{64}$/)
  const verified=await verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,expectedPreviewDigest:preview.digest})
  assert.deepEqual(verified,sealed)
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
  assert.equal(readFileSync(join(source,'sub','delete.txt'),'utf8'),'gone')
  assert.equal(existsSync(join(source,'binary.bin')),false)
  assert.equal(readFileSync(join(source,'.env'),'utf8'),'keep private')
  const folder=join(journalRoot,'batch-'+value.batchId)
  assert.deepEqual(readFileSync(join(folder,'after-000.bin')),Buffer.from([0,255,1,2]))
  assert.equal(readFileSync(join(folder,'before-001.bin'),'utf8'),'old content')
  assert.equal(readFileSync(join(folder,'after-001.bin'),'utf8'),'new content')
}))
test('mode-only worker change remains in sealed plan with exact original/worker modes',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const path=join(source,'run.sh')
  writeFileSync(path,'#!/bin/sh\nexit 0\n',{mode:0o700});chmodSync(path,0o700)
  await createProjectSnapshot(input)
  chmodSync(join(input.directory,'run.sh'),0o600)
  const plan=await previewNonGitProjectChanges(input)
  const {file,value}=grant(plan.digest)
  const seal=await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  assert.equal(seal.changes.length,1)
  assert.equal(seal.changes[0].before,seal.changes[0].after)
  assert.equal(seal.changes[0].beforeMode,0o700)
  assert.equal(seal.changes[0].afterMode,0o600)
  await verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,expectedPreviewDigest:plan.digest})
}))
test('duplicate approval and duplicate batch ID never overwrite completed private evidence',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const plan=await prepare(source,input)
  const {file,value}=grant(plan.digest)
  await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:file}),/already consumed/)
  const second=grant(plan.digest,{batchId:value.batchId})
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:second.file}),/EEXIST/)
}))
test('bad approval, expired approval and wrong plan digest never stage private images',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const plan=await prepare(source,input)
  const expired=grant(plan.digest,{expiresAt:new Date(Date.now()-1000).toISOString()})
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:expired.file}),/expired/)
  const bad=grant('e'.repeat(64))
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:bad.file}),/digest mismatch/)
  const weak=grant(plan.digest)
  chmodSync(weak.file,0o644)
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:weak.file}),/owner-only/)
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
}))
test('unsealed failed stage blocks other stages until explicit human reconciliation',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const plan=await prepare(source,input)
  const first=grant('f'.repeat(64))
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:first.file}),/digest mismatch/)
  assert.equal(existsSync(join(journalRoot,'batch-'+first.value.batchId,'intent.json')),true)
  const second=grant(plan.digest)
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:second.file}),/Unsealed or corrupt/)
}))
test('tampered stored image and extra private files prevent verification',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const plan=await prepare(source,input)
  const {file,value}=grant(plan.digest)
  await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  const dir=join(journalRoot,'batch-'+value.batchId)
  writeFileSync(join(dir,'after-001.bin'),'attacker changed image')
  await assert.rejects(verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,expectedPreviewDigest:plan.digest}),/Corrupted/)
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
}))
test('source/worker drift after sealing refuses verification, never applies files',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const plan=await prepare(source,input)
  const {file,value}=grant(plan.digest)
  await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  writeFileSync(join(source,'change.txt'),'external changed source')
  await assert.rejects(verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,expectedPreviewDigest:plan.digest}),/changed/)
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'external changed source')
}))
test('symlinked journal root and symlinked worker path fail closed',async()=>fixture(async({source,input,journalRoot,grant,base})=>{
  const plan=await prepare(source,input)
  const redirect=join(base,'redirect')
  symlinkSync(journalRoot,redirect)
  const {file}=grant(plan.digest)
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot:redirect,approvalFile:file}),/private non-symlink/)
  rmSync(join(input.directory,'change.txt'))
  symlinkSync(join(source,'change.txt'),join(input.directory,'change.txt'))
  await assert.rejects(stageNonGitChangeBatch(input,{journalRoot,approvalFile:file}),/Symlink|symlink|Unsafe/)
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
}))

test('chmod-only source/worker drift after seal fails verification despite unchanged Git blob OIDs',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const preview=await prepare(source,input)
  const {file,value}=grant(preview.digest)
  await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  chmodSync(join(source,'change.txt'),0o600)
  await assert.rejects(verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,
    expectedPreviewDigest:preview.digest}),/content\/mode drift/)
  chmodSync(join(source,'change.txt'),0o644)
  chmodSync(join(input.directory,'change.txt'),0o600)
  await assert.rejects(verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,
    expectedPreviewDigest:preview.digest}),/content\/mode drift/)
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
}))
test('extra file and altered seal are rejected by read-only verifier',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const preview=await prepare(source,input)
  const {file,value}=grant(preview.digest)
  await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  const folder=join(journalRoot,'batch-'+value.batchId)
  writeFileSync(join(folder,'unknown.bin'),'not staged')
  await assert.rejects(verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,
    expectedPreviewDigest:preview.digest}),/Unexpected file/)
  rmSync(join(folder,'unknown.bin'))
  const seal=join(folder,'seal.json')
  const changed=JSON.parse(readFileSync(seal,'utf8'))
  changed.changes[0].action='delete'
  writeFileSync(seal,JSON.stringify(changed))
  await assert.rejects(verifyNonGitStagedBatch(input,{journalRoot,batchId:value.batchId,
    expectedPreviewDigest:preview.digest}),/digest mismatch/)
}))

test('absent batch verification fails with sanitized error, not a private directory path',async()=>fixture(async({source,input,journalRoot})=>{
  const preview=await prepare(source,input)
  const missing='batch-missing-00001'
  await assert.rejects(verifyNonGitStagedBatch(input,{
    journalRoot,batchId:missing,expectedPreviewDigest:preview.digest
  }),error=>{
    assert.match(error.message,/Batch directory is unsafe or unavailable/)
    assert.equal(error.message.includes(journalRoot),false)
    assert.equal(error.message.includes(input.directory),false)
    return true
  })
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
}))
test('sealed evidence images remain independently readable after stage returns',async()=>fixture(async({source,input,journalRoot,grant})=>{
  const preview=await prepare(source,input)
  const {file,value}=grant(preview.digest)
  const sealed=await stageNonGitChangeBatch(input,{journalRoot,approvalFile:file})
  const folder=join(journalRoot,'batch-'+value.batchId)
  assert.equal(sealed.changes.length,3)
  for(const record of sealed.changes){
    for(const name of [record.beforeImage,record.afterImage]){
      if(!name)continue
      const content=readFileSync(join(folder,name))
      assert.ok(content.length>0)
    }
  }
  await verifyNonGitStagedBatch(input,{
    journalRoot,batchId:value.batchId,expectedPreviewDigest:preview.digest
  })
  assert.equal(readFileSync(join(source,'change.txt'),'utf8'),'old content')
}))
