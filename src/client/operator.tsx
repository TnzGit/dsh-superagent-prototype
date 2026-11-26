/**
 * Operator page (OL-055 S3.1): the owner's private status view of the installed service, reachable only over loopback with the
 * operator's own bearer grant. It states what is installed and what is paused, who owns the Weixin poll, what the queues and the
 * review holds look like (redacted, never payload text), how the model route is doing, and where the last durable checkpoint is.
 * The one action it offers is an idempotent pause/resume of the controlled test Executor; nothing on this page sends a message or
 * applies a change behind a generic confirm, and carrying the token is stated as possession, never a named login.
 */
import { useState, type ReactNode } from 'react'
import { operatorCall, usePoll, type OperatorStatusView } from './api.ts'
import { Button, Icon, Input, Tag } from './controls.tsx'
import { apiMessages, useAction, usePanel } from './provider.tsx'
import { healthText, valueLabel, when, type T } from './text.ts'
import { sourceMark } from './marks.ts'
import type { Health } from '../sources/host.ts'
import { ConfirmButton, Hint, KeyValues, LoadState, Section, StatusHead } from './widgets.tsx'

const STATE_TONE = { ready: 'success', starting: 'info', paused: 'warning', error: 'danger' } as const
/** One health entry as a tag: state plus, when there is one, its fixed code. The detail is never rendered, so no secret leaks here. */
function healthTag(t: T, health: Pick<Health, 'state' | 'code'>) {
  return <Tag tone={STATE_TONE[health.state as keyof typeof STATE_TONE] ?? 'neutral'}
    title={health.code ? healthText(t, { detail: '', code: health.code, values: {} }) : health.state}>
    {valueLabel(t, 'healthState', health.state)}</Tag>
}
const row = (label: string, value: ReactNode): [string, ReactNode] => [label, value]

export function OperatorPage() {
  const { t, notify } = usePanel()
  const [token, setToken] = useState('')
  // The status route answers only with the grant, so the page does not poll until the operator supplies it.
  const { data, error, reload } = usePoll(() => token
    ? operatorCall<OperatorStatusView>(apiMessages(t), 'GET operator/status', {}, token)
    : new Promise<OperatorStatusView>(() => undefined), [token, t])
  const pause = useAction((paused: boolean) => operatorCall<{ paused: boolean }>(apiMessages(t), 'POST operator/executor/pause',
    { body: { paused } }, token).then(() => undefined), { reload })
  const copy = (value: string) => { void navigator.clipboard?.writeText(value)
    .then(() => notify(t('copied')), () => notify(t('operatorCopyFailed'))) }
  const lifecycle = <>
    <KeyValues rows={[row(t('operatorBearer'), t('operatorBearerValue')), row(t('operatorTransport'), t('operatorTransportValue')),
      row(t('operatorRate'), t('operatorRateValue')), row(t('operatorGrantBlock'), t('operatorGrantBlockValue'))]} />
    <Hint>{t('operatorLifecycleHint')}</Hint>
  </>
  if (!token) return <>
    <StatusHead hint={t('operatorHint')} />
    <Section title={t('operatorGrant')}><Input type="password" value={token} placeholder={t('operatorGrantPlaceholder')}
      autoComplete="off" onChange={event => setToken(event.target.value)} /><Hint>{t('operatorGrantHint')}</Hint></Section>
    <Section title={t('operatorLifecycle')}>{lifecycle}</Section>
  </>
  if (!data) return <>
    <StatusHead hint={t('operatorHint')} />
    <LoadState error={error} loading />
  </>
  const status = data
  return <>
    <StatusHead hint={t('operatorHint')} />
    {error && <LoadState error={error} loading={false} />}
    <Section title={t('operatorBuild')}>
      <KeyValues rows={[
        row(t('operatorBuildName'), <span className="dt-mono">{status.build.name || t('unknownValue')}</span>),
        row(t('operatorBuildVersion'), <span className="dt-mono">{status.build.version || t('unknownValue')}</span>),
        row(t('operatorManifest'), status.build.manifestVersion === undefined ? t('unknownValue') : String(status.build.manifestVersion)),
        row(t('operatorNode'), status.build.node ?? t('unknownValue')),
        row(t('operatorStateDir'), <button type="button" className="dt-textlink dt-mono" title={t('operatorCopyStateDir')}
          onClick={() => copy(status.stateDir)}>{status.stateDir}</button>)]} />
      <Hint>{t('operatorBuildHint')}</Hint>
    </Section>
    <Section title={t('operatorExecutor')} badge={status.executor.paused ? <Tag tone="warning">{t('operatorPausedShort')}</Tag> : undefined}>
      <KeyValues rows={[
        row(t('operatorExecutorPaused'), status.executor.paused ? t('operatorPausedYes') : t('operatorPausedNo')),
        row(t('operatorExecutorRunning'), String(status.executor.running)),
        row(t('operatorExecutorQueued'), String(status.executor.queued)),
        row(t('operatorExecutorWorkers'), String(status.executor.maxWorkers)),
        row(t('operatorExecutorHealth'), healthTag(t, status.executor.health))]} />
      <div className="dt-row-buttons">
        {status.executor.paused
          ? <ConfirmButton variant="outline" icon="play" label={t('operatorResume')} title={t('operatorResume')}
            message={t('operatorResumeConfirm')} onConfirm={async () => { await pause.run(false) }} />
          : <ConfirmButton variant="outline" icon="pause" label={t('operatorPause')} title={t('operatorPause')}
            message={t('operatorPauseConfirm')} onConfirm={async () => { await pause.run(true) }} />}
      </div>
      <Hint>{t('operatorExecutorHint')}</Hint>
    </Section>
    <Section title={t('operatorSources')} count={status.sources.length}>
      {status.sources.length ? <ul className="dt-list">{status.sources.map(source => <li key={source.id} className="dt-row">
        <div className="dt-row-main">
          <div className="dt-att-what">{source.id}</div>
          <div className="dt-row-meta">{sourceMark(t, source.state).label}
            {source.health.map(part => <span key={part.name}>{valueLabel(t, 'health', part.name)} {healthTag(t, part)}</span>)}</div>
        </div>
      </li>)}</ul> : <Hint>{t('operatorNoSources')}</Hint>}
      <Hint>{t('operatorSourcesHint')}</Hint>
    </Section>
    <Section title={t('operatorPoll')}>
      <KeyValues rows={[
        row(t('operatorPollAccount'), status.poll.account ? <span className="dt-mono">{status.poll.account.slice(0, 16)}</span>
          : t('operatorPollNoAccount')),
        row(t('operatorPollGeneration'), status.poll.generation === undefined ? t('operatorPollNoLease') : String(status.poll.generation))]} />
      <Hint>{t('operatorPollHint')}</Hint>
    </Section>
    <Section title={t('operatorQueue')} count={status.queue.length}>
      {status.queue.length ? <ul className="dt-list">{status.queue.map(item => <li key={item.kind} className="dt-row">
        <div className="dt-row-main">
          <div className="dt-att-what">{valueLabel(t, 'health', item.kind)}</div>
          <div className="dt-row-meta">{t('operatorQueueWaiting', { count: item.waiting })}
            {item.oldest ? ` · ${t('operatorQueueOldest')} ${when(item.oldest, t('lang'))}` : ''} {healthTag(t, item)}</div>
        </div>
      </li>)}</ul> : <Hint>{t('operatorQueueEmpty')}</Hint>}
      <Hint>{t('operatorQueueHint')}</Hint>
    </Section>
    <Section title={t('operatorReview')} count={status.review.total}>
      <KeyValues rows={[
        row(t('operatorReviewTotal'), String(status.review.total)),
        ...Object.entries(status.review.reasons).map(([reason, count]) => row(valueLabel(t, 'reason', reason), String(count))),
        ...(status.review.journal ? [row(t('operatorJournalEntries'), String(status.review.journal.entries)),
          row(t('operatorJournalProjected'), String(status.review.journal.projected)),
          row(t('operatorJournalCurrent'), status.review.journal.current ? t('operatorJournalYes') : t('operatorJournalNo'))] : [])]} />
      <Hint>{t('operatorReviewHint')}</Hint>
    </Section>
    <Section title={t('operatorModels')}>
      <KeyValues rows={[row(t('operatorModelsHealth'), healthTag(t, status.models)),
        row(t('operatorPolicyVersion'), <span className="dt-mono">{status.policyVersion}</span>)]} />
      <Hint>{t('operatorModelsHint')}</Hint>
    </Section>
    <Section title={t('operatorCheckpoint')}>
      <KeyValues rows={[
        row(t('operatorCheckpointSeq'), status.checkpoint.lastSeq === undefined ? t('operatorCheckpointNone') : String(status.checkpoint.lastSeq)),
        row(t('operatorCheckpointAt'), status.checkpoint.lastAt ? when(status.checkpoint.lastAt, t('lang')) : t('operatorCheckpointNone')),
        row(t('operatorCheckpointEntries'), String(status.checkpoint.durableEntries)),
        row(t('operatorCheckpointProjection'), status.checkpoint.projectionCurrent === undefined ? t('unknownValue')
          : status.checkpoint.projectionCurrent ? t('operatorJournalYes') : t('operatorJournalNo'))]} />
      <Hint>{t('operatorCheckpointHint')}</Hint>
    </Section>
    <Section title={t('operatorLifecycle')} action={<Button variant="outline" size="sm" icon={<Icon name="refresh" size={14} />}
      onClick={() => { void reload() }}>{t('operatorRefresh')}</Button>}>
      {lifecycle}
    </Section>
  </>
}
