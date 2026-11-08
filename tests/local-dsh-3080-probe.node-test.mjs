import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { probe } from '../scripts/probe-dsh-3080.mjs'
const workspaceId='existing-workspace'
const inventory={version:1,origin:'dsh-host',hostId:'mac-dsh-3080',collectedAt:'2026-11-08T00:00:00.000Z',
  workspaces:[{workspaceId,title:'test-label',path:'/Users/owner/proj',sessionIds:['test-1']}]}
test('C0 read-only host audit never invokes session/prompt or discloses original Session IDs/paths',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-3080-c0-'))
  try {
    const file=join(dir,'catalog.json')
    writeFileSync(file,JSON.stringify(inventory),{mode:0o600})
    const calls=[]
    const fetcher=async(url,init)=>{
      const request=JSON.parse(init.body)
      calls.push({url,method:request.method})
      assert.equal(request.method,'session/list')
      return new Response(JSON.stringify({type:'server-response',rpcId:request.rpcId,
        result:{ok:true,value:{items:[{
          sessionId:'test-1',running:false,blank:false,formatStatus:'current',
          projections:{kind:'cached',values:{
            modelSelection:{provider:'cmp170hx',model:'Qwen3.8-Flash-Next'},
            permissions:{currentValue:'workspace-write'}
          }}
        }]}}}),{status:200})
    }
    const result=await probe({catalogFile:file},{fetcher})
    assert.deepEqual(result.summary.sessionCount,1)
    assert.equal(result.summary.workspaceCount,1)
    assert.equal(result.summary.readyForLivePrompt,false)
    assert.deepEqual(calls.map(x=>x.method),['session/list'])
    const displayed=JSON.stringify(result)
    assert.equal(displayed.includes('/Users/owner/proj'),false)
    assert.equal(displayed.includes('test-1'),false)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
