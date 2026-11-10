/** C6B2B4A — SYNTHETIC-ONLY experimental adapter-driven step coordinator.
 *
 * This is NOT a production non-Git Apply executor. The only file writes owned
 * here are private execution receipts outside all three trees. A caller-supplied
 * actor can mutate ONLY a verified disposable test fixture, and is invoked
 * at most once after a durable receipt and audit checkpoint. Never retry,
 * auto-resume, rollback, or connect this module to Runtime/Worker/Weixin.
 *
 * No receipt/sha256 digest is a cryptographic signature or an authorization
 * to touch real projects. Node path checks do NOT exclude foreign writers.
 */
import {createHash,randomUUID} from 'node:crypto'
import {lstatSync,readFileSync,realpathSync} from 'node:fs'
import {lstat,mkdir,open,readFile,readdir,rename,rm} from 'node:fs/promises'
import {basename,dirname,isAbsolute,join,relative,sep} from 'node:path'
import {tmpdir} from 'node:os'
import {projectFingerprint,type SnapshotRequest} from './project-workspaces.ts'
import type {NonGitBatchSeal,StagedChange} from './non-git-batch-stage.ts'
import {
  readNonGitBatchAudit,issueNextNonGitBatchReviewStep,
  confirmNonGitBatchReviewStep
} from './non-git-batch-audit.ts'

const ID=/^[a-z0-9][a-z0-9-]{7,79}$/
const SHA256=/^[0-9a-f]{64}$/
const MARKER='.dsh-c6b2b4-synthetic-only'
const MARKER_TEXT='C6B2B4_SYNTHETIC_ONLY\n'
export interface SyntheticBatchStepGrant {
  version:1
  operation:'synthetic-batch-step'
  grantId:string
  transactionId:string
  executionId:string
  batchId:string
  projectId:string
  rootFingerprint:string
  sealDigest:string
  previewDigest:string
  stepIndex:number
  expiresAt:string
  operatorApproved:true
}
export type SyntheticStepPhase='reserved'|'issued'|'observed'|'review-required'
export interface SyntheticStepReceipt {
  version:1
  phase:SyntheticStepPhase
  grantId:string
  transactionId:string
  executionId:string
  batchId:string
  projectId:string
  rootFingerprint:string
  sealDigest:string
  stepIndex:number
  path:string
  digest:string
  autoRetryAllowed:false
}
export type SyntheticStepActor=(step:Readonly<{
  index:number
  path:string
  action:StagedChange['action']
  after?:string
  afterMode?:number
}>)=>Promise<void>
const hash=(v:unknown):string=>
  createHash('sha256').update(JSON.stringify(v)).digest('hex')
const contained=(root:string,target:string):boolean=>{
  const rel=relative(root,target)
  return rel===''||(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))
}
function fixtureOnly(input:SnapshotRequest):string{
  const source=realpathSync(input.registry.get(input.projectId).root)
  const fixture=dirname(dirname(source))
  const temp=realpathSync(tmpdir())
  if(!contained(temp,fixture)||fixture===temp||
    !/^dsh-c6b2b4-synthetic-[a-z0-9_-]{6,70}$/.test(basename(fixture))||
    projectFingerprint(input.registry.get(input.projectId))!==input.fingerprint||
    input.registry.get(input.projectId).kind!=='local'||
    input.registry.get(input.projectId).readOnly)
    throw Error('Synthetic-only execution refused for non-fixture project')
  const marker=join(fixture,MARKER)
  let stat
  try{stat=lstatSync(marker)}
  catch{throw Error('Synthetic-only execution fixture marker missing')}
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||
    readFileSync(marker,'utf8')!==MARKER_TEXT)
    throw Error('Synthetic-only execution fixture marker invalid')
  if(!contained(fixture,realpathSync(input.directory)))
    throw Error('Synthetic-only worker must belong to same disposable fixture')
  return fixture
}
function privateRoot(input:SnapshotRequest,rootPath:string,stageRoot:string,
    auditRoot:string):string{
  if(!isAbsolute(rootPath))throw Error('Synthetic execution receipts need private absolute root')
  const paths=[rootPath,stageRoot,auditRoot]
  const resolved=paths.map(x=>{
    const st=lstatSync(x)
    if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)
      throw Error('Synthetic execution root must be private non-symlink directory')
    return realpathSync(x)
  })
  const root=resolved[0]!,source=realpathSync(input.registry.get(input.projectId).root),
    worker=realpathSync(input.directory)
  for(const other of [source,worker,resolved[1]!,resolved[2]!]){
    if(contained(root,other)||contained(other,root))
      throw Error('Synthetic execution receipt root must not overlap source or evidence')
  }
  return root
}
function readGrant(file:string):SyntheticBatchStepGrant{
  if(!isAbsolute(file))throw Error('Synthetic step grant must be private absolute file')
  let v:unknown
  try{
    const stat=lstatSync(file)
    if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
      throw Error('Synthetic step grant must be owner-only normal file')
    v=JSON.parse(readFileSync(file,'utf8')) as unknown
  }catch(e){
    if(e instanceof SyntaxError||['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))
      throw Error('Synthetic step grant unavailable or malformed')
    throw e
  }
  if(!v||typeof v!=='object'||Array.isArray(v))
    throw Error('Invalid synthetic step grant')
  const g=v as SyntheticBatchStepGrant
  const keys=['version','operation','grantId','transactionId','executionId','batchId',
    'projectId','rootFingerprint','sealDigest','previewDigest','stepIndex',
    'expiresAt','operatorApproved']
  if(Object.keys(g).length!==keys.length||
    Object.keys(g).some(k=>!keys.includes(k))||
    g.version!==1||g.operation!=='synthetic-batch-step'||
    ![g.grantId,g.transactionId,g.executionId,g.batchId].every(x=>typeof x==='string'&&ID.test(x))||
    typeof g.projectId!=='string'||!g.projectId||
    ![g.rootFingerprint,g.sealDigest,g.previewDigest].every(x=>typeof x==='string'&&SHA256.test(x))||
    !Number.isInteger(g.stepIndex)||g.stepIndex<0||g.stepIndex>=24||
    g.operatorApproved!==true||typeof g.expiresAt!=='string'||
    !Number.isFinite(Date.parse(g.expiresAt))||Date.parse(g.expiresAt)<=Date.now())
    throw Error('Invalid or expired synthetic step grant')
  return g
}
async function syncDir(path:string):Promise<void>{
  const h=await open(path,'r')
  try{await h.sync()}finally{await h.close()}
}
function asRow(row:Omit<SyntheticStepReceipt,'digest'>):SyntheticStepReceipt{
  return {...row,digest:hash(row)}
}
async function persist(folder:string,receipt:SyntheticStepReceipt):Promise<void>{
  const file=join(folder,'.receipt-'+randomUUID())
  try{
    const h=await open(file,'wx',0o600)
    try{await h.writeFile(JSON.stringify(receipt)+'\n');await h.sync()}
    finally{await h.close()}
    await rename(file,join(folder,'receipt.json'))
    await syncDir(folder)
  }finally{await rm(file,{force:true}).catch(()=>{})}
}
function next(row:SyntheticStepReceipt,phase:SyntheticStepPhase):SyntheticStepReceipt{
  const {digest:_old,...fields}=row
  return asRow({...fields,phase})
}
async function existing(root:string,g:SyntheticBatchStepGrant):Promise<void>{
  for(const item of await readdir(root,{withFileTypes:true})){
    if(!item.name.startsWith('step-'))continue
    if(!item.isDirectory()||item.isSymbolicLink())
      throw Error('Unreconciled synthetic execution journal')
    let row:SyntheticStepReceipt
    try{
      const dir=join(root,item.name),f=join(dir,'receipt.json')
      const st=await lstat(f),ds=await lstat(dir)
      if((ds.mode&0o077)!==0||!st.isFile()||st.isSymbolicLink()||
        (st.mode&0o077)!==0)throw Error('Invalid journal')
      row=JSON.parse(await readFile(f,'utf8')) as SyntheticStepReceipt
    }catch{throw Error('Unreconciled synthetic execution journal')}
    if(!row||row.version!==1||row.autoRetryAllowed!==false||
      !ID.test(row.transactionId)||!ID.test(row.grantId)||
      item.name!=='step-'+row.transactionId)
      throw Error('Invalid synthetic execution journal')
    const {digest:proof,...fields}=row
    if(proof!==hash(fields))throw Error('Corrupt synthetic execution journal')
    if(row.grantId===g.grantId||row.transactionId===g.transactionId||
       row.executionId===g.executionId&&row.stepIndex===g.stepIndex)
      throw Error('Synthetic execution grant/step has already been consumed')
    if(row.projectId===g.projectId&&row.phase!=='observed')
      throw Error('Pending synthetic execution needs manual review')
  }
}
/** Create exactly one action attempt. A durable reserved receipt + audit issue
 * precede the externally supplied SYNTHETIC test actor.
 *
 * IMPORTANT: callbacks are fundamentally not crash-atomic with the filesystem.
 * If an actor throws/crashes, do not retry even if no file appears changed.
 * Human must inspect the receipt AND the audit ledger.
 */
export async function executeOneSyntheticBatchStep(
  input:SnapshotRequest,seal:NonGitBatchSeal,
  opts:{stageRoot:string;auditRoot:string;receiptRoot:string;
    executionId:string;grantFile:string;actor:SyntheticStepActor}
):Promise<SyntheticStepReceipt>{
  fixtureOnly(input)
  if(typeof opts.actor!=='function')throw Error('Synthetic test actor required')
  const g=readGrant(opts.grantFile)
  if(g.projectId!==input.projectId||g.rootFingerprint!==input.fingerprint||
    g.executionId!==opts.executionId||g.batchId!==seal.batchId||
    g.sealDigest!==seal.digest||g.previewDigest!==seal.previewDigest||
    g.stepIndex>=seal.changes.length)
    throw Error('Synthetic execution grant/scope mismatch')
  const root=privateRoot(input,opts.receiptRoot,opts.stageRoot,opts.auditRoot)
  // The audit must be ready; historical awaiting-human cannot trigger an actor.
  const auditOpts={auditRoot:opts.auditRoot,executionId:opts.executionId,
    stageRoot:opts.stageRoot}
  const current=await readNonGitBatchAudit(input,seal,auditOpts)
  if(current.status!=='ready'||current.nextIndex!==g.stepIndex||
    current.pendingIndex!==null)
    throw Error('Synthetic step requires a fresh ready audit boundary')
  // A second grant read prevents stale or chmod-revoked grants before reserve.
  const still=readGrant(opts.grantFile)
  if(JSON.stringify(still)!==JSON.stringify(g))
    throw Error('Synthetic step grant changed before reservation')
  await existing(root,g)
  const path=seal.changes[g.stepIndex]!.path
  const folder=join(root,'step-'+g.transactionId)
  // mkdir is the durable one-shot reservation; EEXIST is not retried.
  try{await mkdir(folder,{mode:0o700})}
  catch(e){
    if((e as NodeJS.ErrnoException).code==='EEXIST')
      throw Error('Synthetic step already reserved; human review required')
    throw e
  }
  await syncDir(root)
  let receipt=asRow({version:1,phase:'reserved',
    grantId:g.grantId,transactionId:g.transactionId,executionId:g.executionId,
    batchId:g.batchId,projectId:g.projectId,
    rootFingerprint:g.rootFingerprint,sealDigest:g.sealDigest,
    stepIndex:g.stepIndex,path,autoRetryAllowed:false})
  await persist(folder,receipt)
  // Audit issue rechecks the source boundary and all private staged Worker
  // images before any actor callback. If issue fails, the 'reserved' receipt
  // stays permanently and needs manual reconciliation.
  await issueNextNonGitBatchReviewStep(input,seal,auditOpts)
  receipt=next(receipt,'issued')
  await persist(folder,receipt)
  // Callback receives only sealed metadata; actual filesystem operations
  // are provided in synthetic tests, NEVER by this module.
  const action=seal.changes[g.stepIndex]!
  try{
    await opts.actor(Object.freeze({
      index:g.stepIndex,path:action.path,action:action.action,
      ...(action.after?{after:action.after}:{}),
      ...(action.afterMode!==undefined?{afterMode:action.afterMode}:{})
    }))
    await confirmNonGitBatchReviewStep(input,seal,auditOpts)
  }catch{
    // Do not issue a second callback, rollback, or pretend it succeeded.
    // In particular, a crash between actor and confirmation stays 'issued'.
    throw Error('Synthetic step outcome requires manual inspection; no retry')
  }
  receipt=next(receipt,'observed')
  await persist(folder,receipt)
  return receipt
}
/** Read-only, no recovery or retry of an existing action. */
export async function readSyntheticBatchStepReceipt(
  input:SnapshotRequest,opts:{receiptRoot:string;stageRoot:string;auditRoot:string;transactionId:string}
):Promise<SyntheticStepReceipt>{
  fixtureOnly(input)
  if(!ID.test(opts.transactionId))throw Error('Invalid synthetic receipt ID')
  const root=privateRoot(input,opts.receiptRoot,opts.stageRoot,opts.auditRoot)
  try{
    const folder=join(root,'step-'+opts.transactionId)
    const st=await lstat(folder),file=join(folder,'receipt.json'),ft=await lstat(file)
    if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0||
      !ft.isFile()||ft.isSymbolicLink()||(ft.mode&0o077)!==0)
      throw Error('Untrusted synthetic execution receipt')
    const row=JSON.parse(await readFile(file,'utf8')) as SyntheticStepReceipt
    if(!row||row.version!==1||row.transactionId!==opts.transactionId||
      row.projectId!==input.projectId||row.rootFingerprint!==input.fingerprint||
      row.autoRetryAllowed!==false||
      !['reserved','issued','observed','review-required'].includes(row.phase))
      throw Error('Untrusted synthetic execution receipt')
    const {digest:proof,...fields}=row
    if(proof!==hash(fields))throw Error('Synthetic execution receipt integrity mismatch')
    return row
  }catch(e){
    if(e instanceof SyntaxError||['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))
      throw Error('Missing or corrupt synthetic execution receipt; human review required')
    throw e
  }
}
