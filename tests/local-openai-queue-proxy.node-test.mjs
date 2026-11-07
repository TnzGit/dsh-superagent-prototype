import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createOpenAIQueueProxy } from '../src/local-first/openai-queue-proxy.ts'
const TOKEN = 'test-local-queue-proxy-client-key-32-chars-long'
const UPSTREAM_TOKEN = 'upstream-secret-not-client-token'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function fixtures(upstreamHandler, body) {
  const upstream = createServer(upstreamHandler)
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const { server, queue } = createOpenAIQueueProxy({
    upstreamBase: 'http://127.0.0.1:' + upstream.address().port + '/v1',
    clientKey: TOKEN, upstreamKey: UPSTREAM_TOKEN, concurrency: 1, maxPending: 3,
    waitTimeoutMs: 150, upstreamTimeoutMs: 3000, maxBodyBytes: 1024,
  })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  const headers = {Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'}
  try { await body({base,headers,queue}) }
  finally { await new Promise(resolve => server.close(resolve)); await new Promise(resolve => upstream.close(resolve)) }
}
test('one concurrent inference across all requests with opaque upstream credentials',async()=>{
  let concurrent=0, peak=0, calls=0
  await fixtures(async(req,res)=>{
    assert.equal(req.headers.authorization,'Bearer '+UPSTREAM_TOKEN)
    if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'qwen-local'}]}));return}
    let raw='';for await(const chunk of req) raw+=chunk
    assert.equal(JSON.parse(raw).model,'qwen-local')
    concurrent++;peak=Math.max(peak,concurrent);calls++;await delay(25)
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({choices:[{message:{content:'OK'}}]}));concurrent--
  },async({base,headers,queue})=>{
    assert.equal((await (await fetch(base+'/v1/models',{headers})).json()).data[0].id,'qwen-local')
    const requests=Array.from({length:3},()=>fetch(base+'/v1/chat/completions',{method:'POST',headers,
      body:JSON.stringify({model:'qwen-local',messages:[{role:'user',content:'test'}]})}).then(x=>x.json()))
    const responses=await Promise.all(requests)
    assert.equal(responses.every(x=>x.choices?.[0].message.content==='OK'),true)
    assert.equal(peak,1);assert.equal(calls,3);assert.equal(queue.snapshot().pending,0)
  })
})
test('unauthorized, invalid route, query, and missing body do not reach inference endpoint',async()=>{
  let calls=0
  await fixtures(async(_req,res)=>{calls++;res.end('{}')},async({base,headers})=>{
    assert.equal((await fetch(base+'/health')).status,401)
    assert.equal((await fetch(base+'/health',{headers:{Authorization:'Bearer bad'}})).status,401)
    assert.equal((await fetch(base+'/health',{headers})).status,200)
    assert.equal((await fetch(base+'/v1/chat/completions?secret=oops',{headers})).status,404)
    assert.equal((await fetch(base+'/v1/model/other',{headers})).status,404)
    assert.equal((await fetch(base+'/v1/chat/completions',{headers})).status,405)
    assert.equal(calls,0)
  })
})
test('SSE response is not truncated and keeps model slot until finished',async()=>{
  let active=0,max=0
  await fixtures(async(_req,res)=>{
    active++;max=Math.max(max,active)
    res.writeHead(200,{'Content-Type':'text/event-stream'})
    res.write('data: {"delta":"a"}\n\n')
    await delay(30);res.end('data: [DONE]\n\n');active--
  },async({base,headers})=>{
    const send=()=>fetch(base+'/v1/chat/completions',{method:'POST',headers,body:'{}'}).then(async x=>{
      assert.equal(x.headers.get('content-type'),'text/event-stream')
      return x.text()
    })
    const result=await Promise.all([send(),send()])
    assert.equal(max,1);for(const s of result){assert.match(s,/delta/);assert.match(s,/\[DONE\]/)}
  })
})
test('pending client abort is canceled and never hits upstream',async()=>{
  let resolveHold;const hold=new Promise(r=>resolveHold=r),seen=[]
  await fixtures(async(req,res)=>{
    seen.push(req.url)
    if(seen.length===1)await hold
    res.setHeader('Content-Type','application/json');res.end('{}')
  },async({base,headers,queue})=>{
    const send=(signal)=>fetch(base+'/v1/responses',{method:'POST',headers,body:'{}',signal})
    const first=send()
    while(queue.snapshot().running!==1) await delay(5)
    const ctrl=new AbortController(), pending=send(ctrl.signal)
    while(queue.snapshot().pending!==1)await delay(5)
    ctrl.abort()
    await assert.rejects(pending,{name:'AbortError'})
    await delay(20)
    assert.equal(queue.snapshot().pending,0);assert.equal(seen.length,1)
    resolveHold();assert.equal((await first).status,200)
  })
})
test('oversized requests and queue exhaustion fail without forwarding secrets or prompts',async()=>{
  let resolveHold; const hold=new Promise(r=>resolveHold=r)
  await fixtures(async(_req,res)=>{await hold;res.end('{}')},async({base,headers,queue})=>{
    const bad=await fetch(base+'/v1/responses',{method:'POST',headers,body:'x'.repeat(2048)})
    assert.equal(bad.status,413)
    const first=fetch(base+'/v1/responses',{method:'POST',headers,body:'{}'})
    while(queue.snapshot().running!==1) await delay(5)
    const pending=Array.from({length:3},()=>fetch(base+'/v1/responses',{method:'POST',headers,body:'{}'}))
    while(queue.snapshot().pending!==3) await delay(5)
    const overload=await fetch(base+'/v1/responses',{method:'POST',headers,body:'{}'})
    assert.equal(overload.status,429)
    resolveHold();const response=await Promise.all([first,...pending]);assert.equal(response.every(r=>r.ok),true)
  })
})
