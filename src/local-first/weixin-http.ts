/** Loopback HTTP ingress: authenticated envelope -> allowlisted peer -> persisted DSH Trigger -> ACK. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { actorId, asTrigger, parseEvent, verifyBody, BridgeAuthError, type WeixinEvent } from './weixin-envelope.ts'
import type { Trigger } from '../core/index.ts'
const MAX_BODY = 128 * 1024
export interface BridgeOptions {
  secret: string; allowPeers: readonly string[] | (() => readonly string[])
  ingest: (trigger: Trigger) => Promise<unknown> | unknown
  onFailure?: (reason: string) => void
}
async function readBody(request: IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = []; let size = 0
  for await (const part of request) {
    const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += bytes.length
    if (size > MAX_BODY) throw new Error('body_too_large')
    parts.push(bytes)
  }
  return Buffer.concat(parts)
}
const reply = (response: ServerResponse, code: number, status: string): void => {
  response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify({ status }))
}
/** Bind only to 127.0.0.1; caller owns server.listen and shutdown lifecycle. */
export function createBridgeServer(options: BridgeOptions) {
  if (options.secret.length < 32) throw new Error('Use a bridge secret of at least 32 characters')
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/weixin/inbound') { reply(response, 404, 'not_found'); return }
    let event: WeixinEvent
    try {
      const raw = await readBody(request)
      verifyBody(options.secret, request.headers['x-dsh-timestamp'] as string | undefined,
        request.headers['x-dsh-signature'] as string | undefined, raw)
      event = parseEvent(JSON.parse(raw.toString('utf8')))
      if (!(typeof options.allowPeers === 'function' ? options.allowPeers() : options.allowPeers).includes(actorId(event.accountId, event.peerId))) { reply(response, 403, 'forbidden'); return }
    } catch (error) {
      const auth = error instanceof BridgeAuthError
      const message = error instanceof Error ? error.message : 'unknown'
      options.onFailure?.(auth ? 'auth' : message === 'body_too_large' ? 'size' : 'validation')
      reply(response, auth ? 401 : message === 'body_too_large' ? 413 : 400, 'rejected')
      return
    }
    try {
      // SourceHost.receive stores through the DSH Engine, which deduplicates stable Trigger IDs.
      await options.ingest(asTrigger(event))
      reply(response, 202, 'accepted')
    } catch {
      options.onFailure?.('ingest')
      reply(response, 503, 'retry')
    }
  })
}
