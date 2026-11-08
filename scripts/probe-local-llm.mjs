#!/usr/bin/env node
/**
 * Read-only smoke test for an OpenAI-compatible local inference endpoint.
 * No prompts, response bodies, or API keys are printed to stdout.
 * Usage: LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1 [LOCAL_LLM_MODEL=id] node scripts/probe-local-llm.mjs [--tools]
 */
import { pathToFileURL } from 'node:url'

const TIMEOUT_MS = 120_000

export function normalizeBaseUrl(raw) {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Endpoint must be an HTTP(S) URL without credentials, query, or fragment')
  }
  const cleanPath = url.pathname.replace(/\/+$/, '')
  url.pathname = cleanPath.endsWith('/v1') ? cleanPath : `${cleanPath}/v1`
  return url.toString().replace(/\/$/, '')
}

export function responseSummary(json) {
  const item = json?.choices?.[0]
  const msg = item?.message
  if (!item || !msg || (!Array.isArray(msg.tool_calls) && typeof msg.content !== 'string')) {
    throw new Error('Unexpected Chat Completions response shape')
  }
  return {
    finishReason: item.finish_reason ?? null,
    textNonempty: typeof msg.content === 'string' && msg.content.trim().length > 0,
    toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls.length : 0,
    promptTokens: json.usage?.prompt_tokens ?? null,
    completionTokens: json.usage?.completion_tokens ?? null,
  }
}

async function getJson(url, options, timeoutMs) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).pathname}`)
  return response.json()
}

export async function probe({ baseUrl, model, apiKey, tools = false, timeoutMs = TIMEOUT_MS }) {
  const base = normalizeBaseUrl(baseUrl)
  const headers = { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }
  const models = await getJson(`${base}/models`, { headers }, timeoutMs)
  const ids = Array.isArray(models.data) ? models.data.map(row => row?.id).filter(id => typeof id === 'string') : []
  if (!ids.length) throw new Error('/models returned no usable model ids')
  const selected = model || ids[0]
  if (!ids.includes(selected)) throw new Error('Requested model is not advertised by /models')
  const body = {
    model: selected,
    messages: [{ role: 'user', content: tools ? 'Call the ping tool once with value "ok". Do not answer in text.' : 'Reply with exactly OK.' }],
    max_tokens: 96,
    temperature: 0,
    stream: false,
    ...(tools ? {
      tools: [{ type: 'function', function: { name: 'ping', description: 'Test function calling', parameters: {
        type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false,
      } } }],
      tool_choice: 'auto',
    } : {}),
  }
  const start = performance.now()
  const answer = await getJson(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, timeoutMs)
  const result = responseSummary(answer)
  if (tools ? !result.toolCalls : !result.textNonempty) {
    throw new Error(tools ? 'Model returned no tool calls for the tool-call probe' : 'Model returned an empty text answer')
  }
  return { ok: true, baseUrl: base, model: selected, modelCount: ids.length,
    elapsedMs: Math.round(performance.now() - start), toolProbe: tools, ...result }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--tools')) throw new Error('Only optional --tools is supported; use environment variables for configuration')
  const result = await probe({
    baseUrl: process.env.LOCAL_LLM_BASE_URL || 'http://127.0.0.1:8000/v1',
    model: process.env.LOCAL_LLM_MODEL,
    apiKey: process.env.LOCAL_LLM_API_KEY,
    tools: args.includes('--tools'),
    timeoutMs: Number(process.env.LOCAL_LLM_TIMEOUT_MS || TIMEOUT_MS),
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`Local LLM probe failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1 })
}
