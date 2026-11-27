/** OL-053 subagent B: registered-source identity gate (same-path ABA) for durable snapshot creation.
 * The path-only fingerprint passes when an external writer replaces the registered source directory
 * with a fresh inode at the same path; the registration-time dev/inode identity is the only evidence
 * that the snapshot is copied from the project the operator actually registered. Synthetic copies only:
 * no real project, model, Weixin, host service, network or credentials. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalProjectRegistry } from '../src/local-first/project-registry.ts'
import { projectFingerprint, createProjectSnapshot, verifyProjectSnapshot, previewNonGitProjectChanges } from '../src/local-first/project-workspaces.ts'

async function fixture(work) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-ol053-identity-')))
  const projects = join(base, 'projects'), workspaces = join(base, 'work')
  mkdirSync(projects, { recursive: true }); mkdirSync(workspaces, { recursive: true })
  try { await work({ base, projects, workspaces }) }
  finally { rmSync(base, { recursive: true, force: true }) }
}

test('replacing the registered source with a fresh inode at the same path fails the snapshot creation identity gate', async () => fixture(async ({ base, projects, workspaces }) => {
  const root = join(projects, 'doc'); mkdirSync(root)
  writeFileSync(join(root, 'a.txt'), 'original\n')
  const registry = new LocalProjectRegistry([projects], [{ id: 'doc', root, kind: 'local' }])
  const fingerprint = projectFingerprint(registry.get('doc'))
  const first = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-1'), fingerprint }
  await registry.write('doc', () => createProjectSnapshot(first))
  await verifyProjectSnapshot(first)
  // Deterministic ABA: keep the OLD inode allocated in a tombstone, then create a
  // NEW directory at the exact original path. Deleting/freeing the old inode first makes
  // this test nondeterministic on Linux/ext4 (immediate inode reuse); no decoy timing games.
  const registered = lstatSync(root)
  const tombstone = join(base, 'old-registered-root')
  renameSync(root, tombstone)
  mkdirSync(root, { mode: 0o700 }); writeFileSync(join(root, 'a.txt'), 'original\n')
  const replaced = lstatSync(root)
  assert.notDeepEqual([replaced.dev, replaced.ino], [registered.dev, registered.ino],
    'old root inode is still live, so a same-path replacement cannot reuse its identity')
  assert.equal(projectFingerprint(registry.get('doc')), fingerprint, 'path fingerprint is unchanged by ABA')
  const second = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-2'), fingerprint }
  await assert.rejects(() => registry.write('doc', () => createProjectSnapshot(second)), /identity changed/)
  await assert.rejects(() => verifyProjectSnapshot(first), /identity changed/)
  // The rejected creation must not leave a half-prepared second workspace behind.
  assert.equal(existsSync(second.directory), false)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'original\n')
}))

test('replacing a registered ancestor directory fails the snapshot creation identity gate even when the project root inode is moved back', async () => fixture(async ({ base, projects, workspaces }) => {
  const root = join(projects, 'doc'); mkdirSync(root)
  writeFileSync(join(root, 'a.txt'), 'original\n')
  const registry = new LocalProjectRegistry([projects], [{ id: 'doc', root, kind: 'local' }])
  const fingerprint = projectFingerprint(registry.get('doc'))
  const request = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-ancestor'), fingerprint }
  await registry.write('doc', () => createProjectSnapshot(request))
  // Deterministic ancestor ABA: retain the ORIGINAL ancestor inode under a
  // tombstone name, create a fresh ancestor at the old path, then move the
  // ORIGINAL child inode back into it. The root inode is unchanged, but the
  // registered parent identity differs and must fail closed on both entry points.
  const priorParent = lstatSync(projects), priorRoot = lstatSync(root)
  const tombstone = join(base, 'old-registered-ancestor')
  renameSync(projects, tombstone)
  mkdirSync(projects, { mode: 0o700 })
  renameSync(join(tombstone, 'doc'), root)
  const replacedParent = lstatSync(projects), restoredRoot = lstatSync(root)
  assert.notDeepEqual([replacedParent.dev, replacedParent.ino], [priorParent.dev, priorParent.ino])
  assert.deepEqual([restoredRoot.dev, restoredRoot.ino], [priorRoot.dev, priorRoot.ino])
  const second = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-2'), fingerprint }
  await assert.rejects(() => registry.write('doc', () => createProjectSnapshot(second)), /identity changed/)
  await assert.rejects(() => verifyProjectSnapshot(request), /identity changed/)
  assert.equal(existsSync(second.directory), false)
}))

test('an intact registered source passes the identity gate and its preview stays read-only', async () => fixture(async ({ projects, workspaces }) => {
  const root = join(projects, 'doc'); mkdirSync(root)
  writeFileSync(join(root, 'a.txt'), 'original\n')
  const registry = new LocalProjectRegistry([projects], [{ id: 'doc', root, kind: 'local' }])
  const request = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-ok'),
    fingerprint: projectFingerprint(registry.get('doc')) }
  await registry.write('doc', () => createProjectSnapshot(request))
  await verifyProjectSnapshot(request)
  writeFileSync(join(request.directory, 'a.txt'), 'worker edit\n')
  const preview = await previewNonGitProjectChanges(request)
  assert.deepEqual(preview.changes.map(x => [x.path, x.action]), [['a.txt', 'modify']])
  assert.equal(lstatSync(root).isDirectory(), true)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'original\n')
}))
