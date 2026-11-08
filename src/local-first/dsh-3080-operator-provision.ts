/** Local-Mac filesystem and official owner RPC bindings for a *new* original
 * DSH Workspace. Never used from Weixin; only import from an explicitly
 * operator-approved one-shot host runner.
 *
 * The original DSH Workspace controller exposes workspace/follow as a stream,
 * not a POST snapshot. Its official baseline reader MUST be injected; do not
 * invent a workspace/list HTTP route or infer membership from cwd alone.
 */
import {createHash} from 'node:crypto'
import {constants} from 'node:fs'
import {access,lstat,mkdir,open,realpath} from 'node:fs/promises'
import {basename,dirname,isAbsolute,join,parse,resolve,sep} from 'node:path'
import type {NativeWorkspaceProvisionPort,NewDshWorkspace} from './dsh-3080-new-workspace.ts'
import {DshOwnerRpc} from './dsh-3080-operator-rpc.ts'
const bad=(message:string):never=>{throw Error('Original DSH provisioning blocked: '+message)}
/** One private, owner-controlled approval ledger root already created 0700. */
export interface ProvisionHostOptions {
  rpc:DshOwnerRpc
  /** Absolute canonical 0700 private directory, separate from any Workspace. */
  privateLedgerRoot:string
  /** Read-only official workspace/follow baseline lookup from installed DSH. */
  readWorkspace:(workspaceId:string)=>Promise<NewDshWorkspace>
}
async function privateDir(path:string):Promise<void> {
  if(!isAbsolute(path)||resolve(path)!==path)bad('private ledger path is noncanonical')
  const stat=await lstat(path)
  if(!stat.isDirectory()||stat.isSymbolicLink()||
    (stat.mode&0o077)!==0||typeof process.getuid!=='function'||
    stat.uid!==process.getuid()||await realpath(path)!==path)
    bad('private ledger root must be a canonical, owner-only, non-symlink directory')
}
/** Canonical, symlink-safe owner-writable directory checks for the approved
 * *existing parent*, including every ancestor component. Never create roots.
 */
async function inspectApprovedParent(path:string):Promise<{
  canonicalPath:string;directory:boolean;symlinkSafe:boolean;writable:boolean
}> {
  if(!isAbsolute(path)||resolve(path)!==path||typeof process.getuid!=='function')
    return{canonicalPath:'',directory:false,symlinkSafe:false,writable:false}
  let safe=true
  const root=parse(path).root
  const parts=path.slice(root.length).split(sep).filter(Boolean)
  let walked=root
  try{
    for(const part of parts){
      walked=join(walked,part)
      const s=await lstat(walked)
      if(!s.isDirectory()||s.isSymbolicLink()){safe=false;break}
    }
    const canonical=await realpath(path)
    const end=await lstat(path)
    let writable=false
    try{await access(path,constants.W_OK);writable=true}catch{}
    return{canonicalPath:canonical,directory:end.isDirectory(),
      symlinkSafe:safe&&canonical===path&&end.uid===process.getuid()&&
        (end.mode&0o022)===0,
      writable}
  }catch{return{canonicalPath:'',directory:false,symlinkSafe:false,writable:false}}
}
async function absent(path:string):Promise<boolean> {
  try{await lstat(path);return false}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return true;throw e}
}
/** Build the one-shot Workspace creation port using only owner-only local
 * filesystem operations and the verified official 3080 RPC methods.
 * Caller must supply a genuine streamed host Workspace baseline reader.
 */
export function originalDshProvisionPort(options:ProvisionHostOptions):NativeWorkspaceProvisionPort {
  const {rpc,privateLedgerRoot,readWorkspace}=options
  if(typeof readWorkspace!=='function')bad('official Workspace baseline reader required')
  return{
    inspectParent:inspectApprovedParent,
    childExists:async path=>!(await absent(path)),
    async claimApproval(approvalId){
      await privateDir(privateLedgerRoot)
      const tag=createHash('sha256').update(approvalId).digest('hex')
      const entry=join(privateLedgerRoot,'approval-'+tag)
      try{await mkdir(entry,{mode:0o700})}
      catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return false;throw e}
      return true
    },
    async persistStep(step,data){
      await privateDir(privateLedgerRoot)
      const dir=join(privateLedgerRoot,'approval-'+
        createHash('sha256').update(data.approvalId).digest('hex'))
      await privateDir(dir)
      const file=join(dir,'ledger.jsonl')
      // Append only inside the claimed owner-only ledger directory, fsync
      // before the next external operation, and never include a credential.
      const fd=await open(file,'a',0o600)
      try{await fd.writeFile(JSON.stringify({at:new Date().toISOString(),step,...data})+'\n')
        await fd.sync()}
      finally{await fd.close()}
    },
    async mkdirExclusive(path){
      if(!isAbsolute(path)||basename(path)==='.'||basename(path)==='..'||resolve(path)!==path)
        bad('new project path is not a single canonical directory')
      await mkdir(path,{recursive:false,mode:0o700})
    },
    async registerWorkspace(path){
      const payload=await rpc.registerNewWorkspace(path)
      if(!payload||typeof payload!=='object'||Array.isArray(payload))bad('invalid workspace/create response')
      const r=payload as Record<string,unknown>
      const w=r.workspace
      if(!w||typeof w!=='object'||Array.isArray(w))bad('missing original Workspace')
      const row=w as Record<string,unknown>
      if(typeof r.created!=='boolean'||typeof row.workspaceId!=='string'||
        typeof row.path!=='string'||!Array.isArray(row.sessionIds)||
        !row.sessionIds.every(x=>typeof x==='string'))
        bad('invalid workspace/create identity or membership')
      return{created:r.created,workspace:{workspaceId:row.workspaceId,
        path:row.path,sessionIds:row.sessionIds as string[]}}
    },
    async createSession(workspaceId){
      const value=await rpc.createNewSession(workspaceId)
      if(!value||typeof value!=='object'||Array.isArray(value)||
        typeof (value as Record<string,unknown>).sessionId!=='string')
        bad('invalid session/create response')
      return{sessionId:(value as {sessionId:string}).sessionId}
    },
    inspectWorkspace:readWorkspace,
  }
}
