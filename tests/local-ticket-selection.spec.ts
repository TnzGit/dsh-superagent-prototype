/** Regression of the actual DshExecutor.prepare() Ticket binding, not just a helper. */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DshExecutor } from '../src/executor/dsh.ts'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
import { projectFingerprint } from '../src/local-first/project-workspaces.ts'
import { SettingsSchema } from '../src/policy.ts'
import { parseDshCatalog } from '../src/local-first/existing-dsh-projects.ts'
function ticket(message: string) {
  return { id:'0123456789abcdeffedcba9876543210',origin:{triggerId:'trigger-x',triggerIds:['trigger-x']},
    mandate:{strength:'explicit',basis:{},scope:'change'},title:'Fix test' } as never
}
const outcome={kind:'accept',title:'Fix test',scope:'Fix test',reason:'request',name:'fix-test'} as const
describe('DshExecutor local project selection at accepted Ticket boundary',()=>{
  it('binds an explicitly named allowlisted project to its own worker workspace',()=>{
    const base=mkdtempSync(join(tmpdir(),'dsh-ticket-select-'))
    try{
      const src=join(base,'src'),stateDir=join(base,'state');mkdirSync(src);mkdirSync(stateDir)
      const registry=new LocalProjectRegistry([base],[{id:'demo',root:src,kind:'local'}])
      const host={store:{settings:()=>SettingsSchema.parse({sources:{github:{enabled:false,config:{}}}}),
        tickets:{open:()=>[]},triggers:{get:()=>({text:'/project demo\nFix file'})}},
        effects:{handle:()=>{}}, machine:{stateDir},localProjects:registry,localOnly:()=>true}
      const executor=new DshExecutor(host as never)
      const result=executor.prepare(ticket('/project demo\nFix file'),outcome)
      expect(result.execution).toMatchObject({projectId:'demo',projectFingerprint:projectFingerprint(registry.get('demo')),
        directory:join(stateDir,'work','demo','fix-test-0123456789ab')})
      expect(result.execution?.localProjectError).toBeUndefined()
    } finally {rmSync(base,{recursive:true,force:true})}
  })
  it('fails closed when local-only Ticket has no project selection or registry',()=>{
    const settings=SettingsSchema.parse({sources:{github:{enabled:false,config:{}}}})
    const create=(text:string)=>new DshExecutor({store:{settings:()=>settings,tickets:{open:()=>[]},triggers:{get:()=>({text})}},
      effects:{handle:()=>{}},machine:{stateDir:'/tmp/dsh-test-project-selector'},localOnly:()=>true} as never)
      .prepare(ticket(text),outcome).execution
    expect(create('Please fix a file')?.localProjectError).toMatch(/Select a registered local project/)
    expect(create('/project unknown\nPlease fix')?.localProjectError).toMatch(/not registered/)
  })
  it('does not hijack an original 3080 DSH Workspace or start an unrelated Ticket Worker',()=>{
    const existingDshProjects=parseDshCatalog({
      version:1,origin:'dsh-host',hostId:'mac-dsh-3080',collectedAt:new Date().toISOString(),
      workspaces:[{workspaceId:'original-workspace-xyz',title:'My Existing Project',
        path:'/Users/example/project',sessionIds:['original-session-with-history']}]
    })
    const settings=SettingsSchema.parse({sources:{github:{enabled:false,config:{}}}})
    const create=(text:string)=>new DshExecutor({store:{settings:()=>settings,tickets:{open:()=>[]},
      triggers:{get:()=>({text})}}, effects:{handle:()=>{}},
      machine:{stateDir:'/tmp/isolated-staging'},existingDshProjects,localOnly:()=>true} as never)
      .prepare(ticket(text),outcome).execution
    const explicit=create('/project '+existingDshProjects[0]!.projectId+'\n继续这个旧项目')
    expect(explicit?.projectId).toBeUndefined()
    expect(explicit?.localProjectError).toMatch(/authenticated delegation|3080 Session/)
    const named=create('继续《My Existing Project》项目')
    expect(named?.localProjectError).toMatch(/authenticated delegation|3080 Session/)
    const fresh=create('/new-project a-fresh-idea')
    expect(fresh?.localProjectError).toMatch(/New project requested/)
  })
  it('retains historical GitHub behavior without an explicit local selector',()=>{
    const settings=SettingsSchema.parse({})
    const executor=new DshExecutor({store:{settings:()=>settings,tickets:{open:()=>[]},
      triggers:{get:()=>({text:'Please fix the GitHub repository'})}},
      effects:{handle:()=>{}},machine:{stateDir:'/tmp/dsh-test-selector'},localOnly:()=>false} as never)
    const result=executor.prepare(ticket('GitHub request'),outcome)
    expect(result.execution?.projectId).toBeUndefined()
    expect(result.execution?.localProjectError).toBeUndefined()
    expect(result.execution?.directory).toContain('/work/fix-test-0123456789ab')
  })
})
