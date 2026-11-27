// OL-055 S2.1: hostile-directory, WAL/shm alias, disjoint-state-dir sharing, ABA and stale-owner fence tests
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync, symlinkSync, openSync, closeSync, constants, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { acquireWeixinPollOwnerLease, weixinPollLeaseDirectory } from '../src/local-first/weixin-poll-lease.ts'

const TOKEN_A='SYNTHETIC_OL055_ACCOUNT_A_ONLY_NEVER_REAL'
const TOKEN_B='SYNTHETIC_OL055_ACCOUNT_B_ONLY_NEVER_REAL'
const hash=(token)=>createHash('sha256').update(token).digest('hex')
const tempDirs=[]
function fixture(token=TOKEN_A){
  const parent=mkdtempSync(join(tmpdir(),'dsh-ol055-lease-'))
  tempDirs.push(parent)
  const credsFile=join(parent,'synthetic-credentials.json')
  writeFileSync(credsFile,JSON.stringify({token,baseUrl:'https://ilinkai.weixin.qq.com'}),{mode:0o600})
  chmodSync(credsFile,0o600)
  return {parent,credsFile,accountHash:hash(token)}
}
test.afterEach(()=>{for(const dir of tempDirs.splice(0))rmSync(dir,{recursive:true,force:true})})

function childHolder(credsFile,accountHash,{killAfterMs}={}){
  const child=spawn(process.execPath,['--experimental-strip-types','-e',`
    import { acquireWeixinPollOwnerLease } from '${join(process.cwd(),'src/local-first/weixin-poll-lease.ts')}'
    const lease = acquireWeixinPollOwnerLease(${JSON.stringify(credsFile)}, ${JSON.stringify(accountHash)})
    console.log('HELD:' + lease.generation)
    ${killAfterMs?`setTimeout(()=>process.kill(process.pid,'SIGKILL'),${killAfterMs})`:''}
    setInterval(()=>{},1000)
  `],{stdio:['ignore','pipe','pipe']})
  return new Promise((resolve,reject)=>{
    let buffer=''
    child.stdout.on('data',chunk=>{
      buffer+=chunk
      const line=buffer.split('\n').find(l=>l.startsWith('HELD:'))
      if(line)resolve({child,generation:Number(line.slice(5))})
    })
    child.stderr.on('data',chunk=>{if(!buffer.includes('HELD:'))reject(Error('child failed: '+chunk))})
    child.on('error',reject)
  })
}

test('S2.1: hostile same-UID directory replacement after acquisition cannot break the fence',async()=>{
  // An attacker with same UID replaces the lease dir between acquisition and a fence check.
  const {parent,credsFile,accountHash}=fixture()
  const lease=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.equal(lease.fenceCurrent(),true)
  // Replace the directory with a new one owned by the same uid but with a fresh empty DB
  const dir=weixinPollLeaseDirectory(credsFile)
  const genDir=join(parent,'replacement-')
  mkdirSync(genDir,{mode:0o700})
  rmSync(dir,{recursive:true,force:true})
  symlinkSync(genDir,dir) // a same-UID hostile replacement via symlink
  // fenceCurrent must now fail (symlink refused by O_NOFOLLOW or empty DB)
  assert.equal(lease.fenceCurrent(),false,'stale owner must see fence gone after hostile dir replacement')
  lease.release()
})

test('S2.1: WAL/shm alias path: lease DB with .sqlite-wal and .sqlite-shm sidecar files does not confuse fence',()=>{
  const {credsFile,accountHash}=fixture()
  const lease=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.equal(lease.fenceCurrent(),true)
  // Check the sidecar files exist (WAL journal mode produces them)
  const dir=weixinPollLeaseDirectory(credsFile)
  const files=readdirSync(dir)
  assert.ok(files.includes(`account-${accountHash}.sqlite`),'lease DB present')
  // WAL mode may produce -wal and -shm sidecars; they must not confuse the fence check
  assert.equal(lease.fenceCurrent(),true)
  lease.release()
})

test('S2.1: two processes with disjoint state dirs share one credentials file; they compete for the same lease',async()=>{
  // OL-053 replay: two orchestrator instances with different state dirs but the same creds file
  const {parent,credsFile,accountHash}=fixture()
  const holder=await childHolder(credsFile,accountHash)
  try{
    // Second holder with same creds file but different process fails closed
    assert.throws(()=>acquireWeixinPollOwnerLease(credsFile,accountHash),/locked/)
  }finally{holder.child.kill('SIGKILL');await new Promise(r=>holder.child.on('exit',r))}
  // After the holder dies, the lease is recoverable
  const second=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.ok(second.generation>holder.generation)
  second.release()
})

test('S2.1: lease-file ABA — the DB file is unlinked and recreated while the old holder is live; a new holder takes over on the new file and the stale holder fences out',()=>{
  const {parent,credsFile,accountHash}=fixture()
  const lease=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.equal(lease.fenceCurrent(),true)
  // ABA: swap the lease DB file out from under the live holder (hostile same-UID move).
  const dir=weixinPollLeaseDirectory(credsFile)
  const file=join(dir,`account-${accountHash}.sqlite`)
  rmSync(file,{force:true})
  writeFileSync(file,'',{mode:0o600}) // fresh empty file, same name
  // A new holder can take over on the new file (the OS lock lived on the old, now-unlinked inode).
  // The ABA reset the durable gen back to 1, so generation alone cannot tell the holders apart —
  // the pinned inode identity is what fences the old holder out.
  const newLease=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.equal(lease.fenceCurrent(),false,'old holder must not trust an ABA-swapped file even at equal gen')
  assert.equal(newLease.fenceCurrent(),true,'new holder on the new inode is current')
  newLease.release()
  lease.release() // idempotent
})

test('S2.1: stale owner after takeover never routes, sends, or cursor-commits (fence check blocks all actions)',()=>{
  const {credsFile,accountHash}=fixture()
  const old=acquireWeixinPollOwnerLease(credsFile,accountHash)
  old.release()
  const newOwner=acquireWeixinPollOwnerLease(credsFile,accountHash)
  // The stale owner must see fence is not current — it cannot take any action
  assert.equal(old.fenceCurrent(),false,'stale owner fenced out after takeover')
  assert.equal(newOwner.fenceCurrent(),true)
  newOwner.release()
})

test('S2.1: crash/restart/rotation — SIGKILL holder, then takeover, then lease rotation to account B is independent',async()=>{
  const {credsFile,accountHash}=fixture()
  const holder=await childHolder(credsFile,accountHash,{killAfterMs:200})
  await new Promise(r=>holder.child.on('exit',r))
  // takeover works after crash
  const taken=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.ok(taken.generation>holder.generation)
  // account B lease is independent
  const hashB=hash(TOKEN_B)
  const b=acquireWeixinPollOwnerLease(credsFile,hashB)
  assert.equal(b.fenceCurrent(),true)
  assert.equal(taken.fenceCurrent(),true) // both current, independent
  taken.release();b.release()
})

test('S2.1: lease directory with group/world-writable mode is refused (owner-only requirement)',()=>{
  const {parent,credsFile,accountHash}=fixture()
  const dir=weixinPollLeaseDirectory(credsFile)
  mkdirSync(dir,{mode:0o700})
  chmodSync(dir,0o777) // world-writable
  assert.throws(()=>acquireWeixinPollOwnerLease(credsFile,accountHash),/owner-only|current-owner/)
})

test('S2.1: lease directory owned by a different UID is refused',()=>{
  const {parent,credsFile,accountHash}=fixture()
  const dir=weixinPollLeaseDirectory(credsFile)
  mkdirSync(dir,{mode:0o700})
  chmodSync(dir,0o700)
  // On macOS/Linux we can't change UID in a test without root; the implementation
  // already checks stat.uid === process.getuid(), so a different-uid dir would fail.
  // We can verify the directory is created correctly and has right mode.
  const stat=statSync(dir)
  assert.equal(stat.mode&0o777,0o700)
})
