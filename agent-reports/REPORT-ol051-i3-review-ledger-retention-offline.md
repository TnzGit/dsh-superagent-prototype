# OL-20261124-051 — I3 review-ledger retention, safe summary and late authorization: Mac OFFLINE acceptance report

**Verdict: `ALL_OFFLINE_PASS`** — this is OFFLINE acceptance of the installed product code paths with synthetic traffic and disposable SQLite only. It is **NOT** `I3_PASS`: no real Weixin iLink, QR, account, peer, credential, message, send, or model turn was involved, and nothing on the original DSH environment was touched.

- Repo `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`; task `OL-20261124-051`, result `LO-20261124-051`, scope `OFFLINE_SYNTHETIC_ONLY`.
- Initiation: the operator-forwarded direct task Prompt was the only authority; the public GitHub task document was treated as untrusted data (`public_github_not_execution_authority: true`, `no_auto_dispatch: true`).
- Claimed once (`d6500149325b73da1741cd14b36fea8455735b8a`) before any work; no earlier OL-20261124-051 claimed/done receipts existed; OL-20261124-050 independently ACKed `ALL_OFFLINE_PASS`/closed (`agent-handoff/receipts/online/LO-20261124-050-done.md`).
- Pinned source/test/CI SHA `f0179c7dee7f57ea098ae223dabfa87d0dca2e5c` cross-checked before claim: source CI push **#835** (run 45395374431) and PR **#836** (run 45395389128) both 3/3 `completed/success` at the exact head. Handoff HEAD `1479912fc9d4acaee276e1450777a528fd2f5c27` cross-checked: CI push **#837** / PR **#838** both 3/3 `completed/success` at its exact head. The pinned→HEAD range (HEAD is a direct child of the pin) touches 11 documentation/hand-off files only (150+/42−); `src/`, `tests/`, `.github/`, `package.json`, `pnpm-lock.yaml`, scripts and binaries diff empty (verified with full SHAs).
- Environment: fresh owner-only `0700` scratch (`mktemp -d`, chmod 700) holding a **detached worktree checked out at the exact pinned SHA**; `pnpm install --frozen-lockfile --prefer-offline` against the already-installed offline store (727 ms, exit 0, no download, no new dependency). Measured on this Mac: node **v25.9.0**, pnpm **11.7.0**, vitest **4.1.8**.

## 1. Commands and measured results (local measurements; never copied from CI)

| # | Command (run in the pinned worktree) | Exit | Measured result | Online CI reference |
|---|---|---|---|---|
| 1 | `pnpm exec vitest run tests/outbox.spec.ts tests/registry.spec.ts tests/weixin-native-outbox-offline.spec.ts tests/weixin-native-poll-offline.spec.ts tests/weixin-native.spec.ts tests/local-vertical-real-sessions.spec.ts` | 0 | 6 files, **55/55** (outbox **14**, registry **11**, outbox-offline 7, poll-offline 18, weixin-native 3, vertical 2) | outbox 14 / registry 11 on both Mac workflows |
| 2 | `node --experimental-strip-types --test tests/local-weixin-native.node-test.mjs` | 0 | **6/6** | — |
| 3 | `pnpm exec vitest run` | 0 | **70 files, 1288/1288** (28.9 s) | 1288/1288 |
| 4 | `pnpm typecheck` (`tsc --noEmit`) | 0 | clean | green |
| 5 | `pnpm build` (tsdown) | 0 | 14 files, 798.98 kB | green |
| 6 | `pnpm check` | 0 | clean | green |
| 7 | Verbatim 25-module Node test list from `.github/workflows/local-first-core.yml` | 0 | **255/255** | 255/255 |
| 8 | Verbatim 11-module focus set from the workflow | 0 | **97/97** | 97/97 |
| 9 | `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` | 0 | **5/5** | 5/5 |

Exact parity with the source-CI reference on every measured count (1288 / 97 / 255 / 5, and outbox 14 / registry 11).

## 2. Evidence matrix A–E (production code paths, fake environment, new disposable SQLite)

Each case below genuinely executes the application `Store`, `Outbox`, `SourceRegistry` and the installed fake native Weixin `Source`/`nativeWeixinKind`; all HTTP is intercepted by synthetic `fetch`/fake `Response` with an abort-on-egress tripwire; all account/peer/contextToken values are explicit synthetic constants marked never-real; every SQLite is a fresh disposable file inside the test-owned temp directory.

### A — Manual-review receipt survives `Outbox.withdraw` and same-ID requeue — PASS
`tests/outbox.spec.ts` "an unclaimed Weixin manual-review hold survives withdraw, duplicate ID and later restored authorization": a `weixin` receipt made `pending` with `review.reason=account_mismatch` and **no** `singleSendAttemptAt` is withdrawn via the real `Outbox.withdraw`; the receipt (payload + review) remains (product mechanism: `receipts.withdraw` at `src/app/store.ts:336-337` deletes only `pending AND singleSendAttemptAt IS NULL AND review IS NULL`, so a reviewed hold is never deleted; `Outbox.withdraw` at `src/app/outbox.ts:34-37` cancels the effect only when the delete actually happened). Restoring preflight readiness and queueing the **same ID** again cannot resend: `receipts.add` (`src/app/store.ts:341-345`) is `INSERT OR IGNORE`, so the original receipt and its original text win and `sends === 0` after 5 s of effect time. `reviewSummary()` still reports `{total:1, reasons:{account_mismatch:1}}`.

### B — Reason codes are whitelisted at write; legacy unknown reason stays redacted — PASS
`tests/outbox.spec.ts` "review hold and state summary whitelist reason codes": a synthetic canary token (private string) returned as an untrusted preflight review reason is persisted as the fixed code **`unclassified_hold` at write time** — product mechanism: `holdForReview` (`src/app/store.ts:312-318`) writes `safeWeixinReviewReason(reason)`; the whitelist `WEIXIN_REVIEW_REASONS` = `ambiguous_send, account_mismatch, account_unbound, context_expired_or_unbounded, context_missing, unclassified_hold` with the fallback at `src/app/store.ts:20-26`. Then the canary is injected **directly into the disposable test SQLite** via `UPDATE outbox SET value=json_set(value,'$.review.reason', …)` to simulate a legacy stored unknown reason: `receipts.reviewSummary()` (`src/app/store.ts:267-284`) re-maps every stored reason through the whitelist, and the loopback management `GET state` — `weixinOutboxReview: runtime.store.receipts.reviewSummary()` (`src/app/http.ts:110`) — exposes only `{total:1, reasons:{unclassified_hold:1}}` and the serialized view does **not** contain the canary. No raw text, token, peer or message content leaks.

### C — Same-Ticket reviewed acknowledgement blocks later reply (fail-closed backpressure) — PASS
`tests/outbox.spec.ts` "a reviewed Weixin acknowledgement holds later same-ticket outbound work behind it": with a reviewed (`account_mismatch`) earlier acknowledgement on the same Ticket/thread, the later `reply` stays **pending**, is never claimed (`singleSendAttemptAt` undefined), and **zero** HTTP sends occur (also after 5 s of effect time). Product mechanisms: `Outbox.deliver` returns immediately for a receipt carrying a review (`src/app/outbox.ts:42`), and `receipts.behind(id, FAILURES_BEFORE_ERROR)` (`src/app/store.ts:330-332`) blocks a later message of the same ticket+conversation while an earlier one is still pending. This is **safe blocking, not an automatic retry**: the pending hold requires future private operator reconciliation (per `docs/018`); the `Later` effect only re-queues the attempt, and the earlier reviewed receipt keeps blocking it — no out-of-order delivery and no silent bypass.

### D — Registry rereads live peer allowlist on every send; late revoke denies the adapter — PASS
`tests/registry.spec.ts` "rechecks current Weixin peer authorization on every registry send, not only in the Outbox caller": a direct `SourceRegistry.send` first returns `sent`, then after the simulated peer-authorization revoke returns **`gone`** without ever re-entering the `channel.send` adapter (`sends === 1` throughout). Product mechanism: `SourceRegistry.send` (`src/sources/registry.ts:101-107`) checks `channel.source === 'weixin' && !this.channelAllowed(...)` on **each** call (`channelAllowed` re-reads current settings + `kind.channel.allowed`, :75-79). Complementary Outbox-side gates remain green: the revoke-during-async-preflight case drops with `channelIgnored` and **no** one-shot claim (`src/app/outbox.ts:55-57`, outbox.spec test), and **non-Weixin Sources retain their ordinary transient-failure retry contract** (outbox.spec "non-Weixin Sources retain their transient-failure retry contract" — PASS).

### E — Old I3 offline regression (all OL-050 synthetic gates) — PASS
The pinned suite still enforces every previously accepted synthetic gate: account A→B rotation with zero cross-account sends and durable `account_mismatch`; synthetic accepted-then-EOF exactly one outbound attempt with durable `ambiguous_send` surviving a fresh `Store` re-read and never replaying; context expiry/missing/legacy-unbound fail-closed with zero HTTP; the conservative 60-minute application cap (explicitly **not** an official Tencent expiry claim); absent credential file waits without consuming the claim and exactly one send after it returns; the fd-based `O_NOFOLLOW` + same-fd fstat guard rejects final symlink / 0644 / oversized while accepting 0600; disabled/unauthorized Source never claims; stale in-flight poll page during rotation never reaches route/Engine and token rotation resets the opaque cursor; `test.each([401,429,503])` poll failure and the stale `-14` one-hour backoff commit no cursor; whole-page abort (including the final item) never commits a partial cursor; and the fake-Weixin → Engine → Ticket → mocked Worker → ready → Source-off durable-pending Outbox vertical (2 cases) remains green and is explicitly **SIMULATED with zero model turns**.

## 3. Egress and host no-change accounting

No real Weixin HTTP, no QR, no real credentials, no 8123 model inference, no read or write against the original 3080/3083/8123, no original SQLite/Session/Workspace, no registered-project writes or real source Apply, no dependency download, no cloud/OpenClaw, no system security/provider change, no main merge, no PR state change. All test HTTP is fake (`fetch` tripwire rejects any non-synthesized endpoint; `getupdates` stubbed with fake `Response`s). Remote automation remains `PAUSED_BY_OPERATOR`. Only this task's scratch worktrees are cleaned; OL-044/045/046/047/048/049/050 frozen private evidence is untouched. Nothing failed, so no product source or test was patched by the local Agent.

## 4. Remaining risks / not-proven boundaries (remote-owned)

- The fake `sent` status is against a fake accepted endpoint; a real Tencent `sendmessage` may be irreversibly accepted despite a client-side EOF — synthetic at-most-once cannot prove real delivery or server-side `client_id` idempotency.
- Real iLink semantics (long-poll timeout behavior, real 401/429/5xx, real `-14` expiry, real account rotation lifecycle) remain unverified.
- Same-ticket backpressure means an operator must reconcile the reviewed earlier receipt (private action, not yet exercised against production data); production Apply gates and a consented real peer + real native reply remain GATED for real I3.
- The 60-minute reply window is a conservative application cap, not an official expiry contract.

## 5. Verdict

`ALL_OFFLINE_PASS`. Mac ran this real app code (`Store`/`Outbox`/`SourceRegistry`/installed fake native Weixin `Source`) on synthetic traffic and disposable SQLite; every required command exited 0 with measured parity (55 named / 6 native / **1288** full / **255** CI-exact Node / **97** 11-spec focus / **5** proxy / outbox 14 / registry 11; typecheck+build+check green). **Not** `I3_PASS`, not real Weixin, and not authority to open the real-Weixin or production-Apply gates. No OL-052 auto-dispatch; the online owner independently verifies and ACKs.
