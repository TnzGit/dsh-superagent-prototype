/** OL-20261125-054 subagent B: the private operator token grant guards and the append-only, fsynced audit journal of the
 * operator reconciliation service, under Node's type-stripping: synthetic 0700 fixtures and fake store stubs only —
 * no SQLite, real Weixin, credentials, host service or production state. */
import { test as nodeTest } from 'node:test'
const test=(name,fn)=>nodeTest(name,{timeout:12000},fn)
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OperatorReview, readOperatorToken, OPERATOR_TOKEN_FILE_ENV } from '../src/app/operator-review.ts'
import { UserError } from '../src/core/errors.ts'

const TOKEN = 'synthetic-operator-token-never-real-32-chars'
const dirs = []
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ol054-journal-')); dirs.push(dir)
  chmodSync(dir, 0o700)
  return dir
}
function fakeStore(...receipts) {
  const rows = new Map(receipts.map(receipt => [receipt.id, receipt]))
  const settle = (id, outcome, principal) => {
    const row = rows.get(id)
    if (!row || row.status !== 'pending' || row.channel.source !== 'weixin' || !row.review) return false
    row.status = outcome === 'confirmed_sent' ? 'sent' : 'dropped'
    row.operator = { outcome, principal }
    return true
  }
  // The authoritative durable audit ledger, stubbed the way Store.operatorAudit works: first-writer-wins per (kind, id, principal).
  const audit = []
  const auditKey = record => `${record.kind}\u0000${record.id}\u0000${record.principal}`
  return {
    atomic: fn => fn(),
    operatorAudit: {
      append: record => {
        if (audit.some(entry => auditKey(entry) === auditKey(record))) return false
        audit.push({ seq: audit.length + 1, ...record })
        return true
      },
      remove: record => { const index = audit.findIndex(entry => auditKey(entry) === auditKey(record)); if (index >= 0) audit.splice(index, 1) },
      list: limit => audit.slice(0, limit).map(entry => ({ ...entry })),
      count: () => audit.length,
    },
    triggers: { get: id => ({ id }) },
    receipts: { get: id => rows.get(id),
      operatorSettleReview: settle,
      reviewLedger: limit => [...rows.values()].filter(row => row.status === 'pending' && row.channel.source === 'weixin' && row.review)
        .slice(0, limit).map(row => ({ id: row.id, kind: row.kind, claimed: row.claimed, reviewAt: row.review.at, reason: row.review.reason })),
    },
  }
}
const held = id => ({ id, kind: 'reply', text: 'synthetic', status: 'pending', claimed: false,
  channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } }, review: { at: '2026-11-25T00:00:00.000Z', reason: 'ambiguous_send' } })

test('the private grant is read only from an absolute owner-only non-symlink regular file', () => {
  assert.equal(readOperatorToken(undefined), undefined)
  assert.throws(() => readOperatorToken('relative/token'), /must be absolute/)
  const dir = fixture()
  const file = join(dir, 'token')
  writeFileSync(file, TOKEN, { mode: 0o600 })
  assert.equal(readOperatorToken(file), TOKEN)
  chmodSync(file, 0o644)
  assert.throws(() => readOperatorToken(file), /owner-only regular file/)
  chmodSync(file, 0o600)
  const link = join(dir, 'link')
  writeFileSync(link, TOKEN, { mode: 0o600 })
  const symlink = join(dir, 'through')
  rmSync(symlink, { force: true })
  // A symlink at the grant path is refused before its target is ever opened.
  symlinkSync(file, symlink)
  assert.throws(() => readOperatorToken(symlink), /non-symlink file/)
  rmSync(link); writeFileSync(link, 'short', { mode: 0o600 })
  assert.throws(() => readOperatorToken(link), /at least 16 characters/)
})

test('authorization is constant-time over token digests; a forged token never passes', () => {
  const dir = fixture()
  const review = new OperatorReview({ store: fakeStore(), effects: { cancel: () => {} },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'd' }, already: false }) }, token: TOKEN, journal: join(dir, 'journal.jsonl') })
  assert.equal(review.authorized({ 'x-operator-token': TOKEN }), true)
  assert.equal(review.authorized({ 'x-operator-token': TOKEN + 'x' }), false)
  assert.equal(review.authorized({ 'x-operator-token': 'forged-operator-token-value-abcdefgh' }), false)
  assert.equal(review.authorized({}), false)
  assert.equal(review.authorized({ 'x-operator-token': ['array', 'token'] }), false)
})

test('exactly one reconcile takes effect: first-writer-wins, one journal record, the reply effect cancelled', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const cancelled = []
  const receipt = held('one-effect')
  const review = new OperatorReview({ store: fakeStore(receipt), effects: { cancel: (kind, key) => cancelled.push([kind, key]) },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'd' }, already: false }) }, token: TOKEN, journal })
  const first = review.reconcile('one-effect', 'no_resend')
  assert.deepEqual(first, { id: 'one-effect', status: 'dropped', outcome: 'no_resend', principal: first.principal, journal: true })
  assert.match(first.principal, /^[a-f0-9]{12}$/)
  assert.notEqual(first.principal, TOKEN)
  assert.deepEqual(cancelled, [['reply', 'one-effect']])
  // A duplicate click or the loser of a controller race is refused and changes nothing.
  assert.throws(() => review.reconcile('one-effect', 'no_resend'), error => error instanceof UserError && error.code === 'reviewHoldSettled')
  const lines = readFileSync(journal, 'utf8').trim().split('\n')
  assert.equal(lines.length, 1)
  assert.deepEqual(JSON.parse(lines[0]), { at: JSON.parse(lines[0]).at, kind: 'receipt', id: 'one-effect', outcome: 'no_resend', principal: first.principal })
  // The forensic hold survives terminalization on the row, and the settled ID leaves the ledger.
  assert.equal(receipt.review.reason, 'ambiguous_send')
  assert.equal(review.ledger(50).length, 0)
})

test('only an explicit confirmation marks a hold sent; a terminal classification never re-sends the same ID', () => {
  const dir = fixture()
  const receipt = held('explicit-sent')
  const review = new OperatorReview({ store: fakeStore(receipt), effects: { cancel: () => {} },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'd' }, already: false }) }, token: TOKEN, journal: join(dir, 'journal.jsonl') })
  assert.equal(review.reconcile('explicit-sent', 'confirmed_sent').status, 'sent')
  assert.equal(receipt.status, 'sent')
  assert.equal(receipt.dropped, undefined)
  assert.throws(() => review.reconcile('explicit-sent', 'no_resend'), error => error instanceof UserError && error.code === 'reviewHoldSettled')
  // An unknown ID is refused the same way.
  assert.throws(() => review.reconcile('no-such-id', 'no_resend'), error => error instanceof UserError && error.code === 'reviewHoldSettled')
})

test('an interrupted journal tail freezes every mutation with a human-reconciliation error; the ledger stays readable and nothing is repaired', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const receipt = held('frozen')
  const other = held('still-held')
  const review = new OperatorReview({ store: fakeStore(receipt), effects: { cancel: () => {} },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'd' }, already: false }) }, token: TOKEN, journal })
  review.reconcile('frozen', 'no_resend')
  // The crash landed between the append and its fsync: a partial record the journal cannot answer.
  writeFileSync(journal, readFileSync(journal, 'utf8') + '{"at":"2026-11-25T00:01:00.000Z","kind":"rec', { mode: 0o600 })
  const reopened = new OperatorReview({ store: fakeStore(receipt, other), effects: { cancel: () => {} },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'd' }, already: false }) }, token: TOKEN, journal })
  assert.deepEqual(reopened.ledger(50).map(row => row.id), ['still-held']) // sanitized ledger still answers
  assert.throws(() => reopened.reconcile('still-held', 'no_resend'), /reconciliation is frozen until a human reconciles it: journal unavailable, unsafe, or unterminated/)
  assert.throws(() => reopened.classifyTrigger('some-trigger'), /frozen/)
  // The uncertain receipt stays frozen, and no repair was attempted on the journal.
  assert.equal(other.status, 'pending')
  assert.equal(receipt.status, 'dropped')
  assert.ok(readFileSync(journal, 'utf8').endsWith(',"kind":"rec'))
})

test('journal records are sanitized: ID, kind, outcome and the principal hash — never the token itself', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const store = fakeStore(held('sanitized'))
  const review = new OperatorReview({ store, effects: { cancel: () => {} },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'evaluation-id' }, already: false }) }, token: TOKEN, journal })
  review.classifyTrigger('trigger-one')
  review.reconcile('sanitized', 'no_resend')
  const text = readFileSync(journal, 'utf8')
  assert.ok(!text.includes(TOKEN))
  const records = text.trim().split('\n').map(line => JSON.parse(line))
  assert.deepEqual(records.map(record => [record.kind, record.id]), [['trigger', 'trigger-one'], ['receipt', 'sanitized']])
  assert.equal(records[0].principal, records[1].principal)
  // The durable audit ledger is the authority: both records it carries corroborate the projection, and the journal is current.
  assert.deepEqual(review.auditLedger().map(record => [record.kind, record.id]), [['trigger', 'trigger-one'], ['receipt', 'sanitized']])
  assert.deepEqual(review.journalStatus(), { entries: 2, projected: 2, current: true })
  // A second classification of the same Trigger is idempotent and journals nothing more.
  const again = new OperatorReview({ store, effects: { cancel: () => {} },
    engine: { classifyPendingTrigger: () => ({ decision: { id: 'evaluation-id' }, already: true }) }, token: TOKEN, journal })
  assert.equal(again.classifyTrigger('trigger-one').classified, false)
  assert.equal(readFileSync(journal, 'utf8').trim().split('\n').length, 2)
})

test('the grant env names the service; a Runtime without it never sees the journal path', () => {
  assert.equal(OPERATOR_TOKEN_FILE_ENV, 'DSH_OPERATOR_RECONCILE_TOKEN_FILE')
  const saved = process.env[OPERATOR_TOKEN_FILE_ENV]
  delete process.env[OPERATOR_TOKEN_FILE_ENV]
  assert.equal(readOperatorToken(), undefined)
  if (saved !== undefined) process.env[OPERATOR_TOKEN_FILE_ENV] = saved
})
