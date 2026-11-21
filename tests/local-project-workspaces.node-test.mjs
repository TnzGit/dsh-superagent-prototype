import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync, chmodSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
import { readLocalProjects, projectIdFromRequest, projectFingerprint, createProjectSnapshot,
  verifyProjectSnapshot, previewNonGitProjectChanges } from '../src/local-first/project-workspaces.ts'
const git=(cwd,...argv)=>execFileSync('git',argv,{cwd,encoding:'utf8',env:{
  ...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}}).trim()
async function fixture(work){
  const base=realpathSync(mkdtempSync(join(tmpdir(),'dsh-local-worker-')))
  const projects=join(base,'projects'),workspaces=join(base,'work')
  mkdirSync(projects,{recursive:true});mkdirSync(workspaces,{recursive:true})
  try {await work({base,projects,workspaces})}
  finally {rmSync(base,{recursive:true,force:true})}
}
test('accepts only an explicit first-line project ID, never arbitrary paths',()=>{
  assert.equal(projectIdFromRequest('/project demo-app\n请修改文件'), 'demo-app')
  assert.equal(projectIdFromRequest('项目：demo-app\n请修改文件'), 'demo-app')
  assert.equal(projectIdFromRequest('/project ../secret\n改'), undefined)
  assert.equal(projectIdFromRequest('请修改项目 demo-app 的文件'), undefined)
  assert.equal(projectIdFromRequest('/project demo-app; rm -rf /\n改'), undefined)
  assert.equal(projectIdFromRequest(''), undefined)
})
test('registry is operator-owned and cannot be replaced by a chat supplied filename',async()=>fixture(async({base,projects})=>{
  const root=join(projects,'a');mkdirSync(root)
  const path=join(base,'projects.json')
  writeFileSync(path,JSON.stringify({allowedRoots:[projects],projects:[{id:'a',root,kind:'local'}]}),{mode:0o600})
  const registry=readLocalProjects(path)
  assert.equal(registry.get('a').root,root)
  chmodSync(path,0o666)
  assert.throws(()=>readLocalProjects(path),/writable/)
}))
test('non-Git project is snapshotted, secrets excluded and source unchanged',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'doc');mkdirSync(root)
  mkdirSync(join(root,'src'));writeFileSync(join(root,'src','a.txt'),'original\n')
  writeFileSync(join(root,'.env'),'SHOULD-NOT-COPY')
  mkdirSync(join(root,'node_modules'));writeFileSync(join(root,'node_modules','secret'),'SHOULD-NOT-COPY')
  const registry=new LocalProjectRegistry([projects],[{id:'doc',root,kind:'local'}])
  const directory=join(workspaces,'doc','ticket-123')
  const request={registry,projectId:'doc',directory,fingerprint:projectFingerprint(registry.get('doc'))}
  await registry.write('doc',()=>createProjectSnapshot(request))
  assert.equal(readFileSync(join(directory,'src','a.txt'),'utf8'),'original\n')
  assert.equal(existsSync(join(directory,'.env')),false)
  assert.equal(existsSync(join(directory,'node_modules')),false)
  assert.equal(git(directory,'status','--porcelain'), '?? .dsh-project.json')
  writeFileSync(join(directory,'src','a.txt'),'worker-edited\n')
  assert.equal(readFileSync(join(root,'src','a.txt'),'utf8'),'original\n')
  assert.match(git(directory,'diff','--','src/a.txt'),/worker-edited/)
  await verifyProjectSnapshot(request)
  await assert.rejects(()=>createProjectSnapshot(request),/already exists/)
}))
test('Git project uses offline local clone, never retains writable origin',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'code');mkdirSync(root)
  git(root,'init','-q');writeFileSync(join(root,'main.py'),'print("before")\n')
  git(root,'add','main.py')
  git(root,'-c','user.name=Test','-c','user.email=test@localhost','-c','commit.gpgsign=false','commit','-qm','baseline')
  const registry=new LocalProjectRegistry([projects],[{id:'code',root,kind:'git'}])
  const request={registry,projectId:'code',directory:join(workspaces,'code','ticket-x'),
    fingerprint:projectFingerprint(registry.get('code'))}
  await createProjectSnapshot(request)
  assert.equal(readFileSync(join(request.directory,'main.py'),'utf8'),'print("before")\n')
  assert.equal(git(request.directory,'remote','-v'),'')
  writeFileSync(join(request.directory,'main.py'),'print("after")\n')
  assert.equal(readFileSync(join(root,'main.py'),'utf8'),'print("before")\n')
  await verifyProjectSnapshot(request)
}))
test('dirty source and symlinked source fail before producing a usable Ticket workspace',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'git');mkdirSync(root)
  git(root,'init','-q');writeFileSync(join(root,'a.txt'),'x')
  git(root,'add','a.txt')
  git(root,'-c','user.name=Test','-c','user.email=test@localhost','-c','commit.gpgsign=false','commit','-qm','baseline')
  writeFileSync(join(root,'a.txt'),'dirty')
  const reg=new LocalProjectRegistry([projects],[{id:'code',root,kind:'git'}])
  const req={registry:reg,projectId:'code',directory:join(workspaces,'code','ticket'),
    fingerprint:projectFingerprint(reg.get('code'))}
  await assert.rejects(()=>createProjectSnapshot(req),/uncommitted/)
  assert.equal(existsSync(req.directory),false)
  const local=join(projects,'local');mkdirSync(local)
  symlinkSync('/etc/passwd',join(local,'dangerous'))
  const other=new LocalProjectRegistry([projects],[{id:'local',root:local,kind:'local'}])
  await assert.rejects(()=>createProjectSnapshot({registry:other,projectId:'local',directory:join(workspaces,'local','ticket'),
    fingerprint:projectFingerprint(other.get('local'))}),/Symlinks/)
}))
test('workspace cannot overlap source root or silently switch to another source fingerprint',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'sandbox');mkdirSync(root);writeFileSync(join(root,'file.txt'),'test')
  const reg=new LocalProjectRegistry([projects],[{id:'sandbox',root,kind:'local'}])
  const fingerprint=projectFingerprint(reg.get('sandbox'))
  await assert.rejects(()=>createProjectSnapshot({registry:reg,projectId:'sandbox',
    directory:join(root,'nested-workspace'),fingerprint}),/overlap/)
  await assert.rejects(()=>createProjectSnapshot({registry:reg,projectId:'sandbox',
    directory:join(workspaces,'sandbox','ticket'),fingerprint:'not-correct'}),/changed/)
}))

test('read-only non-Git preview catches additions, edits and deletion without touching source',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'notes');mkdirSync(root)
  writeFileSync(join(root,'edit.txt'),'before')
  writeFileSync(join(root,'delete.txt'),'remove me')
  writeFileSync(join(root,'keep.txt'),'keep')
  writeFileSync(join(root,'.env'),'sensitive-do-not-include')
  const registry=new LocalProjectRegistry([projects],[{id:'notes',root,kind:'local'}])
  const request={registry,projectId:'notes',directory:join(workspaces,'notes','ticket'),
    fingerprint:projectFingerprint(registry.get('notes'))}
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'edit.txt'),'after')
  writeFileSync(join(request.directory,'new.txt'),Buffer.from([0,1,2,255]))
  rmSync(join(request.directory,'delete.txt'))
  const first=await previewNonGitProjectChanges(request)
  assert.deepEqual(first.changes.map(x=>[x.path,x.action]),[
    ['delete.txt','delete'],['edit.txt','modify'],['new.txt','add']])
  assert.match(first.digest,/^[a-f0-9]{64}$/)
  const again=await previewNonGitProjectChanges(request)
  assert.deepEqual(again,first,'preview is deterministic and read-only')
  assert.equal(readFileSync(join(root,'edit.txt'),'utf8'),'before')
  assert.equal(readFileSync(join(root,'delete.txt'),'utf8'),'remove me')
  assert.equal(existsSync(join(root,'new.txt')),false)
  assert.equal(first.changes.some(x=>x.path.includes('.env')||x.path.includes('.dsh')),false)
  assert.equal(git(request.directory,'status','--porcelain').includes('edit.txt'),true)
}))
test('source changes or surprise source additions fail closed instead of silently overwriting',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'docs');mkdirSync(root)
  writeFileSync(join(root,'a.txt'),'base')
  const registry=new LocalProjectRegistry([projects],[{id:'docs',root,kind:'local'}])
  const request={registry,projectId:'docs',directory:join(workspaces,'docs','ticket'),
    fingerprint:projectFingerprint(registry.get('docs'))}
  await createProjectSnapshot(request)
  writeFileSync(join(request.directory,'a.txt'),'worker change')
  writeFileSync(join(root,'a.txt'),'operator changed source')
  await assert.rejects(previewNonGitProjectChanges(request),/Original project changed/)
  writeFileSync(join(root,'a.txt'),'base')
  writeFileSync(join(root,'new-source.txt'),'operator created another file')
  await assert.rejects(previewNonGitProjectChanges(request),/Original project changed/)
  rmSync(join(root,'new-source.txt'))
  assert.equal((await previewNonGitProjectChanges(request)).changes.length,1)
}))
test('symlinks, Git projects and replacement of the workspace baseline are rejected',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'text');mkdirSync(root)
  writeFileSync(join(root,'a.txt'),'safe')
  const registry=new LocalProjectRegistry([projects],[{id:'text',root,kind:'local'}])
  const req={registry,projectId:'text',directory:join(workspaces,'text','ticket'),
    fingerprint:projectFingerprint(registry.get('text'))}
  await createProjectSnapshot(req)
  symlinkSync(join(root,'a.txt'),join(req.directory,'link.txt'))
  await assert.rejects(previewNonGitProjectChanges(req),/Unsafe symlink/)
  rmSync(join(req.directory,'link.txt'))
  const manifest=join(req.directory,'.dsh-project.json')
  const original=readFileSync(manifest,'utf8')
  writeFileSync(manifest,JSON.stringify({...JSON.parse(original),sourceRevision:'not-a-revision'}))
  await assert.rejects(previewNonGitProjectChanges(req),/Invalid immutable/)
  writeFileSync(manifest,original)
  const gitRoot=join(projects,'git');mkdirSync(gitRoot)
  git(gitRoot,'init','-q');writeFileSync(join(gitRoot,'file.txt'),'stable')
  git(gitRoot,'add','file.txt')
  git(gitRoot,'-c','user.name=Test','-c','user.email=test@localhost',
    '-c','commit.gpgsign=false','commit','-qm','init')
  const gitReg=new LocalProjectRegistry([projects],[{id:'git',root:gitRoot,kind:'git'}])
  const gitReq={registry:gitReg,projectId:'git',directory:join(workspaces,'git','ticket'),
    fingerprint:projectFingerprint(gitReg.get('git'))}
  await createProjectSnapshot(gitReq)
  await assert.rejects(previewNonGitProjectChanges(gitReq),/non-Git/)
}))
test('committed worker changes are compared with the pinned immutable snapshot baseline',async()=>fixture(async({projects,workspaces})=>{
  const root=join(projects,'app');mkdirSync(root);writeFileSync(join(root,'a.txt'),'base')
  const registry=new LocalProjectRegistry([projects],[{id:'app',root,kind:'local'}])
  const req={registry,projectId:'app',directory:join(workspaces,'app','ticket'),
    fingerprint:projectFingerprint(registry.get('app'))}
  await createProjectSnapshot(req)
  writeFileSync(join(req.directory,'a.txt'),'new')
  git(req.directory,'add','a.txt')
  git(req.directory,'-c','user.name=Worker','-c','user.email=worker@localhost',
    '-c','commit.gpgsign=false','commit','-qm','worker commit')
  const plan=await previewNonGitProjectChanges(req)
  assert.equal(plan.changes.length,1)
  assert.equal(plan.changes[0].action,'modify')
  assert.equal(readFileSync(join(root,'a.txt'),'utf8'),'base')
}))
