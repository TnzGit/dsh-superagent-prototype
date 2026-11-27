/** First-line project-selector syntax feedback (OL-055 S3.3): the accepted grammar is verified before the expensive route. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasSelectorIntent, selectorFeedback, selectorParses } from '../src/local-first/request-selector-feedback.ts'
import { projectIdFromRequest } from '../src/local-first/project-workspaces.ts'

// The grammar the parser accepts is unchanged: every case that parsed before still parses, and nothing new does.
const accepted = [
  ['/project demo-app\n请修改文件', 'demo-app'],
  ['项目：demo-app\n请修改文件', 'demo-app'],
  ['/project demo-app\nFix the typo', 'demo-app'],
]
for (const [text, id] of accepted) {
  test(`accepts ${text.split('\n')[0]} without feedback`, () => {
    assert.equal(projectIdFromRequest(text), id)
    assert.equal(selectorParses(text), true)
    assert.equal(selectorFeedback(text), undefined)
  })
}
// A request that shows no selector intent is left to the parser with no feedback; the feedback never widens the grammar.
for (const text of ['请修改文件', 'Fix the typo', '请修改项目 demo-app 的文件', '继续《My Existing Project》项目', '']) {
  test(`leaves ${JSON.stringify(text.split('\n')[0])} with no intent and no feedback`, () => {
    assert.equal(hasSelectorIntent(text), false)
    assert.equal(projectIdFromRequest(text), undefined)
    assert.equal(selectorParses(text), false)
    assert.equal(selectorFeedback(text), undefined)
  })
}
// A first line that intends a selector but does not parse is corrected, never accepted: the parser's own answer is unchanged.
for (const text of ['/project ../secret\n改', '/project demo-app; rm -rf /\n改', '/project Demo-App\n修一下']) {
  test(`refuses ${JSON.stringify(text.split('\n')[0])} and returns a correction`, () => {
    assert.equal(projectIdFromRequest(text), undefined)
    assert.equal(hasSelectorIntent(text), true)
    assert.equal(selectorParses(text), false)
    assert.match(selectorFeedback(text) ?? '', /项目标识无效|选择器必须独占第一行/)
    assert.match(selectorFeedback(text) ?? '', /Invalid project ID|selector must be alone/)
  })
}
test('reports the selector joined to the first command line, in both languages, as a correction and not a guess', () => {
  const text = '/project demo-app 修复错字'
  assert.equal(hasSelectorIntent(text), true)
  assert.equal(projectIdFromRequest(text), undefined)
  const feedback = selectorFeedback(text)
  assert.match(feedback, /选择器必须独占第一行/)
  assert.match(feedback, /selector must be alone on the first line/)
  assert.match(feedback, /\/project demo-app\n修复错字/)
  assert.ok(!/demo-app 修复错字/.test(feedback.split('\n')[2] ?? ''), 'the example keeps the selector and the request on separate lines')
})
test('reports an invalid ID after an intended selector, in both languages', () => {
  for (const text of ['/project Demo-App\n修一下', '/project ../secret\n修一下', '项目：Demo-App\n修一下', '/new-project Bad_Name\n新建']) {
    assert.equal(hasSelectorIntent(text), true)
    const feedback = selectorFeedback(text)
    assert.match(feedback, /项目标识无效/)
    assert.match(feedback, /Invalid project ID/)
    assert.match(feedback, /lowercase letters, digits, underscore or hyphen/)
  }
})
test('a new-project request that parses gets no feedback and no intent is invented for free text', () => {
  assert.equal(selectorFeedback('/new-project a-fresh-idea\n新建一个'), undefined)
  assert.equal(selectorFeedback('继续《My Existing Project》项目'), undefined)
})
