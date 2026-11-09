/** C6B2B1: read-only MANUAL recovery inspection for a previously sealed batch.
 * NO apply, rollback, repair, retry, journal writes or runtime wiring.
 * Classification is evidence only, NEVER authorization for a source mutation.
 */
import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {lstat} from 'node:fs/promises'
import {projectFingerprint,type SnapshotRequest} from './project-workspaces.ts'
import type {NonGitBatchSeal,StagedChange} from './non-git-batch-stage.ts'

const HEX=/^[0-9a-f]{40}$|^[0-9a-f]{64}$/
const SHA256=/^[0-9a-f]{64}$/
const MAX_OBSERVATION_BYTES=64*1024*1024
export type FilePosition='before'|'after'|'diverged'|'indeterminate'
export interface RecoveryFileObservation{
  path:string
  /** Absent file is represented by BOTH oid and mode missing. */
  oid?:string
  mode?:number
}
export interface RecoveryFileEvidence{
  path:string
  position:FilePosition
  expectedBefore?:string
  expectedAfter?:string
}
export interface NonGitBatchRecoveryInspection{
  batchId:string
  sealDigest:string
  state:'unchanged'|'fully-applied'|'partially-applied'|'diverged'|'indeterminate'
  files:RecoveryFileEvidence[]
  /** This signal is always false; a separate human-authorized operation is mandatory. */
  autoApplyAllowed:false
  needsHumanReview:true
}
function validMode(value:unknown):value is number{
  return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=0o777
}
function validateSeal(seal:NonGitBatchSeal):void{
  if(!seal||seal.version!==1||seal.status!=='sealed'||!SHA256.test(seal.digest)||
    typeof seal.batchId!=='string'||typeof seal.projectId!=='string'||
    !SHA256.test(seal.previewDigest)||!SHA256.test(seal.rootFingerprint)||
    !Array.isArray(seal.changes)||seal.changes.length===0||seal.changes.length>24)
    throw Error('Invalid sealed batch recovery input')
  const {digest,...rest}=seal
  if(createHash('sha256').update(JSON.stringify(rest)).digest('hex')!==digest)
    throw Error('Batch seal integrity mismatch')
  let previous=''
  for(const row of seal.changes){
    if(typeof row.path!=='string'||!row.path||row.path.includes('\\')||
      row.path.includes('\0')||row.path.startsWith('/')||
      row.path.split('/').some(p=>!p||p==='.'||p==='..')||
      row.path<=previous||
      !['add','modify','delete'].includes(row.action))
      throw Error('Invalid sealed recovery path/order')
    previous=row.path
    const before=row.before!==undefined,after=row.after!==undefined
    if((row.action==='add'&&(!after||before))||
       (row.action==='delete'&&(!before||after))||
       (row.action==='modify'&&(!before||!after)))
      throw Error('Invalid sealed recovery change shape')
    if(before&&(!HEX.test(row.before!)||!validMode(row.beforeMode)||
      row.beforeExecutable!==((row.beforeMode!&0o111)!==0)))
      throw Error('Invalid sealed recovery before-image metadata')
    if(after&&(!HEX.test(row.after!)||!validMode(row.afterMode)||
      row.afterExecutable!==((row.afterMode!&0o111)!==0)))
      throw Error('Invalid sealed recovery after-image metadata')
    if(before&&after&&row.before!.length!==row.after!.length)
      throw Error('Mixed object formats in sealed recovery')
  }
}
function matches(oid:string|undefined,mode:number|undefined,
  expectedOid:string|undefined,expectedMode:number|undefined):boolean{
  return expectedOid===undefined
    ?oid===undefined&&mode===undefined
    :oid===expectedOid&&mode===expectedMode
}
/** Pure reduction of trusted read-only file observations.
 * The entire batch must be observed in exact sorted order; no subset can
 * mistakenly be reported as fully applied.
 */
export function classifyNonGitBatchObservations(
  seal:NonGitBatchSeal,observations:readonly RecoveryFileObservation[]
):NonGitBatchRecoveryInspection{
  validateSeal(seal)
  if(observations.length!==seal.changes.length)
    throw Error('Incomplete batch recovery observation')
  let before=0,after=0,diverged=0,indeterminate=0
  const files:RecoveryFileEvidence[]=[]
  for(let i=0;i<seal.changes.length;i++){
    const expected=seal.changes[i]!,observed=observations[i]!
    if(!observed||observed.path!==expected.path||
      (observed.oid===undefined)!==(observed.mode===undefined)||
      observed.oid!==undefined&&!HEX.test(observed.oid)||
      observed.mode!==undefined&&!validMode(observed.mode))
      throw Error('Invalid batch recovery observation')
    const isBefore=matches(observed.oid,observed.mode,expected.before,expected.beforeMode)
    const isAfter=matches(observed.oid,observed.mode,expected.after,expected.afterMode)
    const position:FilePosition=isBefore&&isAfter?'indeterminate'
      :isBefore?'before':isAfter?'after':'diverged'
    if(position==='before')before++
    else if(position==='after')after++
    else if(position==='diverged')diverged++
    else indeterminate++
    files.push({path:expected.path,position,
      ...(expected.before?{expectedBefore:expected.before}:{}),
      ...(expected.after?{expectedAfter:expected.after}:{})})
  }
  const state:NonGitBatchRecoveryInspection['state']=diverged?'diverged'
    :indeterminate?'indeterminate'
    :before===files.length?'unchanged'
    :after===files.length?'fully-applied':'partially-applied'
  return {batchId:seal.batchId,sealDigest:seal.digest,state,files,
    autoApplyAllowed:false,needsHumanReview:true}
}
async function observeSourceFile(
  path:string,format:40|64
):Promise<{oid?:string,mode?:number}>{
  let before:Awaited<ReturnType<typeof lstat>>
  try{before=await lstat(path)}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e}
  if(!before.isFile()||before.isSymbolicLink()||before.size>MAX_OBSERVATION_BYTES)
    throw Error('Unsafe or oversized source file in recovery inspection')
  const hash=createHash(format===40?'sha1':'sha256')
  hash.update('blob '+before.size+'\0')
  let copied=0
  for await(const chunk of createReadStream(path)){
    const bytes=chunk as Buffer
    copied+=bytes.length
    if(copied>before.size)throw Error('Source changed during recovery observation')
    hash.update(bytes)
  }
  const after=await lstat(path)
  if(copied!==before.size||before.size!==after.size||
    before.dev!==after.dev||before.ino!==after.ino||
    before.mtimeMs!==after.mtimeMs||(before.mode&0o777)!==(after.mode&0o777))
    throw Error('Source changed during recovery observation')
  return {oid:hash.digest('hex'),mode:before.mode&0o777}
}
/** Read original registered project files only; checks bytes AND full POSIX mode.
 * Does not scan files outside the sealed plan or prove quiescence. Do not ever
 * treat its result as an authorization to write. Cannot restore source files.
 */
export async function inspectNonGitBatchRecovery(
  input:SnapshotRequest,seal:NonGitBatchSeal
):Promise<NonGitBatchRecoveryInspection>{
  validateSeal(seal)
  const project=input.registry.get(input.projectId)
  if(project.kind!=='local'||projectFingerprint(project)!==input.fingerprint||
    seal.projectId!==input.projectId||seal.rootFingerprint!==input.fingerprint)
    throw Error('Batch recovery project identity mismatch')
  const observations:RecoveryFileObservation[]=[]
  for(const change of seal.changes){
    const path=input.registry.path(input.projectId,change.path,'read')
    const oid=change.before??change.after!
    const current=await observeSourceFile(path,oid.length as 40|64)
    observations.push({path:change.path,...current})
  }
  return classifyNonGitBatchObservations(seal,observations)
}
