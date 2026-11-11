/** Operator-registered projects: remote chat may select IDs, never supply arbitrary paths. */
import { lstatSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { ModelEndpointQueue } from './model-queue.ts'
export interface ProjectSpec { id: string; root: string; kind: 'local' | 'git'; readOnly?: boolean }
export interface Project { id: string; root: string; kind: 'local' | 'git'; readOnly: boolean }
const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{0,63}$/
const SECRETS = new Set(['.ssh','.git','.aws','.gnupg','.env','.npmrc','.pypirc','.netrc','id_rsa','id_ed25519'])
function within(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}
function canonicalDir(dir: string): string {
  if (!isAbsolute(dir)) throw new Error('Project and allowlisted roots must be absolute')
  const real = realpathSync(dir)
  if (!lstatSync(real).isDirectory()) throw new Error('Project root must be a directory')
  return real
}
/** Defensive path checks; process/container filesystem isolation is still required for execution. */
export class LocalProjectRegistry {
  private readonly projects = new Map<string, Project>()
  // Read-only registration-time identity evidence. Not an authenticated OS capability.
  private readonly rootIdentities = new Map<string, {root:string;dev:number;ino:number}>()
  private readonly writers = new Map<string, ModelEndpointQueue>()
  constructor(allowedRoots: readonly string[], specs: readonly ProjectSpec[]) {
    if (!allowedRoots.length) throw new Error('Configure at least one allowed root')
    const roots = allowedRoots.map(canonicalDir)
    for (const spec of specs) {
      if (!IDENTIFIER.test(spec.id) || this.projects.has(spec.id)) throw new Error('Invalid or duplicate project ID')
      if (lstatSync(spec.root).isSymbolicLink()) throw new Error('Symlinked project root is forbidden')
      const root = canonicalDir(spec.root)
      if (!roots.some(allowed => within(allowed, root))) throw new Error('Project is outside the allowed roots')
      const identity=lstatSync(root)
      if(!identity.isDirectory()||identity.isSymbolicLink())
        throw new Error('Registered project root identity unavailable')
      this.rootIdentities.set(spec.id,{root,dev:identity.dev,ino:identity.ino})
      this.projects.set(spec.id, { id: spec.id, root, kind: spec.kind, readOnly: !!spec.readOnly })
    }
  }
  get(id: string): Project {
    const project = this.projects.get(id)
    if (!project) throw new Error('Unknown project ID')
    return project
  }
  list(): Project[] { return [...this.projects.values()].map(p => ({ ...p })) }
  /** Read-only identity check against the actual directory captured at registration.
   * Detects same-path directory replacement, unlike a path-only fingerprint.
   * The check is NOT atomic with later uses and does not prevent external writers.
   */
  assertRegisteredRootIdentity(id:string):void {
    const project=this.get(id),expected=this.rootIdentities.get(id)
    if(!expected||project.root!==expected.root)
      throw new Error('Registered synthetic project directory identity changed')
    let actual
    try {actual=lstatSync(expected.root)}
    catch {throw new Error('Registered synthetic project directory identity changed')}
    if(!actual.isDirectory()||actual.isSymbolicLink()||
      actual.dev!==expected.dev||actual.ino!==expected.ino)
      throw new Error('Registered synthetic project directory identity changed')
  }
  /** Path may not exist yet, but all existing ancestors are checked without following symlinks. */
  path(id: string, input: string, access: 'read' | 'write' = 'read'): string {
    const project = this.get(id)
    if (access === 'write' && project.readOnly) throw new Error('Project is read-only')
    if (typeof input !== 'string' || input.includes('\\') || input.includes('\0') || isAbsolute(input)) throw new Error('Invalid relative path')
    const parts = input.split('/').filter(p => p && p !== '.')
    if (parts.some(p => p === '..' || SECRETS.has(p) || p.startsWith('.env.'))) throw new Error('Blocked relative path')
    const target = resolve(project.root, ...parts)
    if (!within(project.root, target)) throw new Error('Target leaves project root')
    let current = project.root
    for (const segment of parts) {
      current = resolve(current, segment)
      try {
        if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink traversal denied')
        if (!within(project.root, realpathSync(current))) throw new Error('Resolved path leaves project root')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
    }
    return target
  }
  /** At most one write job per project. Locks only protect users of this registry, not external processes. */
  write<T>(id: string, job: () => Promise<T>): Promise<T> {
    if (this.get(id).readOnly) return Promise.reject(new Error('Project is read-only'))
    let queue = this.writers.get(id)
    if (!queue) { queue = new ModelEndpointQueue(1); this.writers.set(id, queue) }
    return queue.run(() => job(), { priority: 'normal' })
  }
}
