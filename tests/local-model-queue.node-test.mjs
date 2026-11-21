import test from 'node:test'
import assert from 'node:assert/strict'
import { ModelEndpointQueue, ModelQueueRegistry, QueueBusyError, QueueWaitTimeoutError } from '../src/local-first/model-queue.ts'
import { selectRoute } from '../src/local-first/model-routing.ts'
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

test('one endpoint accepts only one active call, across different callers', async () => {
  const queue = new ModelEndpointQueue(1), entered = [], gates = [deferred(), deferred()]
  const first = queue.run(async () => { entered.push('assessment'); await gates[0].promise; return 1 })
  const second = queue.run(async () => { entered.push('worker'); await gates[1].promise; return 2 })
  await tick(); assert.deepEqual(entered, ['assessment']); assert.equal(queue.snapshot().pending,1)
  gates[0].resolve(); assert.equal(await first,1); await tick(); assert.deepEqual(entered,['assessment','worker'])
  gates[1].resolve(); assert.equal(await second,2); await tick(); assert.equal(queue.snapshot().running,0)
})
test('priority selection is fair and background work is not starved', async () => {
  const queue = new ModelEndpointQueue(1,10,2), gate = deferred(), order = []
  const blocker = queue.run(async () => gate.promise)
  const bg = queue.run(async () => { order.push('bg') }, { priority:'background' })
  const urgent = Array.from({length:4},(_,i)=>queue.run(async()=>{order.push(i)},{priority:'interactive'}))
  gate.resolve(); await Promise.all([blocker,bg,...urgent])
  assert.deepEqual(order,[0,1,'bg',2,3])
})
test('pending abort/timeout never consume a model slot', async () => {
  const q = new ModelEndpointQueue(1), gate=deferred(), ctrl=new AbortController()
  const active=q.run(async()=>gate.promise)
  const aborted=q.run(async()=>assert.fail('must not start'),{signal:ctrl.signal})
  const timed=q.run(async()=>assert.fail('must not start'),{waitTimeoutMs:5})
  ctrl.abort()
  await assert.rejects(aborted,{name:'AbortError'})
  await assert.rejects(timed,QueueWaitTimeoutError)
  assert.equal(q.snapshot().pending,0); gate.resolve(); await active
})
test('aborting a RUNNING request does not release its slot until settlement',async()=>{
  const q=new ModelEndpointQueue(1), gate=deferred(), ctrl=new AbortController(), order=[]
  const a=q.run(async(signal)=>{order.push('first'); await gate.promise; assert.equal(signal.aborted,true)},{signal:ctrl.signal})
  const b=q.run(async()=>{order.push('second')})
  await tick();ctrl.abort();await tick();assert.deepEqual(order,['first'])
  gate.resolve();await Promise.all([a,b]);assert.deepEqual(order,['first','second'])
})
test('bounded queue rejects overload and endpoint IDs share queues', async()=>{
  const registry=new ModelQueueRegistry({primary:{concurrency:1,maxPending:1}})
  assert.equal(registry.queue('primary'),registry.queue('primary'))
  assert.throws(()=>registry.queue('unknown'))
  const q=registry.queue('primary'),gate=deferred()
  const a=q.run(async()=>gate.promise), b=q.run(async()=>2)
  await assert.rejects(q.run(async()=>3),QueueBusyError)
  gate.resolve();await Promise.all([a,b])
})
test('routing forbids automatic cloud spend and private data egress',()=>{
  const routes=[
    {id:'primary',model:'qwen',priority:1,local:true,costPerMillionOutputTokensUsd:0,capabilities:['tools'],healthy:false,enabled:true},
    {id:'cloud',model:'paid',priority:2,local:false,costPerMillionOutputTokensUsd:10,capabilities:['tools'],healthy:true,enabled:true},
  ]
  assert.equal(selectRoute(routes,{requiredCapabilities:['tools']}).selected,null)
  assert.equal(selectRoute(routes,{dataPolicy:'cloud-allowed',allowPaid:true,maxOutputCostUsd:.01}).selected,null)
  assert.equal(selectRoute(routes,{dataPolicy:'cloud-allowed',allowPaid:true,maxOutputCostUsd:.1}).selected?.id,'cloud')
  assert.equal(selectRoute(routes,{dataPolicy:'cloud-allowed',allowPaid:true,maxOutputCostUsd:1,requiredCapabilities:['vision']}).selected,null)
  routes[0].healthy=true
  assert.equal(selectRoute(routes,{dataPolicy:'cloud-allowed',allowPaid:true,maxOutputCostUsd:1}).selected?.id,'primary')
})
