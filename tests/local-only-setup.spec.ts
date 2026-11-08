/** Regression coverage for deliberately disabled GitHub Source startup. */
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Config, localOnlyDeployment, machineOf } from '../src/deployment.ts'
import { writeEnvironment, workerBin, workerGitConfig, verifyEnvironment } from '../src/infra/environment.ts'
import { setupChanged } from '../src/app/setup.ts'
import { SettingsSchema } from '../src/policy.ts'

describe('local-only GitHub-optional startup', () => {
  it('creates no GitHub account identity only after the GitHub source was explicitly turned off', () => {
    const deployed = localOnlyDeployment(machineOf(Config({ stateDir: '/tmp/dsh-local-only' })))
    expect(deployed.repository).toBe('')
    expect(deployed.github).toEqual({ cli: '', login: '', noreply: '' })
    const on = SettingsSchema.parse({})
    const off = SettingsSchema.parse({ sources: { github: { enabled: false, config: {} } } })
    expect(setupChanged(on, off)).toBe(true)
    expect(setupChanged(off, on)).toBe(true)
  })
  it('writes no blank GitHub credential helper and a fail-closed gh worker shim', async () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'dsh-local-only-'))
    try {
      const deployed = localOnlyDeployment(machineOf(Config({ stateDir })))
      await writeEnvironment(deployed, [])
      const config = readFileSync(workerGitConfig(stateDir), 'utf8')
      expect(config).not.toContain('credential "https://github.com"')
      expect(config).not.toContain('insteadOf = git@github.com:')
      const gh = readFileSync(join(workerBin(stateDir), 'gh'), 'utf8')
      expect(gh).toContain('GitHub Source is disabled')
      const runtime = { spawn: () => { throw Error('Disabled GitHub must not run a verification subprocess') } }
      await expect(verifyEnvironment(deployed, runtime as never, new AbortController().signal)).resolves.toBeUndefined()
    } finally { rmSync(stateDir, { recursive: true, force: true }) }
  })
})
