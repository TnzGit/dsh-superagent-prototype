import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,chmodSync,statSync,realpathSync,renameSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot,projectFingerprint,previewNonGitProjectChanges} from '../src/local-first/project-workspaces.ts'
import {stageNonGitChangeBatch} from '../src/local-first/non-git-batch-stage.ts'
import {beginNonGitBatchAudit,readNonGitBatchAudit,issueNextNonGitBatchReviewStep} from '../src/local-first/non-git-batch-audit.ts'
import {executeOneSyntheticBatchStep,readSyntheticBatchStepReceipt} from '../src/local-first/non-git-batch-executor.ts'

async function fixture(run){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'dsh-c6b2b4-synthetic-')))
  const roots=join(base,'roots'),workers=join(base,'workers'),stageRoot=join(base,'stage'),
    auditRoot=join(base,'audit'),receiptRoot=join(base,'receipts')
  for(const path of [roots,workers,stageRoot,auditRoot,receiptRoot])
    mkdirSync(path,{mode:0o700})
  writeFileSync(join(base,'.dsh-c6b2b4-synthetic-only'),
    'C6B2B4_SYNTHETIC_ONLY\n',{mode:0o600})
  const source=join(roots,'notes')
  mkdirSync(source,{mode:0o700})
  const registry=new LocalProjectRegistry([roots],[{id:'notes',root:source,kind:'local'}])
  const input={registry,projectId:'notes',directory:join(workers,'ticket'),
    fingerprint:projectFingerprint(registry.get('notes'))}
  let grantNumber=0
  try{
    writeFileSync(join(source,'delete.txt'),'delete me')
    writeFileSync(join(source,'modify.txt'),'before')
    await createProjectSnapshot(input)
    rmSync(join(input.directory,'delete.txt'))
    writeFileSync(join(input.directory,'modify.txt'),'after')
    writeFileSync(join(input.directory,'new.txt'),Buffer.from([1,255,3,0]))
    const plan=await previewNonGitProjectChanges(input)
    const stageApproval=join(base,'stage.json')
    writeFileSync(stageApproval,JSON.stringify({version:1,operation:'stage-batch',
      approvalId:'stage-approval-00001',batchId:'batch-synthetic-00001',
      projectId:'notes',rootFingerprint:input.fingerprint,previewDigest:plan.digest,
      expiresAt:new Date(Date.now()+120_000).toISOString(),operatorApproved:true}),{mode:0o600})
    const seal=await stageNonGitChangeBatch(input,{journalRoot:stageRoot,approvalFile:stageApproval})
    const auditApproval=join(base,'audit.json')
    const executionId='audit-synthetic-00001'
    writeFileSync(auditApproval,JSON.stringify({version:1,operation:'plan-batch-steps',
      approvalId:'audit-approval-00001',executionId,batchId:seal.batchId,
      projectId:'notes',rootFingerprint:input.fingerprint,
      previewDigest:seal.previewDigest,sealDigest:seal.digest,
      expiresAt:new Date(Date.now()+120_000).toISOString(),operatorApproved:true}),{mode:0o600})
    await beginNonGitBatchAudit(input,seal,{stageRoot,auditRoot,approvalFile:auditApproval})
    function grant(stepIndex,extra={}){
      grantNumber++
      const grantId='synthetic-step-grant-'+grantNumber+'-00001'
      const transactionId='synthetic-step-tx-'+grantNumber+'-00001'
      const grantFile=join(base,'step-'+grantNumber+'.json')
      writeFileSync(grantFile,JSON.stringify({version:1,operation:'synthetic-batch-step',
        grantId,transactionId,executionId,batchId:seal.batchId,
        projectId:'notes',rootFingerprint:input.fingerprint,sealDigest:seal.digest,
        previewDigest:seal.previewDigest,stepIndex,
        expiresAt:new Date(Date.now()+120_000).toISOString(),operatorApproved:true,
        ...extra}),{mode:0o600})
      return {grantId,transactionId,grantFile}
    }
    const props={stageRoot,auditRoot,receiptRoot,executionId}
    const meta=[]
    async function actor(step){
      meta.push(step)
      const target=join(source,step.path)
      if(step.action==='delete'){
        rmSync(target)
      }else{
        writeFileSync(target,readFileSync(join(input.directory,step.path)))
        chmodSync(target,step.afterMode)
      }
    }
    await run({base,source,input,seal,props,grant,actor,meta,stageRoot,auditRoot,receiptRoot})
  }finally{rmSync(base,{recursive:true,force:true})}
}
const execute=(input,seal,props,grant,actor)=>
  executeOneSyntheticBatchStep(input,seal,{...props,grantFile:grant.grantFile,actor})
const inspectReceipt=(input,props,grant)=>
  readSyntheticBatchStepReceipt(input,{...props,transactionId:grant.transactionId})

test('synthetic-only steps consume a third independent grant and durably confirm three file images',async()=>fixture(async({source,input,seal,props,grant,actor,meta,receiptRoot})=>{
  assert.deepEqual(seal.changes.map(x=>x.action),['delete','modify','add'])
  for(let i=0;i<3;i++){
    const g=grant(i)
    const r=await execute(input,seal,props,g,actor)
    assert.equal(r.phase,'observed')
    assert.equal(r.stepIndex,i)
    assert.equal(r.autoRetryAllowed,false)
    assert.match(r.digest,/^[a-f0-9]{64}$/)
    assert.deepEqual(await inspectReceipt(input,props,g),r)
    assert.equal(statSync(join(receiptRoot,'step-'+g.transactionId,'receipt.json')).mode&0o777,0o600)
    assert.equal((await readNonGitBatchAudit(input,seal,props)).nextIndex,i+1)
    assert.equal((await readNonGitBatchAudit(input,seal,props)).status,i===2?'complete':'ready')
    await assert.rejects(execute(input,seal,props,g,actor),/fresh ready audit boundary|already been consumed/)
    assert.equal(meta.length,i+1,'no duplicated source mutation')
  }
  assert.equal(existsSync(join(source,'delete.txt')),false)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'after')
  assert.deepEqual(readFileSync(join(source,'new.txt')),Buffer.from([1,255,3,0]))
}))

test('actor throws after durable issued receipt: no replay and no automatic rollback',async()=>fixture(async({source,input,seal,props,grant,actor})=>{
  const g=grant(0)
  let count=0
  await assert.rejects(execute(input,seal,props,g,async()=>{
    count++
    throw Error('synthetic crash injected')
  }),/outcome requires manual inspection/)
  assert.equal(count,1)
  assert.equal((await inspectReceipt(input,props,g)).phase,'issued')
  const audit=await readNonGitBatchAudit(input,seal,props)
  assert.equal(audit.status,'awaiting-human')
  assert.equal(audit.events.length,1)
  await assert.rejects(execute(input,seal,props,g,actor),/fresh ready audit boundary/)
  assert.equal(count,1)
  assert.equal(readFileSync(join(source,'delete.txt'),'utf8'),'delete me')
}))

test('wrong external file bytes make audit terminal review-required, never safe retry',async()=>fixture(async({source,input,seal,props,grant})=>{
  const g=grant(0)
  await assert.rejects(execute(input,seal,props,g,async()=>{
    writeFileSync(join(source,'delete.txt'),'tampered instead of deleted')
  }),/outcome requires manual inspection/)
  assert.equal((await inspectReceipt(input,props,g)).phase,'issued')
  const row=await readNonGitBatchAudit(input,seal,props)
  assert.equal(row.status,'review-required')
  assert.equal(row.events.at(-1).action,'review-required')
  assert.equal(readFileSync(join(source,'delete.txt'),'utf8'),'tampered instead of deleted')
}))

test('worker drift after receipt preparation prevents issue and leaves reserved receipt only',async()=>fixture(async({source,input,seal,props,grant,actor,meta})=>{
  const g=grant(0)
  writeFileSync(join(input.directory,'modify.txt'),'worker changed without a new seal')
  await assert.rejects(execute(input,seal,props,g,actor),
    /Staged worker after-image content\/mode drift before issue/)
  assert.equal((await inspectReceipt(input,props,g)).phase,'reserved')
  assert.equal((await readNonGitBatchAudit(input,seal,props)).status,'ready')
  assert.equal((await readNonGitBatchAudit(input,seal,props)).events.length,0)
  assert.equal(meta.length,0)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
  // Even a separately generated grant is not allowed to silently go past the
  // incomplete durable receipt for this project.
  const later=grant(0)
  await assert.rejects(execute(input,seal,props,later,actor),
    /Synthetic execution grant\/step has already been consumed|Pending synthetic execution needs manual review/)
}))

test('expired, mismatched or non-private independent grant rejects before actor',async()=>fixture(async({source,input,seal,props,grant,actor,meta})=>{
  const expired=grant(0,{expiresAt:new Date(Date.now()-1000).toISOString()})
  await assert.rejects(execute(input,seal,props,expired,actor),/Invalid or expired/)
  const mismatch=grant(0,{sealDigest:'f'.repeat(64)})
  await assert.rejects(execute(input,seal,props,mismatch,actor),/grant\/scope mismatch/)
  const weak=grant(0)
  chmodSync(weak.grantFile,0o644)
  await assert.rejects(execute(input,seal,props,weak,actor),/owner-only/)
  assert.equal(meta.length,0)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
}))

test('removing fixture marker or moving source outside the fixture disables actor entirely',async()=>fixture(async({base,source,input,seal,props,grant,actor,meta})=>{
  const marker=join(base,'.dsh-c6b2b4-synthetic-only')
  const g=grant(0)
  rmSync(marker)
  await assert.rejects(execute(input,seal,props,g,actor),/marker missing/)
  writeFileSync(marker,'NO',{mode:0o600})
  await assert.rejects(execute(input,seal,props,g,actor),/marker invalid/)
  assert.equal(meta.length,0)
  assert.equal(readFileSync(join(source,'delete.txt'),'utf8'),'delete me')
}))

test('receipt root overlap and untrusted missing historical journal fail before source mutation',async()=>fixture(async({input,source,seal,props,grant,actor,meta,receiptRoot})=>{
  const g=grant(0)
  await assert.rejects(execute(input,seal,{...props,receiptRoot:source},g,actor),
    /must not overlap/)
  const incomplete=join(receiptRoot,'step-abandoned-step-00001')
  mkdirSync(incomplete,{mode:0o700})
  await assert.rejects(execute(input,seal,props,g,actor),/Unreconciled synthetic execution journal/)
  assert.equal(meta.length,0)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'before')
}))

test('pending audit checkpoint from another actor cannot be silently adopted or replayed',async()=>fixture(async({input,seal,props,grant,actor,meta})=>{
  await issueNextNonGitBatchReviewStep(input,seal,props)
  const g=grant(0)
  await assert.rejects(execute(input,seal,props,g,actor),/fresh ready audit boundary/)
  assert.equal(meta.length,0)
  assert.equal((await readNonGitBatchAudit(input,seal,props)).status,'awaiting-human')
}))
