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


test('P3 rejects non-enumerable extra keys on plan/change instead of digest-colliding', () => {
  const trusted = inspectProposedApplyPlan(plan()).digest
  const hiddenPlan = plan()
  Object.defineProperty(hiddenPlan, 'unsignedApproval', { value: true, enumerable: false })
  expect(Object.keys(hiddenPlan)).not.toContain('unsignedApproval')
  expect(() => inspectProposedApplyPlan(hiddenPlan)).toThrow(/fields/)
  const hiddenChange = plan()
  Object.defineProperty(hiddenChange.changes[0], 'skipReview', { value: true, enumerable: false })
  expect(() => inspectProposedApplyPlan(hiddenChange)).toThrow(/fields/)
  const clean = inspectProposedApplyPlan(plan()).digest
  expect(clean).toBe(trusted)
})

test('P3 rejects Symbol keys and accessors in proposal objects without invoking getters', () => {
  const symbol = Symbol('invisible')
  const withSymbol = plan()
  withSymbol[symbol] = 'different'
  expect(() => inspectProposedApplyPlan(withSymbol)).toThrow(/fields/)
  const withChangeSymbol = plan()
  withChangeSymbol.changes[1][symbol] = 'different'
  expect(() => inspectProposedApplyPlan(withChangeSymbol)).toThrow(/fields/)
  let calls = 0
  const getterPlan = plan()
  Object.defineProperty(getterPlan, 'projectId', {
    get() { calls++; throw Error('SHOULD NOT RUN') }, enumerable: true
  })
  expect(() => inspectProposedApplyPlan(getterPlan)).toThrow(/fields/)
  expect(calls).toBe(0)
  const getterChange = plan()
  Object.defineProperty(getterChange.changes[0], 'path', {
    get() { calls++; throw Error('SHOULD NOT RUN') }, enumerable: true
  })
  expect(() => inspectProposedApplyPlan(getterChange)).toThrow(/fields/)
  expect(calls).toBe(0)
})

test('P3 rejects hidden/symbolic/extra/sparse entries in changes array', () => {
  const hidden = plan()
  Object.defineProperty(hidden.changes, 'shadow', { value: 'private', enumerable: false })
  expect(() => inspectProposedApplyPlan(hidden)).toThrow(/scope|limits/)
  const symbolic = plan()
  symbolic.changes[Symbol('extra')] = 'private'
  expect(() => inspectProposedApplyPlan(symbolic)).toThrow(/scope|limits/)
  const extra = plan()
  extra.changes.extra = 'private'
  expect(() => inspectProposedApplyPlan(extra)).toThrow(/scope|limits/)
  const hole = plan()
  delete hole.changes[1]
  expect(() => inspectProposedApplyPlan(hole)).toThrow(/scope|limits/)
  const exotic = plan()
  Object.setPrototypeOf(exotic.changes, null)
  expect(() => inspectProposedApplyPlan(exotic)).toThrow(/scope|limits/)
})

test('P3 accepts ordinary frozen own-data plan and refuses objects with inherited fields', () => {
  const normal = plan()
  normal.changes.forEach(Object.freeze)
  Object.freeze(normal.changes)
  Object.freeze(normal)
  expect(inspectProposedApplyPlan(normal).digest).toMatch(/^[a-f0-9]{64}$/)
  const inherited = Object.create({ projectId: 'fixture' })
  Object.assign(inherited, plan())
  delete inherited.projectId
  expect(() => inspectProposedApplyPlan(inherited)).toThrow()
})
