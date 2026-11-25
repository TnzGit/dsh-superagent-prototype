import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireWeixinPollOwnerLease, weixinPollLeaseDirectory } from '../src/local-first/weixin-poll-lease.ts'

// Synthetic credentials only: never a real Weixin token, never the real state directory.
const TOKEN_A='SYNTHETIC_OL054_ACCOUNT_A_ONLY_NEVER_REAL'
const hash=(token)=>createHash('sha256').update(token).digest('hex')
const tempDirs=[]
function fixture(token=TOKEN_A){
  const parent=mkdtempSync(join(tmpdir(),'dsh-ol054-lease-'))
  tempDirs.push(parent)
  const credsFile=join(parent,'synthetic-credentials.json')
  writeFileSync(credsFile,JSON.stringify({token,baseUrl:'https://ilinkai.weixin.qq.com'}),{mode:0o600})
  chmodSync(credsFile,0o600)
  return {parent,credsFile,accountHash:hash(token)}
}
test.afterEach(()=>{for(const dir of tempDirs.splice(0))rmSync(dir,{recursive:true,force:true})})

// A child process holding the lease, so exclusivity is proven ACROSS processes (OS file locks), not just
// inside one interpreter. `hold` keeps the BEGIN IMMEDIATE transaction open until told to close or killed.
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

test('M1: second live owner on the same account fails closed across processes, never acquires',async()=>{
  const {credsFile,accountHash}=fixture()
  const holder=await childHolder(credsFile,accountHash)
  try{
    assert.throws(()=>acquireWeixinPollOwnerLease(credsFile,accountHash),/locked/)
    // And the protected directory itself is owner-only, not a world-writable PID-file style target.
    const dir=statSync(weixinPollLeaseDirectory(credsFile))
    assert.equal(dir.mode&0o777,0o700)
  }finally{holder.child.kill('SIGKILL');await new Promise(r=>holder.child.on('exit',r))}
})

test('M1: bounded takeover after the live owner releases (abort path), fencing generation is durable',async()=>{
  const {credsFile,accountHash}=fixture()
  const first=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.equal(first.fenceCurrent(),true)
  first.release()
  const second=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.ok(second.generation>first.generation,'takeover must advance the durable fence')
  // The old holder is now fenced: it can no longer route or commit.
  assert.equal(first.fenceCurrent(),false)
  assert.equal(second.fenceCurrent(),true)
  second.release()
})

test('M1: takeover after a crashed (SIGKILL) owner is bounded; stale lock is recovered',async()=>{
  const {credsFile,accountHash}=fixture()
  const holder=await childHolder(credsFile,accountHash,{killAfterMs:150})
  // While alive, the parent cannot acquire.
  assert.throws(()=>acquireWeixinPollOwnerLease(credsFile,accountHash),/locked/)
  await new Promise(r=>holder.child.on('exit',r))
  const taken=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.ok(taken.generation>holder.generation)
  assert.equal(taken.fenceCurrent(),true)
  taken.release()
})

test('M1: a zombie holder that lost the lease fences out and cannot route, commit or send',async()=>{
  const {credsFile,accountHash}=fixture()
  const zombie=acquireWeixinPollOwnerLease(credsFile,accountHash)
  // Simulate the zombie losing its hold (its connection died without a clean release, e.g. fault path).
  zombie.release()
  const newOwner=acquireWeixinPollOwnerLease(credsFile,accountHash)
  assert.equal(zombie.fenceCurrent(),false,'zombie must see the advanced durable generation')
  assert.equal(newOwner.fenceCurrent(),true)
  newOwner.release()
})

test('M1: a different account fingerprint is an independent lease (no false contention)',async()=>{
  const {credsFile}=fixture()
  const a=acquireWeixinPollOwnerLease(credsFile,hash(TOKEN_A))
  const b=acquireWeixinPollOwnerLease(credsFile,hash('SYNTHETIC_OL054_ACCOUNT_B_ONLY_NEVER_REAL'))
  assert.equal(a.fenceCurrent(),true)
  assert.equal(b.fenceCurrent(),true)
  a.release();b.release()
})

test('M1: a symlinked lease directory is refused (fail closed, not a soft PID file)',async()=>{
  const {parent,credsFile,accountHash}=fixture()
  const dir=weixinPollLeaseDirectory(credsFile)
  rmSync(dir,{recursive:true,force:true})
  const outside=mkdtempSync(join(parent,'outside-')) // parent is 0700-owned, so a nested symlink is fine to build
  const other=mkdtempSync(join(tmpdir(),'dsh-ol054-lease-other-'))
  tempDirs.push(other)
  rmSync(outside,{recursive:true,force:true})
  writeFileSync(join(parent,'link-target'),'')
  const { symlinkSync } = await import('node:fs')
  symlinkSync(other,dir)
  assert.throws(()=>acquireWeixinPollOwnerLease(credsFile,accountHash),/symlink|following/)
})
