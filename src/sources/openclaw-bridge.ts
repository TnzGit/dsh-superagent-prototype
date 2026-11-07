/** DSH-facing Source for signed OpenClaw Weixin messages. Install as a disabled-by-default DSH plugin. */
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import { createBridgeServer } from '../local-first/weixin-http.ts'
import { actorId, signBody, SOURCE } from '../local-first/weixin-envelope.ts'
import { sourceContext, type SourceContext } from './host.ts'
import type { SourceKind } from './kind.ts'
import type { OutboundMessage } from '../core/index.ts'

const PeerSchema = z.object({ id: z.string().min(1).max(1024) }).strict()
const ConfigSchema = z.object({ peers: z.array(PeerSchema).default([]) }).strict()
type Config = z.infer<typeof ConfigSchema>
const urlOf = (raw: string): string => {
  const url = new URL(raw)
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash) throw new Error('Outbound bridge URL must be loopback HTTP')
  return url.toString()
}
/** The OpenClaw-side transport must deduplicate message.id and return a confirmed 2xx only on successful native delivery. */
export async function sendViaBridge(message: OutboundMessage, secret: string, url: string): Promise<'sent' | 'gone'> {
  if (!secret || secret.length < 32) throw new Error('Bridge secret is not configured')
  if (!url) throw new Error('Outbound OpenClaw transport has not been configured')
  const { accountId, peerId } = message.channel.address
  if (!accountId || !peerId) throw new Error('Missing signed Weixin delivery address')
  const body = JSON.stringify({ id: message.id, accountId, peerId, text: message.text })
  const timestamp = String(Date.now())
  const response = await fetch(urlOf(url), { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', 'x-dsh-timestamp': timestamp,
      'x-dsh-signature': signBody(secret, timestamp, Buffer.from(body)) },
    body, signal: AbortSignal.timeout(30_000) })
  if (response.status === 410) return 'gone'
  if (!response.ok) throw new Error('OpenClaw channel send was not accepted (HTTP ' + response.status + ')')
  return 'sent'
}
/** Current registered peers are read on every inbound request and outbound delivery (not cached at server startup). */
export function kindFor(ctx: SourceContext): SourceKind<Config> {
  return {
    kind: SOURCE,
    title: { zh: '微信 / OpenClaw', en: 'WeChat / OpenClaw' },
    description: { zh: '仅允许明确登记的微信私聊，通过签名桥接交给 DSH 处理。',
      en: 'Authenticated Weixin private messages from explicitly allowed peers.' },
    schema: ConfigSchema,
    health: [SOURCE],
    fields: [{ key: 'peers', type: 'rows', label: { zh: '接收的微信账号与发送者', en: 'Allowed Weixin account/peer IDs' },
      columns: [{ key: 'id', type: 'text', label: { zh: '身份键（编码后的 account:peer）', en: 'Encoded account:peer identity' } }] }],
    scope: ({ meta }, config) => {
      const account = typeof meta.accountId === 'string' ? meta.accountId : ''
      const peer = typeof meta.peerId === 'string' ? meta.peerId : ''
      const id = actorId(account, peer)
      return account && peer && config.peers.some(row => row.id === id)
        ? { listened: true, observed: false, row: id }
        : { listened: false, reason: 'peer_not_allowlisted' }
    },
    channel: {
      allowed: (address, config) => !!address.accountId && !!address.peerId
        && config.peers.some(row => row.id === actorId(address.accountId!, address.peerId!)),
      send: async (_host, message) => sendViaBridge(message, process.env.DSH_WEIXIN_BRIDGE_SECRET ?? '',
        process.env.DSH_WEIXIN_BRIDGE_SEND_URL ?? ''),
      link: () => ({ url: '', label: { zh: '微信私聊', en: 'WeChat direct message' } }),
    },
    threadContext: {
      messageId: trigger => String(trigger.meta.messageId ?? ''),
      // The trigger text is persisted by DSH; neighboring context can be added after the transport supports it.
      read: async () => ({ messages: [], body: {} }),
    },
    policy: {
      schema: z.object({ allowed: z.array(PeerSchema).default([]) }).strict(),
      fields: [{ key: 'allowed', type: 'rows', label: { zh: '可以发起任务的微信用户', en: 'WeChat users who may request work' },
        columns: [{ key: 'id', type: 'text', label: { zh: '身份键', en: 'Actor identity key' } }] }],
      explicit: { zh: '身份在允许名单内且主动私聊该机器人。', en: 'An allowlisted sender speaks directly to this bot.' },
    },
  }
}
export const name = 'dsh-superagent-openclaw-bridge'
export const inject = ['orchestrator']
export function apply(ctx: Context): void {
  const source = sourceContext(ctx.orchestrator, { kind: SOURCE, health: [SOURCE] })
  ctx.effect(() => ctx.orchestrator.sources.register(kindFor(source)), 'openclaw: source kind')
  ctx.effect(() => {
    const secret = process.env.DSH_WEIXIN_BRIDGE_SECRET ?? ''
    const port = Number(process.env.DSH_WEIXIN_BRIDGE_PORT ?? 0)
    if (secret.length < 32 || !Number.isInteger(port) || port < 1 || port > 65535) {
      source.report(SOURCE, { state: 'paused', detail: 'Set bridge secret (>=32 chars) and local TCP port' })
      return () => {}
    }
    const server = createBridgeServer({ secret,
      allowPeers: () => (source.config<Config>(SOURCE)?.peers ?? []).map(row => row.id),
      ingest: trigger => source.receive(trigger),
      onFailure: reason => ctx.logger.warn('openclaw inbound rejected: %s', reason) })
    server.on('error', error => source.report(SOURCE, { state: 'error', detail: String(error) }))
    server.listen(port, '127.0.0.1', () => {
      source.report(SOURCE, { state: 'ready', detail: 'Authenticated loopback bridge listening on ' + port })
    })
    return () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }, 'openclaw: loopback bridge')
}
