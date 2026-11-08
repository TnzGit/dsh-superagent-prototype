/** Operator-approved, read-only inventory of an existing DSH host's Workspaces and Sessions.
 * A catalog entry is a REFERENCE, not an invitation to open its directory or hijack its Session.
 * Live prompts to another DSH host require a separate authenticated, version-checked adapter.
 */
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'
const ID=/^[a-z0-9][a-z0-9_-]{0,63}$/
export interface ExistingDshWorkspace {
  workspaceId: string; title: string; path: string; sessionIds: string[]; updatedAt?: string
}
export interface ExistingDshCatalog {
  version: 1
  origin: 'dsh-host'
  /** Local display label only: e.g. mac-dsh-3080. Never treated as a network endpoint. */
  hostId: string
  collectedAt: string
  workspaces: ExistingDshWorkspace[]
}
export interface ExistingDshProject extends ExistingDshWorkspace {
  /** Stable, restricted alias for user selection; not a new DSH Workspace ID. */
  projectId: string
  hostId: string
}
export const aliasOf = (workspaceId:string):string=>
  'dsh-'+createHash('sha256').update(workspaceId).digest('hex').slice(0,16)
/** Parse the official DSH workspace-projection fields, including the real Session membership. */
export function parseDshCatalog(data:unknown): ExistingDshProject[] {
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid DSH catalog')
  const catalog=data as Record<string,unknown>
  if(catalog.version!==1||catalog.origin!=='dsh-host'||typeof catalog.hostId!=='string'||
    !ID.test(catalog.hostId)||typeof catalog.collectedAt!=='string'||
    !Number.isFinite(Date.parse(catalog.collectedAt))||!Array.isArray(catalog.workspaces))
    throw Error('Invalid DSH catalog header')
  const seen=new Set<string>()
  return catalog.workspaces.map((item:unknown)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid DSH Workspace')
    const p=item as Record<string,unknown>
    if(typeof p.workspaceId!=='string'||!p.workspaceId||p.workspaceId.length>256||
      typeof p.title!=='string'||!p.title.trim()||p.title.length>200||
      typeof p.path!=='string'||!isAbsolute(p.path)||!Array.isArray(p.sessionIds)||
      !p.sessionIds.every((v:unknown)=>typeof v==='string'&&!!v&&v.length<=256))
      throw Error('Invalid DSH Workspace fields')
    const key=catalog.hostId+':'+p.workspaceId
    if(seen.has(key))throw Error('Duplicate Workspace ID')
    seen.add(key)
    return {workspaceId:p.workspaceId,title:p.title,path:p.path,sessionIds:p.sessionIds,
      ...(typeof p.updatedAt==='string'?{updatedAt:p.updatedAt}:{}),
      projectId:aliasOf(key),hostId:catalog.hostId as string} as ExistingDshProject
  })
}
/** File supplied by operator; no scanning of DSH_HOME, session logs, GUI files, or API auth state. */
export function readDshCatalog(file=process.env.DSH_SUPERAGENT_DSH_CATALOG_FILE):ExistingDshProject[] {
  if(!file)return []
  if(!isAbsolute(file))throw Error('Existing DSH catalog path must be absolute')
  const stat=lstatSync(file)
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
    throw Error('Existing DSH catalog must be owner-only (0600) and not a symlink')
  return parseDshCatalog(JSON.parse(readFileSync(file,'utf8')))
}
export interface Selection {
  kind:'existing'|'new-request'|'clarify'|'none'
  project?:ExistingDshProject
  projectId?:string
  evidence?:'explicit-id'|'unique-exact-title'|'confirmed-thread'
  reason?:string
  matches?:readonly string[]
}
function firstLine(text:string):string{return text.split(/\r?\n/,1)[0]?.trim()??''}
function newId(text:string):string|undefined {
  const value=/^(?:\/new-project\s+|新建项目\s*[:：]\s*)([a-z0-9][a-z0-9_-]{0,63})\s*$/.exec(firstLine(text))
  return value?.[1]
}
function explicitId(text:string):string|undefined {
  const value=/^(?:\/project\s+|项目\s*[:：]\s*)([a-z0-9][a-z0-9_-]{0,63})\s*$/.exec(firstLine(text))
  return value?.[1]
}
function exactTitle(text:string):string|undefined {
  // Exact quoted project title with a request to work/continue there; never free-text similarity.
  const matches=[...text.matchAll(/(?:继续|接着|在|处理|修改|完善)\s*(?:项目)?[《「“]([^》」”]{1,200})[》」”]\s*(?:项目)?/g)]
  return matches.length===1?matches[0]?.[1]?.trim():undefined
}
/** A high-confidence match requires an explicit ID, a uniquely quoted exact title,
 * or a previously human-confirmed binding AND an explicit "continue previous project" request.
 * Neither recency, embedding score nor a guess may authorize access to a project.
 */
export function chooseExistingDshProject(text:string,projects:readonly ExistingDshProject[],
  confirmedThreadProjectId?:string):Selection {
  const create=newId(text)
  if(create)return projects.some(p=>p.projectId===create)
    ?{kind:'clarify',reason:'The requested new project ID already exists'}
    :{kind:'new-request',projectId:create,reason:'Requires an approved new-project root and explicit confirmation'}
  const id=explicitId(text)
  if(id){
    const matches=projects.filter(p=>p.projectId===id)
    return matches.length===1?{kind:'existing',project:matches[0],projectId:id,evidence:'explicit-id'}
      :{kind:'clarify',reason:'Project ID is not registered uniquely',matches:matches.map(p=>p.projectId)}
  }
  const title=exactTitle(text)
  if(title){
    const matches=projects.filter(p=>p.title===title)
    if(matches.length===1)return{kind:'existing',project:matches[0],projectId:matches[0]!.projectId,
      evidence:'unique-exact-title'}
    return{kind:'clarify',reason:matches.length?'Several DSH Workspaces have the same title':'No such exact DSH Workspace title',
      matches:matches.map(p=>p.projectId)}
  }
  if(/^(?:继续|接着|继续之前|继续刚才)(?:上次|刚才|之前|原来)?(?:的)?(?:那个|这个|先前)?项目(?:的工作|工作)?[。！!.\s]*$/.test(firstLine(text))){
    const matches=projects.filter(p=>p.projectId===confirmedThreadProjectId)
    return matches.length===1?{kind:'existing',project:matches[0],projectId:matches[0]!.projectId,
      evidence:'confirmed-thread'}
      :{kind:'clarify',reason:'No previously confirmed project binding for this conversation'}
  }
  return{kind:'none',reason:'No high-confidence project selection; do not infer from vague wording'}
}
