/** C6B2B4D: isolated synthetic-only approval reservation experiment.
 * Not wired to applyOneNonGitFile, rollback, Runtime, Worker or Weixin.
 * This is NOT an operator authorization or a production fencing primitive.
 */
import {createHash} from 'node:crypto'
import {lstat,open,realpath,readFile} from 'node:fs/promises'
import {join,relative,isAbsolute} from 'node:path'

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
