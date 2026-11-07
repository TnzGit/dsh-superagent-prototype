/** OpenClaw-side inbound adapter: the DeepSeek Superagent is the sole executor. */
import { createHmac } from 'node:crypto'
const CHANNEL='openclaw-weixin'
const MISSING='Superagent 通道未配置或消息缺少可信身份，请检查桥接设置。'
const UNAVAILABLE='Superagent 暂时不可用，本次请求未确认接收，请稍后重试。'
const ACCEPTED='已交给 Superagent 处理。'
function loopbackUrl(raw) {
  const url=new URL(raw)
  if(url.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname!=='/v1/weixin/inbound')
    throw new Error('DSH bridge URL must point to the local loopback inbound endpoint')
  return url.toString()
}
/** Injection makes the transport independently testable without an installed OpenClaw Gateway. */
export function createPlugin({ env=process.env, fetcher=fetch, clock=()=>Date.now() }={}) {
  return {
    id:'dsh-weixin-bridge',name:'DSH Weixin bridge',
    register(api) {
      api.on('before_dispatch',async(event,ctx)=>{
        // OpenClaw 2026.11.1: the channel name is event.channel, not event.channelId.
        // ctx.channelId identifies the channel on this hook; older host shapes are fallback only.
        if((event.channel ?? ctx.channelId ?? event.channelId ?? ctx.channel)!==CHANNEL) return undefined
        if(event.isGroup===true || ctx.isGroup===true) return {handled:true,text:'仅允许微信私聊发起任务。'}
        const accountId=event.accountId ?? ctx.accountId
        const peerId=event.senderId ?? ctx.senderId
        const messageId=event.messageId ?? ctx.messageId
        const text=event.body ?? event.content
        if(![accountId,peerId,messageId,text].every(v=>typeof v==='string' && v.length>0))
          return {handled:true,text:MISSING}
        const secret=env.DSH_WEIXIN_BRIDGE_SECRET
        if(!secret || secret.length<32 || !env.DSH_WEIXIN_BRIDGE_URL) return {handled:true,text:MISSING}
        let url
        try{url=loopbackUrl(env.DSH_WEIXIN_BRIDGE_URL)}catch{return {handled:true,text:MISSING}}
        const timestamp=String(clock())
        let receivedAt
        try { receivedAt=new Date(event.timestamp ?? clock()).toISOString() } catch { return {handled:true,text:MISSING} }
        const raw=JSON.stringify({accountId,peerId,messageId,receivedAt,text})
        const signature='sha256='+createHmac('sha256',secret).update(timestamp).update('.').update(raw).digest('hex')
        try {
          const result=await fetcher(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
            headers:{'Content-Type':'application/json','x-dsh-timestamp':timestamp,'x-dsh-signature':signature},body:raw})
          return {handled:true,text:result.status===202?ACCEPTED:UNAVAILABLE}
        }catch{
          // Failure is claimed: NEVER fall through to an unrelated OpenClaw model turn.
          return {handled:true,text:UNAVAILABLE}
        }
      })
    }
  }
}
export default createPlugin()
