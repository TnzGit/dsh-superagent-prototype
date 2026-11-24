/** Reliable outbound message delivery backed by persistent receipts and retried reply effects. */
import type { OutboundMessage, Outbox as OutboxPort, ReplyStatus } from '../core/index.ts'
import type { Commands } from '../infra/commands.ts'
import { checkedImText } from '../infra/text.ts'
import type { SourceRegistry } from '../sources/registry.ts'
import { FAILURES_BEFORE_ERROR, Later, type Effects } from './effects.ts'
import type { Store } from './store.ts'

export interface OutboxHost {
  readonly store: Pick<Store, 'atomic' | 'receipts'>
  readonly effects: Pick<Effects, 'enqueue' | 'cancel' | 'handle' | 'idle'>
  readonly sources: Pick<SourceRegistry, 'instance' | 'channelAllowed' | 'prepareSend' | 'send'>
  readonly commands: Commands
  paused(): boolean
}

/**
 * Persists outbound channel messages as receipts and delivers them sequentially through `Effects` and `SourceRegistry`.
 * Implements the core `Outbox` port for `Engine` and source contexts, ensuring per-conversation ordering for each ticket until an earlier message fails repeatedly.
 * Messages wait while processing is paused or their source is unavailable, and settle as dropped when the target conversation is ignored or gone.
 */
export class Outbox implements OutboxPort {
  constructor(private readonly host: OutboxHost) {
    host.effects.handle('reply', (_payload, id) => this.deliver(id), { limit: () => host.paused() ? 0 : 1, retry: [5000, 300_000] })
  }
  /** Record a message receipt and enqueue its delivery effect atomically; duplicate message IDs are ignored. */
  send(message: OutboundMessage): void {
    // Validate IM reply length here; acknowledgements are already validated when decided.
    if (message.kind === 'reply' && message.channel.source === 'feishu') checkedImText(message.text)
    const { store, effects } = this.host
    store.atomic(() => { if (store.receipts.add(message)) effects.enqueue('reply', message.id, {}) })
  }
  status(id: string): ReplyStatus | undefined { return this.host.store.receipts.get(id)?.status }
  withdraw(id: string): void {
    const { store, effects } = this.host
    store.atomic(() => { if (store.receipts.withdraw(id)) effects.cancel('reply', id) })
  }
  sent(): Promise<void> { return this.host.effects.idle('reply') }
  private async deliver(id: string): Promise<void> {
    const { store, sources, commands } = this.host
    const receipt = store.receipts.get(id)
    if (receipt?.status !== 'pending' || receipt.review) return
    // A process can crash after the durable claim and before the HTTP response or receipt settlement.
    // Recovered in-flight Weixin requests ALWAYS require human reconciliation, never replay.
    const isWeixin = receipt.channel.source === 'weixin'
    if (isWeixin && receipt.singleSendAttemptAt) {
      store.receipts.holdForReview(id, 'ambiguous_send')
      return
    }
    if (!sources.instance(receipt.channel.source)?.enabled) throw new Later('The Source is off or not installed')
    // Hold later messages for the same ticket and conversation behind an earlier pending message until it exceeds the failure threshold.
    if (store.receipts.behind(id, FAILURES_BEFORE_ERROR)) throw new Later('An earlier message of this ticket to this conversation waits')
    if (!sources.channelAllowed(receipt.channel)) { store.receipts.settle(receipt, 'channelIgnored'); return }
    if (isWeixin) {
      const preflight = await sources.prepareSend(receipt)
      if (preflight.status === 'waiting') throw new Later('Weixin is not ready for safe sending')
      if (preflight.status === 'gone') { store.receipts.settle(receipt, 'channelGone'); return }
      if (preflight.status === 'review') { store.receipts.holdForReview(id, preflight.reason); return }
      // Recheck live authorization after any async preflight and before claiming.
      if (!sources.instance(receipt.channel.source)?.enabled) throw new Later('Weixin Source disabled')
      if (!sources.channelAllowed(receipt.channel)) { store.receipts.settle(receipt, 'channelIgnored'); return }
      if (!store.atomic(() => store.receipts.claimOneShotSend(id))) {
        store.receipts.holdForReview(id, 'ambiguous_send')
        return
      }
    }
    try {
      const result = await sources.send(receipt, commands)
      if (result === 'waiting') {
        if (isWeixin) { store.receipts.holdForReview(id, 'ambiguous_send'); return }
        throw new Later('The Source is not installed')
      }
      store.receipts.settle(receipt, result === 'gone' ? 'channelGone' : 'sent')
    } catch (error) {
      if (!isWeixin) throw error
      // Timeout, EOF and provider failures may occur AFTER remote acceptance.
      // Do not claim "sent" and NEVER issue another network call.
      store.receipts.holdForReview(id, 'ambiguous_send')
    }
  }
}
