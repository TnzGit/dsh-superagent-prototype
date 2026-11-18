/** I1A: cross-module offline fixture acceptance, NOT a real DSH Worker Session or real Apply.
 * Exercise the actual DshExecutor.prepare project binding followed by the same
 * snapshot function used by its directory preparation, preview, sealed evidence
 * and the durable human-review checkpoint. All writes are disposable fixtures.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {realpathSync} from 'node:fs'
import {DshExecutor} from '../src/executor/dsh.ts'
import {SettingsSchema} from '../src/policy.ts'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot,previewNonGitProjectChanges,verifyProjectSnapshot} from '../src/local-first/project-workspaces.ts'
import {stageNonGitChangeBatch,verifyNonGitStagedBatch} from '../src/local-first/non-git-batch-stage.ts'
import {beginNonGitBatchAudit,issueNextNonGitBatchReviewStep,readNonGitBatchAudit} from '../src/local-first/non-git-batch-audit.ts'

const TICKET_ID='0123456789abcdeffedcba9876543210'
const acceptance={kind:'accept',title:'Review fixture edits',scope:'Review fixture edits',
  reason:'operator requested',name:'fixture-review'}
const ticket=()=>({id:TICKET_ID,origin:{triggerId:'fixture-trigger',triggerIds:['fixture-trigger']},
  mandate:{strength:'explicit',basis:{},scope:'change'},title:'Fixture review'})
const settings=SettingsSchema.parse({sources:{github:{enabled:false,config:{}}}})
function prepared(text,registry,stateDir){
  const host={store:{settings:()=>settings,tickets:{open:()=>[]},
    triggers:{get:()=>({text})}},effects:{handle:()=>{}},
    machine:{stateDir},localProjects:registry,localOnly:()=>true}
  return new DshExecutor(host).prepare(ticket(),acceptance).execution
}
async function fixture(run){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'dsh-i1a-ticket-')))
  const roots=join(base,'registered'),stateDir=join(base,'state')
  const stageRoot=join(base,'private-staged'),auditRoot=join(base,'private-audit')
  for(const dir of [roots,stateDir,stageRoot,auditRoot])mkdirSync(dir,{mode:0o700})
  const source=join(roots,'notes')
  mkdirSync(source,{mode:0o700})
  const registry=new LocalProjectRegistry([roots],[{id:'notes',root:source,kind:'local'}])
  try{await run({base,source,registry,stateDir,stageRoot,auditRoot})}
  finally{rmSync(base,{recursive:true,force:true})}
}
const privateGrant=(path,fields)=>{
  writeFileSync(path,JSON.stringify(fields)+'\n',{mode:0o600})
  assert.equal(statSync(path).mode&0o777,0o600)
  return path
}
test('I1A actual Ticket selection connects to snapshot, 3-file preview, sealed evidence and no-write review checkpoint',()=>fixture(async({base,source,registry,stateDir,stageRoot,auditRoot})=>{
  writeFileSync(join(source,'modify.txt'),'source-before\n',{mode:0o644})
  writeFileSync(join(source,'delete.txt'),'delete-before\n',{mode:0o644})
  writeFileSync(join(source,'.env'),'fake-secret-excluded\n',{mode:0o600})
  const selected=prepared('/project notes\nPlease edit the disposable files',registry,stateDir)
  assert.equal(selected.projectId,'notes')
  assert.equal(selected.localProjectError,undefined)
  assert.match(selected.directory,/work/)
  const input={registry,projectId:selected.projectId,directory:selected.directory,
    fingerprint:selected.projectFingerprint}
  await registry.write('notes',()=>createProjectSnapshot(input))
  await verifyProjectSnapshot(input)
  assert.equal(existsSync(join(input.directory,'.env')),false)
  assert.equal(readFileSync(join(input.directory,'modify.txt'),'utf8'),'source-before\n')
  // Mimic ONLY the isolated Worker copy edit; no DSH Session or real model runs.
  writeFileSync(join(input.directory,'modify.txt'),'worker-after\n')
  rmSync(join(input.directory,'delete.txt'))
  writeFileSync(join(input.directory,'add.bin'),Buffer.from([0,255,11]))
  const preview=await previewNonGitProjectChanges(input)
  assert.deepEqual(preview.changes.map(c=>[c.path,c.action]),[
    ['add.bin','add'],['delete.txt','delete'],['modify.txt','modify']])
  assert.equal(preview.projectId,selected.projectId)
  assert.equal(preview.rootFingerprint,selected.projectFingerprint)
  assert.match(preview.digest,/^[a-f0-9]{64}$/)
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'source-before\n')
  assert.equal(readFileSync(join(source,'delete.txt'),'utf8'),'delete-before\n')
  assert.equal(existsSync(join(source,'add.bin')),false)
  const stageId='integration-stage-00001',auditId='integration-audit-00001'
  const stageApproval=privateGrant(join(base,'fixture-stage-grant.json'),{
    version:1,operation:'stage-batch',approvalId:'integration-stage-grant-00001',
    batchId:stageId,projectId:'notes',rootFingerprint:input.fingerprint,
    previewDigest:preview.digest,expiresAt:new Date(Date.now()+120000).toISOString(),
    operatorApproved:true
  })
  const sealed=await stageNonGitChangeBatch(input,{journalRoot:stageRoot,approvalFile:stageApproval})
  assert.equal(sealed.changes.length,3)
  assert.equal(sealed.status,'sealed')
  assert.equal(sealed.previewDigest,preview.digest)
  assert.deepEqual(await verifyNonGitStagedBatch(input,{journalRoot:stageRoot,
    batchId:stageId,expectedPreviewDigest:preview.digest}),sealed)
  const auditApproval=privateGrant(join(base,'fixture-audit-grant.json'),{
    version:1,operation:'plan-batch-steps',
    approvalId:'integration-audit-grant-00001',executionId:auditId,
    batchId:stageId,projectId:'notes',rootFingerprint:input.fingerprint,
    previewDigest:preview.digest,sealDigest:sealed.digest,
    expiresAt:new Date(Date.now()+120000).toISOString(),operatorApproved:true
  })
  const audit=await beginNonGitBatchAudit(input,sealed,{
    stageRoot,auditRoot,approvalFile:auditApproval})
  assert.equal(audit.status,'ready')
  assert.equal(audit.autoApplyAllowed,false)
  const reviewOpts={auditRoot,executionId:auditId,stageRoot}
  const pending=await issueNextNonGitBatchReviewStep(input,sealed,reviewOpts)
  assert.equal(pending.status,'awaiting-human')
  assert.equal(pending.pendingIndex,0)
  assert.equal(pending.autoApplyAllowed,false)
  await assert.rejects(issueNextNonGitBatchReviewStep(input,sealed,reviewOpts),/cannot issue/)
  assert.equal((await readNonGitBatchAudit(input,sealed,reviewOpts)).status,'awaiting-human')
  assert.equal(readFileSync(join(source,'modify.txt'),'utf8'),'source-before\n')
  assert.equal(readFileSync(join(source,'delete.txt'),'utf8'),'delete-before\n')
  assert.equal(existsSync(join(source,'add.bin')),false)
  assert.equal(readFileSync(join(source,'.env'),'utf8'),'fake-secret-excluded\n')
}))
test('I1A invalid or missing project selector fails before source or Worker workspace preparation',()=>fixture(async({source,registry,stateDir})=>{
  writeFileSync(join(source,'unchanged.txt'),'untouched\n')
  const messages=['Please edit notes','/project unknown\nEdit a file',
    '/project ../outside\nEdit a file','/new-project surprise']
  for(const message of messages){
    const execution=prepared(message,registry,stateDir)
    assert.equal(execution.projectId,undefined)
    assert.ok(execution.localProjectError,'invalid selector must be blocked')
    assert.equal(existsSync(execution.directory),false)
    assert.equal(readFileSync(join(source,'unchanged.txt'),'utf8'),'untouched\n')
  }
}))
