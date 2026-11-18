import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=dirname(dirname(fileURLToPath(import.meta.url)))
const path=(name)=>join(root,name)
const read=(name)=>readFileSync(path(name),'utf8')
const state=JSON.parse(read('agent-handoff/STATE.json'))
const getNum=(name,re)=>{const m=name.match(re);return m?Number(m[1]):-1}
const largest=(names,re)=>Math.max(-1,...names.map(n=>getNum(n,re)))

test('handoff index has bounded state and explicitly named scoped work only',()=>{
  assert.equal(state.schema_version,1)
  assert.equal(state.branch,'feat/local-first-wechat-foundation')
  assert.equal(state.phase,'INTEGRATION_CONVERGENCE')
  assert.ok(state.active_local_task===null || /^OL-\d{8}-\d{3}$/.test(state.active_local_task))
  assert.equal(state.pending_online_ack,null)
  assert.equal(state.no_auto_dispatch,true)
  assert.equal(state.remote_automation,'PAUSED_BY_OPERATOR')
  assert.equal(state.real_apply,'GATED_NO_PRODUCTION_CALLER_OR_GRANT')
  assert.match(state.source_baseline_sha,/^[0-9a-f]{40}$/)
  assert.match(state.last_accepted_local.report_commit,/^[0-9a-f]{40}$/)
  assert.equal(state.last_accepted_local.verdict,'ALL_OFFLINE_PASS')
})
test('last accepted result is acked and a newer OL is at most one and independently scoped',()=>{
  const id=state.last_accepted_local.task_id
  const result=state.last_accepted_local.result_id
  const taskN=getNum(id,/^OL-\d{8}-(\d{3})$/)
  assert.ok(taskN>0)
  assert.equal(taskN,getNum(result,/^LO-\d{8}-(\d{3})$/))
  const pending=state.active_local_task
  const latest=pending?getNum(pending,/^OL-\d{8}-(\d{3})$/):taskN
  assert.ok(latest===taskN || latest===taskN+1)
  assert.equal(largest(readdirSync(path('agent-handoff/messages/to-local')), /-ol(\d{3})-/),latest)
  const inbound=largest(readdirSync(path('agent-handoff/messages/to-online')),/-lo(\d{3})-/)
  // The local report and done receipt are committed before the remote ACK:
  // only that one exact unacknowledged OL may be in a mid-sync state.
  const done=pending && existsSync(path('agent-handoff/receipts/local/'+pending+'-done.md'))
  assert.equal(inbound,done?latest:taskN)
  if(done){
    const resultId=pending.replace(/^OL-/,'LO-')
    const file='agent-handoff/receipts/online/'+resultId+'-done.md'
    assert.ok(!existsSync(path(file)),'unacknowledged result must not have an online ACK')
    assert.ok(read('agent-handoff/receipts/local/'+pending+'-done.md').includes('ALL_OFFLINE_PASS'))
  }
  assert.ok(existsSync(path(state.last_accepted_local.online_ack)))
  assert.ok(read(state.last_accepted_local.online_ack).includes(result))
  assert.ok(existsSync(path('agent-handoff/receipts/local/'+id+'-claimed.md')))
  assert.ok(existsSync(path('agent-handoff/receipts/local/'+id+'-done.md')))
  assert.ok(read('agent-handoff/receipts/local/'+id+'-done.md').includes('ALL_OFFLINE_PASS'))
})
test('historical long documents remain losslessly archived and active state is short',()=>{
  for(const p of ['agent-handoff/CURRENT_STATE.md','agent-handoff/WORK_QUEUE.md'])
    assert.ok(statSync(path(p)).size<12000,p+' too large: move history to archive')
  assert.ok(statSync(path('agent-handoff/archive/CURRENT_STATE-through-OL040-2026-11-14.md')).size>100000)
  assert.ok(statSync(path('agent-handoff/archive/WORK_QUEUE-through-OL040-2026-11-14.md')).size>100000)
  if(state.active_local_task){
    assert.ok(read('LOCAL_AGENT_TASK.md').includes(state.active_local_task))
    assert.equal(state.local_batch.host_live_grant,'NOT_GRANTED')
    assert.equal(state.local_batch.code_sha,state.integration_i1b.test_sha)
    // A claimed/done receipt with no online ACK is a valid bounded handoff transition.
    // It grants no additional host actions; STATE remains pending until the remote ACK.
  }else assert.match(read('LOCAL_AGENT_TASK.md'),/NO ACTIVE TASK/)
  assert.match(read('agent-handoff/MESSAGE_PROTOCOL.md'),/operator pause overrides automatic CI-to-task dispatch/)
})
test('convergence roadmap and OS authorization document exist without announcing real Apply',()=>{
  assert.match(read('docs/013-integration-acceptance.md'),/Gate I1/)
  assert.match(read('docs/013-integration-acceptance.md'),/Ticket/)
  assert.match(read('docs/014-real-apply-boundary.md'),/NO REAL WRITE ENABLED/)
  assert.match(read('agent-handoff/REAL_APPLY_GATES.md'),/NO REAL APPLY EXECUTION ENABLED/)
  const workflow=read('.github/workflows/local-first-core.yml')
  assert.equal((workflow.match(/tests\/handoff-convergence\.node-test\.mjs/g)||[]).length,2)
})
