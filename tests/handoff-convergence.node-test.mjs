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

/*
 * A done receipt is a structured statement of a scoped outcome, NOT a magic
 * pass string somewhere in arbitrary prose. Offline and operator-authorized I2
 * live staging have disjoint, explicitly allowlisted verdict classes.
 */
const I2_SCOPE='CONDITIONAL_I2_OS_ISOLATED_DISPOSABLE_STAGING_ONE_SHOT'
const I2_STATE_SCOPE='CONDITIONAL_ONE_SHOT_OS_ISOLATED_DISPOSABLE_DSH_I2'
const I2_VERDICTS=new Set([
  'I2_ISOLATED_STAGING_PASS',
  'I2_PARTIAL_NO_EDIT',
  'I2_PARTIAL_NO_REAL_TOOL_TURN',
  'I2_AMBIGUOUS_FREEZE',
  'I2_BLOCKED_NO_OS_ISOLATION',
  'I2_BLOCKED_STARTUP_API_UNKNOWN',
  'I2_BLOCKED_MODEL_ROUTE',
  'I2_BLOCKED_BUDGET_ENFORCEMENT',
  'I2_BLOCKED_INSTALLED_API',
  'I2_BLOCKED_TOOL_SCOPE',
  'I2_BLOCKED_APPROVAL_POLICY',
])
const OFFLINE_VERDICTS=new Set([
  'ALL_OFFLINE_PASS', 'OFFLINE_BLOCKED_API', 'OFFLINE_BLOCKED_ENV', 'OFFLINE_FAIL'
])
const scopeVerdict=(scope,verdict)=>
  scope==='OFFLINE_SYNTHETIC_ONLY' ? OFFLINE_VERDICTS.has(verdict)
  : scope===I2_SCOPE ? I2_VERDICTS.has(verdict)
  : false
const field=(body,name)=>{
  const prefix=name+': '
  const matches=body.split(/\r?\n/).filter(line=>line.startsWith(prefix))
  assert.equal(matches.length,1,'expected exactly one '+name+' field')
  const value=matches[0].slice(prefix.length).trim()
  assert.match(value,/^[A-Za-z0-9_.-]+$/,'malformed '+name+' field')
  return value
}
const doneReceipt=(id)=>{
  const body=read('agent-handoff/receipts/local/'+id+'-done.md')
  assert.equal(field(body,'message_id'),id)
  assert.equal(field(body,'status'),'done')
  const scope=field(body,'scope'), verdict=field(body,'verdict')
  assert.ok(scopeVerdict(scope,verdict),'invalid done verdict '+verdict+' for scope '+scope)
  assert.match(field(body,'code_sha'),/^[0-9a-f]{40}$/)
  return {scope,verdict,sha:field(body,'code_sha')}
}

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
  assert.ok(scopeVerdict(
    doneReceipt(state.last_accepted_local.task_id).scope,
    state.last_accepted_local.verdict
  ),'last accepted verdict must be legal for the original task scope')
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
    const receipt=doneReceipt(pending)
    assert.equal(receipt.sha,state.local_batch.code_sha)
    if(state.local_batch.scope===I2_STATE_SCOPE) assert.equal(receipt.scope,I2_SCOPE)
    else assert.equal(receipt.scope,'OFFLINE_SYNTHETIC_ONLY')
    const resultMessages=readdirSync(path('agent-handoff/messages/to-online')).filter(name=>
      name.includes('-lo'+pending.slice(-3)+'-'))
    assert.equal(resultMessages.length,1,'exactly one local result for completed task')
    const resultBody=read('agent-handoff/messages/to-online/'+resultMessages[0])
    assert.equal(field(resultBody,'message_id'),resultId)
    assert.equal(field(resultBody,'verdict'),receipt.verdict)
  }
  assert.ok(existsSync(path(state.last_accepted_local.online_ack)))
  assert.ok(read(state.last_accepted_local.online_ack).includes(result))
  assert.ok(existsSync(path('agent-handoff/receipts/local/'+id+'-claimed.md')))
  assert.ok(existsSync(path('agent-handoff/receipts/local/'+id+'-done.md')))
  const accepted=doneReceipt(id)
  assert.equal(accepted.verdict,state.last_accepted_local.verdict)
  if(state.last_accepted_local.source_code_sha)
    assert.equal(accepted.sha,state.last_accepted_local.source_code_sha)
})
test('historical long documents remain losslessly archived and active state is short',()=>{
  for(const p of ['agent-handoff/CURRENT_STATE.md','agent-handoff/WORK_QUEUE.md'])
    assert.ok(statSync(path(p)).size<12000,p+' too large: move history to archive')
  assert.ok(statSync(path('agent-handoff/archive/CURRENT_STATE-through-OL040-2026-11-14.md')).size>100000)
  assert.ok(statSync(path('agent-handoff/archive/WORK_QUEUE-through-OL040-2026-11-14.md')).size>100000)
  if(state.active_local_task){
    assert.ok(read('LOCAL_AGENT_TASK.md').includes(state.active_local_task))
    assert.equal(state.local_batch.host_live_grant,'NOT_GRANTED')
    assert.match(state.local_batch.code_sha,/^[0-9a-f]{40}$/)
    assert.ok(read('LOCAL_AGENT_TASK.md').includes(state.local_batch.code_sha))
    const sequence=state.active_local_task.slice(-3)
    const messages=readdirSync(path('agent-handoff/messages/to-local')).filter(name=>name.includes('-ol'+sequence+'-'))
    assert.equal(messages.length,1)
    const taskMessage=read('agent-handoff/messages/to-local/'+messages[0])
    assert.ok(taskMessage.includes('message_id: '+state.active_local_task))
    assert.ok(taskMessage.includes('code_sha: '+state.local_batch.code_sha))
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

test('verdict guards reject dishonest pass/partial mixing and prose marker spoofing',()=>{
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','ALL_OFFLINE_PASS'),true)
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','I2_PARTIAL_NO_EDIT'),false)
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','OFFLINE_BLOCKED_API'),true)
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','OFFLINE_BLOCKED_ENV'),true)
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','OFFLINE_FAIL'),true)
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','OFFLINE_ANYTHING'),false)
  assert.equal(scopeVerdict(I2_SCOPE,'OFFLINE_BLOCKED_API'),false)
  assert.equal(scopeVerdict(I2_SCOPE,'I2_BLOCKED_INSTALLED_API'),true)
  assert.equal(scopeVerdict(I2_SCOPE,'I2_BLOCKED_TOOL_SCOPE'),true)
  assert.equal(scopeVerdict(I2_SCOPE,'I2_BLOCKED_APPROVAL_POLICY'),true)
  assert.equal(scopeVerdict('OFFLINE_SYNTHETIC_ONLY','I2_BLOCKED_TOOL_SCOPE'),false)
  assert.equal(scopeVerdict(I2_SCOPE,'I2_PARTIAL_NO_EDIT'),true)
  assert.equal(scopeVerdict(I2_SCOPE,'I2_ISOLATED_STAGING_PASS'),true)
  assert.equal(scopeVerdict(I2_SCOPE,'ALL_OFFLINE_PASS'),false)
  assert.equal(scopeVerdict(I2_SCOPE,'I2_BYPASS_PRODUCTION'),false)
  assert.equal(scopeVerdict('UNKNOWN_FUTURE_SCOPE','I2_PARTIAL_NO_EDIT'),false)
  assert.throws(()=>field(['verdict: I2_PARTIAL_NO_EDIT','verdict: ALL_OFFLINE_PASS'].join(String.fromCharCode(10)),'verdict'))
  assert.throws(()=>field('the body says ALL_OFFLINE_PASS','verdict'))
})
