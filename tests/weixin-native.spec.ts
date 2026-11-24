import { mkdtempSync, writeFileSync, rmSync, chmodSync, symlinkSync, mkdirSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { nativeWeixinKind, canReceive, readNativeCredentials } from '../src/sources/weixin-native.ts'
import { WEIXIN_REPLY_MAX_AGE_MS, messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'

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

describe('native Weixin credential path hardening (OL-20261124-052 P2)', () => {
  // Synthetic constants only; disposable temp files; NO real credentials, NO real network.
  const writeCred = (file: string, token = 'test-token-is-not-real-12345') =>
    writeFileSync(file, JSON.stringify({ token, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })

  it('refuses a parent directory replaced by a symlink into a world-writable attacker directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-ancestor-'))
    try {
      const real = join(dir, 'real-parent')
      mkdirSync(real)
      const file = join(real, 'cred.json')
      writeCred(file)
      // Ancestor replacement: swap the parent directory itself for a symlink to an attacker directory.
      const attacker = join(dir, 'attacker')
      mkdirSync(attacker)
      chmodSync(attacker, 0o777) // world-writable, no sticky bit
      const swapped = join(dir, 'swapped')
      mkdirSync(swapped)
      const swappedFile = join(swapped, 'cred.json')
      writeCred(swappedFile)
      rmSync(swapped, { recursive: true })
      symlinkSync(attacker, swapped)
      expect(() => readNativeCredentials(swappedFile)).toThrow(/ancestor/)
      expect(readNativeCredentials(file)?.token).toBe('test-token-is-not-real-12345')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('refuses a world-writable parent directory but accepts a sticky-bit directory (portable /tmp shape)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-ancestor-'))
    try {
      const open = join(dir, 'open-parent')
      mkdirSync(open)
      const file = join(open, 'cred.json')
      writeCred(file)
      chmodSync(open, 0o777)
      expect(() => readNativeCredentials(file)).toThrow(/ancestor/)
      // Sticky bit (0o1000) makes non-owners unable to rename each other's entries — portable Linux+macOS.
      chmodSync(open, 0o1777)
      expect(readNativeCredentials(file)?.token).toBe('test-token-is-not-real-12345')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('refuses an intermediate ancestor symlinked to a group-writable directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-ancestor-'))
    try {
      const attacker = join(dir, 'group-attacker')
      mkdirSync(attacker)
      chmodSync(attacker, 0o775) // group-writable, no sticky bit
      const inner = join(attacker, 'nest')
      mkdirSync(inner)
      const file = join(inner, 'cred.json')
      writeCred(file)
      // A path component `link/nest` that is a symlink into the group-writable attacker tree.
      const link = join(dir, 'outer-link')
      mkdirSync(link)
      const linkedFile = join(link, 'nest', 'cred.json')
      expect(() => readNativeCredentials(linkedFile)).toThrow() // missing nest resolves before realpath fails
      symlinkSync(inner, join(link, 'nest'))
      // realpath resolves the symlink to the group-writable attacker tree and the walk must refuse it.
      expect(() => readNativeCredentials(linkedFile)).toThrow(/ancestor/)
      expect(() => readNativeCredentials(file)).toThrow(/ancestor/)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('still refuses a final-component symlink while accepting the real file (O_NOFOLLOW on the fd)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-ancestor-'))
    try {
      const file = join(dir, 'cred.json')
      writeCred(file)
      const link = join(dir, 'link.json')
      symlinkSync(file, link)
      expect(() => readNativeCredentials(link)).toThrow()
      expect(readNativeCredentials(file)?.token).toBe('test-token-is-not-real-12345')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  // REAL LIMITATION (unsolved, recorded here): between closing an ancestor fd and opening the final
  // file there is still a TOCTOU window — an attacker who OWNS that ancestor directory (or root) can
  // swap the directory contents in that gap, and Node exposes no openat() to pin the whole chain.
  // The preflight bounds the threat (world-writable non-sticky ancestors are refused outright, so a
  // non-owner cannot perform the swap there) but does not eliminate the owner-side race. Portable on
  // Linux and macOS via the sticky-bit shape; no macOS-only brittle constants without CI fallback.
  it('records the residual ancestor TOCTOU as an accepted bounded limitation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-ancestor-'))
    try {
      const parent = join(dir, 'owner-parent')
      mkdirSync(parent)
      const file = join(parent, 'cred.json')
      writeCred(file)
      // The owner of a private 0700 parent can still replace it out-of-band; preflight passes
      // because the owner is trusted, and this is the documented residual risk, not a bug here.
      expect(readNativeCredentials(file)?.token).toBe('test-token-is-not-real-12345')
      // Replacing the whole parent by an attacker-owned world-writable directory before the read
      // is what the preflight DOES catch (see the symlink-replacement case above).
      chmodSync(parent, 0o777)
      expect(() => readNativeCredentials(file)).toThrow(/ancestor/)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('native Weixin egress guards and TTL ceiling (OL-20261124-052 P2)', () => {
  it('abort-on-egress tripwire: any fetch to a non-iLink endpoint fails the test', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-egress-'))
    try {
      const file = join(dir, 'cred.json')
      writeFileSync(file, JSON.stringify({ token: 'test-token-is-not-real-12345', baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
      const calls: string[] = []
      vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', file)
      vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
        const url = String(input)
        calls.push(url)
        if (!url.startsWith('https://ilinkai.weixin.qq.com/')) throw Error('EGRESS TRIPWIRE: ' + url)
        return new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200, headers: { 'content-type': 'application/json' } })
      }))
      const fresh = messageToTrigger({
        message_id: 'm-egress', from_user_id: 'peer-alice', message_type: 1, message_state: 2,
        create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
        item_list: [{ type: 1, text_item: { text: 'hi' } }],
      }, createHash('sha256').update('test-token-is-not-real-12345').digest('hex'))!
      const outbound = { id: 'outbox-egress', text: 'ok', kind: 'reply' as const, channel: fresh.channel! }
      expect(nativeWeixinKind.channel!.preflight!(outbound)).toMatchObject({ status: 'ready' })
      await expect(nativeWeixinKind.channel!.send({ commands: undefined as never }, outbound)).resolves.toBe('sent')
      expect(calls).toEqual(['https://ilinkai.weixin.qq.com/ilink/bot/sendmessage'])
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('expired-address send performs zero fetches (guard stays intact)', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    try {
      const old = {
        id: 'relay-id', text: 'done', kind: 'reply' as const,
        channel: { source: 'weixin', thread: 'weixin:peer-alice', address: {
          peer: 'peer-alice', messageId: 'm1', contextToken: 'token',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        } },
      }
      await expect(nativeWeixinKind.channel!.send({ commands: undefined as never }, old)).resolves.toBe('gone')
      expect(spy).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })

  it('keeps the 60-minute TTL as a conservative application cap, not an official expiry', () => {
    // The source comment states this is NOT a verified Tencent iLink token lifetime; the
    // application clamps every reply window to at most this ceiling.
    expect(WEIXIN_REPLY_MAX_AGE_MS).toBe(60 * 60 * 1000)
    const future = messageToTrigger({
      message_id: 'm-future', from_user_id: 'peer-alice', message_type: 1, message_state: 2,
      create_time_ms: Date.now() + 10 * 24 * 3600_000, context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
      item_list: [{ type: 1, text_item: { text: 'hi' } }],
    })!
    const windowMs = Date.parse(String(future.channel!.address.expiresAt)) - Date.now()
    expect(windowMs).toBeLessThanOrEqual(WEIXIN_REPLY_MAX_AGE_MS + 1000)
    expect(windowMs).toBeGreaterThan(0)
    // realpath sanity: the guard walks resolved paths, so macOS /var symlink prefixes do not break it.
    expect(realpathSync(tmpdir())).not.toBe(tmpdir())
  })
})
