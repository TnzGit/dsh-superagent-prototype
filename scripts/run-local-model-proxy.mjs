#!/usr/bin/env node
/** Start the independent OpenAI-compatible queue proxy. No production change without operator configuration. */
import { createOpenAIQueueProxy } from '../src/local-first/openai-queue-proxy.ts'
function positive(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid ' + name)
  return value
}
const port = positive('LOCAL_MODEL_PROXY_PORT', 8123)
if (port > 65535) throw Error('Proxy port must be <= 65535')
const key = process.env.LOCAL_MODEL_PROXY_CLIENT_KEY
const upstream = process.env.LOCAL_MODEL_PROXY_UPSTREAM
if (!key || !upstream) throw Error('Missing LOCAL_MODEL_PROXY_CLIENT_KEY or LOCAL_MODEL_PROXY_UPSTREAM')
const { server } = createOpenAIQueueProxy({
  upstreamBase: upstream, clientKey: key, upstreamKey: process.env.LOCAL_MODEL_PROXY_UPSTREAM_KEY,
  concurrency: 1, maxPending: positive('LOCAL_MODEL_PROXY_MAX_PENDING', 64),
  waitTimeoutMs: positive('LOCAL_MODEL_PROXY_WAIT_TIMEOUT_MS', 300_000),
  upstreamTimeoutMs: positive('LOCAL_MODEL_PROXY_UPSTREAM_TIMEOUT_MS', 900_000),
})
server.on('error', error => { console.error('Local model proxy listen failed: ' + error.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => {
  console.info('Local model proxy listening on loopback port ' + port + ', max concurrent inference = 1')
})
const stop = () => server.close()
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
