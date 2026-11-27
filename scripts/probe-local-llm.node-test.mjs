import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { normalizeBaseUrl, responseSummary } from './probe-local-llm.mjs'

test('normalizes v1 base URLs once', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:8000'), 'http://127.0.0.1:8000/v1')
  assert.equal(normalizeBaseUrl('http://127.0.0.1:8000/v1/'), 'http://127.0.0.1:8000/v1')
  assert.equal(normalizeBaseUrl('https://llm.example.net/proxy/v1'), 'https://llm.example.net/proxy/v1')
})

test('rejects endpoint credentials and non-HTTP schemes', () => {
  assert.throws(() => normalizeBaseUrl('http://secret@localhost:8000/v1'))
  assert.throws(() => normalizeBaseUrl('file:///etc/passwd'))
  assert.throws(() => normalizeBaseUrl('http://localhost:8000/?key=secret'))
})

test('summarizes text and tool calling without outputting message contents', () => {
  assert.deepEqual(responseSummary({ choices: [{ message: { content: 'SECRET' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 1 } }),
    { finishReason: 'stop', textNonempty: true, toolCalls: 0, promptTokens: 2, completionTokens: 1 })
  assert.equal(responseSummary({ choices: [{ message: { tool_calls: [{ function: { name: 'ping' } }] } }] }).toolCalls, 1)
})
