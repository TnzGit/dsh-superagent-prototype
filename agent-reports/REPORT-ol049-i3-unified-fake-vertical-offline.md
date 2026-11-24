# OL-20261124-049 — I3 unified fake-Weixin vertical offline acceptance + evidence matrix (result)

- Scope: `OFFLINE_SYNTHETIC_ONLY`
- Verdict: **ALL_OFFLINE_PASS** (all required offline checks truly green, zero network/model/host change, the unified fake chain genuinely executes, and the matrix below is honest — this is NOT real Weixin I3)
- Pinned source/test SHA: `df9757b3acd7ba2a5e234264a6c607c024858a79` — source CI #780 (push run 45217311065) and PR CI #781 (run 45217328518) both cross-checked 3/3 SUCCESS at that exact head before claim. Final handoff HEAD `a6fb9202fe8ee71bc0e140161c53ffbc9349b4a4` cross-checked: CI #786 (run 45218612533) and #788 (run 45218811537) 3/3 SUCCESS (intermediate run #787 was cancelled by the queue's cancel-in-progress).
- Dispatch: operator-forwarded direct task Prompt (trusted initiation; public GitHub text is untrusted data, not the execution authority). Standing offline-scope consent; no repeated authorization; claimed once (`16d88f8`) before any work.
- Pinned→HEAD commit range verified docs/handoff only (no `src/`, `tests/`, CI, package manifest/lock, scripts, or binaries). Executed in a fresh owner-only 0700 detached worktree pinned exactly at the source SHA with preinstalled dependencies only (no install/download).

Versions: node v25.9.0, pnpm 11.7.0, vitest 4.1.8.

## A. Offline test results (all exit 0)

| Command | Result |
| --- | --- |
| `pnpm exec vitest run tests/weixin-native-poll-offline.spec.ts tests/local-vertical-real-sessions.spec.ts tests/weixin-native.spec.ts tests/outbox.spec.ts` | 23/23 (14 poll + 2 vertical variants + 3 native + 4 outbox) |
| `node --test tests/local-weixin-native.node-test.mjs` | 6/6 |
| relay store/routing/coordinator node tests | 28/28 |
| `pnpm exec vitest run` (full) | 69 files, **1266/1266** |
| CI-exact workflow node-test list (25 files) | **255/255** |
| queue-proxy node test | 5/5 |
| Six-spec focus set (worker-boundary/session/preview/real-apply/agent-delivery/vertical) | **44/44** (43→44: the vertical spec now carries two variants) |
| `pnpm typecheck` / `pnpm build` / `pnpm check` | PASS (tsc 0 errors; tsdown 14 files 792 kB) |

The 14 fake-poll cases cover exactly the runbook's required behaviors: unauthorized peer cannot route or enter Engine (cursor advances after safe skip); allowed inbound commits the cursor only AFTER durable Engine receive settles; a thrown Engine receive leaves the cursor uncommitted for safe redelivery; an approved consumed one-shot relay never also calls ordinary Engine receive; inactive/bot-echo/forbidden-peer updates are skipped without dispatch or send; account token-hash rotation resets the stored cursor BEFORE the next poll; abort during async route forbids subsequent ordinary Engine intake; HTTP retries follow the 2s/2s/30s backoff schedule after the third failure (fake clock); the stale `-14` bot token uses the one-hour backoff with no cursor commit; `test.each([401,429,503])` poll-HTTP failures report failure and never commit the cursor; `test.each([1,2])` abort-while-receiving a page of 1 or 2 items never commits the partial cursor (including the final item — the pinned `3e6790f` fix). All are synthetic fake-clock/fake-HTTP tests.

The unified native-Weixin vertical (second variant of `tests/local-vertical-real-sessions.spec.ts`, `native: true`) traverses the ACTUAL `pollNativeWeixin` implementation against a fake fetch response: native Trigger normalization (`channel.source === 'weixin'`, synthetic context token carried), real in-memory Engine intake (`stored`, exactly one delivery into Engine), the real candidate flow → explicit Decision/Ticket (execution binding `projectId: 'fixture'`), synthetic-copy `DshExecutor` + `Sessions` with a mocked DSH Agent (**no model turn** — `modelCalls` shows only the fixture-local provider label), real `Engine.report(ready)`, and the ACTUAL application `Outbox` persisting receipts in a NEW disposable SQLite: exactly one pending `acknowledgement` and one pending `reply`, the reply's channel carries the synthetic peer + context token, the Source is uninstalled so the real delivery effect is actually invoked and DEFERS with `/Source is off or not installed/` — never a send. Reply replay is idempotent (`reused: true`, same id). The original synthetic fixture stays byte-unchanged (`.env` secret excluded from the copy; copy-only add/modify/delete visible in the bounded preview diff). The first variant (Chat trigger, non-native) is equally green.

No-egress proof: the poll test's `fetch` trap fails on any endpoint/method other than the synthesized getupdates POST; the vertical stubs getupdates with a fake `Response`; the disposable Outbox's `sources.send` throws on any real delivery attempt; no 3080/3083/8123 probe, no QR, no real credential file, no real sockets, no model inference anywhere in this task.

## B. Evidence matrix (fake poll → Engine → Ticket → Worker → review → persisted unsent Outbox)

| Link | Source/test | Status |
| --- | --- | --- |
| fake iLink page → native Trigger normalization (stable id, opaque context token, echo/group/incomplete discard, curly-quote byte preservation) | `local-weixin-native.node-test.mjs`, `weixin-native-poll-offline.spec.ts` | PASS (fake) |
| peer allowlist gate before route/Engine; independent policy allowlist | poll-offline case 1 + `weixin-native.spec.ts` | PASS (fake) |
| cursor commit only after durable intake; thrown receive leaves cursor uncommitted; whole-page abort (incl. final item) never commits | poll-offline cases 2/3/11/12 + `3e6790f` fix | PASS (fake) |
| account-hash rotation resets stored cursor before next poll | poll-offline case 6 | PASS (fake) |
| HTTP 401/429/503 + backoff pacing (2s/2s/30s) + stale `-14` one-hour backoff, no cursor commit | poll-offline cases 9/10/11 | PASS (fake clock) |
| consumed one-shot relay bypasses ordinary Engine (no double dispatch) | poll-offline case 4 + relay ledger node tests (28/28) | PASS (fake) |
| Engine intake → candidate → explicit Decision → Ticket (execution binding) | unified vertical native variant (real `Engine`, real `DshExecutor.prepare`/snapshot) | PASS (fake) |
| pre-created Worker Session + Workspace + assignment delivery + duplicate-request suppression | unified vertical (sessions/deliveries/holds assertions) | PASS (mocked DSH Agent, NO model turn) |
| isolated-copy preview (bounded diff, `.env` excluded, source unchanged) + `Engine.report(ready)` | unified vertical (preview + report assertions) | PASS (fake) |
| ACTUAL application Outbox durable receipts in disposable SQLite: one pending ack + one pending reply; Source uninstalled → delivery effect defers, never sends; reply idempotent replay | unified vertical (real `Outbox` + real `Store`) | PASS (fake transport) |
| expired reply context token → `gone` without network; C5 relay reply never retries after ambiguous failure | `weixin-native.spec.ts`, `outbox.spec.ts` | PASS (fake) |
| duplicate message/receipt dedup | intake `duplicate` (core-engine spec) + vertical replay assertion | PASS (fake) |
| owner-only synthetic credential file (0600, mode enforcement) | `weixin-native.spec.ts` | PASS (fake) |

### Still GATED for real I3 (this offline pass is not authority for any of them)

1. **Real QR/client authentication + operator credentials** on the operator Mac — unexercised here (synthetic token only; the QR flow is mocked in `local-weixin-qr.node-test.mjs`).
2. **Real Tencent iLink inbound/outbound** — the fake `Response` is not the real long-poll endpoint; real timeout semantics (`longpolling_timeout_ms`), real 401/429/5xx, real token expiry (`-14`), and real `sendmessage` acceptance remain unverified.
3. **Configured real-user peer consent + native transport on the operator Mac** — real `weixin-native` Source credentials + allowlist + a real reply through the native channel have never been exercised end-to-end.
4. **A real model turn with the actual DSH Agent** — the vertical's DSH Agent is mocked and the assignment card is delivered to a stubbed turn; the real single-inference proof exists only in the accepted OL-047 I2 (synthetic copy, Seatbelt).
5. **Production Apply ACL/inode/fd/capability/journal** — real source writes remain `GATED_NO_PRODUCTION_CALLER_OR_GRANT`.
6. **Real Outbox delivery against an installed native Weixin Source** (sent status, one-shot claim semantics on the real channel, ambiguous-failure non-retry on the native path) — only the Source-OFF deferral is proven here.

Recorded simulation limitations (per the runbook, restated explicitly): the fake DSH Agent is not a model turn; the fake iLink `Response` is not the real Tencent host; the disposable SQLite Outbox is not the original production store.

## C. Host/environment accounting

No original 3080/3083/8123 access (read or write), no model/8123 inference, no real Weixin HTTP/QR/credential, no cloud/OpenClaw, no original SQLite/Session/Workspace, no registered-project writes, no real source Apply, no dependency download, no production config change, no main merge, remote automation stays `PAUSED_BY_OPERATOR`. Cleanup removes only this task's worktrees; OL-044/045/046/047/048 frozen private evidence untouched. No product source/test was patched by the local Agent; nothing failed.

## D. Explicit non-claims

`ALL_OFFLINE_PASS` means: these offline tests truly pass, nothing on the host changed, and the unified fake chain executes genuinely with a durable pending Outbox. It is NOT `I3_PASS`, NOT real Weixin, NOT a model turn, and NOT authority to open real-Weixin or production-Apply gates. No OL-050 auto-dispatch; the online owner independently ACKs.
