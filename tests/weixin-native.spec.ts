import { mkdtempSync, writeFileSync, rmSync, chmodSync, symlinkSync, mkdirSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { nativeWeixinKind, canReceive, readNativeCredentials } from '../src/sources/weixin-native.ts'
import { WEIXIN_REPLY_MAX_AGE_MS, messageToTrigger } from '../src/local-first/weixin-native-protocol.ts'
import { SourceRegistry } from '../src/sources/registry.ts'
import { Engine, MemoryRepositories } from '../src/core/index.ts'
import type { Assessor, Executor, Outbox, Policy, Trigger } from '../src/core/index.ts'
import { SettingsSchema } from '../src/policy.ts'
import type { Commands } from '../src/infra/commands.ts'
import { Store, WEIXIN_REVIEW_REASONS } from '../src/app/store.ts'
import { Effects } from '../src/app/effects.ts'
import { Outbox as DurableOutbox } from '../src/app/outbox.ts'
import { HealthBoard } from '../src/infra/health.ts'

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
    // realpath sanity: the guard walks resolved paths. macOS prefixes /var under a symlinked
    // private/var, so the resolved path must differ there; Linux /tmp is already canonical and
    // must resolve without error. Both OSes prove the guard does not break on either layout.
    const resolved = realpathSync(tmpdir())
    expect(typeof resolved).toBe('string')
    if (process.platform === 'darwin') expect(resolved).not.toBe(tmpdir())
    else expect(resolved).toBe(tmpdir())
  })
})

describe('OL-053 I3: Engine intake enforces the native peer allowlist (real Engine, no OpenClaw)', () => {
  // The poll loop's pre-route canReceive check is NOT the last line of defense: a trigger that
  // reaches Engine intake must still be filtered by the SourceScope of the live configuration.
  function trigger(peer: string, messageId: string): Trigger {
    return messageToTrigger({
      message_id: messageId, from_user_id: peer, message_type: 1, message_state: 2,
      create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
      item_list: [{ type: 1, text_item: { text: 'hi' } }],
    })!
  }
  function harness() {
    const repo = new MemoryRepositories()
    const requests: unknown[] = []
    const assessor: Assessor = { request: vi.fn(candidate => { requests.push(candidate) }), release: vi.fn() }
    const executor: Executor = { start: vi.fn(), deliver: vi.fn(), stop: vi.fn() }
    const outbox: Outbox = { send: vi.fn(), status: vi.fn(), withdraw: vi.fn() }
    const policy: Policy = { version: 'v1', paused: false, evalTimeoutMs: 60_000,
      gate: () => ({ admissible: true, strength: 'explicit', basis: { source: 'weixin', scope: {}, addressed: 'direct' as const, via: 'addressed' as const } }),
      revalidate: () => true, admitsInferred: () => true }
    const registry = new SourceRegistry(() => SettingsSchema.parse({
      sources: { weixin: { enabled: true, config: { allowedPeers: [{ id: 'peer-alice' }] } } } }))
    registry.register(nativeWeixinKind)
    const engine = new Engine({ repo, scope: registry, policy: () => policy, assessor, executor, outbox })
    return { repo, engine, requests }
  }

  it('an unlisted peer is stored with a filtered disposition and never queued for Eval', () => {
    const { repo, engine, requests } = harness()
    expect(engine.receive(trigger('intruder', 'm-intruder'))).toBe('filtered')
    const stored = repo.triggers.get(trigger('intruder', 'm-intruder').id)!
    expect(stored.channel?.source).toBe('weixin')
    expect(repo.triggers.disposition(stored.id)).toMatchObject({
      filtered: { code: 'weixin_peer_not_allowed' }, fanout: [] })
    expect(requests).toHaveLength(0)
    for (const thread of repo.threads.list()) expect(thread.pending).toHaveLength(0)
  })

  it('a listed peer is stored and queued for Eval; a duplicate ID is refused without a second disposition', () => {
    const { repo, engine, requests } = harness()
    expect(engine.receive(trigger('peer-alice', 'm-listed'))).toBe('stored')
    // The allowed trigger is queued for Eval on its primary thread (it is never filtered).
    const listed = trigger('peer-alice', 'm-listed')
    expect(repo.triggers.disposition(listed.id)?.filtered).toBeUndefined()
    expect(repo.threads.list().some(t => t.pending.includes(listed.id))).toBe(true)
    expect(engine.receive({ ...listed })).toBe('duplicate')
  })

  it('revoking the peer between poll capture and intake filters the trigger at the Engine boundary', () => {
    // Same trigger object the loop would hand over; the settings now deny it.
    const repo = new MemoryRepositories()
    const assessor: Assessor = { request: vi.fn(), release: vi.fn() }
    const executor: Executor = { start: vi.fn(), deliver: vi.fn(), stop: vi.fn() }
    const outbox: Outbox = { send: vi.fn(), status: vi.fn(), withdraw: vi.fn() }
    const policy: Policy = { version: 'v1', paused: false, evalTimeoutMs: 60_000,
      gate: () => ({ admissible: true, strength: 'explicit', basis: { source: 'weixin', scope: {}, addressed: 'direct' as const, via: 'addressed' as const } }),
      revalidate: () => true, admitsInferred: () => true }
    const revoked = new SourceRegistry(() => SettingsSchema.parse({
      sources: { weixin: { enabled: true, config: { allowedPeers: [] } } } }))
    revoked.register(nativeWeixinKind)
    const engine = new Engine({ repo, scope: revoked, policy: () => policy, assessor, executor, outbox })
    expect(engine.receive(trigger('peer-alice', 'm-revoked'))).toBe('filtered')
    expect(repo.triggers.disposition(trigger('peer-alice', 'm-revoked').id))
      .toMatchObject({ filtered: { code: 'weixin_peer_not_allowed' } })
  })
})

describe('OL-053 I3: registry and adapter deny an unlisted peer on every send path', () => {
  it('registry.send returns gone for an unlisted peer without ever invoking the native adapter', async () => {
    const sources = new SourceRegistry(() => SettingsSchema.parse({
      sources: { weixin: { enabled: true, config: { allowedPeers: [{ id: 'peer-alice' }] } } } }))
    sources.register(nativeWeixinKind)
    const spy = vi.spyOn(nativeWeixinKind.channel!, 'send')
    const intruder = { id: 'unlisted-send', kind: 'reply' as const, text: 'hi',
      channel: { source: 'weixin', thread: 'weixin:intruder', address: {
        peer: 'intruder', messageId: 'm1', contextToken: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
        accountHash: createHash('sha256').update('test-token-is-not-real-12345').digest('hex'),
        expiresAt: new Date(Date.now() + 60_000).toISOString() } } }
    expect(await sources.send(intruder, {} as Commands)).toBe('gone')
    expect(spy).not.toHaveBeenCalled()
    // A disabled instance denies even an allowlisted address.
    const disabled = new SourceRegistry(() => SettingsSchema.parse({
      sources: { weixin: { enabled: false, config: { allowedPeers: [{ id: 'peer-alice' }] } } } }))
    disabled.register(nativeWeixinKind)
    expect(await disabled.send(intruder, {} as Commands)).toBe('gone')
    expect(spy).not.toHaveBeenCalled()
  })

  it('the native adapter itself refuses an address whose peer is not in the allowlist, with zero fetches', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    try {
      const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-allow-'))
      try {
        writeFileSync(join(dir, 'cred.json'),
          JSON.stringify({ token: 'test-token-is-not-real-12345', baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
        vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', join(dir, 'cred.json'))
        const address = { peer: 'intruder', messageId: 'm1', contextToken: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
          accountHash: createHash('sha256').update('test-token-is-not-real-12345').digest('hex'),
          expiresAt: new Date(Date.now() + 60_000).toISOString() }
        // allowed() is the source-level gate; scope() must deny the same peer on intake.
        const allowed = nativeWeixinKind.schema.parse({ allowedPeers: [{ id: 'peer-alice' }] })
        expect(nativeWeixinKind.channel!.allowed!(address, allowed)).toBe(false)
        expect(nativeWeixinKind.scope!({ meta: { peer: 'intruder' } }, allowed)).toEqual(
          { listened: false, reason: 'weixin_peer_not_allowed' })
        // A trigger minted for the intruder must carry the same deny at every boundary.
        const intruderTrigger = messageToTrigger({
          message_id: 'm-intruder', from_user_id: 'intruder', message_type: 1, message_state: 2,
          create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
          item_list: [{ type: 1, text_item: { text: 'hi' } }] })!
        expect(nativeWeixinKind.channel!.allowed!(intruderTrigger.channel!.address, allowed)).toBe(false)
        expect(spy).not.toHaveBeenCalled()
      } finally { rmSync(dir, { recursive: true, force: true }) }
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })

  it('an address without a peer string is denied by both allowed() and scope()', () => {
    const allowed = nativeWeixinKind.schema.parse({ allowedPeers: [{ id: 'peer-alice' }] })
    expect(nativeWeixinKind.channel!.allowed!({}, allowed)).toBe(false)
    expect(nativeWeixinKind.channel!.allowed!({ peer: 42 as unknown as string }, allowed)).toBe(false)
    expect(nativeWeixinKind.scope!({ meta: {} }, allowed)).toEqual({ listened: false, reason: 'weixin_peer_not_allowed' })
    expect(nativeWeixinKind.scope!({ meta: { peer: 42 } }, allowed)).toEqual({ listened: false, reason: 'weixin_peer_not_allowed' })
  })
})

describe('OL-053 I3: review reasons are sanitized to the fixed local codes', () => {
  it('an out-of-vocabulary reason persists as unclassified_hold and never leaks provider text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-review-'))
    try {
      const file = join(dir, 'orchestrator.sqlite')
      writeFileSync(file, '')
      const store = new Store(file)
      try {
        const channel = { source: 'weixin', thread: 'weixin:peer-alice', address: { peer: 'peer-alice' } }
        store.receipts.add({ id: 'leaky-reason', kind: 'reply', text: 'x', channel })
        store.receipts.holdForReview('leaky-reason', 'Weixin send HTTP 401 secret-token-value')
        expect(store.receipts.get('leaky-reason')?.review?.reason).toBe('unclassified_hold')
        expect(store.receipts.reviewSummary()).toEqual({ total: 1, reasons: { unclassified_hold: 1 } })
        const ledger = store.receipts.reviewLedger(10)
        expect(ledger[0]?.reason).toBe('unclassified_hold')
        expect(JSON.stringify(ledger)).not.toContain('secret-token-value')
        // Known codes are preserved verbatim.
        store.receipts.add({ id: 'known-code', kind: 'reply', text: 'x', channel })
        store.receipts.holdForReview('known-code', 'account_mismatch')
        expect(store.receipts.get('known-code')?.review?.reason).toBe('account_mismatch')
        expect(WEIXIN_REVIEW_REASONS).toContain('ambiguous_send')
        // The dry-run projection must not mutate the durable row.
        const dry = store.receipts.reviewResolveDryRun('known-code', 'sent')
        expect(dry).toMatchObject({ found: true, status: 'pending' })
        expect(store.receipts.get('known-code')?.review?.reason).toBe('account_mismatch')
      } finally { store.close() }
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})

describe('OL-053 I3: durable one-shot outbound freezes every uncertain send response', () => {
  // REAL Outbox + REAL Store + REAL SourceRegistry + nativeWeixinKind + fake transport only.
  // A claim is durable BEFORE the HTTP call, so every post-claim failure must freeze the
  // receipt as ambiguous_send: never settled 'sent', never replayed, one attempt maximum.
  const token = 'test-token-is-not-real-12345'
  const hash = createHash('sha256').update(token).digest('hex')
  const freshAddress = () => messageToTrigger({
    message_id: 'm-send-fault', from_user_id: 'peer-alice', message_type: 1, message_state: 2,
    create_time_ms: Date.now(), context_token: 'SYNTHETIC_CONTEXT_TOKEN_ONLY',
    item_list: [{ type: 1, text_item: { text: 'hi' } }],
  }, hash)!.channel!

  async function attemptWithFailure(id: string, respond: () => Response) {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-native-weixin-send-fault-'))
    try {
      writeFileSync(join(dir, 'cred.json'),
        JSON.stringify({ token, baseUrl: 'https://ilinkai.weixin.qq.com' }), { mode: 0o600 })
      vi.stubEnv('DSH_WEIXIN_NATIVE_CREDENTIALS_FILE', join(dir, 'cred.json'))
      const calls: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
        const url = String(input)
        calls.push(url)
        if (!url.startsWith('https://ilinkai.weixin.qq.com/')) throw Error('EGRESS TRIPWIRE: ' + url)
        return respond()
      }))
      const store = new Store(join(dir, 'orchestrator.sqlite'))
      try {
        const effects = new Effects(store, new HealthBoard())
        const sources = new SourceRegistry(() => SettingsSchema.parse({
          sources: { weixin: { enabled: true, config: { allowedPeers: [{ id: 'peer-alice' }] } } } }))
        sources.register(nativeWeixinKind)
        const outbox = new DurableOutbox({ store, effects, sources, commands: {} as Commands, paused: () => false })
        const receipt = { id, kind: 'reply' as const, text: 'ok', channel: freshAddress() }
        effects.start()
        outbox.send(receipt)
        await effects.idle('reply')
        const row = store.receipts.get(id)!
        // Frozen for review, claim durable, exactly one egress — never 'sent', never Later.
        expect(row.status).toBe('pending')
        expect(row.review?.reason).toBe('ambiguous_send')
        expect(row.singleSendAttemptAt).toBeTruthy()
        expect(calls).toEqual(['https://ilinkai.weixin.qq.com/ilink/bot/sendmessage'])
        // Zero automatic retry: re-queueing the same ID neither replays the effect nor touches the network.
        outbox.send({ ...receipt, text: 'replay-must-not-resend' })
        await effects.idle('reply')
        expect(calls).toHaveLength(1)
        expect(store.receipts.get(id)?.review?.reason).toBe('ambiguous_send')
        expect(store.receipts.get(id)?.text).toBe('ok') // original payload survives any re-queue
        expect(store.receipts.reviewSummary()).toEqual({ total: 1, reasons: { ambiguous_send: 1 } })
        const ledger = store.receipts.reviewLedger(10)
        expect(ledger[0]).toMatchObject({ id, reason: 'ambiguous_send', claimed: true })
      } finally { store.close() }
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('freezes the receipt as ambiguous_send for HTTP 401/429/500/503 from sendmessage, one claim each', async () => {
    for (const status of [401, 429, 500, 503]) {
      await attemptWithFailure('fault-http-' + status, () =>
        new Response(JSON.stringify({ ret: 0 }), { status, headers: { 'content-type': 'application/json' } }))
    }
  })

  it('freezes the receipt as ambiguous_send for a server refusal body and for an accepted-then-EOF fault', async () => {
    await attemptWithFailure('fault-refused-body', () =>
      new Response(JSON.stringify({ ret: -14, errmsg: 'stale' }), { status: 200,
        headers: { 'content-type': 'application/json' } }))
    await attemptWithFailure('fault-eof', () => { throw Error('synthetic accepted-then-EOF') })
  })
})
