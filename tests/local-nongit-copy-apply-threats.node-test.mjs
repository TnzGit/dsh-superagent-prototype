/** OL-052 P4: synthetic-copy Apply/rollback threat matrix on an ORIGINAL-FREE fixture copy.
 * All writes stay under a 0700 disposable directory; the registered source is a COPY created
 * by this test, never a real project. This tests the PROTOTYPE CONTRACT on a disposable copy:
 * it is NOT proof of real production Apply safety (production Apply stays GATED: NO REAL WRITE
 * ENABLED — operator host permissions and live grants are unresolved, see docs/014 and
 * agent-handoff/REAL_APPLY_GATES.md). No real model, Weixin, host services or production state. */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {chmodSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {tmpdir} from 'node:os'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {createProjectSnapshot, previewNonGitProjectChanges, projectFingerprint} from '../src/local-first/project-workspaces.ts'
import {applyOneNonGitFile, rollbackOneNonGitFile} from '../src/local-first/non-git-apply.ts'

const hash=(value)=>createHash('sha256').update(value).digest('hex')
const TX='ol052-copy-transaction-001'
const TX_ROLLBACK='ol052-copy-transaction-001-rollback'
const nowIso=(ms=60_000)=>new Date(Date.now()+ms).toISOString()

async function fixture(run){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'dsh-ol052-copy-apply-')))
  chmodSync(base,0o700)
  const registered=join(base,'registered'), source=join(registered,'notes')
  mkdirSync(registered,{mode:0o700})
  mkdirSync(source,{recursive:true,mode:0o700})
  writeFileSync(join(source,'keep.txt'),'ORIGINAL KEEP\n',{mode:0o600})
  const registry=new LocalProjectRegistry([registered],[{id:'notes',root:source,kind:'local'}])
  const workspace=join(base,'workspace','notes-ticket')
  const fingerprint=projectFingerprint(registry.get('notes'))
  await createProjectSnapshot({registry,projectId:'notes',directory:workspace,fingerprint})
  const request={registry,projectId:'notes',directory:workspace,fingerprint}
  const journal=join(base,'journal'), grant=join(base,'grant.json')
  mkdirSync(journal,0o700)
  try{await run({base,source,workspace,registry,request,journal,grant})}
  finally{rmSync(base,{recursive:true,force:true})}
}
function modifyGrant(grant,preview,operation='apply'){
  const approval={version:1,operation,approvalId:'ol052-copy-approval-'+operation,
    transactionId:operation==='apply'?TX:TX_ROLLBACK,projectId:'notes',
    rootFingerprint:preview.rootFingerprint,previewDigest:preview.digest,
    expiresAt:nowIso(),operatorApproved:true,
    ...(operation==='rollback'?{rollbackOfTransactionId:TX}:{})}
  writeFileSync(grant,JSON.stringify(approval),{mode:0o600})
  chmodSync(grant,0o600)
  return approval
}

test('a concurrent external write to the registered source fails closed and is never merged or overwritten',async()=>fixture(async({source,request})=>{
  // Simulated: an external writer touches the original while the read-only preview runs.
  await previewNonGitProjectChanges(request)
  writeFileSync(join(source,'keep.txt'),'EXTERNAL REWRITE\n')
  await assert.rejects(previewNonGitProjectChanges(request),/Original project changed since worker snapshot/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'EXTERNAL REWRITE\n') // contract refuses to merge or overwrite
}))

test('an interrupted apply (journal stuck at applying after a simulated crash) blocks new applies and reconciles through an independent rollback grant',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  // Simulated crash DURING apply: rewrite the terminal journal back to the non-terminal 'applying' state.
  const txDir=join(journal,'tx-'+TX)
  const row=JSON.parse(readFileSync(join(txDir,'journal.json'),'utf8'))
  writeFileSync(join(txDir,'journal.json'),JSON.stringify({...row,status:'applying'}),{mode:0o600})
  chmodSync(join(txDir,'journal.json'),0o600)
  // A fresh apply over the unreconciled journal fails closed until a human reconciles.
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Unreconciled transaction journal must be manually reviewed/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'COPY MODIFY\n')
  // Recovery: an independent rollback grant against the 'applying' journal restores the original bytes and mode.
  modifyGrant(grant,fresh,'rollback')
  await rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
  assert.equal(statSync(join(source,'keep.txt')).mode&0o777,0o600)
}))

test('a sealed apply journals the durable ORIGINAL before-image used by rollback',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  const row=await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  assert.equal(row.status,'applied')
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'COPY MODIFY\n')
  // The journal keeps the ORIGINAL before-image; only the copy was ever written to the source.
  const beforeImage=readFileSync(join(journal,'tx-'+TX,'before.bin'))
  assert.equal(beforeImage.toString('utf8'),'ORIGINAL KEEP\n')
  // before.bin must equal the Git blob OID the preview recorded as the original 'before' image.
  const blobOid=createHash('sha1').update('blob '+beforeImage.length+'\0').update(beforeImage).digest('hex')
  assert.equal(blobOid,fresh.changes[0].before)
}))

test('a symlink inside the registered source tree is rejected by the snapshot validator (traversal denial)',async()=>fixture(async({base,source,registry})=>{
  const linkHome=join(base,'alias-target'); mkdirSync(linkHome,{mode:0o700})
  writeFileSync(join(linkHome,'outside.txt'),'OUTSIDE SECRET\n',{mode:0o600})
  symlinkSync(join(linkHome,'outside.txt'),join(source,'alias.txt'))
  const workspace=join(base,'workspace','notes-symlink')
  await assert.rejects(createProjectSnapshot({registry,projectId:'notes',directory:workspace,
    fingerprint:projectFingerprint(registry.get('notes'))}),/Symlinks or special files are not allowed/)
  assert.equal(readFileSync(join(linkHome,'outside.txt'),'utf8'),'OUTSIDE SECRET\n') // never read through, never copied
}))

test('a hardlink between the worker copy and the registered source is caught as source drift (shared-inode alias)',async()=>fixture(async({source,workspace,request})=>{
  linkSync(join(source,'keep.txt'),join(workspace,'aliased.txt'))
  // Editing THROUGH the shared-inode alias mutates the ORIGINAL — the preview fails closed on it.
  writeFileSync(join(workspace,'aliased.txt'),'SHARED INODE WRITE\n')
  await assert.rejects(previewNonGitProjectChanges(request),/Original project changed since worker snapshot/)
  assert.ok(lstatSync(join(source,'keep.txt')).nlink>=2) // the alias is real and observable
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'SHARED INODE WRITE\n') // drift already happened; contract never merges it
}))

test('a worker file replaced with a fresh inode after the grant fails the apply digest gate and never mutates the source',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  // An external writer replaces the WORKER file (new inode, new content) after the digest was taken.
  const rewritten=join(base,'worker-rewrite'); writeFileSync(rewritten,'OTHER CONTENT\n',{mode:0o600})
  const beforeInode=statSync(join(workspace,'keep.txt')).ino
  rmSync(join(workspace,'keep.txt'))
  linkSync(rewritten,join(workspace,'keep.txt')) // new inode at the same path
  assert.notEqual(statSync(join(workspace,'keep.txt')).ino,beforeInode)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Single-file plan digest mismatch or more than one change/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
}))

test('a mode-only change is previewed, applied with the executable bit and rolled back to the exact original mode',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  chmodSync(join(workspace,'keep.txt'),0o700) // executable mode change; content identical (same Git blob OID)
  const fresh=await previewNonGitProjectChanges(request)
  assert.ok(fresh.changes.some(c=>c.path==='keep.txt'&&c.action==='modify'&&c.executable===true))
  modifyGrant(grant,fresh)
  await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  assert.notEqual(statSync(join(source,'keep.txt')).mode&0o111,0) // executable bit carried over
  // Rollback needs a SEPARATE fresh approval and restores the original mode and bytes.
  modifyGrant(grant,fresh,'rollback')
  await rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  assert.equal(statSync(join(source,'keep.txt')).mode&0o777,0o600)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
}))

test('a missing journal after a sealed apply makes rollback fail closed without touching the source',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  rmSync(join(journal,'tx-'+TX,'journal.json'))
  modifyGrant(grant,fresh,'rollback')
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),/journal|ENOENT/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'COPY MODIFY\n') // never silently reverted
}))

test('replaying the same approved apply after it already settled is refused as source drift, not duplicated',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  // Replay with the same transaction: the source now differs from the immutable baseline, so the
  // preview gate fails closed before any journal or mutation; the settled row stays 'applied'.
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Original project changed since worker snapshot/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'COPY MODIFY\n')
  const row=JSON.parse(readFileSync(join(journal,'tx-'+TX,'journal.json'),'utf8'))
  assert.equal(row.status,'applied')
}))

test('an expired or revoked grant during a long preview blocks the write (permission revocation mid-await)',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  const approval=modifyGrant(grant,fresh)
  // The operator's grant expires before the apply reads it (simulated long await).
  const expired={...approval,expiresAt:new Date(Date.now()-1000).toISOString()}
  writeFileSync(grant,JSON.stringify(expired),{mode:0o600}); chmodSync(grant,0o600)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Invalid or expired single-file operator approval/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
}))

test('a foreign rewrite of the private grant file between read and source-write blocks the mutation',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  const apply=applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  // A foreign operator edits the grant while the apply is in flight (simulated mid-await revocation).
  await new Promise(resolve=>setImmediate(resolve))
  const foreign={...JSON.parse(readFileSync(grant,'utf8')),expiresAt:nowIso(120_000)}
  writeFileSync(grant,JSON.stringify(foreign),{mode:0o600}); chmodSync(grant,0o600)
  await assert.rejects(apply,/Private approval changed before source write/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
}))

test('an existing single-file apply lock is never broken automatically (human reconciliation required)',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  writeFileSync(join(journal,'.single-file-apply.lock'),'crash residue\n',{mode:0o600})
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Single-file apply lock exists; human reconciliation required/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
  assert.ok(exists(join(journal,'.single-file-apply.lock'))) // never auto-stolen
  function exists(p){try{lstatSync(p);return true}catch{return false}}
}))

test('rollback of a symlinked, hardlinked or special-mode source after apply is refused for manual review',async()=>fixture(async({base,source,workspace,request,journal,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  await applyOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant})
  // A foreign process replaces the applied source file with a symlink before rollback.
  mkdirSync(join(base,'elsewhere'),{mode:0o700})
  rmSync(join(source,'keep.txt'))
  symlinkSync(join(base,'elsewhere'),join(source,'keep.txt'))
  modifyGrant(grant,fresh,'rollback')
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Symlink traversal denied|Unsupported source file type requires manual review/)
  rmSync(join(source,'keep.txt'))
  writeFileSync(join(source,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  // A hardlink alias on the source blocks rollback too.
  linkSync(join(source,'keep.txt'),join(base,'alias-hardlink'))
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Hardlinked source path requires manual review/)
  rmSync(join(base,'alias-hardlink'))
  chmodSync(join(source,'keep.txt'),0o2600) // setgid special mode bit
  await assert.rejects(rollbackOneNonGitFile(request,{journalDirectory:journal,approvalFile:grant}),
    /Special source mode bits require manual review/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'COPY MODIFY\n') // never silently reverted
}))

test('journal directory overlapping the source project is rejected before any mutation',async()=>fixture(async({base,source,workspace,request,grant})=>{
  writeFileSync(join(workspace,'keep.txt'),'COPY MODIFY\n',{mode:0o600})
  const fresh=await previewNonGitProjectChanges(request)
  modifyGrant(grant,fresh)
  const nested=join(source,'journal-under-source'); mkdirSync(nested,0o700)
  await assert.rejects(applyOneNonGitFile(request,{journalDirectory:nested,approvalFile:grant}),
    /Journal must not overlap source project or worker workspace/)
  assert.equal(readFileSync(join(source,'keep.txt'),'utf8'),'ORIGINAL KEEP\n')
}))
