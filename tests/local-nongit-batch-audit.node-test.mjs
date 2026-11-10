import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,chmodSync,existsSync,realpathSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot,projectFingerprint,previewNonGitProjectChanges} from '../src/local-first/project-workspaces.ts'
import {stageNonGitChangeBatch} from '../src/local-first/non-git-batch-stage.ts'
import {
  beginNonGitBatchAudit,issueNextNonGitBatchReviewStep,
  confirmNonGitBatchReviewStep,readNonGitBatchAudit
} from '../src/local-first/non-git-batch-audit.ts'

async function fixture(run){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'c6b2b2-synthetic-')))
  const roots=join(base,'roots'),work=join(base,'worker'),stagedRoot=join(base,'staged'),
    auditRoot=join(base,'audit')
  for(const dir of [roots,work,stagedRoot,auditRoot])mkdirSync(dir,{mode:0o700})
  const source=join(roots,'notes')
  mkdirSync(source,{mode:0o700})
  const registry=new LocalProjectRegistry([roots],[{id:'notes',root:source,kind:'local'}])
  const input={registry,projectId:'notes',
    directory:join(work,'ticket'),fingerprint:projectFingerprint(registry.get('notes'))}
  try{
    writeFileSync(join(source,'delete.txt'),'delete me')
    writeFileSync(join(source,'modify.txt'),'before')
    await createProjectSnapshot(input)
    rmSync(join(input.directory,'delete.txt'))
    writeFileSync(join(input.directory,'modify.txt'),'after')
    writeFileSync(join(input.directory,'new.txt'),Buffer.from([1,255,0,7]))
    const plan=await previewNonGitProjectChanges(input)
    const stageFile=join(base,'stage-grant.json')
    writeFileSync(stageFile,JSON.stringify({version:1,operation:'stage-batch',
      approvalId:'stage-approval-0001',batchId:'stage-batch-00001',projectId:'notes',
      rootFingerprint:input.fingerprint,previewDigest:plan.digest,
      expiresAt:new Date(Date.now()+60_000).toISOString(),operatorApproved:true}),{mode:0o600})
    const seal=await stageNonGitChangeBatch(input,{journalRoot:stagedRoot,approvalFile:stageFile})
    let next=0
    function approve(extra={}){
      next++
      const file=join(base,'audit-grant-'+next+'.json')
      const fields={version:1,operation:'plan-batch-steps',
        approvalId:'audit-approval-'+next+'-0001',
        executionId:'batch-execution-'+next+'-0001',
        batchId:seal.batchId,projectId:'notes',
        rootFingerprint:input.fingerprint,previewDigest:seal.previewDigest,
        sealDigest:seal.digest,expiresAt:new Date(Date.now()+60_000).toISOString(),
        operatorApproved:true,...extra}
      writeFileSync(file,JSON.stringify(fields),{mode:0o600})
      return {file,fields}
    }
    // Manual source changes below simulate a SEPARATE human-driven file actor.
    // The batch audit module itself must never import a source writer.
    function simulateHumanFileChange(index){
      const row=seal.changes[index]
      assert.ok(row)
      const path=join(source,row.path)
      if(row.action==='delete'){rmSync(path);return}
      const bytes=readFileSync(join(input.directory,row.path))
      writeFileSync(path,bytes)
      chmodSync(path,row.afterMode)
    }
    await run({source,input,seal,stagedRoot,auditRoot,approve,simulateHumanFileChange,base})
  }finally{rmSync(base,{recursive:true,force:true})}
}
const opts=(root,id)=>({auditRoot:root,executionId:id})
test('audit creates durable no-write intent, then each manual file is confirmed in sorted order',async()=>fixture(async({source,input,seal,stagedRoot,auditRoot,approve,simulateHumanFileChange})=>{
  const {file,fields}=approve()
  const baseline=readFileSync(join(source,'modify.txt'))
  const row=await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:file})
  assert.equal(row.status,'ready')
  assert.equal(row.autoApplyAllowed,false)
  assert.equal(row.nextIndex,0)
  assert.deepEqual(row.events,[])
  assert.deepEqual(readFileSync(join(source,'modify.txt')),baseline)
  for(let i=0;i<seal.changes.length;i++){
    const p=opts(auditRoot,fields.executionId)
    const pending=await issueNextNonGitBatchReviewStep(input,seal,p)
    assert.equal(pending.status,'awaiting-human')
    assert.equal(pending.pendingIndex,i)
    assert.equal(pending.autoApplyAllowed,false)
    assert.equal((await readNonGitBatchAudit(input,seal,p)).status,'awaiting-human')
    await assert.rejects(issueNextNonGitBatchReviewStep(input,seal,p),/cannot issue another step/)
    simulateHumanFileChange(i)
    const confirmed=await confirmNonGitBatchReviewStep(input,seal,p)
    assert.equal(confirmed.nextIndex,i+1)
    assert.equal(confirmed.status,i===seal.changes.length-1?'complete':'ready')
    assert.equal(confirmed.autoApplyAllowed,false)
    assert.equal(confirmed.events.length,2*(i+1))
    assert.equal((await readNonGitBatchAudit(input,seal,p)).status,confirmed.status)
  }
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'after')
  assert.equal(existsSync(join(source,'delete.txt')),false)
  assert.deepEqual(readFileSync(join(source,'new.txt')),Buffer.from([1,255,0,7]))
  await assert.rejects(issueNextNonGitBatchReviewStep(input,seal,opts(auditRoot,fields.executionId)),/cannot issue/)
}))
test('crash after durable issue never reissues; later human evidence confirms without retrying a write',async()=>fixture(async({input,seal,stagedRoot,auditRoot,approve,simulateHumanFileChange})=>{
  const {file,fields}=approve()
  await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:file})
  const p=opts(auditRoot,fields.executionId)
  const issued=await issueNextNonGitBatchReviewStep(input,seal,p)
  assert.equal(issued.status,'awaiting-human')
  // Simulate killing the caller and reopening persisted state:
  assert.equal((await readNonGitBatchAudit(input,seal,p)).pendingIndex,0)
  await assert.rejects(issueNextNonGitBatchReviewStep(input,seal,p),/cannot issue/)
  simulateHumanFileChange(0)
  const confirmed=await confirmNonGitBatchReviewStep(input,seal,p)
  assert.equal(confirmed.status,'ready')
  assert.equal(confirmed.nextIndex,1)
  await assert.rejects(confirmNonGitBatchReviewStep(input,seal,p),/No pending/)
}))
test('missing manual after-image freezes the attempt in review-required without automatic retry',async()=>fixture(async({source,input,seal,stagedRoot,auditRoot,approve})=>{
  const {file,fields}=approve()
  await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:file})
  const p=opts(auditRoot,fields.executionId)
  await issueNextNonGitBatchReviewStep(input,seal,p)
  await assert.rejects(confirmNonGitBatchReviewStep(input,seal,p),/human review required/)
  const row=await readNonGitBatchAudit(input,seal,p)
  assert.equal(row.status,'review-required')
  assert.equal(row.nextIndex,0)
  assert.equal(row.events.at(-1).action,'review-required')
  await assert.rejects(issueNextNonGitBatchReviewStep(input,seal,p),/cannot issue/)
  await assert.rejects(confirmNonGitBatchReviewStep(input,seal,p),/No pending/)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
}))
test('an external change to a future file before the expected step freezes the batch',async()=>fixture(async({source,input,seal,stagedRoot,auditRoot,approve,simulateHumanFileChange})=>{
  const {file,fields}=approve()
  await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:file})
  const p=opts(auditRoot,fields.executionId)
  await issueNextNonGitBatchReviewStep(input,seal,p)
  simulateHumanFileChange(0)
  // The future planned modify has been changed prematurely by a foreign writer.
  writeFileSync(join(source,'modify.txt'),'unexpected externally edited bytes')
  await assert.rejects(confirmNonGitBatchReviewStep(input,seal,p),/human review required/)
  assert.equal((await readNonGitBatchAudit(input,seal,p)).status,'review-required')
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'unexpected externally edited bytes')
}))
test('a forged scope, weak approval or expired approval never creates an execution audit',async()=>fixture(async({input,seal,stagedRoot,auditRoot,approve})=>{
  const bad=approve({sealDigest:'0'.repeat(64)})
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:bad.file}),/approval scope mismatch/)
  const weak=approve()
  chmodSync(weak.file,0o644)
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:weak.file}),/owner-only/)
  const expired=approve({expiresAt:new Date(Date.now()-1000).toISOString()})
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:expired.file}),/Invalid or expired/)
}))
test('same approval/execution cannot be rearmed, even after an audit has already started',async()=>fixture(async({input,seal,stagedRoot,auditRoot,approve})=>{
  const {file}=approve()
  await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:file})
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:file}),/already consumed/)
  const other=approve()
  // A separate approval must NOT create a concurrent active ledger, even when
  // the first ledger is still 'ready' (before the first checkpoint).
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:other.file}),/needs human reconciliation/)
}))
test('corrupt audit journal and orphaned lock fail closed without touching the source',async()=>fixture(async({input,seal,stagedRoot,auditRoot,approve,source})=>{
  const first=approve()
  await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:first.file})
  const journal=join(auditRoot,'execution-'+first.fields.executionId,'audit.json')
  const data=JSON.parse(readFileSync(journal,'utf8'))
  data.nextIndex=2
  writeFileSync(journal,JSON.stringify(data))
  await assert.rejects(readNonGitBatchAudit(input,seal,opts(auditRoot,first.fields.executionId)),/integrity/)
  const later=approve()
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:later.file}),/Unreconciled/)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
}))
test('historical awaiting-human audit blocks new attempt for same project',async()=>fixture(async({input,seal,stagedRoot,auditRoot,approve})=>{
  const first=approve()
  await beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,auditRoot,approvalFile:first.file})
  await issueNextNonGitBatchReviewStep(input,seal,opts(auditRoot,first.fields.executionId))
  const other=approve()
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot,approvalFile:other.file}),/needs human reconciliation/)
}))
test('audit root may not overlap project source, worker or staging; neither source nor staging are modified',async()=>fixture(async({input,source,seal,stagedRoot,auditRoot,approve})=>{
  const {file}=approve()
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot:source,approvalFile:file}),/separate from source/)
  await assert.rejects(beginNonGitBatchAudit(input,seal,{stageRoot:stagedRoot,
    auditRoot:stagedRoot,approvalFile:file}),/not overlap/)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
}))
