import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
import { readLocalProjects, projectIdFromRequest, projectFingerprint, createProjectSnapshot,
  verifyProjectSnapshot } from '../src/local-first/project-workspaces.ts'
const git=(cwd,...argv)=>execFileSync('git',argv,{cwd,encoding:'utf8',env:{
  ...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}}).trim()
async function fixture(work){
  const base=mkdtempSync(join(tmpdir(),'dsh-local-worker-'))
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
