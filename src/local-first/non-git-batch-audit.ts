/** C6B2B2 — durable, default-OFF, source-READ-ONLY batch step audit.
 *
 * A batch "issued" event is a write-ahead HUMAN-REVIEW CHECKPOINT, not an
 * authorization or an instruction to change a source file. A separate future
 * operator-approved adapter would have to perform a real mutation. This module
 * has NO mutating calls targeting a registered project, no automatic retries,
 * no automatic rollback and no Runtime/Worker/Weixin callers.
 */
import {createHash,randomUUID} from 'node:crypto'
import {lstatSync,readFileSync,realpathSync} from 'node:fs'
import {lstat,open,readFile,readdir,rename,rm,unlink,mkdir} from 'node:fs/promises'
import {isAbsolute,join,relative,sep} from 'node:path'
import {projectFingerprint,type SnapshotRequest} from './project-workspaces.ts'
import {verifyNonGitStagedBatch,verifyNonGitStagedWorkerAfterImages,type NonGitBatchSeal} from './non-git-batch-stage.ts'
import {inspectNonGitBatchRecovery} from './non-git-batch-recovery.ts'

const ID=/^[a-z0-9][a-z0-9-]{7,79}$/
const HASH=/^[0-9a-f]{64}$/
export interface BatchAuditGrant {
  version:1
  operation:'plan-batch-steps'
  approvalId:string
  executionId:string
  batchId:string
  projectId:string
  rootFingerprint:string
  previewDigest:string
  sealDigest:string
  expiresAt:string
  operatorApproved:true
}
export type BatchAuditStatus='ready'|'awaiting-human'|'review-required'|'complete'
export interface BatchAuditEvent{
  index:number
  action:'issued'|'confirmed'|'review-required'
  path:string
}
export interface NonGitBatchAudit{
  version:1
  status:BatchAuditStatus
  executionId:string
  approvalId:string
  batchId:string
  projectId:string
  rootFingerprint:string
  previewDigest:string
  sealDigest:string
  /** Index of the NEXT file to be considered. */
  nextIndex:number
  pendingIndex:number|null
  events:BatchAuditEvent[]
  /** SHA256 over the other fields; corruption check, not an authentication token. */
  digest:string
  /** Absolutely never an instruction or permission to mutate source. */
  autoApplyAllowed:false
}
function digest(value:unknown):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function contentHash<T extends {digest:string}>(row:Omit<T,'digest'>):T{
  return {...row,digest:digest(row)} as T
}
function contained(root:string,target:string):boolean{
  const r=relative(root,target)
  return r===''||(r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r))
}
function privateAuditRoot(input:SnapshotRequest,rootPath:string,stagePath?:string):string{
  if(!isAbsolute(rootPath))throw Error('Audit root must be absolute')
  const info=lstatSync(rootPath)
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Audit root must be an owner-only normal directory')
  const root=realpathSync(rootPath),source=realpathSync(input.registry.get(input.projectId).root),
    worker=realpathSync(input.directory)
  if(contained(root,source)||contained(source,root)||
    contained(root,worker)||contained(worker,root))
    throw Error('Audit root must be separate from source and worker')
  if(stagePath){
    const stage=realpathSync(stagePath)
    if(contained(root,stage)||contained(stage,root))
      throw Error('Audit root must not overlap the sealed stage root')
  }
  return root
}
function readGrant(file:string):BatchAuditGrant{
  if(!isAbsolute(file))throw Error('Batch audit grant must be an absolute private file')
  let json:unknown
  try {
    const stat=lstatSync(file)
    if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
      throw Error('Batch audit grant must be owner-only normal file')
    json=JSON.parse(readFileSync(file,'utf8')) as unknown
  }catch(e){
    if(e instanceof SyntaxError||['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))
      throw Error('Batch audit grant is missing or invalid')
    throw e
  }
  if(!json||typeof json!=='object'||Array.isArray(json))
    throw Error('Invalid or expired batch audit grant')
  const g=json as BatchAuditGrant
  const keys=['version','operation','approvalId','executionId','batchId','projectId',
    'rootFingerprint','previewDigest','sealDigest','expiresAt','operatorApproved']
  if(Object.keys(g).length!==keys.length||
    Object.keys(g).some(x=>!keys.includes(x))||
    g.version!==1||g.operation!=='plan-batch-steps'||
    typeof g.approvalId!=='string'||!ID.test(g.approvalId)||
    typeof g.executionId!=='string'||!ID.test(g.executionId)||
    typeof g.batchId!=='string'||!ID.test(g.batchId)||
    typeof g.projectId!=='string'||!g.projectId||
    typeof g.rootFingerprint!=='string'||!HASH.test(g.rootFingerprint)||
    typeof g.previewDigest!=='string'||!HASH.test(g.previewDigest)||
    typeof g.sealDigest!=='string'||!HASH.test(g.sealDigest)||
    g.operatorApproved!==true||typeof g.expiresAt!=='string'||
    !Number.isFinite(Date.parse(g.expiresAt))||Date.parse(g.expiresAt)<=Date.now())
    throw Error('Invalid or expired batch audit grant')
  return g
}
async function syncDir(path:string):Promise<void>{
  const f=await open(path,'r')
  try{await f.sync()}finally{await f.close()}
}
async function persist(folder:string,row:Omit<NonGitBatchAudit,'digest'>):Promise<NonGitBatchAudit>{
  const full=contentHash<NonGitBatchAudit>(row)
  const temp=join(folder,'.audit-'+randomUUID())
  try{
    const file=await open(temp,'wx',0o600)
    try{await file.writeFile(JSON.stringify(full)+'\n');await file.sync()}
    finally{await file.close()}
    await rename(temp,join(folder,'audit.json'))
    await syncDir(folder)
  }finally{await rm(temp,{force:true}).catch(()=>{})}
  return full
}
/** No lock stealing or retries: an orphaned lock requires human intervention. */
async function locked<T>(root:string,cb:()=>Promise<T>):Promise<T>{
  const lock=join(root,'.batch-audit.lock')
  let handle:Awaited<ReturnType<typeof open>>
  try{handle=await open(lock,'wx',0o600)}
  catch(error){
    if((error as NodeJS.ErrnoException).code==='EEXIST')
      throw Error('Batch audit lock exists; human reconciliation required')
    throw error
  }
  try{await handle.sync();await syncDir(root);return await cb()}
  finally{await handle.close();await unlink(lock);await syncDir(root)}
}
function safeSeal(input:SnapshotRequest,seal:NonGitBatchSeal):void{
  const project=input.registry.get(input.projectId)
  if(project.kind!=='local'||projectFingerprint(project)!==input.fingerprint||
    seal.projectId!==input.projectId||seal.rootFingerprint!==input.fingerprint||
    seal.status!=='sealed'||seal.version!==1||!HASH.test(seal.digest)||
    !Array.isArray(seal.changes)||!seal.changes.length||seal.changes.length>24)
    throw Error('Batch audit project/seal scope mismatch')
}
/** Replay ledger events to reject tampered step counters or impossible transitions. */
function checkHistory(row:NonGitBatchAudit,seal:NonGitBatchSeal):void{
  if(row.version!==1||row.autoApplyAllowed!==false||
    row.projectId!==seal.projectId||row.rootFingerprint!==seal.rootFingerprint||
    row.batchId!==seal.batchId||row.previewDigest!==seal.previewDigest||
    row.sealDigest!==seal.digest||!ID.test(row.executionId)||
    !ID.test(row.approvalId)||!Array.isArray(row.events)||
    row.events.length>seal.changes.length*2+1)
    throw Error('Batch audit metadata mismatch')
  let next=0,pending:number|null=null,blocked=false
  for(const e of row.events){
    if(!e||!Number.isInteger(e.index)||e.path!==seal.changes[e.index]?.path)
      throw Error('Invalid batch audit event path')
    if(e.action==='issued'&&pending===null&&!blocked&&e.index===next){
      pending=next
    }else if(e.action==='confirmed'&&pending===next&&e.index===next&&!blocked){
      next++;pending=null
    }else if(e.action==='review-required'&&pending===next&&e.index===next&&!blocked){
      blocked=true
    }else throw Error('Impossible batch audit event sequence')
  }
  const expected:BatchAuditStatus=blocked?'review-required':
    pending!==null?'awaiting-human':next===seal.changes.length?'complete':'ready'
  if(row.status!==expected||row.nextIndex!==next||row.pendingIndex!==pending)
    throw Error('Batch audit state does not match event history')
}
async function readRow(folder:string,seal:NonGitBatchSeal):Promise<NonGitBatchAudit>{
  let content:string
  try{
    const dir=await lstat(folder)
    const file=await lstat(join(folder,'audit.json'))
    if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o077)!==0||
      !file.isFile()||file.isSymbolicLink()||(file.mode&0o077)!==0)
      throw Error('Untrusted batch audit journal')
    content=await readFile(join(folder,'audit.json'),'utf8')
  }catch(e){
    if(['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))
      throw Error('Missing or incomplete batch audit requires human review')
    throw e
  }
  let row:NonGitBatchAudit
  try{row=JSON.parse(content) as NonGitBatchAudit}
  catch{throw Error('Corrupt batch audit requires human review')}
  if(!row||typeof row!=='object'||typeof row.digest!=='string')throw Error('Corrupt batch audit')
  const {digest:proof,...fields}=row
  if(proof!==digest(fields))throw Error('Batch audit integrity check failed')
  checkHistory(row,seal)
  return row
}
async function existingAudits(root:string,grant:BatchAuditGrant):Promise<void>{
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(!entry.name.startsWith('execution-'))continue
    // Malformed historical entries never silently permit a new approval.
    if(!entry.isDirectory()||entry.isSymbolicLink())
      throw Error('Untrusted prior batch execution audit')
    const folder=join(root,entry.name)
    let record:NonGitBatchAudit
    try{
      const file=join(folder,'audit.json'),stat=await lstat(file),dir=await lstat(folder)
      if((dir.mode&0o077)!==0||!stat.isFile()||stat.isSymbolicLink()||
        (stat.mode&0o077)!==0)
        throw Error('Untrusted prior batch execution audit')
      record=JSON.parse(await readFile(file,'utf8')) as NonGitBatchAudit
    }catch{throw Error('Unreconciled prior batch execution audit')}
    if(!record||typeof record.digest!=='string'){
      throw Error('Unreconciled prior batch execution audit')
    }
    const {digest:proof,...fields}=record
    if(proof!==digest(fields)||entry.name!=='execution-'+record.executionId||
      !ID.test(record.executionId)||!ID.test(record.approvalId))
      throw Error('Unreconciled prior batch execution audit')
    if(record.approvalId===grant.approvalId)
      throw Error('Batch audit approval was already consumed')
    // Even a 'ready' receipt is unfinished work. Never permit two separately
    // granted executions for the same project to diverge concurrently.
    if(record.projectId===grant.projectId&&record.status!=='complete')
      throw Error('Prior batch execution needs human reconciliation')
  }
}
function validateScope(row:NonGitBatchAudit,input:SnapshotRequest,seal:NonGitBatchSeal):void{
  safeSeal(input,seal)
  if(row.projectId!==input.projectId||row.rootFingerprint!==input.fingerprint||
    row.sealDigest!==seal.digest)
    throw Error('Batch audit identity drift')
}
/** Create sealed, owner-approved write-ahead audit; NO source writes. */
export async function beginNonGitBatchAudit(
  input:SnapshotRequest,seal:NonGitBatchSeal,
  options:{stageRoot:string;auditRoot:string;approvalFile:string}
):Promise<NonGitBatchAudit>{
  safeSeal(input,seal)
  const g=readGrant(options.approvalFile)
  if(g.projectId!==input.projectId||g.rootFingerprint!==input.fingerprint||
    g.batchId!==seal.batchId||g.sealDigest!==seal.digest||
    g.previewDigest!==seal.previewDigest)
    throw Error('Batch audit approval scope mismatch')
  const root=privateAuditRoot(input,options.auditRoot,options.stageRoot)
  return locked(root,async()=>{
    await existingAudits(root,g)
    const checked=await verifyNonGitStagedBatch(input,{
      journalRoot:options.stageRoot,batchId:g.batchId,
      expectedPreviewDigest:g.previewDigest
    })
    if(checked.digest!==seal.digest)throw Error('Approved staged seal has changed')
    const reread=readGrant(options.approvalFile)
    if(JSON.stringify(reread)!==JSON.stringify(g))
      throw Error('Batch audit grant changed during preflight')
    const folder=join(root,'execution-'+g.executionId)
    await mkdir(folder,{mode:0o700})
    await syncDir(root)
    const row:Omit<NonGitBatchAudit,'digest'>={
      version:1,status:'ready',executionId:g.executionId,
      approvalId:g.approvalId,batchId:seal.batchId,projectId:input.projectId,
      rootFingerprint:input.fingerprint,previewDigest:seal.previewDigest,
      sealDigest:seal.digest,nextIndex:0,pendingIndex:null,events:[],
      autoApplyAllowed:false
    }
    return persist(folder,row)
  })
}
async function withAudit<T>(input:SnapshotRequest,seal:NonGitBatchSeal,
  rootPath:string,executionId:string,
  cb:(folder:string,row:NonGitBatchAudit)=>Promise<T>,
  stageRoot?:string):Promise<T>{
  if(!ID.test(executionId))throw Error('Invalid batch audit execution ID')
  safeSeal(input,seal)
  const root=privateAuditRoot(input,rootPath,stageRoot)
  return locked(root,async()=>{
    const folder=join(root,'execution-'+executionId),row=await readRow(folder,seal)
    validateScope(row,input,seal)
    if(row.executionId!==executionId)throw Error('Batch audit execution ID mismatch')
    return cb(folder,row)
  })
}
function nextRow(row:NonGitBatchAudit,status:BatchAuditStatus,
  nextIndex:number,pendingIndex:number|null,event:BatchAuditEvent):Omit<NonGitBatchAudit,'digest'>{
  const {digest:_ignored,...fields}=row
  return {...fields,status,nextIndex,pendingIndex,events:[...row.events,event]}
}
/** Records a checkpoint BEFORE any external/manual action. It performs none. */
export async function issueNextNonGitBatchReviewStep(
  input:SnapshotRequest,seal:NonGitBatchSeal,opts:{auditRoot:string;executionId:string;stageRoot:string}
):Promise<NonGitBatchAudit>{
  return withAudit(input,seal,opts.auditRoot,opts.executionId,async(folder,row)=>{
    if(row.status!=='ready'||row.pendingIndex!==null||
      row.nextIndex>=seal.changes.length)throw Error('Batch audit cannot issue another step')
    const snapshot=await inspectNonGitBatchRecovery(input,seal)
    if(snapshot.files.some((f,i)=>f.position!==(i<row.nextIndex?'after':'before')))
      throw Error('Batch source no longer matches audited per-file boundary')
    // The original source has already diverged from its baseline on confirmed
    // steps. Check the worker/staged AFTER images independently, not via
    // verifyNonGitStagedBatch (which requires the original source baseline).
    await verifyNonGitStagedWorkerAfterImages(input,{
      journalRoot:opts.stageRoot,seal
    })
    const index=row.nextIndex
    return persist(folder,nextRow(row,'awaiting-human',index,index,
      {index,action:'issued',path:seal.changes[index]!.path}))
  },opts.stageRoot)
}
/** Verify observed result AFTER a separate manual external step.
 * If any file is foreign or wrongly sequenced, terminalize as review-required.
 * Does not and cannot apply/rollback any file, even on an incomplete step.
 */
export async function confirmNonGitBatchReviewStep(
  input:SnapshotRequest,seal:NonGitBatchSeal,opts:{auditRoot:string;executionId:string}
):Promise<NonGitBatchAudit>{
  return withAudit(input,seal,opts.auditRoot,opts.executionId,async(folder,row)=>{
    if(row.status!=='awaiting-human'||row.pendingIndex!==row.nextIndex)
      throw Error('No pending batch step eligible for observation')
    const inspection=await inspectNonGitBatchRecovery(input,seal)
    const index=row.nextIndex
    const expected=inspection.files.every((f,i)=>
      f.position===(i<=index?'after':'before'))
    if(!expected){
      // No retries: record evidence that manual reconciliation is required.
      await persist(folder,nextRow(row,'review-required',index,index,
        {index,action:'review-required',path:seal.changes[index]!.path}))
      throw Error('Batch source not at expected per-file boundary; human review required')
    }
    const next=index+1
    return persist(folder,nextRow(row,next===seal.changes.length?'complete':'ready',
      next,null,{index,action:'confirmed',path:seal.changes[index]!.path}))
  })
}
/** Read-only status query: never resumes or retries a previous step. */
export async function readNonGitBatchAudit(
  input:SnapshotRequest,seal:NonGitBatchSeal,opts:{auditRoot:string;executionId:string}
):Promise<NonGitBatchAudit>{
  if(!ID.test(opts.executionId))throw Error('Invalid batch audit execution ID')
  safeSeal(input,seal)
  const root=privateAuditRoot(input,opts.auditRoot)
  const row=await readRow(join(root,'execution-'+opts.executionId),seal)
  validateScope(row,input,seal)
  if(row.executionId!==opts.executionId)throw Error('Batch audit execution ID mismatch')
  return row
}
