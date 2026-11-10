import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,chmodSync,symlinkSync,readdirSync,statSync} from 'node:fs'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {reserveSyntheticApproval,inspectSyntheticApproval,reserveFixtureBoundSyntheticApproval} from '../src/local-first/non-git-synthetic-approval-ledger.ts'
const grant=(journalRoot)=>({version:1,approvalId:'approval-synthetic-00001',transactionId:'transaction-synthetic-00001',projectFingerprint:'a'.repeat(64),previewDigest:'b'.repeat(64),operation:'apply',journalRoot})
async function fixture(run){
 const base=mkdtempSync(join(tmpdir(),'dsh-ledger-synthetic-'))
 const root=join(base,'ledger'),journal=join(base,'journal')
 mkdirSync(root,{mode:0o700});mkdirSync(journal,{mode:0o700})
 try{await run({root,journal})}finally{rmSync(base,{recursive:true,force:true})}
}
test('one-use reservation is durable and rejects same ID across journal roots',()=>fixture(async({root,journal})=>{
 const g=grant(journal)
 assert.equal(await reserveSyntheticApproval(root,g),'reserved')
 assert.equal((await inspectSyntheticApproval(root,g.approvalId)).transactionId,g.transactionId)
 await assert.rejects(reserveSyntheticApproval(root,g),/already reserved/)
 const other=join(journal,'other');mkdirSync(other,{mode:0o700})
 await assert.rejects(reserveSyntheticApproval(root,{...g,journalRoot:other}),/already reserved/)
}))
test('parallel same-ID reservation admits exactly one',()=>fixture(async({root,journal})=>{
 const outcomes=await Promise.allSettled(Array.from({length:8},()=>reserveSyntheticApproval(root,grant(journal))))
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1)
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,7)
}))
test('unsafe ledger mode and malformed approval fail closed',()=>fixture(async({root,journal})=>{
 chmodSync(root,0o755)
 await assert.rejects(reserveSyntheticApproval(root,grant(journal)),/Unsafe/)
 chmodSync(root,0o700)
 await assert.rejects(reserveSyntheticApproval(root,{...grant(journal),previewDigest:'bad'}),/Invalid/)
}))
test('corrupt entry is never overwritten or silently recovered',()=>fixture(async({root,journal})=>{
 const g=grant(journal)
 await reserveSyntheticApproval(root,g)
 const {createHash}=await import('node:crypto')
 const path=join(root,createHash('sha256').update(g.approvalId).digest('hex')+'.json')
 writeFileSync(path,'{broken',{mode:0o600})
 await assert.rejects(inspectSyntheticApproval(root,g.approvalId),/Corrupt/)
 await assert.rejects(reserveSyntheticApproval(root,g),/already reserved/)
}))

test('ancestor and descendant ledger/journal roots fail closed before creating entries',()=>fixture(async({root,journal})=>{
 const nested=join(root,'nested');mkdirSync(nested,{mode:0o700})
 await assert.rejects(reserveSyntheticApproval(root,grant(nested)),/overlaps journal/)
 const childLedger=join(journal,'ledger');mkdirSync(childLedger,{mode:0o700})
 await assert.rejects(reserveSyntheticApproval(childLedger,grant(journal)),/overlaps journal/)
 assert.equal((await import('node:fs')).readdirSync(root).filter(x=>x.endsWith('.json')).length,0)
 assert.equal((await import('node:fs')).readdirSync(childLedger).length,0)
}))

test('symlinked journal root fails closed without reserving an ID',()=>fixture(async({root,journal})=>{
 const alias=join(root,'journal-alias')
 symlinkSync(journal,alias,'dir')
 await assert.rejects(reserveSyntheticApproval(root,grant(alias)),/Unsafe synthetic journal root/)
 assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length,0)
}))

test('fixture-bound reservation denies alternate private journal roots and a mismatched project',()=>fixture(async({root,journal})=>{
  const base=join(root,'..')
  writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({
    version:1,purpose:'offline-synthetic-only',projectFingerprint:'a'.repeat(64)
  }),{mode:0o600})
  const alternate=join(base,'journal-alternate');mkdirSync(alternate,{mode:0o700})
  await assert.rejects(reserveFixtureBoundSyntheticApproval(base,grant(alternate)),
    /journal root differs from owner binding/)
  await assert.rejects(reserveFixtureBoundSyntheticApproval(base,{
    ...grant(journal),projectFingerprint:'c'.repeat(64)
  }),/binding project mismatch/)
  assert.equal(await reserveFixtureBoundSyntheticApproval(base,grant(journal)),'reserved')
  await assert.rejects(reserveFixtureBoundSyntheticApproval(base,grant(journal)),/already reserved/)
  assert.equal(readdirSync(alternate).length,0)
  assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length,1)
}))
test('synthetic fixture binding must be owner-only, unsymlinked and non-replayable',()=>fixture(async({root,journal})=>{
  const base=join(root,'..'),marker=join(base,'.synthetic-ledger-binding.json')
  writeFileSync(marker,JSON.stringify({
    version:1,purpose:'offline-synthetic-only',projectFingerprint:'a'.repeat(64)
  }),{mode:0o600})
  chmodSync(marker,0o644)
  await assert.rejects(reserveFixtureBoundSyntheticApproval(base,grant(journal)),/Untrusted synthetic fixture binding/)
  chmodSync(marker,0o600)
  const alias=join(base,'marker-target')
  writeFileSync(alias,'{}',{mode:0o600})
  rmSync(marker)
  symlinkSync(alias,marker)
  await assert.rejects(reserveFixtureBoundSyntheticApproval(base,grant(journal)),/Untrusted synthetic fixture binding/)
  assert.equal(readdirSync(root).length,0)
}))
test('partial durable reservation after simulated crash is never overwritten or replayed',()=>fixture(async({root,journal})=>{
  const g=grant(journal)
  const id=createHash('sha256').update(g.approvalId).digest('hex')+'.json'
  writeFileSync(join(root,id),'{"version":1,"approvalId":',{mode:0o600})
  await assert.rejects(reserveSyntheticApproval(root,g),/already reserved/)
  await assert.rejects(inspectSyntheticApproval(root,g.approvalId),/Corrupt/)
  assert.equal(statSync(join(root,id)).size,26)
}))
test('independent OS processes compete for one synthetic ID; exactly one reservation wins',()=>fixture(async({root,journal})=>{
  const moduleUrl=new URL('../src/local-first/non-git-synthetic-approval-ledger.ts',import.meta.url).href
  const script=[
    'import {reserveSyntheticApproval} from '+JSON.stringify(moduleUrl),
    'const grant=JSON.parse(process.argv[2])',
    'try{await reserveSyntheticApproval(process.argv[1],grant);process.stdout.write("WIN")}',
    'catch(error){if(!String(error.message).includes("already reserved")){',
    '  process.stderr.write(String(error.message));process.exitCode=2',
    '}else process.stdout.write("DENIED")}'
  ].join('\n')
  const runChild=()=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[
      '--experimental-strip-types','--input-type=module','-e',script,root,JSON.stringify(grant(journal))
    ],{stdio:['ignore','pipe','pipe']})
    let stdout='',stderr=''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data',data=>{stdout+=data})
    child.stderr.on('data',data=>{stderr+=data})
    child.once('error',reject)
    child.once('close',(exit)=>resolve({exit,stdout,stderr}))
  })
  const results=await Promise.all(Array.from({length:4},()=>runChild()))
  assert.deepEqual(results.map(x=>x.exit),[0,0,0,0],JSON.stringify(results))
  assert.equal(results.filter(x=>x.stdout==='WIN').length,1,JSON.stringify(results))
  assert.equal(results.filter(x=>x.stdout==='DENIED').length,3,JSON.stringify(results))
  assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length,1)
}))
