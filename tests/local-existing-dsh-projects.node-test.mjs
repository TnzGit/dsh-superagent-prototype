import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseDshCatalog, readDshCatalog, chooseExistingDshProject
} from '../src/local-first/existing-dsh-projects.ts'
const inventory={
  version:1,origin:'dsh-host',hostId:'mac-dsh-3080',collectedAt:'2026-11-08T00:00:00.000Z',
  workspaces:[
    {workspaceId:'uuid-dsh-original-1',title:'Inventory App',path:'/Users/example/projects/inventory',
      sessionIds:['original-session-a','original-session-b'],updatedAt:'2026-11-06T00:00:00.000Z'},
    {workspaceId:'uuid-dsh-original-2',title:'Shared Name',path:'/Users/example/projects/lab',
      sessionIds:['original-session-c']},
    {workspaceId:'uuid-dsh-original-3',title:'Shared Name',path:'/Users/example/projects/lab2',
      sessionIds:[]}
  ]
}
test('an imported DSH Workspace keeps stable original Workspace ID, path and Session IDs',()=>{
  const [p]=parseDshCatalog(inventory)
  assert.equal(p.workspaceId,'uuid-dsh-original-1')
  assert.deepEqual(p.sessionIds,['original-session-a','original-session-b'])
  assert.equal(p.path,'/Users/example/projects/inventory')
  assert.match(p.projectId,/^dsh-[a-f0-9]{16}$/)
  assert.deepEqual(parseDshCatalog(inventory),parseDshCatalog({...inventory}))
})
test('explicit project alias picks its exact identity and refuses an unknown alias',()=>{
  const projects=parseDshCatalog(inventory),p=projects[0]
  const answer=chooseExistingDshProject('/project '+p.projectId+'\n继续改 README',projects)
  assert.equal(answer.kind,'existing')
  assert.equal(answer.evidence,'explicit-id')
  assert.equal(answer.project?.workspaceId,p.workspaceId)
  assert.equal(chooseExistingDshProject('/project not-in-catalog\nwrite',projects).kind,'clarify')
})
test('a uniquely quoted exact title plus project action is a high-confidence match, but duplicates are not',()=>{
  const projects=parseDshCatalog(inventory)
  const result=chooseExistingDshProject('继续《Inventory App》项目',projects)
  assert.equal(result.kind,'existing')
  assert.equal(result.evidence,'unique-exact-title')
  const ambiguous=chooseExistingDshProject('继续《Shared Name》项目',projects)
  assert.equal(ambiguous.kind,'clarify')
  assert.equal(ambiguous.matches?.length,2)
  assert.equal(chooseExistingDshProject('Inventory App seems relevant',projects).kind,'none')
})
test('do not auto-select from recency or fuzzy wording; previous thread binding requires explicit continue',()=>{
  const projects=parseDshCatalog(inventory),first=projects[0].projectId
  assert.equal(chooseExistingDshProject('修一下昨天说过的 Bug',projects,first).kind,'none')
  assert.equal(chooseExistingDshProject('继续之前项目',projects,first).evidence,'confirmed-thread')
  assert.equal(chooseExistingDshProject('继续之前项目',projects).kind,'clarify')
  assert.equal(chooseExistingDshProject('在另外那个项目里改',projects,first).kind,'none')
})
test('new-project request is a proposal, never an automatic creation or reuse',()=>{
  const projects=parseDshCatalog(inventory)
  const result=chooseExistingDshProject('/new-project design-lab\n新建工作',projects)
  assert.equal(result.kind,'new-request')
  assert.equal(result.projectId,'design-lab')
  assert.equal(chooseExistingDshProject('新建项目：demo-app\n请初始化',projects).kind,'new-request')
  assert.equal(chooseExistingDshProject('/new-project ../escape',projects).kind,'none')
})
test('bad catalog and duplicate Workspace IDs fail closed; owner-only import refuses weak permissions',()=>{
  assert.throws(()=>parseDshCatalog({...inventory,workspaces:[inventory.workspaces[0],inventory.workspaces[0]]}),/Duplicate/)
  assert.throws(()=>parseDshCatalog({...inventory,workspaces:[{...inventory.workspaces[0],sessionIds:[3]}]}),/fields/)
  const dir=mkdtempSync(join(tmpdir(),'dsh-workspace-catalog-'))
  try {
    const file=join(dir,'catalog.json')
    writeFileSync(file,JSON.stringify(inventory),{mode:0o600})
    assert.equal(readDshCatalog(file).length,3)
    chmodSync(file,0o644)
    assert.throws(()=>readDshCatalog(file),/owner-only/)
    const alias=join(dir,'link.json')
    symlinkSync(file,alias)
    assert.throws(()=>readDshCatalog(alias),/owner-only/)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
