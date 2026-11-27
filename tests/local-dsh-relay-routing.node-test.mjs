import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parseDshCatalog} from '../src/local-first/existing-dsh-projects.ts'
import {textHash,approvedRelayTextMatches,isApprovedRelayTextMismatch,
  chooseApprovedNativeRelay,readNativeRelayApproval,routeAttested}
  from '../src/local-first/dsh-relay-routing.ts'
const [project]=parseDshCatalog({version:1,origin:'dsh-host',hostId:'mac-dsh-3080',
  collectedAt:'2026-11-08T00:00:00.000Z',
  workspaces:[{workspaceId:'original-1',title:'Stable Project',path:'/tmp/original',
    sessionIds:['session-1','session-2']}]})
const now=Date.now()
const trigger=text=>({
  id:'weixin-test-1',source:'weixin',human:true,addressed:'direct',
  actor:{source:'weixin',id:'peer-a'},threads:[{source:'weixin',id:'weixin:peer-a'}],
  channel:{source:'weixin',thread:'weixin:peer-a',
    address:{peer:'peer-a',messageId:'server-id',contextToken:'private-context'}},
  meta:{peer:'peer-a'},at:new Date(now).toISOString(),text
})
const approval=(text,overrides={})=>({
  version:1,approvalId:'one-shot-C3',operation:'prompt',peer:'peer-a',
  projectId:project.projectId,sessionId:'session-1',textSha256:textHash(text),
  expiresAt:new Date(now+60_000).toISOString(),operatorApproved:true,...overrides
})
const empty={boundProject:()=>undefined}
test('operator grant plus exact project AND selected Session routes only the specified task',()=>{
  const content='/project '+project.projectId+'\n/session session-1\n修复一个测试'
  const chosen=chooseApprovedNativeRelay(trigger(content),approval(content),[project],empty,now)
  assert.equal(chosen?.sessionId,'session-1')
  assert.equal(chosen?.task,'修复一个测试')
  assert.equal(chosen?.project.workspaceId,'original-1')
})
test('multi-Session Workspace is NEVER silently bound to arbitrary Session',()=>{
  const content='/project '+project.projectId+'\n修复一个测试'
  assert.equal(chooseApprovedNativeRelay(trigger(content),approval(content),[project],empty,now),undefined)
  const wrong='/project '+project.projectId+'\n/session session-2\n修复一个测试'
  assert.equal(chooseApprovedNativeRelay(trigger(wrong),approval(wrong),[project],empty,now),undefined)
})
test('confirmed-thread continuation uses durable binding, not semantic recency',()=>{
  const content='继续之前项目'
  const ledger={boundProject:()=>({project,sessionId:'session-1'})}
  assert.equal(chooseApprovedNativeRelay(trigger(content),approval(content),[project],ledger,now)?.sessionId,'session-1')
  assert.equal(chooseApprovedNativeRelay(trigger(content),approval(content),[project],empty,now),undefined)
  assert.equal(chooseApprovedNativeRelay(trigger(content),approval(content),[project],
    {boundProject:()=>({project,sessionId:'session-2'})},now),undefined)
})
test('fuzzy project, new project, wrong sender and mismatched text are never routed',()=>{
  for(const content of ['请帮我在旧项目继续做','/new-project hello','你好']){
    assert.equal(chooseApprovedNativeRelay(trigger(content),approval(content),[project],empty,now),undefined)
  }
  const text='/project '+project.projectId+'\n/session session-1\n完成'
  assert.equal(chooseApprovedNativeRelay({...trigger(text),actor:{source:'weixin',id:'other'}},
    approval(text),[project],empty,now),undefined)
  assert.equal(chooseApprovedNativeRelay(trigger(text),approval(text,{textSha256:textHash('different')}),
    [project],empty,now),undefined)
  assert.equal(chooseApprovedNativeRelay(trigger(text),approval(text),[project],empty,now+120_000),undefined)
})
test('session binding itself demands a separately operator-approved exact /bind-project command',()=>{
  const content='/bind-project '+project.projectId+' session-1'
  const chosen=chooseApprovedNativeRelay(trigger(content),approval(content,{operation:'bind'}),[project],empty,now)
  assert.equal(chosen?.operation,'bind')
  assert.equal(chosen?.task,'')
  assert.equal(chooseApprovedNativeRelay(trigger(content),approval(content),[project],empty,now),undefined)
})
test('owner-only private grant and short-lived route attestation are mandatory',()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-relay-config-'))
  try{
    const file=join(dir,'approval.json'),route=join(dir,'route.json')
    const message='/project '+project.projectId+'\n/session session-1\nhi'
    writeFileSync(file,JSON.stringify(approval(message)),{mode:0o600})
    assert.equal(readNativeRelayApproval(file)?.approvalId,'one-shot-C3')
    chmodSync(file,0o644)
    assert.throws(()=>readNativeRelayApproval(file),/owner-only/)
    assert.equal(routeAttested(undefined,'session-1',now),false)
    const att={version:1,sessionId:'session-1',provider:'llm-local-proxy',
      model:'Qwen3.8-Flash-Next',baseURL:'http://127.0.0.1:8123/v1',
      verifiedAt:new Date(now).toISOString(),operatorObserved:true}
    writeFileSync(route,JSON.stringify(att),{mode:0o600})
    assert.equal(routeAttested(route,'session-1',now),true)
    assert.equal(routeAttested(route,'session-2',now),false)
    assert.equal(routeAttested(route,'session-1',now+5*60*1000+1),false)
    chmodSync(route,0o666)
    assert.equal(routeAttested(route,'session-1',now),false)
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('V2 grant permits only two preapproved FULL literal hashes: straight versus curly quotes',()=>{
  const base='/project '+project.projectId+'\n/session session-1\n请仅回复 "OK"'
  const curly=base.replace('"OK"','“OK”')
  const v2=approval(base,{version:2,alternateTextSha256:textHash(curly)})
  assert.equal(approvedRelayTextMatches(base,v2),true)
  assert.equal(approvedRelayTextMatches(curly,v2),true)
  assert.equal(chooseApprovedNativeRelay(trigger(curly),v2,[project],empty,now)?.task,
    '请仅回复 “OK”')
  for(const other of [base+'!',curly+' ',curly.replace('OK','NO'),curly.replace('session-1','session-2')]){
    assert.equal(approvedRelayTextMatches(other,v2),false)
    assert.equal(chooseApprovedNativeRelay(trigger(other),v2,[project],empty,now),undefined)
  }
  assert.equal(chooseApprovedNativeRelay(trigger(curly),approval(base),[project],empty,now),undefined,
    'legacy V1 grants remain EXACT and do not accept quote substitution')
})
test('near-miss quarantine is bound to exact explicit project selector, peer and fresh grant',()=>{
  const text='/project '+project.projectId+'\n/session session-1\n请仅回复 "OK"'
  const curly=text.replace('"OK"','“OK”')
  const v1=approval(text)
  assert.equal(isApprovedRelayTextMismatch(trigger(curly),v1,[project],now),true)
  assert.equal(isApprovedRelayTextMismatch(trigger(text),v1,[project],now),false)
  assert.equal(isApprovedRelayTextMismatch(trigger(curly),approval(text,{
    version:2,alternateTextSha256:textHash(curly)}),[project],now),false)
  assert.equal(isApprovedRelayTextMismatch(trigger('你好'),v1,[project],now),false)
  assert.equal(isApprovedRelayTextMismatch(trigger(curly.replace(project.projectId,'dsh-other')),
    v1,[project],now),false)
  assert.equal(isApprovedRelayTextMismatch({...trigger(curly),actor:{source:'weixin',id:'other'}},
    v1,[project],now),false)
  assert.equal(isApprovedRelayTextMismatch(trigger(curly),v1,[],now),false)
  assert.equal(isApprovedRelayTextMismatch(trigger(curly),v1,[project],now+120_000),false)
})
test('private grant loader only permits V2 validated pair, V1 remains single-hash',()=>{
  const dir=mkdtempSync(join(tmpdir(),'dsh-v2-private-'))
  try{
    const file=join(dir,'grant.json')
    const original='/project '+project.projectId+'\n/session session-1\n请回复 "OK"'
    const alt=original.replace('"OK"','“OK”')
    const v2=approval(original,{version:2,alternateTextSha256:textHash(alt)})
    const load=value=>{
      writeFileSync(file,JSON.stringify(value),{mode:0o600})
      return readNativeRelayApproval(file)
    }
    assert.equal(load(v2)?.alternateTextSha256,textHash(alt))
    assert.throws(()=>load({...v2,alternateTextSha256:textHash(original)}),/Invalid operator/)
    assert.throws(()=>load({...v2,alternateTextSha256:'bad'}),/Invalid operator/)
    assert.throws(()=>load({...v2,alternateTextSha256:undefined}),/Invalid operator/)
    assert.throws(()=>load({...v2,version:1}),/Invalid operator/)
    assert.equal(load(approval(original))?.version,1)
  }finally{rmSync(dir,{recursive:true,force:true})}
})
