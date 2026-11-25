/** OL-053 subagent B: registered-source identity gate (same-path ABA) for durable snapshot creation.
 * The path-only fingerprint passes when an external writer replaces the registered source directory
 * with a fresh inode at the same path; the registration-time dev/inode identity is the only evidence
 * that the snapshot is copied from the project the operator actually registered. Synthetic copies only:
 * no real project, model, Weixin, host service, network or credentials. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
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

test('replacing the registered source with a fresh inode at the same path fails the snapshot creation identity gate', async () => fixture(async ({ projects, workspaces }) => {
  const root = join(projects, 'doc'); mkdirSync(root)
  writeFileSync(join(root, 'a.txt'), 'original\n')
  const registry = new LocalProjectRegistry([projects], [{ id: 'doc', root, kind: 'local' }])
  const fingerprint = projectFingerprint(registry.get('doc'))
  const first = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-1'), fingerprint }
  await registry.write('doc', () => createProjectSnapshot(first))
  await verifyProjectSnapshot(first)
  // ABA: an external writer deletes the source and recreates it at the SAME path with a NEW inode.
  // The path-derived fingerprint is byte-identical, so only the captured dev/inode identity can catch it.
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { mode: 0o700 }); writeFileSync(join(root, 'a.txt'), 'original\n')
  assert.equal(projectFingerprint(registry.get('doc')), fingerprint, 'path fingerprint is unchanged by ABA')
  const second = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-2'), fingerprint }
  await assert.rejects(() => registry.write('doc', () => createProjectSnapshot(second)), /identity changed/)
  // The rejected creation must not leave a half-prepared second workspace behind.
  assert.equal(existsSync(second.directory), false)
  assert.equal(readFileSync(join(root, 'a.txt'), 'utf8'), 'original\n')
}))

test('replacing a registered ancestor directory fails the snapshot creation identity gate even when the project root inode is moved back', async () => fixture(async ({ base, projects, workspaces }) => {
  const root = join(projects, 'doc'); mkdirSync(root)
  writeFileSync(join(root, 'a.txt'), 'original\n')
  // Decoy allocation consumes the freed inode number so each replacement carries a
  // genuinely different dev/inode identity (Linux reuses just-freed inodes immediately).
  const decoy = () => { mkdirSync(join(base, 'decoy-' + decoy.n++), { mode: 0o700 }) }
  decoy.n = 0
  const registry = new LocalProjectRegistry([projects], [{ id: 'doc', root, kind: 'local' }])
  const fingerprint = projectFingerprint(registry.get('doc'))
  const request = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-ancestor'), fingerprint }
  await registry.write('doc', () => createProjectSnapshot(request))
  // Swap the allowlist root (an ancestor of the project) for a fresh directory and recreate the project inside it.
  // Filesystems reuse just-freed inode numbers for the next allocation (certain on Linux ext4/xfs),
  // so each replacement is preceded by a decoy directory that consumes the freed inode; the swap then
  // carries a genuinely different dev/inode identity on every platform.
  decoy(); rmSync(projects, { recursive: true, force: true })
  decoy(); mkdirSync(projects, { mode: 0o700 })
  decoy(); rmSync(root, { recursive: true, force: true })
  decoy(); mkdirSync(root, { mode: 0o700 }); writeFileSync(join(root, 'a.txt'), 'original\n')
  const second = { registry, projectId: 'doc', directory: join(workspaces, 'doc', 'ticket-2'), fingerprint }
  await assert.rejects(() => registry.write('doc', () => createProjectSnapshot(second)), /identity changed/)
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
