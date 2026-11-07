/** Authenticated OpenClaw-native outbound delivery; no private Tencent API implementation. */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const OUTBOUND_PATH = '/plugins/dsh-weixin-bridge/outbound'
const MAX_BODY = 96 * 1024
const MAX_MESSAGE = 64000
const MAX_CHUNK = 3500
const valid = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)
const sha = text => createHash('sha256').update(text).digest('hex')
export const peerKey = (accountId, peerId) => sha(JSON.stringify([accountId,peerId]))
const write = (res, code, status) => {
  if (res.destroyed) return
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify({ status }))
}
const loopback = address => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)
const sign = (secret, ts, bytes) => 'sha256='+createHmac('sha256',secret).update(ts).update('.').update(bytes).digest('hex')

export function verifySignedOutbound(secret, timestamp, signature, bytes, now=Date.now()) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof timestamp !== 'string' ||
      !/^\d{13}$/.test(timestamp) || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature) ||
      Math.abs(now-Number(timestamp))>300000) return false
  const a=Buffer.from(signature),b=Buffer.from(sign(secret,timestamp,bytes))
  return a.length===b.length && timingSafeEqual(a,b)
}
function parse(bytes) {
  const m=JSON.parse(bytes.toString('utf8'))
  if (!m || typeof m !== 'object' || Array.isArray(m) ||
    Object.keys(m).some(k=>!['id','accountId','peerId','text'].includes(k)) ||
    !valid(m.id) || !valid(m.accountId) || !valid(m.peerId) ||
    typeof m.text !== 'string' || !m.text.trim() || m.text.length>MAX_MESSAGE) throw Error('invalid_envelope')
  return m
}
async function payload(req) {
  const items=[];let size=0
  for await(const buf of req) {
    const part=Buffer.isBuffer(buf)?buf:Buffer.from(buf)
    size+=part.length
    if(size<=MAX_BODY) items.push(part)
  }
  if(size>MAX_BODY) throw RangeError('body_too_large')
  return Buffer.concat(items)
}
/** Plain text chunks cannot exceed Tencent's nominal 4000-char sendText limit. */
export function chunks(text) {
  const points=Array.from(text), out=[]
  for(let i=0;i<points.length;i+=MAX_CHUNK) out.push(points.slice(i,i+MAX_CHUNK).join(''))
  return out
}
/**
 * Store is a persistent OpenClaw keyed store (lookup/register), not a volatile map.
 * A crash or ambiguous provider result leaves 'sending'/'unknown': NEVER auto-replay it.
 * Manual reconciliation is required rather than duplicating a recipient-visible message.
 */
export function createOutboundHandler({secret, store, peerStore, sendText, now=()=>Date.now(), log=()=>{}}) {
  if(!secret || secret.length<32 || !store?.lookup || !store?.register || !peerStore?.lookup || !sendText)
    throw Error('Outbound bridge requires secret, durable store, peer registry, and native sendText')
  const inFlight=new Map()
  return async (req,res) => {
    if(req.method!=='POST' || req.url!==OUTBOUND_PATH) {write(res,404,'not_found');return true}
    if(!loopback(req.socket?.remoteAddress)) {write(res,403,'local_only');return true}
    if(Number(req.headers['content-length'] ?? 0)>MAX_BODY) {req.resume();write(res,413,'too_large');return true}
    let raw, message
    try {
      raw=await payload(req)
      if(!verifySignedOutbound(secret,req.headers['x-dsh-timestamp'],req.headers['x-dsh-signature'],raw,now())) {
        write(res,401,'invalid_signature');return true
      }
      message=parse(raw)
    } catch(error) {write(res,error instanceof RangeError?413:400,'invalid_envelope');return true}
    const {id,accountId,peerId,text}=message
    const digest=sha(JSON.stringify([accountId,peerId,text]))
    const key=sha(JSON.stringify([id,accountId,peerId]))
    const send=async()=>{
      // A sender is permitted only if the Gateway admitted that exact account/peer previously.
      if(!(await peerStore.lookup(peerKey(accountId,peerId)))) return 'forbidden'
      const previous=await store.lookup(key)
      if(previous) return previous.digest===digest && previous.status==='sent' ? 'sent'
        : previous.digest!==digest ? 'conflict' : 'unknown'
      await store.register(key,{digest,status:'sending'})
      try {
        for(const part of chunks(text)) await sendText({accountId,peerId,text:part})
        await store.register(key,{digest,status:'sent'})
        return 'sent'
      } catch {
        // Could have sent one or more chunks before the error. Never resend automatically.
        await store.register(key,{digest,status:'unknown'}).catch(()=>{})
        return 'unknown'
      }
    }
    const existing=inFlight.get(key)
    if(existing && existing.digest!==digest) {write(res,409,'conflict');return true}
    let pending=existing?.promise
    if(!pending) {
      pending=Promise.resolve().then(send)
      inFlight.set(key,{digest,promise:pending})
      void pending.finally(()=>{if(inFlight.get(key)?.promise===pending) inFlight.delete(key)}).catch(()=>{})
    }
    try {
      const outcome=await pending
      const codes={sent:200,forbidden:403,conflict:409,unknown:409}
      write(res,codes[outcome]??503,outcome)
    } catch {
      log('outbound_state_unavailable')
      write(res,503,'state_unavailable')
    }
    return true
  }
}
