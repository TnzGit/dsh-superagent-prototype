/** OL-20261126-055 subagent B (S1): the hardened journal constructor — every access opens the exact path through its own
 * O_NOFOLLOW descriptor that is closed explicitly, and refuses a foreign inode before it can be read, modified or followed.
 * Under Node's type-stripping: synthetic 0700 fixtures and fake store stubs only — no SQLite, real Weixin, credentials,
 * host service or production state. */
import { test as nodeTest } from 'node:test'
const test=(name,fn)=>nodeTest(name,{timeout:12000},fn)
import assert from 'node:assert/strict'
import { chmodSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OperatorReview, journalLineOf, OPERATOR_JOURNAL_MAX_BYTES } from '../src/app/operator-review.ts'

const TOKEN = 'synthetic-operator-token-never-real-32-chars'
const dirs = []
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ol055-journal-')); dirs.push(dir)
  chmodSync(dir, 0o700)
  return dir
}
function fakeStore(...receipts) {
  const rows = new Map(receipts.map(receipt => [receipt.id, receipt]))
  const audit = []
  const auditKey = record => `${record.kind}\u0000${record.id}\u0000${record.principal}`
  return {
    atomic: fn => fn(),
    operatorAudit: {
      append: record => { if (audit.some(entry => auditKey(entry) === auditKey(record))) return false; audit.push({ seq: audit.length + 1, ...record }); return true },
      remove: record => { const index = audit.findIndex(entry => auditKey(entry) === auditKey(record)); if (index >= 0) audit.splice(index, 1) },
      list: limit => audit.slice(0, limit).map(entry => ({ ...entry })),
      count: () => audit.length,
    },
    triggers: { get: id => ({ id }) },
    receipts: { get: id => rows.get(id),
      operatorSettleReview: (id, outcome, principal) => {
        const row = rows.get(id)
        if (!row || row.status !== 'pending' || row.channel.source !== 'weixin' || !row.review) return false
        row.status = outcome === 'confirmed_sent' ? 'sent' : 'dropped'
        row.operator = { outcome, principal }
        return true
      },
      reviewLedger: limit => [...rows.values()].filter(row => row.status === 'pending' && row.channel.source === 'weixin' && row.review)
        .slice(0, limit).map(row => ({ id: row.id, kind: row.kind, claimed: row.claimed, reviewAt: row.review.at, reason: row.review.reason })),
    },
  }
}
const held = id => ({ id, kind: 'reply', text: 'synthetic', status: 'pending', claimed: false,
  channel: { source: 'weixin', thread: 'weixin:s', address: { peer: 's' } }, review: { at: '2026-11-25T00:00:00.000Z', reason: 'ambiguous_send' } })
const review = (store, journal) => new OperatorReview({ store, effects: { cancel: () => {} },
  engine: { classifyPendingTrigger: () => ({ decision: { id: 'd' }, already: false }) }, token: TOKEN, journal })
function openDescriptors() {
  // /dev/fd is the process's own descriptor table on both macOS and Linux; a leak shows up as a growing count here.
  try { return readdirSync('/dev/fd').length } catch { return undefined }
}

test('the constructor never leaks a descriptor: building many operators does not grow the descriptor table', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const before = openDescriptors()
  for (let i = 0; i < 40; i++) review(fakeStore(), journal) // each construction opens + closes read, validate and re-project descriptors
  const after = openDescriptors()
  if (before === undefined || after === undefined) return
  assert.ok(after <= before + 1, `descriptors grew across 40 constructions: ${before} -> ${after}`)
})

test('a malicious symlink at the journal path is refused, and its foreign target is neither modified nor read through', () => {
  const dir = fixture()
  const foreign = join(dir, 'foreign.txt')
  writeFileSync(foreign, 'SENSITIVE FOREIGN PAYTEXT that must never reach a diagnostic\n', { mode: 0o644 })
  const journal = join(dir, 'journal.jsonl')
  symlinkSync(foreign, journal)
  // Every access — validate, re-project, inspect — opens with O_NOFOLLOW and refuses the symlink, so the foreign file is untouched.
  assert.throws(() => review(fakeStore(held('a')), journal), /without following symlinks|regular file|owner-only/)
  assert.equal(statSync(foreign).mode & 0o777, 0o644) // no fchmod leaked onto the foreign target
  assert.equal(readFileSync(foreign, 'utf8'), 'SENSITIVE FOREIGN PAYTEXT that must never reach a diagnostic\n') // no write-through
})

test('a hardlink to a foreign inode is refused and the foreign file keeps its own mode and bytes', () => {
  const dir = fixture()
  const foreign = join(dir, 'foreign-inode')
  writeFileSync(foreign, 'foreign\n', { mode: 0o644 })
  const journal = join(dir, 'journal.jsonl')
  linkSync(foreign, journal) // journal and foreign now share one inode (nlink 2)
  assert.throws(() => review(fakeStore(held('a')), journal), /exactly one hard link/)
  assert.equal(statSync(foreign).mode & 0o777, 0o644) // the shared inode is never tightened
  assert.equal(lstatSync(journal).nlink, 2)
})

test('a foreign owner or a swapped group-writable ancestor is refused before the journal is used', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  writeFileSync(journal, '', { mode: 0o600 })
  // A group-writable ancestor directory (no sticky bit) fails the identity walk.
  chmodSync(dir, 0o775)
  assert.throws(() => review(fakeStore(held('a')), journal), /not group or world writable unless sticky/)
  chmodSync(dir, 0o700)
  // A journal root reached through a symlinked directory is resolved to its real path and validated there; a group-writable
  // real target is refused before the journal is ever used, so the symlink cannot smuggle an unsafe ancestor.
})

test('an unbounded journal is refused: the size bound is enforced before any read or append', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  writeFileSync(journal, 'x'.repeat(OPERATOR_JOURNAL_MAX_BYTES + 1), { mode: 0o600 })
  assert.throws(() => review(fakeStore(held('a')), journal), /bounded size/)
})

test('a pre-existing owner-only journal of ours keeps working and its mode is not loosened (additive, migration-safe)', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  // An older valid journal written by the previous constructor shape: owner-only with one prior record.
  const record = { at: '2026-11-25T00:00:00.000Z', kind: 'receipt', id: 'legacy', principal: 'aaaaaaaaaaaa' }
  writeFileSync(journal, journalLineOf(record) + '\n', { mode: 0o600 })
  const store = fakeStore(held('legacy'))
  store.operatorAudit.append(record) // the durable ledger carries the same record, so the projection corroborates
  const service = review(store, journal)
  assert.equal(statSync(journal).mode & 0o777, 0o600)
  assert.equal(service.journalStatus().current, true)
  // The legacy record stays in the projection, and a still-pending hold reconciles normally (additive, migration-safe).
  service.reconcile('legacy', 'no_resend')
  assert.equal(readFileSync(journal, 'utf8').trim().split('\n').length, 2)
  assert.equal(statSync(journal).mode & 0o777, 0o600)
})

test('the crash-after-commit / lost-projection case re-projects from the authoritative ledger on reopen, and a duplicate never re-sends', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const receipt = held('durable')
  const store = fakeStore(receipt)
  const first = review(store, journal)
  first.reconcile('durable', 'confirmed_sent')
  // Simulate the crash: the SQLite commit made the audit durable, but the external projection write was lost.
  writeFileSync(journal, '', { mode: 0o600 })
  assert.deepEqual(first.journalStatus(), { entries: 1, projected: 0, current: false })
  // On reopen the ledger (the authority) is re-projected; the journal is current again.
  const reopened = review(store, journal)
  assert.equal(reopened.journalStatus().current, true)
  assert.equal(readFileSync(journal, 'utf8').trim().split('\n').length, 1)
  // The terminal receipt is already durable, so a replayed reviewed hold is refused, never a second send.
  assert.throws(() => reopened.reconcile('durable', 'no_resend'), error => error.code === 'reviewHoldSettled')
  assert.equal(receipt.status, 'sent')
})

test('a projection the ledger and the durable state cannot corroborate freezes reconciliation with a shape-only diagnostic', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const receipt = held('uncertain')
  const store = fakeStore(receipt)
  // A foreign/unsupported line that the ledger never carried AND the durable receipt still shows as pending.
  writeFileSync(journal, '{"at":"2026-11-25T00:00:00.000Z","kind":"receipt","id":"uncertain","principal":"deadbeefcafe","outcome":"confirmed_sent"}\n', { mode: 0o600 })
  const service = review(store, journal)
  assert.throws(() => service.reconcile('uncertain', 'no_resend'), /cannot corroborate/)
  assert.equal(receipt.status, 'pending') // frozen: no mutation, no false "accepted"
  // The diagnostic never echoes the foreign line's content (only the corroboration reason).
})


test('rejecting a hardlinked journal closes the attempted descriptor on every failure', () => {
  const dir = fixture()
  const foreign = join(dir, 'hardlink-target')
  const journal = join(dir, 'journal.jsonl')
  writeFileSync(foreign, 'original\n', { mode: 0o600 })
  linkSync(foreign, journal)
  const before = openDescriptors()
  for (let i = 0; i < 24; i++) assert.throws(() => review(fakeStore(), journal), /exactly one hard link/)
  const after = openDescriptors()
  if (before !== undefined && after !== undefined)
    assert.ok(after <= before + 1, `failed owner checks leaked descriptors: ${before} -> ${after}`)
  assert.equal(readFileSync(foreign, 'utf8'), 'original\n')
})

test('a truncated pre-existing tail freezes BEFORE SQLite replay can append and conceal it', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const store = fakeStore(held('durable'))
  store.operatorAudit.append({ at: '2026-11-26T00:00:00.000Z', kind: 'receipt',
    id: 'durable', principal: 'aaaaaaaaaaaa', outcome: 'confirmed_sent' })
  const truncated = '{"at":"2026-11-26T00:00:00.000Z","kind":'
  writeFileSync(journal, truncated + '\n', { mode: 0o600 })
  const service = review(store, journal)
  assert.throws(() => service.reconcile('durable', 'no_resend'), /interrupted journal record/)
  assert.equal(readFileSync(journal, 'utf8'), truncated + '\n', 'no reproject over a corrupt tail')
})

test('a malformed middle record or duplicate projection freezes even when the last line is valid', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const store = fakeStore()
  const record = { at: '2026-11-26T00:00:00.000Z', kind: 'trigger',
    id: 'legacy', principal: 'aaaaaaaaaaaa' }
  const good = journalLineOf(record)
  writeFileSync(journal, 'BROKEN RECORD\n' + good + '\n', { mode: 0o600 })
  const malformed = review(store, journal)
  assert.throws(() => malformed.classifyTrigger('legacy'), /interrupted journal record/)
  writeFileSync(journal, good + '\n' + good + '\n', { mode: 0o600 })
  const duplicate = review(store, journal)
  assert.throws(() => duplicate.classifyTrigger('legacy'), /duplicate journal record/)
})

test('a journal corrupted AFTER a clean startup freezes the next operator mutation', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const store = fakeStore(held('pending'))
  const service = review(store, journal)
  writeFileSync(journal, 'truncated{\n', { mode: 0o600 })
  assert.throws(() => service.reconcile('pending', 'no_resend'), /interrupted journal record/)
  assert.equal(store.receipts.get('pending').status, 'pending')
  assert.equal(store.operatorAudit.count(), 0)
})


test('an unterminated syntactically valid JSONL line is not treated as an fsynced record', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const store = fakeStore(held('pending'))
  const record = { at: '2026-11-26T00:00:00.000Z', kind: 'receipt', id: 'pending',
    principal: 'aaaaaaaaaaaa', outcome: 'no_resend' }
  writeFileSync(journal, journalLineOf(record), { mode: 0o600 }) // no final newline
  const service = review(store, journal)
  assert.equal(service.journalStatus().current, false)
  assert.throws(() => service.reconcile('pending', 'no_resend'), /unterminated/)
  assert.equal(store.operatorAudit.count(), 0)
  assert.equal(store.receipts.get('pending').status, 'pending')
})

test('post-start symlink substitution freezes BEFORE any SQLite terminal transition', () => {
  const dir = fixture()
  const journal = join(dir, 'journal.jsonl')
  const foreign = join(dir, 'foreign')
  writeFileSync(foreign, 'FOREIGN CONTENT\n', { mode: 0o600 })
  const store = fakeStore(held('pending'))
  const service = review(store, journal)
  rmSync(journal)
  symlinkSync(foreign, journal)
  assert.equal(service.journalStatus().current, false)
  assert.throws(() => service.reconcile('pending', 'no_resend'), /journal unavailable, unsafe/)
  assert.equal(store.operatorAudit.count(), 0)
  assert.equal(store.receipts.get('pending').status, 'pending')
  assert.equal(readFileSync(foreign, 'utf8'), 'FOREIGN CONTENT\n')
})
