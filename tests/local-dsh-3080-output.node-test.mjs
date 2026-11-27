import test from 'node:test'
import assert from 'node:assert/strict'
import {
  continuationReceipt, correlateDshCompletion, trackDshContinuation, continuationWeixinReply
} from '../src/local-first/dsh-3080-output.ts'
const receipt=continuationReceipt({triggerId:'weixin-trigger-1',workspaceId:'original-ws',
  sessionId:'existing-dsh-session-1',afterSeq:10})
const event=(seq,type,data={},surfaceOp=undefined)=>({type:'event',event:{
  seq,type,time:1731022222000,data,...surfaceOp?{surfaceOp}:{}
}})
const input=event(11,'user/message',{role:'user',source:{kind:'user',rpcId:receipt.requestId},
  content:[{type:'text',text:'fix the test'}]},'append')
const assistant=event(15,'assistant/message',{message:{role:'assistant',content:[
  {type:'reasoning',text:'private reasoning never leave host'},
  {type:'text',text:'已经完成测试修复。'}]}},'append')
const end=event(16,'turn/end',{turn:1,reason:{kind:'completed'}})
const wait=(reason='idle',cursor=16)=>({reason,state:{cursor,active:false,running:false,pendingInput:[]},
  output:{records:[],truncated:false}})
const page=(records=[input,assistant,end],cursor=16,hasMore=false)=>({cursor,hasMore,records})
const trigger={id:receipt.triggerId,source:'weixin',human:true,at:'2026-11-08T13:00:00Z',
  threads:[{source:'weixin',id:'peer-a'}],actor:{source:'weixin',id:'peer-a'},text:'fix',
  meta:{},channel:{source:'weixin',thread:'peer-a',address:{peer:'peer-a',messageId:'msg-a',contextToken:'secret-context-token'}}}
test('a matching original user-rpc ID, completed turn, and assistant message allows only final text',()=>{
  const result=correlateDshCompletion(receipt,wait(),page())
  assert.equal(result.status,'completed')
  assert.equal(result.text,'已经完成测试修复。')
  assert.equal(JSON.stringify(result).includes('private reasoning'),false)
  const msg=continuationWeixinReply(trigger,receipt,result)
  assert.equal(msg.kind,'reply')
  assert.equal(msg.channel.address.contextToken,trigger.channel.address.contextToken)
  assert.equal(msg.channel.address.messageId,trigger.channel.address.messageId)
  assert.equal(msg.channel.address.peer,trigger.channel.address.peer)
  assert.equal(msg.id,continuationWeixinReply(trigger,receipt,result).id)
  assert.notEqual(msg.channel,trigger.channel)
  assert.equal(JSON.stringify(result).includes('secret-context-token'),false)
})
test('the same completion cannot be delivered to a different Weixin Trigger',()=>{
  const result=correlateDshCompletion(receipt,wait(),page())
  assert.throws(()=>continuationWeixinReply({...trigger,id:'another-msg'},receipt,result),/unverified/)
  assert.throws(()=>continuationWeixinReply({...trigger,channel:{...trigger.channel,address:{...trigger.channel.address,contextToken:''}}},receipt,result),/unverified/)
  assert.throws(()=>continuationWeixinReply({...trigger,human:false},receipt,result),/unverified/)
  assert.throws(()=>continuationWeixinReply({...trigger,source:'feishu'},receipt,result),/unverified/)
})
test('unrelated user message in same original DSH Session rejects reply leakage',()=>{
  const foreign=event(13,'user/message',{source:{kind:'user',rpcId:'different-rpc'}},'append')
  assert.equal(correlateDshCompletion(receipt,wait(),page([input,foreign,assistant,end])).status,'ambiguous')
  assert.equal(correlateDshCompletion(receipt,wait(),page([foreign,input,assistant,end])).status,'ambiguous')
  assert.equal(correlateDshCompletion(receipt,wait(),page([assistant,end])).status,'ambiguous')
})
test('replacement user nodes or a new turn after the matching completion are unsafe to relay',()=>{
  const replaced=event(11,'user/message',{source:{kind:'user',rpcId:receipt.requestId}}, {op:'replace',startSeq:3,endSeq:4})
  assert.equal(correlateDshCompletion(receipt,wait(),page([replaced,assistant,end])).status,'ambiguous')
  const nextTurn=event(17,'turn/start',{turn:2})
  assert.equal(correlateDshCompletion(receipt,wait('idle',17),page([input,assistant,end,nextTurn],17)).status,'ambiguous')
})
test('timeout, pending input, unfinished turn and aborted turns never yield Weixin text',()=>{
  assert.equal(correlateDshCompletion(receipt,wait('timeout'),page()).status,'pending')
  assert.equal(correlateDshCompletion(receipt,wait('input-required'),page()).status,'blocked')
  assert.equal(correlateDshCompletion(receipt,wait(),page([input,assistant])).status,'pending')
  assert.equal(correlateDshCompletion(receipt,wait(),page([input,assistant,event(16,'turn/end',{
    turn:1,reason:{kind:'error',error:{code:'MODEL_FAILED',message:'no'}}})])).status,'failed')
})
test('history cursor mismatch, truncation and oversized output must not leak completion',()=>{
  assert.equal(correlateDshCompletion(receipt,wait(),page([input,assistant,end],17)).status,'ambiguous')
  assert.equal(correlateDshCompletion(receipt,wait(),page([
    event(12,'user/message',{source:{kind:'user',rpcId:receipt.requestId}},'append'),assistant,end
  ],16,true)).status,'ambiguous')
  assert.equal(correlateDshCompletion(receipt,wait(),page([
    input,event(15,'assistant/message',{message:{content:[{type:'text',text:'Z'.repeat(9000)}]}},'append'),end
  ])).status,'blocked')
})
test('read-only tracker calls approved Session wait and page at exactly the same cursor',async()=>{
  const calls=[]
  const reader={
    waitForSession:async(sessionId,afterSeq)=>{calls.push(['wait',sessionId,afterSeq]);return wait()},
    pageSession:async(sessionId,throughSeq)=>{calls.push(['page',sessionId,throughSeq]);return page()}
  }
  const result=await trackDshContinuation(reader,receipt)
  assert.equal(result.status,'completed')
  assert.deepEqual(calls,[['wait',receipt.sessionId,10],['page',receipt.sessionId,16]])
})
test('pending wait never reads Session history, preventing unrelated premature reply',async()=>{
  const reader={
    waitForSession:async()=>wait('timeout'),
    pageSession:async()=>{throw Error('must not read history on timeout')}
  }
  const result=await trackDshContinuation(reader,receipt)
  assert.equal(result.status,'pending')
})
test('bad DSH wire shapes fail closed without sending or confusing request ID',async()=>{
  const invalids=[{...wait(),output:null},{...wait(),state:{cursor:-1}},
    {...wait(),reason:'invented'}]
  for(const response of invalids){
    const reader={waitForSession:async()=>response,pageSession:async()=>page()}
    const result=await trackDshContinuation(reader,receipt)
    assert.equal(result.status,'ambiguous')
    assert.equal(result.requestId,receipt.requestId)
  }
})

test('C5.4B live event order: exact RPC followed by three DSH-owned context snapshots and completion',async()=>{
  const snapshots=['runtime-context','skill-catalog','time-context'].map((kind,i)=>
    event(12+i,'user/message',{role:'user',source:{kind},
      content:[{type:'text',text:'DSH-generated context, not a human prompt'}]},'append'))
  const livePage=page([input,...snapshots,assistant,end])
  const result=correlateDshCompletion(receipt,wait(),livePage)
  assert.equal(result.status,'completed')
  assert.equal(result.requestId,receipt.requestId)
  assert.equal(result.text,'已经完成测试修复。')
  const reader={waitForSession:async()=>wait(),pageSession:async()=>livePage}
  const tracked=await trackDshContinuation(reader,receipt)
  assert.equal(tracked.status,'completed')
  assert.equal(continuationWeixinReply(trigger,receipt,tracked).text,'已经完成测试修复。')
})
test('unknown, genuine human, missing provenance and claimed context with rpcId stay ambiguous',()=>{
  const variants=[
    {source:{kind:'user'}},
    {source:{kind:'user',rpcId:'another-human-rpc'}},
    {source:{kind:'other-injected-context'}},
    {source:{kind:'runtime-context',rpcId:'another-human-rpc'}},
    {source:{kind:'skill-catalog',rpcId:receipt.requestId}},
    {source:{}},{},
  ]
  for(const v of variants){
    const event13=event(13,'user/message',v,'append')
    const result=correlateDshCompletion(receipt,wait(),page([input,event13,assistant,end]))
    assert.equal(result.status,'ambiguous',JSON.stringify(v))
    assert.equal(result.reason,'unrelated_user_message_in_continuation_window')
  }
})
test('DSH context snapshots before matching RPC, after completion, and non-append cannot authorize reply',()=>{
  const snapshot=(kind,seq,surface='append')=>
    event(seq,'user/message',{role:'user',source:{kind}},surface)
  for(const kind of ['runtime-context','skill-catalog','time-context']){
    let outcome=correlateDshCompletion(receipt,wait(),page([
      snapshot(kind,11),event(12,'user/message',input.event.data,'append'),assistant,end
    ]))
    assert.equal(outcome.status,'ambiguous',kind+' before prompt')
    outcome=correlateDshCompletion(receipt,wait('idle',17),page([
      input,assistant,end,snapshot(kind,17)
    ],17))
    assert.equal(outcome.status,'ambiguous',kind+' after completion')
    outcome=correlateDshCompletion(receipt,wait(),page([
      input,snapshot(kind,13,{op:'replace',startSeq:2,endSeq:3}),assistant,end
    ]))
    assert.equal(outcome.status,'ambiguous',kind+' non-append')
  }
})
