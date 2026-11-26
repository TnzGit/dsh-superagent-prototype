// @vitest-environment jsdom
// The private operator UI: what it shows, what it refuses to do, and the one safe action it offers.
import { expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.ts'
import { usePanel, mount, remount, all, find, click, text, type } from './fixtures/panel.tsx'
import { server } from './fixtures/panel-server.ts'

usePanel()
const passwordField = () => document.querySelector<HTMLInputElement>('input[type="password"]')!

it('offers the operator tab after the stage tabs and never reads the status route before the grant is given', async () => {
  await mount()
  expect(all('[role="tab"]').map(tab => tab.textContent)).toEqual(['概览', '来源', '触发', '评估', '执行', '操作员', '设置'])
  await click(zh['tab.operator'])
  // The page asks for the private grant first and states the bearer lifecycle instead of implying it.
  expect(text()).toContain(zh.operatorGrant)
  expect(text()).toContain(zh.operatorBearerValue)
  expect(text()).toContain(zh.operatorTransportValue)
  expect(text()).toContain(zh.operatorRateValue)
  // Nothing is fetched without the grant, so no unauthenticated request is even attempted.
  expect(server.requests.filter(request => request.path === 'operator/status')).toEqual([])
  // And the page offers no send or Apply: only the grant and the lifecycle that bounds it.
  expect(all('button').map(button => button.textContent ?? '').join(' ')).not.toMatch(/发送|Send|应用|Apply/)
})

it('shows the installed build, the paused Executor, the poll lease, the queues and the redacted review state with the grant', async () => {
  await mount(en)
  await click('Operator')
  await type(passwordField(), 'SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL')
  expect(server.requests.some(request => request.path === 'operator/status' && request.method === 'GET')).toBe(true)
  // The installed build and its manifest, so the operator knows what is running without reading raw SQLite.
  expect(text()).toContain('dsh-superagent')
  expect(text()).toContain('0.1.0')
  expect(text()).toContain('/synthetic/state')
  // Executor state and its health, source health, the poll owner's lease generation, queue health, review state, model health.
  expect(text()).toContain('Controlled test Executor')
  expect(text()).toContain('Lease generation')
  expect(text()).toContain('7')
  expect(text()).toContain('1 waiting')
  expect(text()).toContain('Deliveries awaiting review')
  expect(text()).toContain('ambiguous_send')
  expect(text()).toContain('Journal matches the ledger')
  expect(text()).toContain('Model route health')
  // The last durable checkpoint, so recovery can key to its sequence.
  expect(text()).toContain('Last checkpoint')
  // The token is never rendered back, and no secret or payload text appears anywhere on the page.
  expect(text()).not.toContain('SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL')
  expect(text()).not.toContain('syntheticaccountfingerprint0123456789')
})

it('pauses the controlled Executor through its own grant, idempotently, and never sends anything behind a generic confirm', async () => {
  await mount()
  await click(zh['tab.operator'])
  await type(passwordField(), 'SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL')
  server.requests.length = 0
  await click(zh.operatorPause)
  // The confirm names its scope and says it sends nothing, before anything is done.
  expect(text()).toContain(zh.operatorPauseConfirm)
  await click(zh.confirm)
  const pause = server.requests.find(request => request.path === 'operator/executor/pause')
  expect(pause?.method).toBe('POST')
  expect(pause?.body).toEqual({ paused: true })
  // The view now says the Executor is paused, and no outbound send was made by clicking.
  expect(text()).toContain(zh.operatorPausedYes)
  expect(server.requests.filter(request => request.path.startsWith('operator/')).every(request =>
    request.path === 'operator/status' || request.path === 'operator/executor/pause')).toBe(true)
  // Resuming is the same route with the opposite value: one action governs both directions, idempotently.
  server.requests.length = 0
  await click(zh.operatorResume)
  await click(zh.confirm)
  expect(server.requests.find(request => request.path === 'operator/executor/pause')?.body).toEqual({ paused: false })
  expect(text()).toContain(zh.operatorPausedNo)
})

it('refuses the pause when the operator closes the confirm, so nothing is changed by opening a dialog', async () => {
  await mount()
  await click(zh['tab.operator'])
  await type(passwordField(), 'SYNTHETIC_OPERATOR_TOKEN_ONLY_NEVER_REAL')
  server.requests.length = 0
  await click(zh.operatorPause)
  await click(zh.cancel)
  expect(server.requests.filter(request => request.path === 'operator/executor/pause')).toEqual([])
  expect(server.settings.paused).toBe(false)
})

it('says the same thing in both languages and keeps the operator tab in the tab strip after a restart of the panel', async () => {
  await mount(en)
  await click('Operator')
  // The hint sits in the status head's tip, so it is read from its label, not the body text.
  expect(all('.dt-info').map(tip => tip.getAttribute('aria-label')).join('\n')).toContain('loopback only')
  // A remount is the panel's own restart: the operator tab is still there, still in the strip, and still points at the page.
  await remount(en)
  expect(all('[role="tab"]').map(tab => tab.textContent)).toEqual(['Overview', 'Source', 'Trigger', 'Eval', 'Execution', 'Operator',
    'Settings'])
  expect(find('Operator', '[role="tab"]').getAttribute('aria-controls')).toBe('dt-page')
})
