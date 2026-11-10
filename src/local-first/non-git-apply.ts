/** Explicit, default-OFF, SINGLE-FILE non-Git synthetic/apply primitive.
 * No runtime/Weixin/Worker caller exists. Do not infer live host authorization.
 * Crash recovery is manual, never an automatic retry.
 */
import {createHash,randomUUID} from 'node:crypto'
import {constants as fsConstants,lstatSync,realpathSync} from 'node:fs'
import {copyFile,link,lstat,mkdir,open,readFile,readdir,rename,rm,unlink,chmod} from 'node:fs/promises'
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path'
import {createReadStream} from 'node:fs'
import {previewNonGitProjectChanges,projectFingerprint,type NonGitChange,type SnapshotRequest} from './project-workspaces.ts'

const TX=/^[a-z0-9][a-z0-9-]{7,79}$/
const HASH=/^[a-f0-9]{64}$/
const contained=(base:string,target:string):boolean=>{
  const r=relative(base,target)
  return r===''||(r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r))
}
export interface NonGitFileApproval {
  version:1
  operation:'apply'|'rollback'
  approvalId:string
  transactionId:string
  projectId:string
  rootFingerprint:string
  previewDigest:string
  expiresAt:string
  operatorApproved:true
  /** Rollback uses a distinct approval and refers to the original transaction. */
  rollbackOfTransactionId?:string
}
export type FileJournalStatus='prepared'|'applying'|'applied'|'rolling-back'|'rolled-back'
export interface NonGitFileJournal {
  version:1
  transactionId:string
  approvalId:string
  projectId:string
  rootFingerprint:string
  previewDigest:string
  sourceRevision:string
  path:string
  change:NonGitChange
  beforeExecutable?:boolean
  /** Exact original POSIX permissions, restored only after an independent rollback grant. */
  beforeMode?:number
  status:FileJournalStatus
  /** Populated BEFORE attempting a rollback. Reuse never grants a second write. */
  rollbackApprovalId?:string
}
function readApproval(file:string):NonGitFileApproval {
  if(!isAbsolute(file))throw Error('Operator approval must be an absolute private path')
  const info=lstatSync(file)
  if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Operator approval must be owner-only non-symlink')
  const p=JSON.parse(requireRead(file)) as NonGitFileApproval
  const fields=Object.keys(p).sort().join(',')
  const allowed=Object.keys({version:1,operation:1,approvalId:1,transactionId:1,projectId:1,
    rootFingerprint:1,previewDigest:1,expiresAt:1,operatorApproved:1,rollbackOfTransactionId:1})
  if(fields.split(',').some(x=>!allowed.includes(x))||
    p.version!==1||!['apply','rollback'].includes(p.operation)||
    !TX.test(p.approvalId)||!TX.test(p.transactionId)||
    typeof p.projectId!=='string'||!p.projectId||
    !HASH.test(p.rootFingerprint)||!HASH.test(p.previewDigest)||
    p.operatorApproved!==true||!Number.isFinite(Date.parse(p.expiresAt))||
    Date.parse(p.expiresAt)<=Date.now()||
    (p.operation==='apply'?p.rollbackOfTransactionId!==undefined:
      !p.rollbackOfTransactionId||!TX.test(p.rollbackOfTransactionId)||
      p.rollbackOfTransactionId===p.transactionId))
    throw Error('Invalid or expired single-file operator approval')
  return p
}
import {readFileSync} from 'node:fs'
function requireRead(path:string):string{return readFileSync(path,'utf8')}
function recheckApproval(file:string,expected:NonGitFileApproval):void {
  const now=readApproval(file)
  if(JSON.stringify(now)!==JSON.stringify(expected))
    throw Error('Private approval changed before source write')
}
function journalRoot(input:SnapshotRequest,dir:string):string {
  if(!isAbsolute(dir))throw Error('Journal directory must be absolute')
  const info=lstatSync(dir)
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)
    throw Error('Journal root must be owner-only non-symlink directory')
  const root=realpathSync(dir),project=realpathSync(input.registry.get(input.projectId).root),
    workspace=realpathSync(input.directory)
  if(contained(root,project)||contained(project,root)||
    contained(root,workspace)||contained(workspace,root))
    throw Error('Journal must not overlap source project or worker workspace')
  return root
}
async function syncDir(dir:string):Promise<void>{
  const handle=await open(dir,'r')
  try{await handle.sync()}finally{await handle.close()}
}
async function atomicJournal(dir:string,row:NonGitFileJournal):Promise<void>{
  const temporary=join(dir,'.state-'+randomUUID())
  try{
    const handle=await open(temporary,'wx',0o600)
    try{await handle.writeFile(JSON.stringify(row)+'\n');await handle.sync()}
    finally{await handle.close()}
    await rename(temporary,join(dir,'journal.json'))
    await syncDir(dir)
  }finally{await rm(temporary,{force:true}).catch(()=>{})}
}
/** An existing lock is NEVER broken automatically after a crash: human audit required. */
async function underLock<T>(root:string,work:()=>Promise<T>):Promise<T>{
  const lock=join(root,'.single-file-apply.lock')
  // A prior crash or concurrent operator attempt must not reveal the private
  // journal root through the raw Node EEXIST error. Never steal or retry locks.
  let f:Awaited<ReturnType<typeof open>>
  try{f=await open(lock,'wx',0o600)}
  catch(error){
    if((error as NodeJS.ErrnoException).code==='EEXIST')
      throw Error('Single-file apply lock exists; human reconciliation required')
    throw error
  }
  try{await f.sync();await syncDir(root);return await work()}
  finally{await f.close();await unlink(lock);await syncDir(root)}
}
async function fileBlob(path:string,hashLength:number):Promise<string|undefined>{
  let info
  try{info=await lstat(path)}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e}
  if(!info.isFile()||info.isSymbolicLink())throw Error('Unsafe source or worker file type')
  const digest=createHash(hashLength===40?'sha1':'sha256')
  digest.update('blob '+info.size+'\0')
  let count=0
  for await(const chunk of createReadStream(path)){
    const data=chunk as Buffer
    count+=data.length
    if(count>info.size)throw Error('File changed during transaction')
    digest.update(data)
  }
  const updated=await lstat(path)
  if(count!==info.size||updated.size!==info.size||
    ((updated.mode&0o111)!==0)!==((info.mode&0o111)!==0))
    throw Error('File changed during transaction')
  return digest.digest('hex')
}
/** Conservative preflight, not a race-free OS-level file descriptor guard.
 * Reject known hardlink aliases and metadata that the single-file journal
 * cannot restore. This remains strictly default-OFF and synthetic tested.
 */
async function refuseUnsupportedSourceMetadata(path:string):Promise<void>{
  let info:Awaited<ReturnType<typeof lstat>>
  try{info=await lstat(path)}
  catch(e){
    if((e as NodeJS.ErrnoException).code==='ENOENT')return
    throw e
  }
  if(!info.isFile()||info.isSymbolicLink())
    throw Error('Unsupported source file type requires manual review')
  if(info.nlink!==1)
    throw Error('Hardlinked source path requires manual review')
  if((info.mode&0o7000)!==0)
    throw Error('Special source mode bits require manual review')
}
function safeTarget(input:SnapshotRequest,change:NonGitChange):string {
  if(!change.path||change.path.includes('\\')||
    change.path.split('/').some(x=>!x||x==='.'||x==='..'))
    throw Error('Invalid target path')
  return input.registry.path(input.projectId,change.path,'write')
}
/** Prevent a new apply while a previous transaction remains uncertain. */
async function noPendingTransaction(root:string):Promise<void>{
  for(const item of await readdir(root,{withFileTypes:true})){
    if(!item.name.startsWith('tx-'))continue
    if(!item.isDirectory()||item.isSymbolicLink())throw Error('Unsafe transaction journal entry')
    let row:NonGitFileJournal
    try{row=JSON.parse(await readFile(join(root,item.name,'journal.json'),'utf8')) as NonGitFileJournal}
    catch{throw Error('Unreconciled transaction journal')}
    if(['prepared','applying','rolling-back'].includes(row.status))
      throw Error('Unreconciled transaction journal must be manually reviewed')
  }
}
async function copyVerified(from:string,to:string,oid:string,executable:boolean,mode?:number):Promise<void>{
  await copyFile(from,to,fsConstants.COPYFILE_EXCL)
  await chmod(to,mode??(executable?0o700:0o600))
  const got=await fileBlob(to,oid.length)
  if(got!==oid)throw Error('File content changed during private copy')
  const handle=await open(to,'r')
  try{await handle.sync()}finally{await handle.close()}
}
/** No API is exported to call apply from Weixin/Worker. Requires private operator file
 * and owner-only OUT-OF-SOURCE journal; at most one existing-parent file.
 * Source writes only happen after the complete journal+backup is durably prepared.
 */
export async function applyOneNonGitFile(input:SnapshotRequest,opts:{
  journalDirectory:string;approvalFile:string
}):Promise<NonGitFileJournal>{
  const approval=readApproval(opts.approvalFile)
  if(approval.operation!=='apply'||approval.projectId!==input.projectId||
    approval.rootFingerprint!==input.fingerprint)throw Error('Apply approval scope mismatch')
  const root=journalRoot(input,opts.journalDirectory)
  return underLock(root,async()=>{
    await noPendingTransaction(root)
    const plan=await previewNonGitProjectChanges(input)
    if(plan.digest!==approval.previewDigest||plan.changes.length!==1)
      throw Error('Single-file plan digest mismatch or more than one change')
    const change=plan.changes[0]!,target=safeTarget(input,change),parent=dirname(target)
    if(!lstatSync(parent).isDirectory())throw Error('Apply requires an existing ordinary parent directory')
    await refuseUnsupportedSourceMetadata(target)
    const dir=join(root,'tx-'+approval.transactionId)
    await mkdir(dir,{mode:0o700})
    await syncDir(root)
    const beforeMode=change.before?(await lstat(target)).mode:undefined
    const row:NonGitFileJournal={version:1,transactionId:approval.transactionId,
      approvalId:approval.approvalId,projectId:plan.projectId,rootFingerprint:plan.rootFingerprint,
      previewDigest:plan.digest,sourceRevision:plan.sourceRevision,path:change.path,change,
      ...(beforeMode===undefined?{}:{beforeExecutable:(beforeMode&0o111)!==0,beforeMode:beforeMode&0o777}),status:'prepared'}
    const temp=join(parent,'.dsh-apply-'+randomUUID())
    try{
      const before=await fileBlob(target,change.before?.length??change.after?.length??40)
      if(before!==change.before)throw Error('Source drift immediately before apply')
      if(change.before){
        await copyVerified(target,join(dir,'before.bin'),change.before,false,0o600)
      }
      if(change.after){
        const worker=resolve(realpathSync(input.directory),change.path)
        const actual=await fileBlob(worker,change.after.length)
        if(actual!==change.after)throw Error('Worker file drift before apply')
        await copyVerified(worker,temp,change.after,change.executable)
      }
      await syncDir(dir)
      await atomicJournal(dir,row)
      // Expiry or permission revocation during a long preview blocks the write.
      recheckApproval(opts.approvalFile,approval)
      await atomicJournal(dir,{...row,status:'applying'})
      // One more pre-write drift check; external writers must be quiesced by the
      // operator (our lock only serializes calls using this module).
      if(await fileBlob(target,change.before?.length??change.after?.length??40)!==change.before)
        throw Error('Source drift immediately before mutation')
      await refuseUnsupportedSourceMetadata(target)
      if(change.before&&((await lstat(target)).mode&0o111)!==(beforeMode!&0o111))
        throw Error('Source executable mode drift')
      if(change.action==='add'){
        await link(temp,target) // atomic no-clobber: fails if source appeared
        await unlink(temp)
      }else if(change.action==='modify')await rename(temp,target)
      else await unlink(target)
      await syncDir(parent)
      if(await fileBlob(target,change.after?.length??change.before?.length??40)!==change.after)
        throw Error('Source post-write verification failed; manual review required')
      const completed={...row,status:'applied' as const}
      await atomicJournal(dir,completed)
      return completed
    }finally{await rm(temp,{force:true}).catch(()=>{})}
  })
}
/** A separate fresh PRIVATE rollback approval is required; this never reacts
 * to a chat message, retry loop or automatic process startup.
 * All non-before/non-after source states fail closed for manual reconciliation.
 */
export async function rollbackOneNonGitFile(input:SnapshotRequest,opts:{
  journalDirectory:string;approvalFile:string
}):Promise<NonGitFileJournal>{
  const approval=readApproval(opts.approvalFile)
  if(approval.operation!=='rollback'||approval.projectId!==input.projectId||
    approval.rootFingerprint!==input.fingerprint)throw Error('Rollback approval scope mismatch')
  const root=journalRoot(input,opts.journalDirectory)
  if(projectFingerprint(input.registry.get(input.projectId))!==input.fingerprint)
    throw Error('Rollback project identity drift')
  return underLock(root,async()=>{
    const dir=join(root,'tx-'+approval.rollbackOfTransactionId)
    const info=await lstat(dir)
    if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)
      throw Error('Untrusted transaction journal directory')
    const journalFile=join(dir,'journal.json')
    const journalStat=await lstat(journalFile)
    if(!journalStat.isFile()||journalStat.isSymbolicLink()||
      (journalStat.mode&0o077)!==0)
      throw Error('Unsafe private transaction journal file')
    const row=JSON.parse(await readFile(journalFile,'utf8')) as NonGitFileJournal
    if(row.version!==1||row.transactionId!==approval.rollbackOfTransactionId||
      row.projectId!==approval.projectId||row.rootFingerprint!==approval.rootFingerprint||
      row.previewDigest!==approval.previewDigest||
      !['applied','applying'].includes(row.status)||row.rollbackApprovalId)
      throw Error('Rollback journal scope or terminal status mismatch')
    const target=safeTarget(input,row.change),parent=dirname(target)
    if(row.path!==row.change.path||row.change.action!=='add'&&
      row.change.action!=='modify'&&row.change.action!=='delete'||
      typeof row.change.executable!=='boolean'||
      row.change.before!==undefined&&!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(row.change.before)||
      row.change.after!==undefined&&!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(row.change.after)||
      row.change.before===undefined&&row.change.after===undefined)
      throw Error('Invalid transaction journal change')
    const expected=createHash('sha256').update(JSON.stringify({
      projectId:row.projectId,rootFingerprint:row.rootFingerprint,
      sourceRevision:row.sourceRevision,changes:[row.change]
    })).digest('hex')
    if(expected!==row.previewDigest)
      throw Error('Transaction journal change no longer matches approved preview')
    await refuseUnsupportedSourceMetadata(target)
    const actual=await fileBlob(target,row.change.after?.length??row.change.before?.length??40)
    const currentMode=actual===undefined?undefined:(await lstat(target)).mode&0o777
    const restored=actual===row.change.before&&
      (row.change.before===undefined||currentMode===row.beforeMode)
    const applied=actual===row.change.after&&
      (row.change.after===undefined||currentMode===(row.change.executable?0o700:0o600))
    // Content alone is insufficient: mode-only changes share the same Git blob OID.
    // A foreign chmod after apply must not silently qualify for rollback.
    if(!restored&&!applied)
      throw Error('Source content or mode changed since apply; manual review required')
    recheckApproval(opts.approvalFile,approval)
    const marked={...row,status:'rolling-back' as const,rollbackApprovalId:approval.approvalId}
    await atomicJournal(dir,marked)
    // If a crash left original bytes AND mode already present, do not rewrite them.
    if(!restored){
      const temp=join(parent,'.dsh-revert-'+randomUUID())
      try{
        if(row.change.before){
          const before=join(dir,'before.bin')
          if(await fileBlob(before,row.change.before.length)!==row.change.before)
            throw Error('Private rollback backup corrupt')
          if(typeof row.beforeMode!=='number'||row.beforeMode<0||
            row.beforeMode>0o777||!Number.isInteger(row.beforeMode))
            throw Error('Rollback journal has invalid original file mode')
          await copyVerified(before,temp,row.change.before,row.beforeExecutable===true,row.beforeMode)
          if(await fileBlob(target,row.change.after?.length??40)!==row.change.after)
            throw Error('Source drift before rollback')
          await refuseUnsupportedSourceMetadata(target)
          if(row.change.action==='delete'){
            await link(temp,target);await unlink(temp)
          }else await rename(temp,target)
        }else{
          if(await fileBlob(target,row.change.after?.length??40)!==row.change.after)
            throw Error('Source drift before rollback delete')
          await refuseUnsupportedSourceMetadata(target)
          await unlink(target)
        }
        await syncDir(parent)
      }finally{await rm(temp,{force:true}).catch(()=>{})}
    }
    if(await fileBlob(target,row.change.before?.length??row.change.after?.length??40)!==row.change.before)
      throw Error('Rollback verification failed; manual review required')
    if(row.change.before&&((await lstat(target)).mode&0o777)!==row.beforeMode)
      throw Error('Rollback original mode mismatch')
    const done={...marked,status:'rolled-back' as const}
    await atomicJournal(dir,done)
    return done
  })
}
