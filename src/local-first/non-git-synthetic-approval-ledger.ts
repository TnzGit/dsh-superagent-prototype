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
/** Snapshot canonical data properties before ANY filesystem mutation.
 * Accessors are rejected without invoking their getters; the snapshot prevents
 * a caller from mutating the original values during later awaits. Proxy traps
 * remain untrusted and this is not an authentication or race-free boundary.
 */
function normalizeSyntheticReservation(input:SyntheticApprovalReservation):SyntheticApprovalReservation {
  try {
    if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.getPrototypeOf(input)!==Object.prototype)
      throw Error('Invalid synthetic reservation')
    const descriptors=Object.getOwnPropertyDescriptors(input)
    const keys=Reflect.ownKeys(descriptors)
    if(keys.length!==7||keys.some(key=>typeof key!=='string')||
      keys.sort().join(',')!==
        'approvalId,journalRoot,operation,previewDigest,projectFingerprint,transactionId,version'||
      keys.some(key=>!Object.hasOwn(descriptors[key as string],'value')))
      throw Error('Invalid synthetic reservation')
    const value=Object.fromEntries(keys.map(key=>[key,descriptors[key as string].value])) as SyntheticApprovalReservation
    if(value.version!==1||typeof value.approvalId!=='string'||!ID.test(value.approvalId)||
      typeof value.transactionId!=='string'||!ID.test(value.transactionId)||
      typeof value.projectFingerprint!=='string'||!SHA.test(value.projectFingerprint)||
      typeof value.previewDigest!=='string'||!SHA.test(value.previewDigest)||
      !['apply','rollback'].includes(value.operation)||
      typeof value.journalRoot!=='string'||!value.journalRoot)
      throw Error('Invalid synthetic reservation')
    return Object.freeze(value)
  }catch {throw Error('Invalid synthetic reservation')}
}

/** Owner-created canonical ledger root; the caller must supply ONE root per fixture.
 * A different root cannot be detected here: registry-level binding is still required.
 */
export async function reserveSyntheticApproval(
  ledgerRoot:string, reservation:SyntheticApprovalReservation
):Promise<'reserved'> {
  reservation=normalizeSyntheticReservation(reservation)
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
  if(!r||typeof r!=='object'||Array.isArray(r)||
    Object.keys(r).sort().join(',')!==
      'approvalId,journalRoot,operation,previewDigest,projectFingerprint,transactionId,version'||
    r.version!==1||r.approvalId!==approvalId||
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


/** C6B2B5A: process-local fixture ledger pin for a registry instance.
 * C6B2B5B also uses an owner-private, exclusive-create binding file under the
 * disposable synthetic project parent so separate instances/processes that
 * share that fixture reject a second ledger root. Neither mechanism is an
 * authenticated global arbiter or production authorization.
 */
const syntheticRegistryLedgerPins=new WeakMap<object,Map<string,string>>()
// In-process inode evidence: deletion/replacement after a successful pin must
// not be silently accepted as a fresh first-use fixture. Not cross-process auth.
const syntheticPinFileIdentities=new WeakMap<object,Map<string,{dev:number;ino:number}>>()
// Best-effort same-process identity continuity for the selected ledger directory.
const syntheticLedgerDirIdentities=new WeakMap<object,Map<string,{dev:number;ino:number}>>()

/** A private durable binding inside the *disposable parent*, never the
 * registered project source. An interrupted wx write is terminal and requires
 * manual fixture disposal; never auto-repair or switch to another ledger.
 * This file is same-user mutable and NOT an authenticated external lock.
 */
async function pinDisposableSyntheticLedger(
  registry:Pick<LocalProjectRegistry,'get'|'assertRegisteredRootIdentity'>,
  projectId:string,ledgerRoot:string,projectFp:string
):Promise<void>{
  const sourceRoot=registry.get(projectId).root
  const fixture=dirname(sourceRoot),temp=await realpath(tmpdir())
  const stat=await lstat(fixture)
  if(dirname(fixture)!==temp||
    !/^dsh-project-synthetic-[A-Za-z0-9_-]{6,70}$/.test(basename(fixture))||
    !stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||
    await realpath(fixture)!==fixture)
    throw Error('Synthetic registry ledger pin requires private disposable project parent')
  registry.assertRegisteredRootIdentity(projectId)
  const file=join(fixture,'.dsh-synthetic-ledger-pin.json')
  const expected={version:1,purpose:'offline-synthetic-ledger-pin',
    projectId,projectFingerprint:projectFp,ledgerRoot}
  const remembered=syntheticPinFileIdentities.get(registry)?.get(projectId)
  if(remembered){
    let current
    try{current=await lstat(file)}catch{throw Error('Synthetic registry ledger pin disappeared; manual review required')}
    if(current.dev!==remembered.dev||current.ino!==remembered.ino)
      throw Error('Synthetic registry ledger pin identity changed; manual review required')
  }
  let handle
  try{handle=await open(file,'wx',0o600)}
  catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e
  }
  if(handle){
    try{await handle.writeFile(JSON.stringify(expected)+'\n');await handle.sync()}
    finally{await handle.close()}
    const directory=await open(fixture,'r')
    try{await directory.sync()}finally{await directory.close()}
  }
  const entry=await lstat(file)
  if(!entry.isFile()||entry.isSymbolicLink()||entry.nlink!==1||
    (entry.mode&0o777)!==0o600)
    throw Error('Unsafe synthetic registry ledger pin')
  let parsed:unknown
  try{parsed=JSON.parse(await readFile(file,'utf8'))}
  catch{throw Error('Corrupt synthetic registry ledger pin; manual review required')}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||
    Object.keys(parsed).sort().join(',')!==
    'ledgerRoot,projectFingerprint,projectId,purpose,version')
    throw Error('Corrupt synthetic registry ledger pin; manual review required')
  const row=parsed as Record<string,unknown>
  if(row.version!==1||row.purpose!=='offline-synthetic-ledger-pin'||
    row.projectId!==projectId||row.projectFingerprint!==projectFp||
    row.ledgerRoot!==ledgerRoot)
    throw Error('Synthetic registry has a conflicting fixture ledger binding')
  registry.assertRegisteredRootIdentity(projectId)
  const finalEntry=await lstat(file)
  if(finalEntry.dev!==entry.dev||finalEntry.ino!==entry.ino)
    throw Error('Synthetic registry ledger pin identity changed; manual review required')
  let identities=syntheticPinFileIdentities.get(registry)
  if(!identities){identities=new Map();syntheticPinFileIdentities.set(registry,identities)}
  identities.set(projectId,{dev:entry.dev,ino:entry.ino})
}

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
 * A private persistent pin within the disposable project parent rejects a
 * different fixture/ledger even from new registry instances or OS processes.
 * The in-memory pin also rejects changes within one registry instance.
 * This does NOT fence arbitrary independent project parents, authenticate an
 * initial binding or defeat external writers/ABA. NEVER use for real Apply.
 */
export async function reserveRegistryBoundSyntheticApproval(
  registry:Pick<LocalProjectRegistry,'get'|'assertRegisteredRootIdentity'>,
  projectId:string,fixtureRoot:string,reservation:SyntheticApprovalReservation
):Promise<'reserved'>{
  reservation=normalizeSyntheticReservation(reservation)
  const bound=await inspectRegistryBoundSyntheticApproval(
    registry,projectId,fixtureRoot,reservation)
  // Preserve cross-fixture rejection before checking same-path inode continuity.
  const priorFixture=syntheticRegistryLedgerPins.get(registry)?.get(projectId)
  if(priorFixture!==undefined&&priorFixture!==bound.ledgerRoot)
    throw Error('Synthetic registry has a conflicting fixture ledger binding')
  const ledgerEntry=await lstat(bound.ledgerRoot)
  const rememberedLedger=syntheticLedgerDirIdentities.get(registry)?.get(projectId)
  if(rememberedLedger&&(ledgerEntry.dev!==rememberedLedger.dev||ledgerEntry.ino!==rememberedLedger.ino))
    throw Error('Synthetic registry ledger directory identity changed; manual review required')
  await pinDisposableSyntheticLedger(
    registry,projectId,bound.ledgerRoot,bound.projectFingerprint)
  const checkedLedger=await lstat(bound.ledgerRoot)
  if(checkedLedger.dev!==ledgerEntry.dev||checkedLedger.ino!==ledgerEntry.ino)
    throw Error('Synthetic registry ledger directory identity changed; manual review required')
  let pins=syntheticRegistryLedgerPins.get(registry)
  if(!pins){pins=new Map<string,string>();syntheticRegistryLedgerPins.set(registry,pins)}
  const previous=pins.get(projectId)
  if(previous!==undefined&&previous!==bound.ledgerRoot)
    throw Error('Synthetic registry has a conflicting fixture ledger binding')
  // No await between binding lookup and set: concurrent async callers sharing
  // this JS registry instance cannot both choose different ledger roots.
  if(previous===undefined)pins.set(projectId,bound.ledgerRoot)
  registry.assertRegisteredRootIdentity(projectId)
  let ledgerIdentities=syntheticLedgerDirIdentities.get(registry)
  if(!ledgerIdentities){ledgerIdentities=new Map();syntheticLedgerDirIdentities.set(registry,ledgerIdentities)}
  if(!ledgerIdentities.has(projectId))ledgerIdentities.set(projectId,{dev:ledgerEntry.dev,ino:ledgerEntry.ino})
  return reserveFixtureBoundSyntheticApproval(fixtureRoot,reservation)
}
