/** C6B2: default-OFF, operator-gated MULTI-FILE STAGING ONLY.
 * Writes private, out-of-source evidence copies and an immutable sealed manifest.
 * NEVER modifies registered project source, and has NO apply/rollback methods.
 * No Runtime/Weixin/Ticket caller; synthetic-only acceptance until separately authorized.
 */
import {createHash,randomUUID} from 'node:crypto'
import {constants,createReadStream,lstatSync,readFileSync,realpathSync} from 'node:fs'
import {copyFile,lstat,mkdir,open,readFile,readdir,unlink,stat} from 'node:fs/promises'
import {isAbsolute,join,relative,resolve,sep} from 'node:path'
import {previewNonGitProjectChanges,verifyProjectSnapshot,type NonGitChange,type SnapshotRequest} from './project-workspaces.ts'
import {projectFingerprint} from './project-workspaces.ts'

const ID=/^[a-z0-9][a-z0-9-]{7,79}$/
const HEX64=/^[0-9a-f]{64}$/
const MAX_FILES=24,MAX_COPY_BYTES=64*1024*1024
const contained=(root:string,target:string):boolean=>{
  const rel=relative(root,target)
  return rel===''||(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))
}
export interface NonGitBatchStageGrant {
  version:1
  operation:'stage-batch'
  approvalId:string
  batchId:string
  projectId:string
  rootFingerprint:string
  previewDigest:string
  expiresAt:string
  operatorApproved:true
}
export interface StagedChange {
  path:string
  action:NonGitChange['action']
  before?:string
  after?:string
  beforeExecutable?:boolean
  afterExecutable?:boolean
  beforeMode?:number
  afterMode?:number
  beforeImage?:string
  afterImage?:string
}
export interface NonGitBatchSeal {
  version:1
  status:'sealed'
  batchId:string
  approvalId:string
  projectId:string
  rootFingerprint:string
  sourceRevision:string
  previewDigest:string
  changes:StagedChange[]
  /** SHA256 of stable manifest fields; does not grant apply authority. */
  digest:string
}
const exactly=(value:unknown,keys:readonly string[]):boolean=>
  !!value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).every(x=>keys.includes(x))&&
  Object.keys(value).length===keys.length

function readGrant(file:string):NonGitBatchStageGrant{
  if(!isAbsolute(file))throw Error('Stage approval must be private absolute file')
  const info=lstatSync(file)
  if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Stage approval must be owner-only regular file')
  const v=JSON.parse(readFileSync(file,'utf8')) as NonGitBatchStageGrant
  const keys=['version','operation','approvalId','batchId','projectId',
    'rootFingerprint','previewDigest','expiresAt','operatorApproved']
  if(!exactly(v,keys)||v.version!==1||v.operation!=='stage-batch'||
    !ID.test(v.approvalId)||!ID.test(v.batchId)||typeof v.projectId!=='string'||
    !HEX64.test(v.rootFingerprint)||!HEX64.test(v.previewDigest)||
    v.operatorApproved!==true||typeof v.expiresAt!=='string'||
    !Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=Date.now())
    throw Error('Invalid or expired multi-file stage grant')
  return v
}
function privateRoot(input:SnapshotRequest,folder:string):string{
  if(!isAbsolute(folder))throw Error('Batch journal root must be absolute')
  const info=lstatSync(folder)
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Batch journal root must be private non-symlink directory')
  const root=realpathSync(folder),source=realpathSync(input.registry.get(input.projectId).root),
    worker=realpathSync(input.directory)
  if(contained(root,source)||contained(source,root)||
    contained(root,worker)||contained(worker,root))
    throw Error('Batch journal root must not overlap source or worker')
  return root
}
async function syncDirectory(folder:string):Promise<void>{
  const h=await open(folder,'r')
  try{await h.sync()}finally{await h.close()}
}
async function writeDurable(file:string,content:string):Promise<void>{
  const h=await open(file,'wx',0o600)
  try{await h.writeFile(content);await h.sync()}finally{await h.close()}
  await syncDirectory(resolve(file,'..'))
}
function digest(content:unknown):string{
  return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}
function validRel(rel:string):boolean{
  return !!rel&&!rel.includes('\\')&&!rel.includes('\0')&&!isAbsolute(rel)&&
    rel.split('/').every(p=>!!p&&p!=='.'&&p!=='..')
}
async function hashedFile(file:string,sizeLimit:number,objectFormat:40|64):Promise<{oid:string,mode:number,size:number}>{
  const before=await lstat(file)
  if(!before.isFile()||before.isSymbolicLink()||before.size>sizeLimit)
    throw Error('Unsafe or oversized source/worker file in batch')
  const oid=createHash(objectFormat===40?'sha1':'sha256')
  oid.update('blob '+before.size+'\0')
  let bytes=0
  for await(const chunk of createReadStream(file)){
    const data=chunk as Buffer
    bytes+=data.length
    if(bytes>before.size)throw Error('File changed while staging')
    oid.update(data)
  }
  const after=await lstat(file)
  if(bytes!==before.size||after.size!==before.size||
    after.ino!==before.ino||after.dev!==before.dev||
    (after.mode&0o777)!==(before.mode&0o777)||
    after.mtimeMs!==before.mtimeMs)
    throw Error('File changed while staging')
  return {oid:oid.digest('hex'),mode:before.mode&0o777,size:bytes}
}
/** Copy into 0600 sealed evidence image; source bytes remain untouched. */
async function capture(from:string,to:string,expected:string,room:number):
  Promise<{mode:number,size:number}>{
  const format=expected.length===40||expected.length===64?expected.length:0
  if(format!==40&&format!==64)throw Error('Unsupported baseline blob object')
  const before=await hashedFile(from,room,format)
  if(before.oid!==expected)throw Error('Source or worker changed since approved preview')
  await copyFile(from,to,constants.COPYFILE_EXCL)
  const image=await lstat(to)
  if(!image.isFile()||image.isSymbolicLink())throw Error('Private batch image is unsafe')
  const h=await open(to,'r+')
  try{await h.chmod(0o600);await h.sync()}finally{await h.close()}
  const captured=await hashedFile(to,room,format)
  const sourceAgain=await hashedFile(from,room,format)
  if(captured.oid!==expected||sourceAgain.oid!==expected||
    sourceAgain.mode!==before.mode||sourceAgain.size!==before.size)
    throw Error('Source or worker changed while staging')
  return {mode:before.mode,size:before.size}
}
function imageName(i:number,which:'before'|'after'):string {
  return which+'-'+String(i).padStart(3,'0')+'.bin'
}
async function readPrivateJson(file:string):Promise<unknown>{
  const info=await lstat(file)
  if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Unsafe batch journal file')
  return JSON.parse(await readFile(file,'utf8')) as unknown
}
async function existingBatches(root:string,approvalId?:string):Promise<void>{
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(!entry.name.startsWith('batch-'))continue
    if(!entry.isDirectory()||entry.isSymbolicLink())
      throw Error('Unsafe batch journal directory')
    const folder=join(root,entry.name)
    const dir=await lstat(folder)
    if(dir.mode&0o077)throw Error('Unsafe batch permissions')
    let intent:NonGitBatchStageGrant,seal:NonGitBatchSeal
    try{
      intent=await readPrivateJson(join(folder,'intent.json')) as NonGitBatchStageGrant
      seal=await readPrivateJson(join(folder,'seal.json')) as NonGitBatchSeal
    }catch{throw Error('Unsealed or corrupt batch requires manual reconciliation')}
    if(!intent||!seal||seal.status!=='sealed'||seal.batchId!==intent.batchId||
      seal.approvalId!==intent.approvalId||
      entry.name!=='batch-'+seal.batchId)
      throw Error('Unsealed or mismatched batch requires manual reconciliation')
    if(approvalId&&seal.approvalId===approvalId)
      throw Error('Batch stage approval was already consumed')
  }
}
function sealFields(row:Omit<NonGitBatchSeal,'digest'>):Omit<NonGitBatchSeal,'digest'>{
  return row
}
export async function stageNonGitChangeBatch(input:SnapshotRequest,opts:{
  journalRoot:string;approvalFile:string
}):Promise<NonGitBatchSeal>{
  const grant=readGrant(opts.approvalFile)
  if(grant.projectId!==input.projectId||grant.rootFingerprint!==input.fingerprint)
    throw Error('Batch stage grant does not match registered project')
  const root=privateRoot(input,opts.journalRoot)
  const lock=join(root,'.batch-stage.lock')
  const lockHandle=await open(lock,'wx',0o600)
  try{
    await lockHandle.sync();await syncDirectory(root)
    await existingBatches(root,grant.approvalId)
    await verifyProjectSnapshot(input)
    const project=input.registry.get(input.projectId)
    if(project.kind!=='local'||project.readOnly||projectFingerprint(project)!==input.fingerprint)
      throw Error('Batch staging requires original writable registered non-Git project')
    const folder=join(root,'batch-'+grant.batchId)
    // Reserve transaction ID permanently, even if we crash or fail later.
    await mkdir(folder,{mode:0o700})
    await syncDirectory(root)
    await writeDurable(join(folder,'intent.json'),JSON.stringify(grant)+'\n')
    const plan=await previewNonGitProjectChanges(input)
    if(plan.digest!==grant.previewDigest||plan.changes.length===0||
      plan.changes.length>MAX_FILES)
      throw Error('Stage digest mismatch, empty batch or too many files')
    const worker=realpathSync(input.directory)
    let total=0
    const changes:StagedChange[]=[]
    for(const [i,change] of plan.changes.entries()){
      if(!validRel(change.path))throw Error('Unsafe batch relative file path')
      const original=input.registry.path(input.projectId,change.path,'read')
      const output=resolve(worker,change.path)
      if(!contained(worker,output))throw Error('Worker file path left workspace')
      const item:StagedChange={path:change.path,action:change.action,
        ...(change.before?{before:change.before}:{}),
        ...(change.after?{after:change.after}:{}),
        ...(change.before?{beforeExecutable:false}:{}),
        ...(change.after?{afterExecutable:change.executable}:{})}
      if(change.before){
        const name=imageName(i,'before')
        const result=await capture(original,join(folder,name),change.before,MAX_COPY_BYTES-total)
        total+=result.size
        item.beforeExecutable=(result.mode&0o111)!==0
        item.beforeMode=result.mode
        item.beforeImage=name
      }
      if(change.after){
        const name=imageName(i,'after')
        const result=await capture(output,join(folder,name),change.after,MAX_COPY_BYTES-total)
        total+=result.size
        item.afterMode=result.mode
        item.afterExecutable=(result.mode&0o111)!==0
        item.afterImage=name
      }
      if(item.afterExecutable!==undefined&&item.afterExecutable!==change.executable)
        throw Error('Worker file executable mode changed during batch staging')
      changes.push(item)
    }
    const planAgain=await previewNonGitProjectChanges(input)
    if(planAgain.digest!==plan.digest)
      throw Error('Original or Worker project drift during batch staging')
    // Ownership-only grant file is rechecked before final seal, including expiry.
    const current=readGrant(opts.approvalFile)
    if(JSON.stringify(current)!==JSON.stringify(grant))
      throw Error('Batch stage grant changed before sealing')
    const fields=sealFields({version:1,status:'sealed',batchId:grant.batchId,
      approvalId:grant.approvalId,projectId:plan.projectId,
      rootFingerprint:plan.rootFingerprint,sourceRevision:plan.sourceRevision,
      previewDigest:plan.digest,changes})
    const sealed:NonGitBatchSeal={...fields,digest:digest(fields)}
    await writeDurable(join(folder,'seal.json'),JSON.stringify(sealed)+'\n')
    await syncDirectory(folder)
    return sealed
  }finally{
    await lockHandle.close()
    await unlink(lock)
    await syncDirectory(root)
  }
}
/** Read-only validation for sealed private evidence; refuses source/worker drift.
 * NOT proof of safe atomic apply: never calls a mutating source method.
 */
export async function verifyNonGitStagedBatch(input:SnapshotRequest,opts:{
  journalRoot:string;batchId:string;expectedPreviewDigest:string
}):Promise<NonGitBatchSeal>{
  if(!ID.test(opts.batchId)||!HEX64.test(opts.expectedPreviewDigest))
    throw Error('Invalid batch verification scope')
  const root=privateRoot(input,opts.journalRoot)
  const folder=join(root,'batch-'+opts.batchId)
  const info=await lstat(folder)
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Batch directory is unsafe')
  const intent=await readPrivateJson(join(folder,'intent.json')) as NonGitBatchStageGrant
  const sealed=await readPrivateJson(join(folder,'seal.json')) as NonGitBatchSeal
  if(!sealed||sealed.version!==1||sealed.status!=='sealed'||
    sealed.batchId!==opts.batchId||intent.batchId!==sealed.batchId||
    sealed.approvalId!==intent.approvalId||
    sealed.projectId!==input.projectId||sealed.projectId!==intent.projectId||
    sealed.rootFingerprint!==input.fingerprint||
    sealed.previewDigest!==opts.expectedPreviewDigest||
    sealed.previewDigest!==intent.previewDigest||
    !Array.isArray(sealed.changes)||!sealed.changes.length||
    sealed.changes.length>MAX_FILES)
    throw Error('Batch seal metadata mismatch')
  const {digest:proof,...fields}=sealed
  if(proof!==digest(fields))throw Error('Batch seal digest mismatch')
  const plan=await previewNonGitProjectChanges(input)
  if(plan.digest!==sealed.previewDigest||plan.sourceRevision!==sealed.sourceRevision||
    plan.changes.length!==sealed.changes.length)
    throw Error('Source or worker drift since sealed batch')
  let total=0
  const allowed=new Set(['intent.json','seal.json'])
  for(const [i,change] of sealed.changes.entries()){
    const expected=plan.changes[i]!
    if(!validRel(change.path)||change.path!==expected.path||
      change.action!==expected.action||change.before!==expected.before||
      change.after!==expected.after||change.afterExecutable!==undefined&&
      change.afterExecutable!==expected.executable)
      throw Error('Sealed batch change does not match immutable preview')
    for(const [which,oid]of [['before',change.before],['after',change.after]] as const){
      const key=which==='before'?'beforeImage':'afterImage'
      const name=change[key]
      if(!oid){if(name!==undefined)throw Error('Unexpected batch image');continue}
      if(name!==imageName(i,which))throw Error('Batch image name mismatch')
      allowed.add(name)
      const file=join(folder,name),stat=await lstat(file)
      if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
        throw Error('Unsafe private batch image')
      const actual=await hashedFile(file,MAX_COPY_BYTES-total,oid.length as 40|64)
      if(actual.oid!==oid)throw Error('Corrupted sealed batch image')
      total+=actual.size
    }
  }
  for(const item of await readdir(folder)){
    if(!allowed.has(item))throw Error('Unexpected file in private sealed batch')
  }
  return sealed
}
