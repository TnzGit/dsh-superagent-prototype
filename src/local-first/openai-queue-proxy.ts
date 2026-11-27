/** Single-purpose OpenAI-compatible admission proxy for a one-slot local inference server. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { ModelEndpointQueue, QueueBusyError, QueueWaitTimeoutError } from './model-queue.ts'

export interface ProxyOptions {
  upstreamBase: string; clientKey: string; upstreamKey?: string
  concurrency?: number; maxPending?: number; waitTimeoutMs?: number; upstreamTimeoutMs?: number
  maxBodyBytes?: number; fetcher?: typeof fetch
}
const RESOURCE_PATHS = new Set(['/v1/chat/completions','/v1/responses','/v1/embeddings'])
const copy = (req: ServerResponse, upstream: Response): void => {
  req.statusCode = upstream.status
  for (const name of ['content-type', 'cache-control', 'x-request-id']) {
    const value = upstream.headers.get(name)
    if (value) req.setHeader(name, value)
  }
  req.setHeader('X-Content-Type-Options', 'nosniff')
}
const response = (res: ServerResponse, code: number, detail: string): void => {
  if (res.destroyed) return
  if (res.headersSent) { res.destroy(); return }
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify({ error: { type: detail } }))
}
const authorized = (header: string | undefined, token: string): boolean => {
  if (!header?.startsWith('Bearer ')) return false
  const actual = Buffer.from(header.slice(7)), expected = Buffer.from(token)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
const checkBase = (base: string): string => {
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Upstream must be a clean HTTP(S) URL')
  const path = url.pathname.replace(/\/+$/, '')
  if (!path.endsWith('/v1')) throw new Error('Upstream base must end in /v1')
  return url.origin + path
}
const read = async (req: IncomingMessage, limit: number): Promise<Buffer> => {
  // Do not throw from within "for await": that destroys IncomingMessage and may prevent the
  // server from returning a usable 413 response to an oversized local client.
  const chunks: Buffer[] = []; let bytes = 0
  for await (const chunk of req) {
    const item = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += item.length
    if (bytes <= limit) chunks.push(item)
  }
  if (bytes > limit) throw new RangeError('request_too_large')
  return Buffer.concat(chunks)
}

/** One server process owns one ModelEndpointQueue shared by every route and DSH role using this proxy. */
export function createOpenAIQueueProxy(config: ProxyOptions) {
  if (!config.clientKey || config.clientKey.length < 32) throw new Error('Client API key must be >=32 characters')
  const base = checkBase(config.upstreamBase)
  const queue = new ModelEndpointQueue(config.concurrency ?? 1, config.maxPending ?? 64)
  const fetcher = config.fetcher ?? fetch
  const maxBody = config.maxBodyBytes ?? 16 * 1024 * 1024
  const upstreamTimeout = config.upstreamTimeoutMs ?? 900_000
  const maxWait = config.waitTimeoutMs ?? 300_000
  if (![maxBody, upstreamTimeout, maxWait].every(x => Number.isSafeInteger(x) && x > 0)) throw new TypeError('Invalid limits')
  const server = createServer(async (req, res) => {
    const route = req.url?.split('?')[0] ?? ''
    if (req.url !== route || !['/health','/v1/models',...RESOURCE_PATHS].includes(route)) return response(res, 404, 'not_found')
    if (!authorized(req.headers.authorization, config.clientKey)) return response(res, 401, 'unauthorized')
    if (route === '/health') {
      if (req.method !== 'GET') return response(res, 405, 'method_not_allowed')
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ status: 'ready', queue: queue.snapshot() }))
      return
    }
    if (req.method !== (route === '/v1/models' ? 'GET' : 'POST')) return response(res, 405, 'method_not_allowed')
    const controller = new AbortController()
    const disconnect = () => { if (!res.writableEnded) controller.abort() }
    req.once('aborted', disconnect); res.once('close', disconnect)
    if (req.method === 'POST' && Number(req.headers['content-length'] ?? 0) > maxBody) {
      response(res, 413, 'request_too_large')
      req.resume()
      return
    }
    let body: Buffer | undefined
    try { if (req.method === 'POST') body = await read(req, maxBody) }
    catch (error) { if (!controller.signal.aborted) response(res, error instanceof RangeError ? 413 : 400, 'invalid_body'); return }
    const forward = async (slotSignal: AbortSignal) => {
      const abort = new AbortController()
      const stop = () => abort.abort()
      slotSignal.addEventListener('abort', stop, { once: true })
      controller.signal.addEventListener('abort', stop, { once: true })
      const timer = setTimeout(stop, upstreamTimeout)
      try {
        const upstream = await fetcher(base + route.slice(3), {
          method: req.method, redirect: 'error', body: body ? Uint8Array.from(body) : undefined,
          headers: { ...(body ? { 'Content-Type': req.headers['content-type'] || 'application/json' } : {}),
            ...(config.upstreamKey ? { Authorization: 'Bearer ' + config.upstreamKey } : {}) },
          signal: abort.signal,
        })
        if (res.destroyed) { await upstream.body?.cancel(); return }
        copy(res, upstream)
        if (!upstream.body) { res.end(); return }
        await pipeline(Readable.fromWeb(upstream.body as never), res, { signal: abort.signal })
      } finally { clearTimeout(timer); slotSignal.removeEventListener('abort', stop); controller.signal.removeEventListener('abort', stop) }
    }
    try {
      if (route === '/v1/models') await forward(controller.signal) // Discovery is not a GPU generation request.
      else await queue.run(forward, { priority: 'normal', signal: controller.signal, waitTimeoutMs: maxWait })
    } catch (error) {
      if (res.destroyed || controller.signal.aborted) return
      if (error instanceof QueueBusyError) response(res, 429, 'queue_full')
      else if (error instanceof QueueWaitTimeoutError) response(res, 504, 'queue_timeout')
      else response(res, 502, 'upstream_unavailable')
    } finally {
      req.off('aborted', disconnect); res.off('close', disconnect)
    }
  })
  return { server, queue }
}
