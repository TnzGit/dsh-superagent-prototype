// @ts-nocheck
/**
 * I1E vertical source integration: actual Engine + DshExecutor + Sessions +
 * AgentDelivery + project snapshot + core Outbox, with a disposable simulated
 * DSH SessionController/workspaceRegistry/persistence/Agent.
 *
 * This is NOT a real DSH Agent turn/model inference, original host,
 * native Weixin, OS sandbox or source Apply. The fake provider resolves only
 * a synthetic routing identity, never opens a network connection.
 */
import { test, expect, vi } from 'vitest'
vi.mock('@deepseek-ai/dsh-scope', async importOriginal => ({
  ...await importOriginal(), scopeParentOf: () => undefined
}))
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Engine, MemoryRepositories } from '../src/core/index.ts'
import { DshExecutor, workerSessionId } from '../src/executor/dsh.ts'
import { Sessions } from '../src/app/sessions.ts'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
import { previewNonGitProjectChanges } from '../src/local-first/project-workspaces.ts'
import { SettingsSchema } from '../src/policy.ts'
import { pollNativeWeixin, nativeWeixinKind } from '../src/sources/weixin-native.ts'
import { messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'
import { KV } from '../src/kv.ts'
import { Store } from '../src/app/store.ts'
import { Outbox } from '../src/app/outbox.ts'

test.each([
  { name: 'I1E synthetic chat Engine→Ticket→Worker→preview→Outbox no source write', native: false },
  { name: 'I3 offline real native Weixin poll→Engine→Ticket→Worker→ready→durable pending Outbox', native: true }
])('$name', async ({native}) => {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-i1e-vertical-')))
  const stateDir = join(parent,'state'), projectHome=join(parent,'registered'), source=join(projectHome,'fixture')
  mkdirSync(stateDir,{recursive:true,mode:0o700})
  mkdirSync(source,{recursive:true,mode:0o700})
  writeFileSync(join(source,'before.txt'), 'ORIGINAL\n')
  writeFileSync(join(source,'to-delete.txt'), 'DELETE ONLY IN COPY\n')
  writeFileSync(join(source,'.env'), 'FIXTURE SECRET EXCLUDED\n', {mode:0o600})
  const registry = new LocalProjectRegistry([projectHome], [{id:'fixture',root:source,kind:'local'}])
  const repo = new MemoryRepositories(), effects = new Map(), queue = []
  const agents = new Map(), history = new Map(), events = new Map(), workspaceEntities = new Map()
  const modelCalls=[], madeSessions=[], workspaces=[], permissions=[], restrictions=[], guards=[], deliveries=[], outbox=[]
  let flushes = 0, engine
  const settings = SettingsSchema.parse({sources:{github:{enabled:false,config:{}}}})
  const now='2026-11-18T00:00:00.000Z'
  const context = {
    agents:{get:id=>agents.get(id)},
    get:()=>undefined,logger:{warn:()=>{}},
    on:(name,cb)=>{events.set(name,[...events.get(name)??[],cb]);return()=>{}},
    subprocess:{spawn:({argv,cwd})=>{
      expect(argv.slice(0,3)).toEqual(['git','config','-z'])
      expect(cwd.startsWith(stateDir)).toBe(true)
      return {done:Promise.resolve({exitCode:1}),collected:{
        stdout:{readFrom:()=>({text:''})},stderr:{readFrom:()=>({text:''})}}}
    }},
    llm:{resolveCallConfig:async cfg=>{modelCalls.push(cfg);return cfg}},
    permissionPresets:{set:(session,preset)=>permissions.push({sessionId:session.id,preset})},
    workspaceRegistry:{
      create:async cwd=>{workspaces.push(cwd);const workspace={id:'offline-workspace-'+workspaces.length,path:cwd,sessionIds:[]};workspaceEntities.set(cwd,workspace);return workspace},
      resolveByPath:async cwd=>workspaceEntities.get(cwd),
      list:()=>[...workspaceEntities.values()]
    },
    sessionPersistence:{
      flush:async()=>{flushes++},
      open:async id=>({read:async(offset,limit)=>({events:(history.get(id)??[]).slice(offset,offset+limit)}),
        async [Symbol.asyncDispose]() {}})
    }
  }
  const createAgent=(id,preset,cwd)=>{
    const storedEvents=[], hooks=[]
    const session={id,header:{agentPreset:preset,cwd},
      snapshotEvents:()=>[...storedEvents],requestHeader:()=>null,
      append:(type,data)=>{const evt={type,data};storedEvents.push(evt);return evt}
    }
    const inbox={nextTurn:[],nextStep:[],remove:msgId=>{
      for(const group of [inbox.nextTurn,inbox.nextStep]){const i=group.findIndex(m=>m.id===msgId);if(i>=0)group.splice(i,1)}
    }}
    const agentContext={
      systemPrompt:{section:()=>()=>{}},
      inject:(_services,cb)=>{cb({skills:{register:()=>()=>{}}});return Object.assign(Promise.resolve(),{dispose:async()=>{}})},
      tools:{
        get:name=>['read','write','edit','bash','glob','grep','subagent','schedule_task'].includes(name),
        register:()=>()=>{},
        restrict:opts=>{restrictions.push({id,allow:opts.allow});return()=>{}},
        guard:fn=>{guards.push({id,fn});return()=>{}}
      },
      on:()=>()=>{},
      effect:fn=>{hooks.push(fn())}
    }
    const agent={id,session,ctx:agentContext,status:'idle',inbox,
      followup:message=>{inbox.nextTurn.push(message);deliveries.push({id,kind:'queue',message})},
      steer:message=>{inbox.nextStep.push(message);deliveries.push({id,kind:'steer',message})},
      inject:message=>deliveries.push({id,kind:'inject',message}),
      cancel:()=>{},whenIdle:async()=>{}}
    agents.set(id,agent)
    return agent
  }
  context.sessionController={
    resolveAgent:async id=>agents.has(id)?{agent:agents.get(id)}:{error:{code:'session/not-found'}},
    create:async opts=>{madeSessions.push(opts);const workspace=workspaceEntities.get(workspaces.at(-1));createAgent(opts.sessionId,opts.agentPreset,workspace?.path);workspace?.sessionIds.push(opts.sessionId)},
    rename:async()=>{}
  }
  const store={tickets:repo.tickets,triggers:repo.triggers,
    settings:()=>settings,atomic:fn=>repo.atomic(fn),afterCommit:fn=>fn()}
  const handlerOpts=new Map()
  const effectPort={handle:(name,handler,opts)=>{effects.set(name,handler);handlerOpts.set(name,opts)},
    enqueue:(name,id,payload)=>queue.push({name,id,payload}),pending:()=>false,idle:async()=>{}}
  const fakeSettings=()=>({...settings,executor:{...settings.executor,model:{provider:'fixture-local-only',model:'fixture-qwen'}}})
  const sessionHost={
    context,store:{tickets:repo.tickets,settings:fakeSettings,get:()=>undefined,set:()=>{},keys:()=>[]},
    prompts:{current:()=>({revision:0,config:{skills:{}}}),skills:()=>[],compose:()=> 'fixture-only system prompt'},
    effects:effectPort,health:{set:()=>{}},masterId:'unused-original-master',
    lifetime:new AbortController().signal,closing:()=>false,environment:()=>[],tools:()=>[]
  }
  const sessions=new Sessions(sessionHost)
  const host={
    context,store,sessions,effects:effectPort,machine:{stateDir},localProjects:registry,
    localOnly:()=>true,lifetime:sessionHost.lifetime,
    closing:()=>false,paused:()=>false,environment:()=>[],sourceLink:async()=>({}),repliedTo:()=>undefined,
    health:{get:()=>undefined,set:()=>{}},
    get engine(){return engine}
  }
  const executor=new DshExecutor(host)
  const candidates=[]
  // Actual application Outbox persists receipts in disposable SQLite, but the
  // Source is uninstalled: delivery is NEVER initiated on a real transport.
  const receiptStore = new Store(join(stateDir,'offline-outbox.sqlite'))
  const realOutbox = new Outbox({
    store: {atomic:fn=>receiptStore.atomic(fn), receipts:receiptStore.receipts},
    effects:effectPort,
    sources: {
      instance:()=>undefined,
      channelAllowed:()=>false,
      send:async()=>{throw Error('I3 OFFLINE: real message delivery forbidden')}
    },
    commands:{} as never, paused:()=>false
  })
  const outboxPort={
    send:msg=>{if(!outbox.some(x=>x.id===msg.id))outbox.push(msg);realOutbox.send(msg)},
    status:id=>realOutbox.status(id),withdraw:id=>realOutbox.withdraw(id)
  }
  const policy={version:'fixture-v1',paused:false,evalTimeoutMs:60000,
    gate:()=>({admissible:true,strength:'explicit',basis:{via:'fixture'}}),
    revalidate:()=>true,admitsInferred:()=>false}
  engine=new Engine({repo,policy:()=>policy,scope:{scope:()=>({listened:true,observed:false})},
    assessor:{request:x=>candidates.push(x),release:()=>{}},executor,outbox:outboxPort,
    prepareTicket:(ticket,outcome)=>executor.prepare(ticket,outcome),now:()=>now})
  const input={
    message_id:'fixture-msg',from_user_id:'synthetic-peer',message_type:1,message_state:2,
    create_time_ms:Date.parse(now),context_token:'ONLY_SYNTHETIC_CONTEXT',
    item_list:[{type:1,text_item:{text:'/project fixture\nEdit isolated copy only'}}]
  }
  const trigger=native ? messageToTrigger(input)! : {
    id:'fixture-msg',source:'chat',
    threads:[{source:'chat',id:'fixture-thread'}],actor:{source:'chat',id:'human-fixture'},
    human:true,addressed:'direct',at:now,text:'/project fixture\nEdit isolated copy only',
    channel:{source:'chat',thread:'fixture-thread',address:{peer:'offline-only'}},meta:{}}
  try{
    if(native){
      const credentialsFile=join(parent,'SYNTHETIC-NOT-REAL-credentials.json')
      writeFileSync(credentialsFile, JSON.stringify({
        token:'this-is-a-fake-only-bot-token-not-usable',
        baseUrl:'https://ilinkai.weixin.qq.com'
      }), {mode:0o600})
      vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE',credentialsFile)
      const stopped=new AbortController(), sourceState=new Map()
      let fetchCalls=0, deliveredToEngine=0
      vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
        expect(String(url)).toBe('https://ilinkai.weixin.qq.com/ilink/bot/getupdates')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body).get_updates_buf).toBe('')
        fetchCalls++
        return new Response(JSON.stringify({
          ret:0,errcode:0,msgs:[input],get_updates_buf:'synthetic-next-cursor',
          longpolling_timeout_ms:1000
        }),{status:200,headers:{'content-type':'application/json'}})
      }))
      const sourceCtx={
        ready:Promise.resolve(),configured:()=>true,
        config:()=>nativeWeixinKind.schema.parse({allowedPeers:[{id:'synthetic-peer'}]}),
        state:{
          get:key=>sourceState.get(key),
          set:(key,value)=>{if(value===undefined)sourceState.delete(key);else sourceState.set(key,value)}
        },
        receive:received=>{deliveredToEngine++;return engine.receive(received)},
        threads:{describe:()=>{}},
        report:(_source,health)=>{if(health.state==='ready'||health.state==='error')stopped.abort()}
      }
      await pollNativeWeixin(sourceCtx,stopped.signal)
      expect(fetchCalls).toBe(1)
      expect(deliveredToEngine).toBe(1)
      expect(sourceState.get(KV.weixin.nativeCursor)).toBe('synthetic-next-cursor')
      expect(repo.triggers.get(trigger.id)?.channel.source).toBe('weixin')
    }else engine.receive(trigger)
    engine.evaluateDue()
    const candidate=candidates.at(-1)
    expect(candidate).toBeDefined()
    const decision=engine.decide(trigger.id,{
      evalId:candidate.evalId,kind:'accept',title:'Project fixture isolated task',
      scope:'fixture-only',reason:'offline explicit',name:'fixture',acknowledgement:'accepted fixture'
    })
    const ticket=repo.tickets.get(decision.ticketId)
    expect(ticket.execution.projectId).toBe('fixture')
    expect(outbox.filter(x=>x.kind==='acknowledgement')).toHaveLength(1)
    while(queue.length){
      const item=queue.shift()
      // Durable Outbox receipts remain pending while the channel Source is
      // OFF; never dispatch reply effects in a fake-I3 test.
      if(item.name==='reply')continue
      await effects.get(item.name)(item.payload)
    }
    const sessionId=workerSessionId(ticket.id)
    const worker=agents.get(sessionId)
    expect(worker).toBeDefined()
    expect(madeSessions).toMatchObject([{sessionId,agentPreset:'dsh-superagent-worker'}])
    expect(workspaces).toEqual([ticket.execution.directory])
    expect(modelCalls).toEqual([{provider:'fixture-local-only',model:'fixture-qwen'}])
    expect(permissions).toEqual([{sessionId,preset:'workspace-write'}])
    const allow=restrictions.find(x=>x.id===sessionId).allow
    expect(allow).toContain('write')
    expect(allow).not.toContain('schedule_task')
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].message.id).toBe(sessions.promptedId('assignment:'+ticket.id))
    expect(deliveries[0].message.source.kind).toBe('dsh-superagent')
    expect(JSON.parse(deliveries[0].message.content[0].text)).toMatchObject({
      ticket_id:ticket.id,project_id:'fixture',workspace_mode:'isolated-snapshot',source_write:'forbidden'
    })
    expect(await sessions.holds(sessionId,'assignment:'+ticket.id)).toBe(true)
    await sessions.prompt(sessionId,'assignment:'+ticket.id,'DUPLICATE MUST NOT DELIVER','queue')
    expect(deliveries).toHaveLength(1)
    expect(repo.tickets.get(ticket.id).assignments[0].state).toBe('running')
    const isolated=ticket.execution.directory
    expect(readFileSync(join(isolated,'before.txt'),'utf8')).toBe('ORIGINAL\n')
    expect(existsSync(join(isolated,'.env'))).toBe(false)
    writeFileSync(join(isolated,'before.txt'),'ISOLATED AFTER\n')
    rmSync(join(isolated,'to-delete.txt'))
    writeFileSync(join(isolated,'added.txt'),'ISOLATED ADDED\n')
    const preview=await previewNonGitProjectChanges({registry,projectId:'fixture',directory:isolated,
      fingerprint:ticket.execution.projectFingerprint})
    expect(preview.changes.map(c=>[c.path,c.action])).toEqual([
      ['added.txt','add'],['before.txt','modify'],['to-delete.txt','delete']
    ])
    engine.report(ticket.id,{state:'ready',summary:'Fixture preview; original unchanged'})
    const first=engine.reply({purpose:'result',ticketId:ticket.id,text:'Review pending, no source apply'})
    const replay=engine.reply({purpose:'result',ticketId:ticket.id,text:'Review pending, no source apply'})
    expect(replay.id).toBe(first.id)
    expect(replay.reused).toBe(true)
    expect(outbox.filter(x=>x.kind==='reply')).toHaveLength(1)
    expect(realOutbox.status(first.id)).toBe('pending')
    expect(realOutbox.status(outbox.find(x=>x.kind==='acknowledgement').id)).toBe('pending')
    expect(outbox.filter(x=>x.kind==='reply')[0].channel.source).toBe(native?'weixin':'chat')
    if(native){
      expect(outbox.filter(x=>x.kind==='reply')[0].channel.address).toMatchObject({
        peer:'synthetic-peer',contextToken:'ONLY_SYNTHETIC_CONTEXT'
      })
      // Actually invoke the real Outbox's delivery effect while Source is
      // uninstalled: it must defer, not attempt native Weixin send.
      await expect(effects.get('reply')({},first.id)).rejects.toThrow(/Source is off or not installed/)
      expect(realOutbox.status(first.id)).toBe('pending')
    }
    expect(readFileSync(join(source,'before.txt'),'utf8')).toBe('ORIGINAL\n')
    expect(readFileSync(join(source,'to-delete.txt'),'utf8')).toBe('DELETE ONLY IN COPY\n')
    expect(readFileSync(join(source,'.env'),'utf8')).toBe('FIXTURE SECRET EXCLUDED\n')
    expect(existsSync(join(source,'added.txt'))).toBe(false)
    expect(flushes).toBeGreaterThanOrEqual(2)
    expect(guards).toHaveLength(1)
  }finally{
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    executor.dispose()
    sessions.dispose()
    receiptStore.close()
    rmSync(parent,{recursive:true,force:true})
  }
})
