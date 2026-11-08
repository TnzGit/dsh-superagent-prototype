import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nativeWeixinKind, canReceive, readNativeCredentials } from '../src/sources/weixin-native.ts'

describe('native Weixin Source (no OpenClaw runtime)', () => {
  it('requires explicit source peer allowlist and has separate Policy authorization', () => {
    const none = nativeWeixinKind.schema.parse({})
    expect(canReceive(none, 'peer-alice')).toBe(false)
    const allowed = nativeWeixinKind.schema.parse({ allowedPeers: [{ id: 'peer-alice' }] })
    expect(canReceive(allowed, 'peer-alice')).toBe(true)
    expect(nativeWeixinKind.scope?.({ meta: { peer: 'peer-alice' } }, allowed)).toMatchObject({ listened: true })
    expect(nativeWeixinKind.scope?.({ meta: { peer: 'intruder' } }, allowed)).toMatchObject({ listened: false })
    expect(nativeWeixinKind.channel?.allowed?.({ peer: 'intruder' }, allowed)).toBe(false)
    expect(nativeWeixinKind.policy?.schema.parse({ allowed: [{ id: 'peer-alice' }] })).toMatchObject({ allowed: [{ id: 'peer-alice' }] })
  })
  it('never attempts an expired relay reply (no token refresh or network call)', async () => {
    const old = {
      id: 'relay-id', text: 'done', kind: 'reply' as const,
      channel: { source: 'weixin', thread: 'weixin:peer-alice', address: {
        peer: 'peer-alice', messageId: 'm1', contextToken: 'old-private-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      } },
    }
    await expect(nativeWeixinKind.channel!.send({ commands: undefined as never }, old)).resolves.toBe('gone')
    await expect(nativeWeixinKind.channel!.send({ commands: undefined as never }, {
      ...old, channel: { ...old.channel, address: { ...old.channel.address, expiresAt: 'invalid-date' } },
    })).resolves.toBe('gone')
  })
  it('reads owner-only credentials from a separate file, refuses weak modes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-'))
    const file = join(dir, 'cred.json')
    try {
      writeFileSync(file, JSON.stringify({ token: 'test-token-is-not-real-12345', baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
      expect(readNativeCredentials(file)?.token).toBe('test-token-is-not-real-12345')
      chmodSync(file, 0o644)
      expect(() => readNativeCredentials(file)).toThrow(/owner-only/)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
