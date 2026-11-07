import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlugin } from '../integrations/openclaw-weixin-dsh/plugin.mjs'
import { createBridgeServer } from '../src/local-first/weixin-http.ts'
import { actorId } from '../src/local-first/weixin-envelope.ts'
const secret='test-secret-longer-than-32-characters!!'
const dispatch=(plugin,event,ctx={})=>{
  let handler
  plugin.register({on:(name,cb)=>{assert.equal(name,'before_dispatch');handler=cb}})
  return handler(event,ctx)
}
test('OpenClaw Weixin event is signed into DSH without a model turn',async()=>{
  const received=[]
  const server=createBridgeServer({secret,allowPeers:[actorId('account-1','user-1')],ingest:t=>{received.push(t)}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try {
    const plugin=createPlugin({env:{DSH_WEIXIN_BRIDGE_SECRET:secret,
      DSH_WEIXIN_BRIDGE_URL:'http://127.0.0.1:'+server.address().port+'/v1/weixin/inbound'}})
    const result=await dispatch(plugin,{channelId:'openclaw-weixin',accountId:'account-1',
      senderId:'user-1',messageId:'abc',body:'任务1',timestamp:Date.now()})
    assert.equal(result.handled,true);assert.match(result.text,/已交给/)
    assert.equal(received.length,1);assert.equal(received[0].source,'openclaw-weixin')
  } finally { await new Promise(resolve=>server.close(resolve)) }
})
test('other channels remain unaffected',async()=>{
  assert.equal(await dispatch(createPlugin({env:{}}),{channelId:'telegram',body:'hello'}),undefined)
})
test('missing identity, group traffic and failed ingress are claimed without running OpenClaw LLM',async()=>{
  const plugin=createPlugin({env:{}})
  assert.equal((await dispatch(plugin,{channelId:'openclaw-weixin',body:'hello'})).handled,true)
  assert.equal((await dispatch(plugin,{channelId:'openclaw-weixin',body:'hello',isGroup:true})).handled,true)
  const fail=createPlugin({env:{DSH_WEIXIN_BRIDGE_SECRET:secret,
    DSH_WEIXIN_BRIDGE_URL:'http://127.0.0.1:1234/v1/weixin/inbound'},fetcher:async()=>{throw Error('down')}})
  const result=await dispatch(fail,{channelId:'openclaw-weixin',accountId:'account-1',
    senderId:'user-1',messageId:'1',body:'hello'})
  assert.equal(result.handled,true);assert.match(result.text,/重试/)
})
