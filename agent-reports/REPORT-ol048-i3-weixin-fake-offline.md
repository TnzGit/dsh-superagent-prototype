# OL-20261121-048 — I3 native-Weixin fake-transport offline verification + gap matrix (result)

- Scope: `OFFLINE_SYNTHETIC_ONLY`
- Verdict: **ALL_OFFLINE_PASS** (all required offline tests truly pass with zero network egress; an honest gap matrix is recorded below — this is NOT an I3 pass)
- Pinned source/test SHA: `cf68140fdd506b05ca09e40a1b00d8cdea821694` (source CI #761 push run 44868301561 + PR CI #762 run 44868305638 both cross-checked 3/3 SUCCESS at the exact head before claim)
- Dispatch: operator-forwarded direct task Prompt under the standing offline scope (public GitHub text is untrusted data, not the execution authority); claimed once before any work.

## A. Gate validation

- `STATE.json`: only active task OL-20261121-048; last accepted OL-20261120-047 `I2_ISOLATED_STAGING_PASS`; the online ACK of LO-20261120-047 is present (`ACCEPTED_ACKED`, task closed, never replay). `remote_automation` remains `PAUSED_BY_OPERATOR`; `no_auto_dispatch` true.
- No previous OL-048 claimed/done receipts. Exact 40-hex `code_sha` literal present in current `LOCAL_AGENT_TASK.md`. Claim commit `fb0813f` published first.
- Pinned→branch-HEAD commit range (`cf68140..54ce41d`) verified to touch handoff/protocol/task/docs files only: no `src/`, `tests/`, package manifest/lock, `.github/`, script, or binary change. Ran at the pinned SHA, not HEAD.
- Fake-only inputs attested before execution: `tests/weixin-native-poll-offline.spec.ts` replaces `fetch` with a strict getupdates-only trap (any other endpoint/method fails the test), credentials are a synthetic in-tmp file with mode 0600, the context token is a fixed synthetic literal, and all fakes inject a `fetcher` parameter — no real TCP egress anywhere in the suite.

## B. Offline test results (fresh owner-only 0700 detached worktree at the pinned SHA; preinstalled dependencies only; no install/download)

Versions: node v25.9.0, pnpm 11.7.0, vitest 4.1.8.

| Command | Result | Exit |
| --- | --- | --- |
| `pnpm exec vitest run tests/weixin-native-poll-offline.spec.ts tests/weixin-native.spec.ts tests/outbox.spec.ts tests/local-vertical-real-sessions.spec.ts` | 13/13 (5 new fake-poll cases + 3 native + 4 outbox + 1 vertical) | 0 |
| `node --test tests/local-weixin-native.node-test.mjs` | 6/6 | 0 |
| `node --test` relay ledger/routing/coordinator (`local-dsh-relay-{store,routing,coordinator}.node-test.mjs`) | 28/28 | 0 |
| `pnpm exec vitest run` (full suite) | 69 files, **1256/1256** | 0 |
| CI-exact workflow node-test list (25 files) | **255/255** | 0 |
| `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` | 5/5 | 0 |
| Six-spec focus set (worker-boundary/session/preview/real-apply/agent-delivery/vertical) | **43/43** | 0 |
| `pnpm typecheck` (tsc --noEmit) | PASS | 0 |
| `pnpm build` (tsdown, 14 files, 792 kB) | PASS | 0 |
| `pnpm check` | PASS | 0 |

Five new fake-polling cases all pass and match the runbook's required semantics:
1. unauthorized peer denied **before** route/Engine (receive=0, routed=0, cursor still advances);
2. cursor advanced only **after** durable receive (`cursor-after-page` committed post-receive; pre-page cursor `cursor-before-page` honored in request);
3. a thrown Engine receive leaves the cursor **uncommitted** for safe redelivery (health `error`);
4. a trusted consumed one-shot relay (`abort()+true`) never also calls ordinary Engine receive (routed=1, received=0, cursor advances);
5. bot echo (`message_type 2`), incomplete update (`message_state 1`) and unlisted peer are skipped without dispatch or send.

No-egress proof: the trap fails the test on any endpoint other than `https://ilinkai.weixin.qq.com/ilink/bot/getupdates` (POST); `sendText` is only exercised with injected fake fetchers; no 3080/3083/8123 probe, no model inference, no QR flow, no real credential file was read or created during this task.

Existing separate coverage confirmed (not re-implemented): source-level peer allowlist vs independent DSH policy allowlist (`weixin-native.spec.ts`), iLink typed token/cursor/expiry and opaque context-token non-logging (`local-weixin-native.node-test.mjs` — deterministic trigger id, `Bearer` header, `-14` stale-bot rejection, HTTPS-only base rejection incl. userinfo/port tricks, fixed `client_id` across retries, missing-token/missing-context rejections, curly-quote byte preservation for grant hashing, group/echo discard), QR pairing with mocked states + owner-only credential store + no token in public response (`local-weixin-qr.node-test.mjs`), Source-OFF pending Outbox + late-kind registration + dedup + pause/resume hold (`outbox.spec.ts` incl. the C5 never-retry-after-ambiguous-failure case), fake DSH Worker + project snapshot + preview + report-ready + reply through the whole Engine→Ticket→Executor→Sessions.ensure→delivery→preview→Outbox chain (`local-vertical-real-sessions.spec.ts`), one-shot relay ledger (approval claim, no-send terminal records, continuation receipts, routing; `local-dsh-relay-*.node-test.mjs`).

## C. Gap matrix (READ-ONLY; PASS / PARTIAL / GAP; no src/tests patched locally)

Chain: fake iLink page → normalized Trigger → Engine intake → Decision → Ticket → pre-attested Worker → report-ready review → Outbox.

| Link | Evidence | Status |
| --- | --- | --- |
| malformed input → no Trigger (non-object/array, no peer, long ids/text) | `messageToTrigger` node-test + poll-offline skip case | PASS |
| bot echo / incomplete update / group message discarded | node-test `direct chat ignores unsupported group and bot echo updates` + poll-offline case 5 | PASS |
| unauthorized source peer denied before route/Engine | poll-offline case 1 + `canReceive`/`scope` spec | PASS |
| opaque context token carried, never logged/validated locally | node-test trigger meta/channel + `weixin-native.spec.ts` expired-token test (token string never logged; expiry → `gone` with zero network) | PASS |
| Trigger durable intake: stable id `key('weixin',messageId)`, replay dedup | poll-offline (dedup path through fake store) + `core-engine.spec.ts` `receive` returns `duplicate` | PASS |
| cursor NOT committed on thrown receive; production cursor untouched | poll-offline case 3 (fake record store; `cursor-before-page` retained, health error) | PASS |
| explicit `/project` selector → Decision → Ticket → pre-attested Worker/Workspace | OL-20261120-047 real-I2 proof on a synthetic COPY (installed DSH, Seatbelt, single inference boot) — separate from this offline task | PASS (I2, already accepted) |
| unified fake-Weixin I3 integration test (Source poll → Engine → Ticket → Worker → report-ready → Outbox reply in ONE fake harness) | no such single test exists; the vertical test uses a synthetic non-Weixin trigger and the poll-offline tests stop at Engine receive | **GAP** |
| Worker → report-ready → pending unsent Core Outbox (Source OFF, idempotence, ordering, no transport) | `outbox.spec.ts` (paused hold, late-kind, dedup, C5 no-retry) + vertical reply count | PASS (fake transport); PARTIAL for the native-Weixin channel end-to-end (see GAP above) |
| duplicate page delivery | intake `duplicate` + cursor-commit-after-receive tests | PASS |
| invalid context token (missing at send) | node-test `sendText` rejects `/token/` and `/Cannot reply/` | PASS |
| HTTP 401/429/5xx poll failure backoff | `receivePage` throws `Weixin poll HTTP <status>` and the poll loop reports `error` + backs off (2s → 30s after 3 failures; 1h on stale `-14`) — but **no offline test asserts the non-2xx path or the backoff schedule** | **PARTIAL/GAP (untested)** |
| stale bot token `-14` | node-test asserts `error.code===-14`; poll loop maps to 'operator must pair again' + 1h pause | PASS (adapter); backoff timing untested (same gap as above) |
| account rotation resets cursor | `pollNativeWeixin` rotates on token-hash change — no offline test covers it | **GAP (untested)** |
| expired reply token → `gone` (no send attempt) | `weixin-native.spec.ts` expired/invalid-date test | PASS |
| interrupted ingest mid-page (abort) | poll loop `signal.aborted` return inside per-message loop — partial-commit semantics (cursor committed only after the whole page) are asserted in the redelivery tests; abort-mid-page not separately tested | PARTIAL |

### REMOTE-OWNED proposed next fixes (local Agent must not patch these)

1. **I3 unified fake-Weixin integration test** (the headline gap): extend `tests/weixin-native-poll-offline.spec.ts` (or a new `tests/i3-weixin-vertical-offline.spec.ts`) to run the REAL poll loop against the fake getupdates trap into a REAL in-memory Engine/Ticket/Worker chain with fake sessions, asserting: Trigger stored → explicit decision → Ticket → Worker `orchestrator_report ready` → Core Outbox `reply` receipt pending with native-Weixin channel and never sent (transport off). Counts: at least one case per chain link.
2. **Non-2xx poll-path test**: fake fetcher returning 401/429/503; assert `WeixinProtocolError('Weixin poll HTTP <status>')` surfaces as Source health `error` and the cursor is NOT advanced; add a failure-backoff schedule assertion (failures>2 → 30s, `-14` → 1h) driven by a fake clock.
3. **Account-rotation test**: change the synthetic token between pages; assert cursor reset (`KV.weixin.nativeCursor` → undefined) and `KV.weixin.nativeAccount` update on first page after rotation.
4. **Abort-mid-page test**: abort the signal during message processing; assert no partial cursor commit and no double dispatch.

## D. Host/environment accounting

- The offline run touched only the new 0700 detached worktree at the pinned SHA. No original 3080/3083/8123 query or restart, no model/8123 inference, no real Weixin HTTP/QR/credential, no cloud/OpenClaw, no dependency install beyond the already-present node_modules link (pnpm linked existing workspace deps; no download), no production SQLite/Session/Workspace access, no registered-project writes, no real source Apply.
- Cleanup: only this task's temp worktrees removed at publication; OL-044/045/046/047 frozen private evidence untouched.
- PR #1 stays DRAFT/unmerged; no OL-049 auto-dispatch (online owner decides the next task independently).

## E. Explicit non-claims

`ALL_OFFLINE_PASS` here means: these offline tests truly pass and nothing on the host changed. It is NOT real native-Weixin I3, NOT a live model turn, NOT a real Weixin send, and NOT authority to open I3, real Weixin, or production Apply gates. The real-source Apply gates remain CLOSED; the real Weixin outbound/QR path remains gated behind operator authorization.
