// @ts-nocheck
/** P3 contract tests are proposal-only: no source, host, operator grant or Apply. */
import { test, expect } from 'vitest'
import { inspectProposedApplyPlan } from '../src/local-first/real-apply-contract.ts'

const hash = x => x.repeat(64)
const sha40 = '1'.repeat(40)
const add = (path = 'add.txt') => ({
  path, action: 'add', beforeSha256: null, afterSha256: hash('a'),
  beforeBytes: null, afterBytes: 4, beforeMode: null, afterMode: 0o644
})
const modify = (path = 'change.txt') => ({
  path, action: 'modify', beforeSha256: hash('b'), afterSha256: hash('c'),
  beforeBytes: 6, afterBytes: 7, beforeMode: 0o644, afterMode: 0o644
})
const remove = (path = 'remove.txt') => ({
  path, action: 'delete', beforeSha256: hash('d'), afterSha256: null,
  beforeBytes: 8, afterBytes: null, beforeMode: 0o644, afterMode: null
})
const plan = (changes = [add(), modify(), remove()]) => ({
  version: 1, projectId: 'fixture', rootFingerprint: hash('e'),
  sourceRevision: sha40, changes
})
test('P3 contract produces frozen deterministic digest over bounded canonical add/modify/delete proposal', () => {
  const p = plan()
  const first = inspectProposedApplyPlan(p), second = inspectProposedApplyPlan(plan())
  expect(first.digest).toMatch(/^[a-f0-9]{64}$/)
  expect(first.digest).toBe(second.digest)
  expect(Object.isFrozen(first)).toBe(true)
  expect(Object.isFrozen(first.changes)).toBe(true)
  expect(Object.isFrozen(first.changes[0])).toBe(true)
  const altered = plan()
  altered.changes[1].afterSha256 = hash('f')
  expect(inspectProposedApplyPlan(altered).digest).not.toBe(first.digest)
  expect(p.changes[1].afterSha256).toBe(hash('c')) // no mutation by inspector
})
test('P3 contract rejects path traversal, Unicode aliases, secret paths and absolute/cross-root paths', () => {
  for (const path of [
    '../evil', 'nested/../evil', './evil', '/absolute/file', 'C:\\private\\file',
    'foo//bar', 'has space.txt', '.env', 'foo/.git/config',
    'foo/secret.key', 'foo/id_ed25519', 'foo/settings.db',
    'foo/é.txt', 'foo/\0malicious', 'foo/\ntext'
  ]) {
    expect(() => inspectProposedApplyPlan(plan([add(path)])), path).toThrow()
  }
})
test('P3 contract refuses case aliases, duplicate paths, parent/child conflicts, noncanonical ordering', () => {
  const variants = [
    [add('a.txt'), modify('a.txt')], [add('A.txt'), modify('a.txt')],
    [add('A'), modify('A/b.txt')], [add('a/b.txt'), modify('a')],
    [modify('z.txt'), add('a.txt')]
  ]
  for (const changes of variants) expect(() => inspectProposedApplyPlan(plan(changes))).toThrow()
})
test('P3 contract refuses malformed change fields, mismatched operations, unsafe modes and byte budgets', () => {
  const invalid = [
    { ...add(), afterSha256: null },
    { ...add(), beforeSha256: hash('a') },
    { ...modify(), beforeBytes: -1 },
    { ...modify(), afterMode: 0o777 },
    { ...modify(), beforeMode: 0o4755 },
    { ...remove(), afterMode: 0o644 },
    { ...remove(), action: 'execute' },
    { ...add(), afterBytes: 64 * 1024 * 1024 + 1 },
    { ...add(), unexpected: true }
  ]
  for (const item of invalid) expect(() => inspectProposedApplyPlan(plan([item]))).toThrow()
  const many = Array.from({ length: 25 }, (_, i) => add('file' + String(i).padStart(2, '0')))
  expect(() => inspectProposedApplyPlan(plan(many))).toThrow()
  const huge = Array.from({ length: 5 }, (_, i) => ({ ...add('file' + i),
    afterBytes: 64 * 1024 * 1024 }))
  expect(() => inspectProposedApplyPlan(plan(huge))).toThrow()
})
test('P3 contract refuses malformed outer scope and never confuses SHA digest with authority', () => {
  const bad = [
    { ...plan(), version: 2 }, { ...plan(), projectId: '../outside' },
    { ...plan(), rootFingerprint: hash('b').slice(1) },
    { ...plan(), sourceRevision: 'bogus' },
    { ...plan(), changes: [] }, { ...plan(), extraApproval: true },
    Object.assign(Object.create(null), plan())
  ]
  for (const value of bad) expect(() => inspectProposedApplyPlan(value)).toThrow()
  expect(inspectProposedApplyPlan(plan())).not.toHaveProperty('authorized')
  expect(inspectProposedApplyPlan(plan())).not.toHaveProperty('apply')
  expect(inspectProposedApplyPlan(plan())).not.toHaveProperty('operatorApproved')
})
