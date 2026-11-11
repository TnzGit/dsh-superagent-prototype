/** C6B2B4D: isolated synthetic-only approval reservation experiment.
 * Not wired to applyOneNonGitFile, rollback, Runtime, Worker or Weixin.
 * This is NOT an operator authorization or a production fencing primitive.
 */
import {createHash} from 'node:crypto'
import {lstat,open,realpath,readFile} from 'node:fs/promises'
import {join,relative,isAbsolute,dirname,basename} from 'node:path'
import {tmpdir} from 'node:os'
import {projectFingerprint} from './project-workspaces.ts'
import type {LocalProjectRegistry} from './project-registry.ts'

const ID=/^[a-z0-9][a-z0-9-]{7,79}$/
const SHA=/^[a-f0-9]{64}$/
export interface SyntheticApprovalReservation {
  version:1
  approvalId:string
  transactionId:string
  projectFingerprint:string
  previewDigest:string
  operation:'apply'|'rollback'
  journalRoot:string
}
/** Owner-created canonical ledger root; the caller must supply ONE root per fixture.
 * A different root cannot be detected here: registry-level binding is still required.
 */
export async function reserveSyntheticApproval(
  ledgerRoot:string, reservation:SyntheticApprovalReservation
):Promise<'reserved'> {
  if(reservation.version!==1||!ID.test(reservation.approvalId)||
    !ID.test(reservation.transactionId)||!SHA.test(reservation.projectFingerprint)||
    !SHA.test(reservation.previewDigest)||!['apply','rollback'].includes(reservation.operation)||
    typeof reservation.journalRoot!=='string'||!reservation.journalRoot)
    throw Error('Invalid synthetic reservation')
  const stat=await lstat(ledgerRoot)
  if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
    throw Error('Unsafe synthetic ledger root')
  const root=await realpath(ledgerRoot)
  const journalStat=await lstat(reservation.journalRoot)
  if(!journalStat.isDirectory()||journalStat.isSymbolicLink()||(journalStat.mode&0o077)!==0)
    throw Error('Unsafe synthetic journal root')
  const journal=await realpath(reservation.journalRoot)
  // Reject ancestor/descendant roots as well as equality; both directions matter.
  const overlaps=(a:string,b:string)=>{
    const rel=relative(a,b)
    return rel===''||(!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&rel!=='..'&&!isAbsolute(rel))
  }
  if(overlaps(root,journal)||overlaps(journal,root))
    throw Error('Synthetic ledger overlaps journal')
  // Hash the ID to avoid private identifiers appearing in filesystem names.
  const name=createHash('sha256').update(reservation.approvalId).digest('hex')+'.json'
  const file=join(root,name)
  let handle
  try {handle=await open(file,'wx',0o600)}
  catch(e) {
    if((e as NodeJS.ErrnoException).code==='EEXIST')
      throw Error('Synthetic approval already reserved; human reconciliation required')
    throw e
  }
  // Any failure after exclusive creation leaves a consumed, possibly incomplete
  // reservation. Never delete it automatically or retry.
  try {
    await handle.writeFile(JSON.stringify({...reservation,journalRoot:journal})+'\n')
    await handle.sync()
  } finally {await handle.close()}
  const dir=await open(root,'r')
  try {await dir.sync()}finally{await dir.close()}
  return 'reserved'
}
/** Read-only inspection; incomplete, replaced or mode-unsafe entries fail closed. */
export async function inspectSyntheticApproval(
  ledgerRoot:string,approvalId:string
):Promise<SyntheticApprovalReservation> {
  if(!ID.test(approvalId))throw Error('Invalid synthetic approval ID')
  const root=await realpath(ledgerRoot)
  const rootStat=await lstat(ledgerRoot)
  if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||(rootStat.mode&0o077)!==0)
    throw Error('Unsafe synthetic ledger root')
  const file=join(root,createHash('sha256').update(approvalId).digest('hex')+'.json')
  const stat=await lstat(file)
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.nlink!==1)
    throw Error('Unsafe synthetic reservation')
  let value:unknown
  try {value=JSON.parse(await readFile(file,'utf8'))}
  catch {throw Error('Corrupt synthetic reservation; human reconciliation required')}
  const r=value as SyntheticApprovalReservation
  if(!r||r.version!==1||r.approvalId!==approvalId||
    !ID.test(r.transactionId)||!SHA.test(r.projectFingerprint)||
    !SHA.test(r.previewDigest)||!['apply','rollback'].includes(r.operation)||
    typeof r.journalRoot!=='string'||!r.journalRoot)
    throw Error('Corrupt synthetic reservation; human reconciliation required')
  return r
}


/** Synthetic fixture-only *root binding* for process/crash adversarial tests.
 *
 * The fixture name, private marker and fixed child directories prevent a test
 * caller from accidentally choosing a second ledger for the SAME fixture.
 * The marker is NOT signed, a temporary directory is not an OS sandbox, and
 * this is not registry-backed real-project approval or production fencing.
 */
export async function reserveFixtureBoundSyntheticApproval(
  fixtureRoot:string,reservation:SyntheticApprovalReservation
):Promise<'reserved'>{
  const fixtureStat=await lstat(fixtureRoot)
  if(!fixtureStat.isDirectory()||fixtureStat.isSymbolicLink()||
    (fixtureStat.mode&0o077)!==0)
    throw Error('Unsafe synthetic fixture root')
  const fixture=await realpath(fixtureRoot)
  const temp=await realpath(tmpdir())
  if(dirname(fixture)!==temp||
    !/^dsh-ledger-synthetic-[a-zA-Z0-9_-]{6,70}$/.test(basename(fixture)))
    throw Error('Synthetic approval fixture is not a disposable temp root')
  const marker=join(fixture,'.synthetic-ledger-binding.json')
  let bound:unknown
  try{
    const st=await lstat(marker)
    if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
      (st.mode&0o777)!==0o600)
      throw Error('Untrusted synthetic fixture binding')
    bound=JSON.parse(await readFile(marker,'utf8')) as unknown
  }catch(error){
    if(error instanceof SyntaxError||
      ['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??''))
      throw Error('Missing or corrupt synthetic fixture binding')
    throw error
  }
  if(!bound||typeof bound!=='object'||Array.isArray(bound)||
    Object.keys(bound).length!==3)
    throw Error('Untrusted synthetic fixture binding')
  const b=bound as {version?:unknown;purpose?:unknown;projectFingerprint?:unknown}
  if(b.version!==1||b.purpose!=='offline-synthetic-only'||
    typeof b.projectFingerprint!=='string'||!SHA.test(b.projectFingerprint)||
    b.projectFingerprint!==reservation.projectFingerprint)
    throw Error('Synthetic fixture binding project mismatch')
  const ledger=join(fixture,'ledger'),journal=join(fixture,'journal')
  // Fail closed if a caller tries to reserve into an alternate journal
  // directory, even when it is owner-only and outside the ledger.
  const supplied=await realpath(reservation.journalRoot)
  const fixed=await realpath(journal)
  if(supplied!==fixed)
    throw Error('Synthetic fixture journal root differs from owner binding')
  return reserveSyntheticApproval(ledger,reservation)
}


/** C6B2B5A: in-memory fixture ledger pin for one LocalProjectRegistry instance.
 * No caller can select a second ledger root through reserveRegistryBound...
 * after the first validated binding. This process-local WeakMap is NOT a durable
 * global arbiter: a different registry instance/process or a same-user forged
 * fixture may still reserve the SAME ID elsewhere. No real Apply permission.
 */
const syntheticRegistryLedgerPins=new WeakMap<object,Map<string,string>>()

/** C6B2B4E source-only READ-ONLY synthetic registry/fixture binding gate.
 * Uses an operator-created LocalProjectRegistry identity and the already defined
 * projectFingerprint; no source or journal is created, consumed or modified.
 * Caller-selected registry/configuration and same-user marker remain untrusted;
 * ordinary Node lstat+realpath is NOT a race-free OS fd-based authorization.
 * This is NOT connected to any real project Apply or production caller.
 */
export async function inspectRegistryBoundSyntheticApproval(
  registry:Pick<LocalProjectRegistry,'get'|'assertRegisteredRootIdentity'>,
  projectId:string,fixtureRoot:string,reservation:SyntheticApprovalReservation
):Promise<{
  projectId:string
  projectFingerprint:string
  ledgerRoot:string
  journalRoot:string
}>{
  if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(projectId))
    throw Error('Invalid synthetic registry project ID')
  const project=registry.get(projectId)
  if(project.id!==projectId||project.kind!=='local'||project.readOnly)
    throw Error('Synthetic registry project is not eligible')
  // Registration-time inode binding detects replacement of the root OR an
  // ordinary ancestor while the final root inode is unchanged. Best-effort,
  // read-only evidence: not a race-free descriptor-relative capability.
  registry.assertRegisteredRootIdentity(projectId)
  // Reject a symlinked ancestor even when the final root is a directory.
  const checkAncestors=async()=>{
    let ancestor=project.root
    while(true){
      const ancestorStat=await lstat(ancestor)
      if(ancestorStat.isSymbolicLink())
        throw Error('Registered synthetic project ancestor identity changed')
      const parent=dirname(ancestor)
      if(parent===ancestor)break
      ancestor=parent
    }
  }
  await checkAncestors()
  const projectStat=await lstat(project.root)
  const canonicalProject=await realpath(project.root)
  if(!projectStat.isDirectory()||projectStat.isSymbolicLink()||
    canonicalProject!==project.root)
    throw Error('Registered synthetic project root identity changed')
  const fingerprint=projectFingerprint(project)
  if(reservation.projectFingerprint!==fingerprint)
    throw Error('Synthetic reservation differs from registered project identity')
  const fixtureStat=await lstat(fixtureRoot)
  const fixture=await realpath(fixtureRoot)
  const canonicalTemp=await realpath(tmpdir())
  if(!fixtureStat.isDirectory()||fixtureStat.isSymbolicLink()||
    (fixtureStat.mode&0o077)!==0||dirname(fixture)!==canonicalTemp||
    !/^dsh-ledger-synthetic-[a-zA-Z0-9_-]{6,70}$/.test(basename(fixture)))
    throw Error('Unsafe registry-bound synthetic fixture')
  const contains=(a:string,b:string)=>{
    const rel=relative(a,b)
    return rel===''||(!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&
      rel!=='..'&&!isAbsolute(rel))
  }
  if(contains(canonicalProject,fixture)||contains(fixture,canonicalProject))
    throw Error('Synthetic fixture overlaps registered project root')
  const marker=join(fixture,'.synthetic-ledger-binding.json')
  const markerStat=await lstat(marker)
  if(!markerStat.isFile()||markerStat.isSymbolicLink()||
    markerStat.nlink!==1||(markerStat.mode&0o777)!==0o600)
    throw Error('Unsafe synthetic registry binding marker')
  let parsed:unknown
  try{parsed=JSON.parse(await readFile(marker,'utf8'))}
  catch{throw Error('Corrupt synthetic registry binding marker')}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||
    Object.keys(parsed).sort().join(',')!=='projectFingerprint,purpose,version')
    throw Error('Untrusted synthetic registry binding marker')
  const bound=parsed as Record<string,unknown>
  if(bound.version!==1||bound.purpose!=='offline-synthetic-only'||
    bound.projectFingerprint!==fingerprint)
    throw Error('Synthetic registry binding fingerprint mismatch')
  const ledger=join(fixture,'ledger'),journal=join(fixture,'journal')
  for(const dir of [ledger,journal]){
    const info=await lstat(dir)
    if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0||
      await realpath(dir)!==dir)
      throw Error('Unsafe synthetic registry private directory')
  }
  const requested=await realpath(reservation.journalRoot)
  const requestedStat=await lstat(reservation.journalRoot)
  if(requestedStat.isSymbolicLink()||requested!==journal)
    throw Error('Synthetic registry journal differs from fixed binding')
  // Re-attest both the original inode and ancestor path near return. A swap
  // retained during the async marker/ledger checks must fail closed; ABA
  // replacement and non-cooperating writers still need OS-level isolation.
  await checkAncestors()
  registry.assertRegisteredRootIdentity(projectId)
  // Return facts for read-only evidence. Never consume a grant in this gate.
  return Object.freeze({projectId,projectFingerprint:fingerprint,
    ledgerRoot:ledger,journalRoot:journal})
}

/** Registry-scoped fixture reservation for DISPOSABLE synthetic tests only.
 *
 * First validated fixture pins the ledger for this registry instance/project.
 * A later caller choosing an alternate fixture/ledger is rejected BEFORE a
 * second receipt can be created. The durable wx reservation arbitrates only
 * attempts using that one ledger. This is NOT cross-process fencing, cannot
 * authenticate the first fixture, and must NEVER be used for real project Apply.
 */
export async function reserveRegistryBoundSyntheticApproval(
  registry:Pick<LocalProjectRegistry,'get'|'assertRegisteredRootIdentity'>,
  projectId:string,fixtureRoot:string,reservation:SyntheticApprovalReservation
):Promise<'reserved'>{
  const bound=await inspectRegistryBoundSyntheticApproval(
    registry,projectId,fixtureRoot,reservation)
  let pins=syntheticRegistryLedgerPins.get(registry)
  if(!pins){pins=new Map<string,string>();syntheticRegistryLedgerPins.set(registry,pins)}
  const previous=pins.get(projectId)
  if(previous!==undefined&&previous!==bound.ledgerRoot)
    throw Error('Synthetic registry has a conflicting fixture ledger binding')
  // No await between binding lookup and set: concurrent async callers sharing
  // this JS registry instance cannot both choose different ledger roots.
  if(previous===undefined)pins.set(projectId,bound.ledgerRoot)
  registry.assertRegisteredRootIdentity(projectId)
  return reserveFixtureBoundSyntheticApproval(fixtureRoot,reservation)
}
