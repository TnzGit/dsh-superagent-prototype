/** Native NEW-project creation plan for the authoritative original DSH 3080.
 * The class is not wired to 3083 or Weixin and contains NO RPC implementation.
 * Callers must inject the official workspace/create and session/create APIs,
 * plus a private durable one-shot approval ledger and host-safe mkdir adapter.
 * NEVER copy or reuse an original Workspace/Session just to satisfy a new request.
 */
import {isAbsolute, join, resolve, dirname} from 'node:path'

export interface NewDshWorkspaceGrant {
  operatorApproved:true
  /** Private durable one-shot approval identity, not a chat-supplied task ID. */
  approvalId:string
  /** Actual operator-approved parent directory on the 3080 host. */
  parent:string
  /** One new directory component, not an arbitrary path or pre-existing workspace alias. */
  slug:string
}
export interface NewDshWorkspace {
  workspaceId:string
  path:string
  sessionIds:readonly string[]
}
export interface NativeWorkspaceProvisionPort {
  /** Host canonical parent verification; must enforce symlink-safe ownership and writable policy. */
  inspectParent(path:string):Promise<{canonicalPath:string;directory:boolean;symlinkSafe:boolean;writable:boolean}>
  /** Require absent child, before AND immediately after reservation. */
  childExists(path:string):Promise<boolean>
  /** Atomic one-shot claim, durable before any directory or RPC write. */
  claimApproval(approvalId:string):Promise<boolean>
  /** Durable audit trail: records intended changes and progress, never contains Session histories. */
  persistStep(step:'planned'|'directory-created'|'workspace-created'|'session-created',
    data:{approvalId:string;path:string;workspaceId?:string;sessionId?:string}):Promise<void>
  /** Exclusive creation on the approved parent, not mkdir -p through symlink parents. */
  mkdirExclusive(path:string):Promise<void>
  /** Official workspace/create; MUST return created=true for a genuinely new Workspace. */
  registerWorkspace(path:string):Promise<{workspace:NewDshWorkspace;created:boolean}>
  /** Official session/create with workspaceId only, creating a FRESH Session in this Workspace. */
  createSession(workspaceId:string):Promise<{sessionId:string}>
  /** Official workspace/follow read-only projection; no session log reads. */
  inspectWorkspace(workspaceId:string):Promise<NewDshWorkspace>
}
export class NativeWorkspaceProvisionBlocked extends Error {
  readonly code:string
  constructor(code:string,message:string){super(message);this.name='NativeWorkspaceProvisionBlocked';this.code=code}
}
const fail=(code:string,message:string):never=>{throw new NativeWorkspaceProvisionBlocked(code,message)}
const slugValid=(slug:string):boolean=>/^[a-z][a-z0-9_-]{0,62}$/.test(slug) &&
  !['.', '..', 'dsh', 'tmp'].includes(slug)
/** Pure plan: operator must give one canonical parent and a safe *new* slug.
 * Filesystem existence and symlink checks still belong to the 3080 host port.
 */
export function planNewDshWorkspace(grant:NewDshWorkspaceGrant):{parent:string;path:string;approvalId:string} {
  if(grant.operatorApproved!==true||typeof grant.approvalId!=='string'||
    !/^[a-z0-9][a-z0-9_-]{7,127}$/.test(grant.approvalId))
    return fail('missing_operator_approval','Private one-shot Workspace grant is missing or malformed')
  if(typeof grant.parent!=='string'||!isAbsolute(grant.parent)||
    resolve(grant.parent)!==grant.parent||typeof grant.slug!=='string'||!slugValid(grant.slug))
    return fail('invalid_project_location','Only one approved canonical parent and safe project slug are allowed')
  const path=join(grant.parent,grant.slug)
  if(dirname(path)!==grant.parent||path===grant.parent)
    return fail('invalid_project_location','New Workspace would escape its approved parent')
  return {parent:grant.parent,path,approvalId:grant.approvalId}
}
/** One-shot, deliberately non-retryable native registration.
 *
 * A failure after mkdir/register/create may leave partial legitimate resources.
 * The caller MUST reconcile them manually from the persisted ledger. It must
 * NEVER automatically delete a Workspace or retry session/create: the latter
 * can create duplicate Sessions after an ambiguous network response.
 */
export async function createApprovedNativeDshWorkspace(
  grant:NewDshWorkspaceGrant,port:NativeWorkspaceProvisionPort,
):Promise<{workspaceId:string;sessionId:string;path:string}> {
  const plan=planNewDshWorkspace(grant)
  const parent=await port.inspectParent(plan.parent)
  if(!parent.directory||!parent.symlinkSafe||!parent.writable||
    parent.canonicalPath!==plan.parent)
    return fail('parent_unverified','The original host could not verify its exact safe writable project parent')
  if(await port.childExists(plan.path))
    return fail('project_already_exists','New project path already exists; never adopt an old directory implicitly')
  if(!(await port.claimApproval(plan.approvalId)))
    return fail('approval_already_claimed','One-shot project creation already claimed; reconcile existing ledger')
  await port.persistStep('planned',{approvalId:plan.approvalId,path:plan.path})
  // Recheck after the durable one-shot claim: a concurrent directory creator must win.
  if(await port.childExists(plan.path))
    return fail('project_race','A project path was created by another process; no mutation by this request')
  await port.mkdirExclusive(plan.path)
  await port.persistStep('directory-created',{approvalId:plan.approvalId,path:plan.path})
  // Even if the parent changed during mkdir, do not register the wrong directory.
  const second=await port.inspectParent(plan.parent)
  if(second.canonicalPath!==plan.parent||!second.directory||!second.symlinkSafe)
    return fail('parent_changed','Approved parent changed after creating directory; manual recovery required')
  const created=await port.registerWorkspace(plan.path)
  if(!created.created||!created.workspace.workspaceId||created.workspace.path!==plan.path||
    created.workspace.sessionIds.length!==0)
    return fail('workspace_registration_ambiguous','Workspace not proven freshly registered; manual review required')
  await port.persistStep('workspace-created',{
    approvalId:plan.approvalId,path:plan.path,workspaceId:created.workspace.workspaceId})
  const session=await port.createSession(created.workspace.workspaceId)
  if(!session.sessionId)return fail('session_creation_ambiguous','Session create returned no identity')
  await port.persistStep('session-created',{
    approvalId:plan.approvalId,path:plan.path,
    workspaceId:created.workspace.workspaceId,sessionId:session.sessionId})
  const verified=await port.inspectWorkspace(created.workspace.workspaceId)
  if(verified.workspaceId!==created.workspace.workspaceId||verified.path!==plan.path||
    verified.sessionIds.length!==1||verified.sessionIds[0]!==session.sessionId)
    return fail('session_membership_unverified','New Session not uniquely confirmed in new original Workspace')
  return {workspaceId:verified.workspaceId,sessionId:session.sessionId,path:verified.path}
}
