import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync,renameSync,writeFileSync,chmodSync,symlinkSync,readdirSync,statSync,realpathSync} from 'node:fs'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {reserveSyntheticApproval,inspectSyntheticApproval,reserveFixtureBoundSyntheticApproval,inspectRegistryBoundSyntheticApproval,reserveRegistryBoundSyntheticApproval} from '../src/local-first/non-git-synthetic-approval-ledger.ts'
import {LocalProjectRegistry} from '../src/local-first/project-registry.ts'
import {projectFingerprint} from '../src/local-first/project-workspaces.ts'
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
test('synthetic reservation rejects unexpected input keys before consuming approval',()=>fixture(async({root,journal})=>{
 const g=grant(journal)
 await assert.rejects(reserveSyntheticApproval(root,{...g,unexpected:'not-authority'}),/Invalid synthetic reservation/)
 assert.equal(readdirSync(root).length,0,'invalid input must not create a receipt')
 assert.equal(await reserveSyntheticApproval(root,g),'reserved')
 assert.equal((await inspectSyntheticApproval(root,g.approvalId)).approvalId,g.approvalId)
 await assert.rejects(reserveSyntheticApproval(root,g),/already reserved/)
}))
test('synthetic reservation rejects inherited, nonenumerable and symbol keys before receipt',()=>fixture(async({root,journal})=>{
 const g=grant(journal)
 const inherited=Object.assign(Object.create({inherited:'not-authority'}),g)
 const hidden={...g};Object.defineProperty(hidden,'hidden',{value:'not-authority'})
 const symbol={...g,[Symbol('hidden')]:'not-authority'}
 for(const input of [inherited,hidden,symbol]){
  await assert.rejects(reserveSyntheticApproval(root,input),/Invalid synthetic reservation/)
  assert.equal(readdirSync(root).length,0)
 }
 assert.equal(await reserveSyntheticApproval(root,g),'reserved')
}))
test('synthetic accessor values are rejected without getter invocation or receipt',()=>fixture(async({root,journal})=>{
 let calls=0
 const g={...grant(journal)}
 Object.defineProperty(g,'approvalId',{enumerable:true,configurable:true,get(){calls++;throw Error('getter executed')}})
 await assert.rejects(reserveSyntheticApproval(root,g),/Invalid synthetic reservation/)
 assert.equal(calls,0)
 assert.equal(readdirSync(root).length,0)
 assert.equal(await reserveSyntheticApproval(root,grant(journal)),'reserved')
}))
test('synthetic reservation rejects Proxy inputs without invoking traps or writing receipt',()=>fixture(async({root,journal})=>{
 const g=grant(journal);let traps=0
 const proxy=new Proxy(g,{
  getPrototypeOf(){traps++;throw Error('proxy trap executed')},
  ownKeys(){traps++;throw Error('proxy trap executed')},
  getOwnPropertyDescriptor(){traps++;throw Error('proxy trap executed')}
 })
 await assert.rejects(reserveSyntheticApproval(root,proxy),/Invalid synthetic reservation/)
 assert.equal(traps,0,'proxy traps must not run')
 assert.equal(readdirSync(root).length,0)
 const revoked=Proxy.revocable(g,{});revoked.revoke()
 await assert.rejects(reserveSyntheticApproval(root,revoked.proxy),/Invalid synthetic reservation/)
 assert.equal(readdirSync(root).length,0)
 assert.equal(await reserveSyntheticApproval(root,g),'reserved')
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

test('read-only synthetic receipt inspection rejects unexpected fields without consuming or rewriting receipt',()=>fixture(async({root,journal})=>{
 const g=grant(journal)
 await reserveSyntheticApproval(root,g)
 const path=join(root,createHash('sha256').update(g.approvalId).digest('hex')+'.json')
 const fs=await import('node:fs')
 const original=fs.readFileSync(path,'utf8')
 fs.writeFileSync(path,JSON.stringify({...g,unexpected:'not-authority'})+'\n',{mode:0o600})
 const tampered=fs.readFileSync(path,'utf8')
 await assert.rejects(inspectSyntheticApproval(root,g.approvalId),/Corrupt synthetic reservation/)
 assert.equal(fs.readFileSync(path,'utf8'),tampered,'inspection must be read-only')
 await assert.rejects(reserveSyntheticApproval(root,g),/already reserved/)
 assert.notEqual(tampered,original)
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

test('registry preflight binds a registered synthetic root and never creates an approval',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(external,'registered')
    mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-alpha',root:project,kind:'local'}])
    const fingerprint=projectFingerprint(registry.get('synthetic-alpha'))
    const base=join(root,'..')
    writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fingerprint
    }),{mode:0o600})
    const result=await inspectRegistryBoundSyntheticApproval(registry,'synthetic-alpha',base,{
      ...grant(journal),projectFingerprint:fingerprint
    })
    assert.equal(result.projectFingerprint,fingerprint)
    assert.equal(result.ledgerRoot,realpathSync(root))
    assert.equal(result.journalRoot,realpathSync(journal))
    assert.equal(readdirSync(root).length,0,'read-only preflight must not reserve an approval')
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-alpha',base,{
      ...grant(journal),projectFingerprint:'a'.repeat(64)
    }),/differs from registered project/)
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'unknown-project',base,{
      ...grant(journal),projectFingerprint:fingerprint
    }),/Unknown project ID/)
  }finally{rmSync(external,{recursive:true,force:true})}
}))
test('registry preflight rejects alternate journal, forged marker fingerprint and unsafe marker mode',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(external,'registered');mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-beta',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-beta'))
    const base=join(root,'..'),marker=join(base,'.synthetic-ledger-binding.json')
    writeFileSync(marker,JSON.stringify({version:1,purpose:'offline-synthetic-only',projectFingerprint:fp}),{mode:0o600})
    const alt=join(base,'alternate-journal');mkdirSync(alt,{mode:0o700})
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-beta',base,{
      ...grant(alt),projectFingerprint:fp
    }),/journal differs from fixed binding/)
    chmodSync(marker,0o644)
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-beta',base,{
      ...grant(journal),projectFingerprint:fp
    }),/Unsafe synthetic registry binding marker/)
    chmodSync(marker,0o600)
    writeFileSync(marker,JSON.stringify({version:1,purpose:'offline-synthetic-only',projectFingerprint:'a'.repeat(64)}))
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-beta',base,{
      ...grant(journal),projectFingerprint:fp
    }),/binding fingerprint mismatch/)
    assert.equal(readdirSync(root).length,0)
  }finally{rmSync(external,{recursive:true,force:true})}
}))
test('registry preflight rejects a project root swapped for symlink after registration',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(external,'registered'),alias=join(external,'real-elsewhere')
    mkdirSync(project,{mode:0o700})
    mkdirSync(alias,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-gamma',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-gamma'))
    const base=join(root,'..')
    writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    rmSync(project,{recursive:true})
    symlinkSync(alias,project,'dir')
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-gamma',base,{
      ...grant(journal),projectFingerprint:fp
    }),/Registered synthetic project (?:root|ancestor|directory) identity changed/)
    assert.equal(readdirSync(root).length,0)
  }finally{rmSync(external,{recursive:true,force:true})}
}))


test('registry preflight refuses a symlinked ancestor after registry creation',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const parent=join(external,'parent'),project=join(parent,'registered')
    mkdirSync(parent,{mode:0o700});mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-ancestor',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-ancestor'))
    const base=join(root,'..')
    writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    const replacement=join(external,'replacement')
    // Move the original directory, then introduce an alias at its old parent.
    ;(await import('node:fs')).renameSync(parent,replacement)
    symlinkSync(replacement,parent,'dir')
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-ancestor',base,{
      ...grant(journal),projectFingerprint:fp
    }),/ancestor identity changed/)
    assert.equal(readdirSync(root).length,0)
  }finally{rmSync(external,{recursive:true,force:true})}
}))

// A same-path replacement by another ordinary directory preserves the path-only
// projectFingerprint. The independent registration-time dev/ino MUST refuse it.
test('registry preflight detects ordinary directory replacement at the identical path',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(external,'registered'),original=join(external,'original-moved')
    mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-inode',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-inode'))
    const base=join(root,'..')
    writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    renameSync(project,original)
    mkdirSync(project,{mode:0o700}) // not a symlink, but a DIFFERENT inode
    assert.equal(projectFingerprint(registry.get('synthetic-inode')),fp)
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-inode',base,{
      ...grant(journal),projectFingerprint:fp
    }),/Registered synthetic project directory identity changed/)
    assert.equal(readdirSync(root).length,0,'read-only refusal must not issue a receipt')
    assert.equal(readdirSync(journal).length,0)
  }finally{rmSync(external,{recursive:true,force:true})}
}))

// The root inode can remain exactly the same while an ordinary (non-symlink)
// ancestor is replaced and the root directory is moved back into the new tree.
// The path-only fingerprint and root dev/ino both stay equal; the ancestor's
// captured inode must independently fail closed with no approval reservation.
test('registry preflight rejects ordinary ancestor replacement preserving root inode',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const parent=join(external,'parent'),project=join(parent,'registered')
    const moved=join(external,'moved-parent')
    mkdirSync(parent,{mode:0o700});mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-parent-inode',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-parent-inode'))
    const rootBefore=statSync(project)
    const base=join(root,'..')
    writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    renameSync(parent,moved)
    mkdirSync(parent,{mode:0o700})
    renameSync(join(moved,'registered'),project)
    const rootAfter=statSync(project)
    assert.equal(rootAfter.dev,rootBefore.dev)
    assert.equal(rootAfter.ino,rootBefore.ino,'the original project inode is preserved')
    assert.equal(projectFingerprint(registry.get('synthetic-parent-inode')),fp)
    await assert.rejects(inspectRegistryBoundSyntheticApproval(registry,'synthetic-parent-inode',base,{
      ...grant(journal),projectFingerprint:fp
    }),/Registered synthetic project ancestor identity changed/)
    assert.equal(readdirSync(root).length,0,'failed preflight cannot reserve approval')
    assert.equal(readdirSync(journal).length,0)
  }finally{rmSync(external,{recursive:true,force:true})}
}))

// A *single* registry instance pins the first validated fixture's ledger; a
// second equally private fixture cannot consume the same approval via this API.
test('registry-scoped synthetic reservation rejects cross-fixture same-ID replay before writing',()=>fixture(async({root,journal})=>{
  const projectBase=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  const second=mkdtempSync(join(tmpdir(),'dsh-ledger-synthetic-'))
  try{
    const project=join(projectBase,'registered')
    mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([projectBase],[{id:'synthetic-pinned',root:project,kind:'local'}])
    const fingerprint=projectFingerprint(registry.get('synthetic-pinned'))
    const first=join(root,'..')
    writeFileSync(join(first,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fingerprint
    }),{mode:0o600})
    const ledger2=join(second,'ledger'),journal2=join(second,'journal')
    mkdirSync(ledger2,{mode:0o700});mkdirSync(journal2,{mode:0o700})
    writeFileSync(join(second,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fingerprint
    }),{mode:0o600})
    const g={...grant(journal),projectFingerprint:fingerprint}
    assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-pinned',first,g),'reserved')
    await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-pinned',second,{
      ...g,journalRoot:journal2
    }),/conflicting fixture ledger binding/)
    await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-pinned',first,g),/already reserved/)
    assert.equal(readdirSync(root).filter(n=>n.endsWith('.json')).length,1)
    assert.equal(readdirSync(ledger2).length,0,'alternate fixture must not get a receipt')
    assert.equal(readdirSync(journal2).length,0)
  }finally{rmSync(second,{recursive:true,force:true});rmSync(projectBase,{recursive:true,force:true})}
}))

test('registry-bound invalid reservation input leaves no durable pin or receipt',()=>fixture(async({root,journal})=>{
 const projectBase=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
 try{
  const project=join(projectBase,'registered');mkdirSync(project,{mode:0o700})
  const registry=new LocalProjectRegistry([projectBase],[{id:'synthetic-early-guard',root:project,kind:'local'}])
  const fp=projectFingerprint(registry.get('synthetic-early-guard'))
  const fixtureRoot=join(root,'..')
  writeFileSync(join(fixtureRoot,'.synthetic-ledger-binding.json'),JSON.stringify({
   version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
  }),{mode:0o600})
  const g={...grant(journal),projectFingerprint:fp}
  await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-early-guard',fixtureRoot,{
   ...g,unexpected:'not-authority'
  }),/Invalid synthetic reservation/)
  assert.equal(readdirSync(projectBase).includes('.dsh-synthetic-ledger-pin.json'),false,
   'invalid input must not create a durable pin')
  assert.equal(readdirSync(root).length,0,'invalid input must not create a receipt')
  assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-early-guard',fixtureRoot,g),'reserved')
  assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length,1)
 }finally{rmSync(projectBase,{recursive:true,force:true})}
}))

test('registry-bound inherited and hidden input keys cannot create durable pin',()=>fixture(async({root,journal})=>{
 const parent=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
 try{
  const project=join(parent,'registered');mkdirSync(project,{mode:0o700})
  const registry=new LocalProjectRegistry([parent],[{id:'synthetic-hidden-keys',root:project,kind:'local'}])
  const fp=projectFingerprint(registry.get('synthetic-hidden-keys'))
  const base=join(root,'..')
  writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({version:1,purpose:'offline-synthetic-only',projectFingerprint:fp}),{mode:0o600})
  const g={...grant(journal),projectFingerprint:fp}
  const inherited=Object.assign(Object.create({extra:true}),g)
  const hidden={...g};Object.defineProperty(hidden,'extra',{value:true})
  for(const input of [inherited,hidden]){
   await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-hidden-keys',base,input),/Invalid synthetic reservation/)
   assert.equal(readdirSync(parent).includes('.dsh-synthetic-ledger-pin.json'),false)
   assert.equal(readdirSync(root).length,0)
  }
  assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-hidden-keys',base,g),'reserved')
 }finally{rmSync(parent,{recursive:true,force:true})}
}))

test('registry-bound accessor input cannot run getter or create durable pin',()=>fixture(async({root,journal})=>{
 const parent=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
 try{
  const project=join(parent,'registered');mkdirSync(project,{mode:0o700})
  const registry=new LocalProjectRegistry([parent],[{id:'synthetic-accessor',root:project,kind:'local'}])
  const fp=projectFingerprint(registry.get('synthetic-accessor'))
  const base=join(root,'..')
  writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({version:1,purpose:'offline-synthetic-only',projectFingerprint:fp}),{mode:0o600})
  let calls=0
  const g={...grant(journal),projectFingerprint:fp}
  Object.defineProperty(g,'journalRoot',{enumerable:true,get(){calls++;throw Error('getter executed')}})
  await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-accessor',base,g),/Invalid synthetic reservation/)
  assert.equal(calls,0)
  assert.equal(readdirSync(parent).includes('.dsh-synthetic-ledger-pin.json'),false)
  assert.equal(readdirSync(root).length,0)
  assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-accessor',base,{...grant(journal),projectFingerprint:fp}),'reserved')
 }finally{rmSync(parent,{recursive:true,force:true})}
}))

test('registry-bound Proxy input is refused before pin and without executing traps',()=>fixture(async({root,journal})=>{
 const parent=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
 try{
  const project=join(parent,'registered');mkdirSync(project,{mode:0o700})
  const registry=new LocalProjectRegistry([parent],[{id:'synthetic-proxy',root:project,kind:'local'}])
  const fp=projectFingerprint(registry.get('synthetic-proxy'))
  const base=join(root,'..')
  writeFileSync(join(base,'.synthetic-ledger-binding.json'),JSON.stringify({version:1,purpose:'offline-synthetic-only',projectFingerprint:fp}),{mode:0o600})
  const g={...grant(journal),projectFingerprint:fp};let traps=0
  const proxy=new Proxy(g,{
   getPrototypeOf(){traps++;throw Error('trap executed')},
   ownKeys(){traps++;throw Error('trap executed')},
   getOwnPropertyDescriptor(){traps++;throw Error('trap executed')}
  })
  await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-proxy',base,proxy),/Invalid synthetic reservation/)
  assert.equal(traps,0)
  assert.equal(readdirSync(parent).includes('.dsh-synthetic-ledger-pin.json'),false)
  assert.equal(readdirSync(root).length,0)
  assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-proxy',base,g),'reserved')
 }finally{rmSync(parent,{recursive:true,force:true})}
}))

// Durable owner-private synthetic parent pin crosses registry instances, but
// a distinct project parent or same-user deletion can still bypass it.
test('registry-scoped durable fixture pin rejects alternate ledger in new registry instance',()=>fixture(async({root,journal})=>{
  const projectBase=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  const second=mkdtempSync(join(tmpdir(),'dsh-ledger-synthetic-'))
  try{
    const project=join(projectBase,'registered');mkdirSync(project,{mode:0o700})
    const setup=()=>new LocalProjectRegistry([projectBase],[{id:'synthetic-unshared',root:project,kind:'local'}])
    const r1=setup(),r2=setup(),fp=projectFingerprint(r1.get('synthetic-unshared'))
    const first=join(root,'..')
    writeFileSync(join(first,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    const ledger2=join(second,'ledger'),journal2=join(second,'journal')
    mkdirSync(ledger2,{mode:0o700});mkdirSync(journal2,{mode:0o700})
    writeFileSync(join(second,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    assert.equal(await reserveRegistryBoundSyntheticApproval(r1,'synthetic-unshared',first,{
      ...grant(journal),projectFingerprint:fp
    }),'reserved')
    await assert.rejects(reserveRegistryBoundSyntheticApproval(r2,'synthetic-unshared',second,{
      ...grant(journal2),projectFingerprint:fp
    }),/conflicting fixture ledger binding/)
    assert.equal(readdirSync(root).filter(n=>n.endsWith('.json')).length,1)
    assert.equal(readdirSync(ledger2).filter(n=>n.endsWith('.json')).length,0)
  }finally{rmSync(second,{recursive:true,force:true});rmSync(projectBase,{recursive:true,force:true})}
}))

// A power loss while writing the owner-private pin must never be treated as
// permission to choose a different ledger or to auto-repair the torn file.
test('corrupt durable project-fixture pin refuses synthetic reservation without any ledger receipt',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(external,'registered');mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-corrupt-pin',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-corrupt-pin'))
    writeFileSync(join(root,'..','.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    const pin=join(external,'.dsh-synthetic-ledger-pin.json')
    writeFileSync(pin,'{incomplete',{mode:0o600})
    await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-corrupt-pin',join(root,'..'),{
      ...grant(journal),projectFingerprint:fp
    }),/Corrupt synthetic registry ledger pin/)
    assert.equal(readdirSync(root).length,0)
    assert.equal(readdirSync(journal).length,0)
    assert.equal((await import('node:fs')).readFileSync(pin,'utf8'),'{incomplete')
  }finally{rmSync(external,{recursive:true,force:true})}
}))

test('two OS processes sharing synthetic project parent cannot reserve same ID into two ledgers',()=>fixture(async({root,journal})=>{
  const external=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  const second=mkdtempSync(join(tmpdir(),'dsh-ledger-synthetic-'))
  try{
    const project=join(external,'registered');mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([external],[{id:'synthetic-process-pin',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-process-pin'))
    const fixture1=join(root,'..'),ledger2=join(second,'ledger'),journal2=join(second,'journal')
    mkdirSync(ledger2,{mode:0o700});mkdirSync(journal2,{mode:0o700})
    for(const fixtureRoot of [fixture1,second])
      writeFileSync(join(fixtureRoot,'.synthetic-ledger-binding.json'),JSON.stringify({
        version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
      }),{mode:0o600})
    const url=new URL('../src/local-first/non-git-synthetic-approval-ledger.ts',import.meta.url).href
    const regUrl=new URL('../src/local-first/project-registry.ts',import.meta.url).href
    const script=[
      'import {reserveRegistryBoundSyntheticApproval} from '+JSON.stringify(url),
      'import {LocalProjectRegistry} from '+JSON.stringify(regUrl),
      'const [base,fixture,id,approval]=process.argv.slice(1)',
      'const registry=new LocalProjectRegistry([base],[{id,root:base+"/registered",kind:"local"}])',
      'try{await reserveRegistryBoundSyntheticApproval(registry,id,fixture,JSON.parse(approval));process.stdout.write("WIN")}',
      'catch(e){if(/conflicting fixture ledger binding|Corrupt synthetic registry ledger pin/.test(String(e.message)))process.stdout.write("DENIED");',
      'else {process.stderr.write(String(e.message));process.exitCode=2}}'
    ].join('\n')
    const run=(fixtureRoot,journalRoot)=>new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,['--experimental-strip-types','--input-type=module','-e',
        script,external,fixtureRoot,'synthetic-process-pin',JSON.stringify({...grant(journalRoot),projectFingerprint:fp})
      ],{stdio:['ignore','pipe','pipe']})
      let stdout='',stderr=''
      child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8')
      child.stdout.on('data',chunk=>{stdout+=chunk});child.stderr.on('data',chunk=>{stderr+=chunk})
      child.once('error',reject);child.once('close',code=>resolve({code,stdout,stderr}))
    })
    const results=await Promise.all([run(fixture1,journal),run(second,journal2)])
    assert.deepEqual(results.map(x=>x.code),[0,0],JSON.stringify(results))
    assert.equal(results.filter(x=>x.stdout==='WIN').length,1,JSON.stringify(results))
    assert.equal(results.filter(x=>x.stdout==='DENIED').length,1,JSON.stringify(results))
    assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length+
      readdirSync(ledger2).filter(x=>x.endsWith('.json')).length,1)
  }finally{rmSync(external,{recursive:true,force:true});rmSync(second,{recursive:true,force:true})}
}))

test('same registry refuses deleted or replaced durable pin without issuing another receipt',()=>fixture(async({root,journal})=>{
  const parent=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(parent,'registered');mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([parent],[{id:'synthetic-pin-drift',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-pin-drift'))
    const fixtureRoot=join(root,'..')
    writeFileSync(join(fixtureRoot,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    const first={...grant(journal),projectFingerprint:fp}
    assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-pin-drift',fixtureRoot,first),'reserved')
    const pin=join(parent,'.dsh-synthetic-ledger-pin.json')
    const original=(await import('node:fs')).readFileSync(pin,'utf8')
    const next={...first,approvalId:'approval-synthetic-00002'}
    // Keep the original inode alive under a different name: unlink+recreate
    // may legitimately recycle its inode immediately on Linux.
    const moved=pin+'.moved'
    ;(await import('node:fs')).renameSync(pin,moved)
    await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-pin-drift',fixtureRoot,next),
      /pin disappeared/)
    assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length,1)
    writeFileSync(pin,original,{mode:0o600})
    await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-pin-drift',fixtureRoot,next),
      /pin identity changed/)
    assert.equal(readdirSync(root).filter(x=>x.endsWith('.json')).length,1)
  }finally{rmSync(parent,{recursive:true,force:true})}
}))

// Preserve the original directory inode under a new name to avoid inode reuse.
test('same registry refuses ledger directory replacement before issuing a new receipt',()=>fixture(async({root,journal})=>{
  const parent=mkdtempSync(join(tmpdir(),'dsh-project-synthetic-'))
  try{
    const project=join(parent,'registered');mkdirSync(project,{mode:0o700})
    const registry=new LocalProjectRegistry([parent],[{id:'synthetic-ledger-drift',root:project,kind:'local'}])
    const fp=projectFingerprint(registry.get('synthetic-ledger-drift'))
    const fixtureRoot=join(root,'..')
    writeFileSync(join(fixtureRoot,'.synthetic-ledger-binding.json'),JSON.stringify({
      version:1,purpose:'offline-synthetic-only',projectFingerprint:fp
    }),{mode:0o600})
    const first={...grant(journal),projectFingerprint:fp}
    assert.equal(await reserveRegistryBoundSyntheticApproval(registry,'synthetic-ledger-drift',fixtureRoot,first),'reserved')
    const retained=join(fixtureRoot,'ledger-retained')
    renameSync(root,retained)
    mkdirSync(root,{mode:0o700})
    await assert.rejects(reserveRegistryBoundSyntheticApproval(registry,'synthetic-ledger-drift',fixtureRoot,{
      ...first,approvalId:'approval-synthetic-00002'
    }),/ledger directory identity changed/)
    assert.equal(readdirSync(root).length,0)
    assert.equal(readdirSync(retained).filter(x=>x.endsWith('.json')).length,1)
  }finally{rmSync(parent,{recursive:true,force:true})}
}))
