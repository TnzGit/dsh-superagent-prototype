import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
const fixture = async fn => {
  // Canonicalize macOS /var -> /private/var while retaining the registry's symlink-safe semantics.
  const base=realpathSync(mkdtempSync(join(tmpdir(),'superagent-project-')))
  const root=join(base,'allowed'),project=join(root,'alpha'),outside=join(base,'outside')
  mkdirSync(project,{recursive:true});mkdirSync(outside)
  try{return await fn({root,project,outside})}finally{rmSync(base,{recursive:true,force:true})}
}
test('unknown project IDs and roots outside registered directories are denied',()=>fixture(({root,project,outside})=>{
  assert.throws(()=>new LocalProjectRegistry([root],[{id:'alpha',root:outside,kind:'local'}]),/outside/)
  assert.throws(()=>new LocalProjectRegistry([root],[{id:'../escape',root:project,kind:'local'}]),/Invalid/)
  const registry=new LocalProjectRegistry([root],[{id:'alpha',root:project,kind:'local'}])
  assert.equal(registry.get('alpha').root,project)
  assert.throws(()=>registry.get('/etc/passwd'),/Unknown/)
}))
test('symlink traversal, dotdot paths, and secret locations are denied',()=>fixture(({root,project,outside})=>{
  symlinkSync(outside,join(project,'leak'))
  writeFileSync(join(project,'safe.txt'),'hello')
  const projects=new LocalProjectRegistry([root],[{id:'alpha',root:project,kind:'local'}])
  assert.equal(projects.path('alpha','safe.txt'),join(project,'safe.txt'))
  assert.equal(projects.path('alpha','new/sub/new.ts','write'),join(project,'new/sub/new.ts'))
  for(const path of ['../escape','/etc/passwd','leak/file','.ssh/id_rsa','.git/config','.env','.env.production','nested/../../escape','nested\\..\\escape'])
    assert.throws(()=>projects.path('alpha',path),undefined,'Must reject '+path)
}))
test('read-only projects cannot be written and concurrent writers are serialized',()=>fixture(async({root,project})=>{
  const readOnly=new LocalProjectRegistry([root],[{id:'alpha',root:project,kind:'local',readOnly:true}])
  assert.throws(()=>readOnly.path('alpha','a.ts','write'),/read-only/)
  await assert.rejects(readOnly.write('alpha',async()=>0),/read-only/)
  const registry=new LocalProjectRegistry([root],[{id:'alpha',root:project,kind:'local'}])
  let running=0,maxRunning=0
  await Promise.all(Array.from({length:10},(_,i)=>registry.write('alpha',async()=>{
    running++;maxRunning=Math.max(maxRunning,running)
    await new Promise(resolve=>setTimeout(resolve,0))
    running--;return i
  })))
  assert.equal(maxRunning,1)
}))
