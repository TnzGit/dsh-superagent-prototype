import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,chmodSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {reserveSyntheticApproval,inspectSyntheticApproval} from '../src/local-first/non-git-synthetic-approval-ledger.ts'
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
