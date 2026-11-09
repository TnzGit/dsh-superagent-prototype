/** Durable, isolated project snapshots for DSH local-only Ticket workers; source projects are NEVER modified. */
import { randomUUID, createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { chmod, cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { LocalProjectRegistry, type Project, type ProjectSpec } from './project-registry.ts'
const git = promisify(execFileCallback)
const PROJECT = /^[a-z0-9][a-z0-9_-]{0,63}$/
const NON_GIT_EXCLUDES = new Set(['.git', '.hg', '.svn', 'node_modules', '.venv', '.tox', '.cache', '.idea', '.DS_Store',
  '.ssh', '.aws', '.gnupg', '.npmrc', '.pypirc', '.netrc', 'id_rsa', 'id_ed25519'])
const MAX_ITEMS = 10000, MAX_BYTES = 1024 * 1024 * 1024
export interface LocalProjectsFile { allowedRoots: string[]; projects: ProjectSpec[] }
export interface SnapshotManifest { projectId: string; rootFingerprint: string; kind: Project['kind']; sourceRevision: string }
const contained = (base: string, target: string): boolean => {
  const rel = relative(base, target)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}
const hash = (text: string): string => createHash('sha256').update(text).digest('hex')
export const projectFingerprint = (project: Project): string => hash(JSON.stringify([project.id,project.root,project.kind,project.readOnly]))
/**
 * A project ID is an explicit first-line selector, not a path or something inferred from a prompt.
 * Examples: "/project demo-app\nFix the typo" and "项目：demo-app\n修复错字".
 */
export function projectIdFromRequest(text: string): string | undefined {
  const first = text.split(/\r?\n/, 1)[0]?.trim() ?? ''
  const match = /^(?:\/project\s+|项目\s*[:：]\s*)([a-z0-9][a-z0-9_-]{0,63})\s*$/.exec(first)
  return match?.[1]
}
/** Operator-owned allowlist file is an input to the host, never writable by a model or a Weixin message. */
export function readLocalProjects(file = process.env.DSH_SUPERAGENT_LOCAL_PROJECTS_FILE): LocalProjectRegistry | undefined {
  if (!file) return undefined
  if (!isAbsolute(file)) throw new Error('Local project registry file must be absolute')
  const info = lstatSync(file)
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o022) !== 0)
    throw new Error('Local project registry must be a regular file not writable by group/others')
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid local project registry object')
  const value = raw as Record<string, unknown>
  if (Object.keys(value).some(k => !['allowedRoots','projects'].includes(k)) || !Array.isArray(value.allowedRoots) ||
    !Array.isArray(value.projects) || !value.projects.length) throw new Error('Invalid local project registry shape')
  if (!value.allowedRoots.every((v: unknown) => typeof v === 'string') ||
    !value.projects.every((p: unknown) => p && typeof p === 'object' && !Array.isArray(p) &&
      Object.keys(p).every(k => ['id','root','kind','readOnly'].includes(k)) &&
      typeof (p as ProjectSpec).id === 'string' && typeof (p as ProjectSpec).root === 'string' &&
      ['git','local'].includes((p as ProjectSpec).kind) &&
      ((p as ProjectSpec).readOnly === undefined || typeof (p as ProjectSpec).readOnly === 'boolean')))
    throw new Error('Invalid local project registry entries')
  return new LocalProjectRegistry(value.allowedRoots as string[], value.projects as ProjectSpec[])
}
const gitEnvironment = (): NodeJS.ProcessEnv => ({
  ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1'
})
async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await git('git', args, { cwd, encoding:'utf8', timeout: 120_000, maxBuffer: 5_000_000, env: gitEnvironment() })
  return stdout
}
function excluded(relativeFile: string): boolean {
  return relativeFile.split(sep).some(s => NON_GIT_EXCLUDES.has(s) || s === '.env' || s.startsWith('.env.'))
}
async function validateTree(root: string, skipSecret: boolean): Promise<void> {
  let files = 0, bytes = 0
  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name), rel = relative(root, path)
      if (skipSecret && excluded(rel)) continue
      const info = await lstat(path)
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error('Symlinks or special files are not allowed in project snapshot')
      files++
      bytes += info.isFile() ? info.size : 0
      if (files > MAX_ITEMS || bytes > MAX_BYTES) throw new Error('Project exceeds snapshot limits')
      if (info.isDirectory()) await visit(path)
    }
  }
  await visit(root)
}
/** Ensure another project cannot contain our destination. */
export function assertWorkspaceOutsideProject(project: Project, base: string): void {
  // Check before mkdir: an invalid path inside the original project must not create
  // even an empty intermediate directory there.
  let ancestor = dirname(base)
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor)
  const target = resolve(realpathSync(ancestor), relative(ancestor, base))
  if (contained(project.root, target) || contained(target, project.root))
    throw new Error('Project source and worker workspace must not overlap')
}
export interface SnapshotRequest {
  registry: LocalProjectRegistry
  projectId: string
  directory: string
  fingerprint: string
}
/**
 * Safely populate an absent Ticket workspace from a registered source. Git gets a clean local clone
 * with origin removed; non-Git gets a secret-filtered copy and an offline baseline commit for diff.
 * Transactional staging + rename ensure failed copying cannot look like a prepared workspace.
 */
export async function createProjectSnapshot(input: SnapshotRequest): Promise<void> {
  const { registry, projectId, directory } = input
  const project = registry.get(projectId)
  if (!PROJECT.test(projectId) || project.readOnly) throw new Error('Project is not writable')
  if (projectFingerprint(project) !== input.fingerprint) throw new Error('Local project registry changed since Ticket creation')
  if (!isAbsolute(directory)) throw new Error('Ticket workspace must be absolute')
  assertWorkspaceOutsideProject(project, directory)
  await mkdir(dirname(directory), { recursive: true, mode: 0o700 })
  // Revalidate after creation in case an ancestor changed outside this process.
  assertWorkspaceOutsideProject(project, directory)
  const parent = realpathSync(dirname(directory))
  const candidate = resolve(parent, basename(directory))
  // /var is a normal alias of /private/var on macOS; compare canonical parents, not raw caller spelling.
  await lstat(candidate).then(() => { throw new Error('Workspace already exists') }, err => { if (err.code !== 'ENOENT') throw err })
  const staging = join(parent, '.dsh-stage-' + randomUUID())
  try {
    if (project.kind === 'git') {
      const sourceStatus = await runGit(['-C', project.root, 'status', '--porcelain'], parent)
      if (sourceStatus.trim()) throw new Error('Git source has uncommitted changes: commit or use a separate operator-approved snapshot')
      if (await stat(join(project.root,'.gitmodules')).then(() => true, () => false))
        throw new Error('Git submodules need explicit operator approval and are not supported in local snapshot mode')
      const tracked = await runGit(['-C',project.root,'ls-files','-z'],parent)
      if (tracked.split('\0').some(p => p && excluded(p)))
        throw new Error('Git source tracks sensitive or excluded paths; review and remove them before staging')
      await runGit(['clone','--local','--no-hardlinks','--',project.root,staging],parent)
      // Do not leave an accidental push/fetch path from a worker back to the operator's source.
      await runGit(['-C',staging,'remote','remove','origin'],parent)
      await validateTree(staging,true)
    } else {
      await validateTree(project.root,true)
      await cp(project.root,staging,{recursive:true,force:false,errorOnExist:true,dereference:false,
        filter:async src => src===project.root || !excluded(relative(project.root,src))})
      await runGit(['init','-q',staging],parent)
      await runGit(['-C',staging,'add','-A'],parent)
      await runGit(['-c','user.name=DSH Staging','-c','user.email=dsh-staging@localhost',
        '-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','-C',staging,
        'commit','--allow-empty','-qm','DSH isolated snapshot baseline'],parent)
    }
    await chmod(staging,0o700)
    // Source identity, not absolute source path or credentials, in the worker workspace.
    const info: SnapshotManifest = {projectId,rootFingerprint:input.fingerprint,kind:project.kind,
      sourceRevision:(await runGit(['-C',staging,'rev-parse','HEAD'],parent)).trim()}
    await writeFile(join(staging,'.dsh-project.json'),JSON.stringify(info)+'\n',{flag:'wx',mode:0o600})
    await rename(staging,candidate)
  } catch(error) {
    await rm(staging,{recursive:true,force:true}).catch(()=>{})
    throw error
  }
}
/** Fail closed on resumed worker whose workspace was replaced, renamed or rerouted. */
export async function verifyProjectSnapshot(input: SnapshotRequest): Promise<void> {
  const project = input.registry.get(input.projectId)
  if (projectFingerprint(project) !== input.fingerprint) throw new Error('Project configuration differs from original Ticket')
  const info = await lstat(input.directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Ticket workspace is not a normal directory')
  const root = realpathSync(input.directory)
  if (root !== resolve(realpathSync(dirname(input.directory)),basename(input.directory)))
    throw new Error('Ticket workspace was redirected through a symlink')
  assertWorkspaceOutsideProject(project,root)
  const metadata = JSON.parse(await readFile(join(root,'.dsh-project.json'),'utf8')) as SnapshotManifest
  if (metadata.projectId !== input.projectId || metadata.rootFingerprint !== input.fingerprint || metadata.kind !== project.kind)
    throw new Error('Ticket workspace belongs to another registered project')
}

/** Read-only preview; intentionally has NO method capable of writing the registered source.
 * Its digest is evidence for operator review, NOT a permission/authorization token.
 * Future apply/rollback MUST freshly recheck source drift under an exclusive host lock.
 */
export interface NonGitChange {
  path: string
  action: 'add' | 'modify' | 'delete'
  /** Git blob OID of the isolated snapshot's immutable baseline (if present). */
  before?: string
  /** Git blob OID of the worker's current file (if present). */
  after?: string
  /** Executable mode of the current worker file (false for deletions). */
  executable: boolean
}
export interface NonGitChangePreview {
  projectId: string
  rootFingerprint: string
  sourceRevision: string
  changes: NonGitChange[]
  /** SHA256 over stable identifiers + change metadata, never over private file contents. */
  digest: string
}
type ScannedFile={absolute:string;size:number;executable:boolean}
const MAX_PREVIEW_CHANGES=500
/** Enumerate ONLY allowlisted source/worker files, never following symlinks.
 * Excluded secrets, DSH/Git metadata, dependency directories and device files
 * cannot accidentally become an operator-approved patch.
 */
async function enumerateSafeFiles(root:string):Promise<Map<string,ScannedFile>> {
  const found=new Map<string,ScannedFile>()
  let count=0,bytes=0
  async function visit(directory:string):Promise<void> {
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const full=join(directory,entry.name),rel=relative(root,full)
      if(rel==='.dsh-project.json'||excluded(rel))continue
      const info=await lstat(full)
      if(info.isSymbolicLink()||(!info.isDirectory()&&!info.isFile()))
        throw Error('Unsafe symlink or special file in project change preview')
      count++;bytes+=info.isFile()?info.size:0
      if(count>MAX_ITEMS||bytes>MAX_BYTES)throw Error('Project exceeds change preview limits')
      if(info.isDirectory())await visit(full)
      else found.set(rel,{absolute:full,size:info.size,executable:(info.mode&0o111)!==0})
    }
  }
  await visit(root)
  return found
}
function treeObjects(stdout:string):Map<string,{oid:string;executable:boolean}> {
  const objects=new Map<string,{oid:string;executable:boolean}>()
  for(const entry of stdout.split('\0')){
    if(!entry)continue
    const match=/^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64})\t([^\0]+)$/.exec(entry)
    if(!match)throw Error('Unsupported Git baseline object in isolated snapshot')
    const rel=match[3]!
    if(isAbsolute(rel)||rel.split('/').some(x=>!x||x==='.'||x==='..')||
      excluded(rel)||rel==='.dsh-project.json'||rel.includes('\\')||objects.has(rel))
      throw Error('Unsafe path in isolated snapshot baseline')
    objects.set(rel,{oid:match[2]!,executable:match[1]==='100755'})
    if(objects.size>MAX_ITEMS)throw Error('Git baseline exceeds change preview limits')
  }
  return objects
}
/** Stream object hashing: Git hashes a blob as "blob <size>\\0" plus raw bytes.
 * No file content is returned and large files are not loaded into RAM.
 */
async function blobOid(file:ScannedFile,algorithm:'sha1'|'sha256'):Promise<string>{
  const result=createHash(algorithm)
  result.update('blob '+file.size+'\0')
  let read=0
  for await(const chunk of createReadStream(file.absolute)){
    const data=chunk as Buffer
    read+=data.length
    if(read>file.size)throw Error('Project file changed while being read')
    result.update(data)
  }
  if(read!==file.size)throw Error('Project file changed while being read')
  const current=await lstat(file.absolute)
  if(!current.isFile()||current.isSymbolicLink()||current.size!==file.size||
    ((current.mode&0o111)!==0)!==file.executable)
    throw Error('Project file changed during preview')
  return result.digest('hex')
}
/** PLAN ONLY: compare worker edits with the immutable non-Git snapshot baseline.
 * Abort when the original project has changed in any non-excluded file since
 * the snapshot, including added files. Never write/patch/delete the source.
 */
export async function previewNonGitProjectChanges(input:SnapshotRequest):Promise<NonGitChangePreview>{
  await verifyProjectSnapshot(input)
  const project=input.registry.get(input.projectId)
  if(project.kind!=='local'||project.readOnly)throw Error('Only writable registered non-Git projects support this preview')
  if(projectFingerprint(project)!==input.fingerprint)throw Error('Project identity drift')
  const workspace=realpathSync(input.directory)
  const dotGit=await lstat(join(workspace,'.git'))
  if(!dotGit.isDirectory()||dotGit.isSymbolicLink())
    throw Error('Worker baseline Git metadata was redirected')
  const manifest=JSON.parse(await readFile(join(workspace,'.dsh-project.json'),'utf8')) as SnapshotManifest
  if(!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(manifest.sourceRevision))
    throw Error('Invalid immutable worker snapshot revision')
  const format=(await runGit(['-C',workspace,'rev-parse','--show-object-format'],workspace)).trim()
  if(format!=='sha1'&&format!=='sha256')throw Error('Unsupported Git baseline object format')
  if(manifest.sourceRevision.length!==(format==='sha1'?40:64))
    throw Error('Snapshot baseline revision format mismatch')
  const tree=treeObjects(await runGit(['-C',workspace,'ls-tree','-rz','--full-tree',manifest.sourceRevision],workspace))
  const source=await enumerateSafeFiles(project.root)
  const worker=await enumerateSafeFiles(workspace)
  // The original source must be byte-identical to the saved snapshot.
  // A concurrent external write is fail-closed rather than merged or overwritten.
  if(source.size!==tree.size)throw Error('Original project changed since worker snapshot')
  for(const [path,original] of tree){
    const actual=source.get(path)
    if(!actual||actual.executable!==original.executable||
      (await blobOid(actual,format))!==original.oid)
      throw Error('Original project changed since worker snapshot')
  }
  const all=[...new Set([...tree.keys(),...worker.keys()])].sort()
  const changes:NonGitChange[]=[]
  for(const path of all){
    const before=tree.get(path),current=worker.get(path)
    const after=current?await blobOid(current,format):undefined
    if(before&&current&&before.oid===after&&before.executable===current.executable)continue
    changes.push({path,action:!before?'add':!current?'delete':'modify',
      ...(before?{before:before.oid}:{}),...(after?{after}:{}),
      executable:current?.executable??false})
    if(changes.length>MAX_PREVIEW_CHANGES)throw Error('Too many worker changes for a bounded manual review')
  }
  const details={projectId:input.projectId,rootFingerprint:input.fingerprint,
    sourceRevision:manifest.sourceRevision,changes}
  return {...details,digest:hash(JSON.stringify(details))}
}
