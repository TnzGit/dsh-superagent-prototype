/** Signed, transport-neutral bridge envelope for Tencent openclaw-weixin. */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Trigger } from '../core/index.ts'
export interface WeixinEvent {
  accountId: string; peerId: string; messageId: string; receivedAt: string; text: string; conversationId?: string
}
export class BridgeAuthError extends Error {
  constructor(message = 'Invalid bridge authentication') { super(message); this.name = 'BridgeAuthError' }
}
const FIELD = /^[^\u0000-\u001f\u007f]{1,256}$/
export const SOURCE = 'openclaw-weixin'
export const actorId = (accountId: string, peerId: string): string =>
  encodeURIComponent(accountId) + ':' + encodeURIComponent(peerId)
export function parseEvent(body: unknown): WeixinEvent {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected a message object')
  const e = body as Record<string, unknown>
  for (const key of ['accountId', 'peerId', 'messageId'])
    if (typeof e[key] !== 'string' || !FIELD.test(e[key])) throw new Error('Invalid ' + key)
  if (typeof e.receivedAt !== 'string' || !Number.isFinite(Date.parse(e.receivedAt))) throw new Error('Invalid message timestamp')
  if (typeof e.text !== 'string' || !e.text.trim() || e.text.length > 64000) throw new Error('Empty or oversized message')
  if (e.conversationId !== undefined && (typeof e.conversationId !== 'string' || !FIELD.test(e.conversationId))) throw new Error('Invalid conversation')
  if (Object.keys(e).some(k => !['accountId','peerId','messageId','receivedAt','text','conversationId'].includes(k)))
    throw new Error('Unexpected message fields')
  return e as unknown as WeixinEvent
}
/** Timestamp format: Unix milliseconds. Signature: HMAC SHA256(timestamp + '.' + exact raw bytes). */
export function signBody(secret: string, timestamp: string, raw: Uint8Array): string {
  if (!secret || !timestamp) throw new BridgeAuthError('Missing signing inputs')
  return 'sha256=' + createHmac('sha256', secret).update(timestamp).update('.').update(raw).digest('hex')
}
export function verifyBody(secret: string, timestamp: string | undefined, signature: string | undefined,
  raw: Uint8Array, now = Date.now()): void {
  if (!secret || !timestamp || !/^\d{13}$/.test(timestamp) || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    throw new BridgeAuthError()
  if (Math.abs(now - Number(timestamp)) > 300000) throw new BridgeAuthError('Stale bridge request')
  const expected = Buffer.from(signBody(secret, timestamp, raw)), received = Buffer.from(signature)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new BridgeAuthError()
}
/** ID and actor are derived only from a verified channel envelope, never inferred from message text. */
export function asTrigger(event: WeixinEvent): Trigger {
  const actor = actorId(event.accountId, event.peerId)
  const thread = SOURCE + ':' + actor
  return {
    id: thread + ':' + encodeURIComponent(event.messageId), source: SOURCE,
    threads: [{ source: SOURCE, id: actor }],
    actor: { source: SOURCE, id: actor }, human: true, addressed: 'direct',
    at: new Date(event.receivedAt).toISOString(), text: event.text,
    channel: { source: SOURCE, thread, address: { accountId: event.accountId, peerId: event.peerId } },
    meta: { accountId: event.accountId, peerId: event.peerId, messageId: event.messageId },
  }
}
