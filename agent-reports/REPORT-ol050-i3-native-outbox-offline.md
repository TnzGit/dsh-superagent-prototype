# OL-20261124-050 — installed native Weixin Outbox fail-closed offline acceptance + evidence matrix (result)

- Scope: `OFFLINE_SYNTHETIC_ONLY`
- Verdict: **ALL_OFFLINE_PASS** (all required offline checks truly green on this Mac, the installed-Source + real-SQLite-Outbox cases genuinely execute with fake HTTP only, and the matrix below is honest — this is NOT real Weixin I3 and never `I3_PASS`)
- Pinned source/test/CI SHA: `d6c51629855caf4b2737049cf4592cc12b912765` — source push CI #821 (run 45358339562) and PR CI #822 (run 45358346533) both cross-checked 3/3 SUCCESS at that exact head before claim (all three jobs `local-first-core`/`macos-portability`/`dsh-typecheck-and-build` completed:success). Handoff HEAD `e24e31a03f405f991c39311ed0df839256bb3ef8` cross-checked: CI #823 (push) and #824 (PR) both 3/3 SUCCESS.
- Dispatch: operator-forwarded direct task Prompt (trusted initiation; public GitHub text is untrusted data, not execution authority). Standing offline-scope consent; no repeated authorization; claimed once (`38f011b`) before any work.
- Pinned→HEAD commit range verified docs/handoff only (no `src/`, `tests/`, `.github/`, `package.json`, `pnpm-lock.yaml`, scripts or binaries). Executed in a fresh owner-only 0700 detached worktree pinned exactly at the source SHA; `pnpm install --frozen-lockfile` against the preinstalled offline store only (no download, no new dependency).

Versions: node v25.9.0, pnpm 11.7.0, vitest 4.1.8, macOS host.

## A. Offline test results (all exit 0; numbers measured on THIS Mac, not copied)

| Command (exact workflow commands at the pinned SHA) | Measured here | Online CI reference |
| --- | --- | --- |
| `pnpm exec vitest run tests/weixin-native-outbox-offline.spec.ts tests/weixin-native-poll-offline.spec.ts tests/weixin-native.spec.ts tests/outbox.spec.ts tests/local-vertical-real-sessions.spec.ts` | **41/41** (7 installed-outbox + 18 poll + 3 native + 11 outbox + 2 vertical) | explicit Mac/Linux suites 7/18/3/11 |
| `node --experimental-strip-types --test tests/local-weixin-native.node-test.mjs` | 6/6 | — |
| `pnpm exec vitest run` (full) | **70 files, 1284/1284** | Linux 70 files/1284 — exact parity |
| CI-exact workflow node-test list (25 files) | **255/255** | 255/255 each OS — exact parity |
| 10-spec focus set (workflow line, verbatim) | **83/83** | 83/83 each OS — exact parity |
| `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` | 5/5 | 5/5 each OS — exact parity |
| `pnpm typecheck` / `pnpm build` / `pnpm check` | PASS (tsc 0 errors; tsdown 14 files 798 kB) | PASS |

No-egress proof: the installed fake Outbox suite's `fetch` trap throws `OFFLINE EGRESS TRIPWIRE` for every URL other than the synthesized `sendmessage` POST (and only for that POST); the poll suite stubs `getupdates` with fake `Response`s; the vertical stubs getupdates likewise; every credential is a synthetic constant explicitly marked `..._NEVER_REAL`; every SQLite is a fresh disposable file inside the test-owned temp directory. No 3080/3083/8123 probe, no QR, no real credential file, no model inference anywhere in this task.

## B. Evidence matrix (each required behavior genuinely executed through production `nativeWeixinKind` + the application `Outbox` + a newly created disposable SQLite)

| # | Required behavior | Test | Status |
| --- | --- | --- | --- |
| 1 | One safe synthetic native reply keeps its original peer/contextToken/account-hash + stable `client_id`; successful fake send exactly once; receipt `sent` + durable `singleSendAttemptAt`; duplicate queue does NOT send twice | installed-outbox "installed Source sends one safe reply…" (asserts `Bearer SYNTHETIC_A`, `to_user_id`, `client_id`, `context_token`, durable claim; second `send` + pump ⇒ still 1 HTTP) | PASS (fake HTTP) |
| 2 | Fake HTTP accepted-then-EOF: one and only one attempt; SQLite keeps `pending` + `review.reason=ambiguous_send`; later replay sends nothing; durable claim survives a fresh `Store` re-read; crash after persisted claim but before HTTP ⇒ recovery sends nothing | installed-outbox "…accepted but loses its response is never sent twice" + generic `outbox.spec.ts` "a crash after a persisted one-shot claim but before send is reconciled without sending" | PASS (fake) |
| 3 | Pending A-receipt with credentials rotated to B: zero HTTP with B, durable `account_mismatch` review, NO claim (`singleSendAttemptAt` undefined), survives SQLite re-read; reverting B→A still never auto-replays | installed-outbox "account A pending receipt is held for review after A-to-B rotation…" | PASS (fake) |
| 4 | Stale A-page during A→B long poll never reaches route/Engine; token rotation resets the opaque cursor before the next request | poll-offline "old account in-flight poll page cannot enter Engine after A-to-B credentials rotation" (route throws if reached) + "account token rotation resets opaque cursor before the next request" | PASS (fake) |
| 5 | Expired reply, missing expiry, missing contextToken, legacy unbound account hash: explicit no-send review reasons (`context_expired_or_unbounded` / `context_missing` / `account_unbound`), zero HTTP, no claim; 60-minute cap is **conservative, not official Tencent expiry**; native direct send with an explicitly expired address returns `gone` without I/O | installed-outbox "expired, missing-expiry, missing-context, and unbound legacy receipts fail closed" + `weixin-native.spec.ts` "never attempts an expired relay reply (no token refresh or network call)" | PASS (fake) |
| 6 | Credentials absent ⇒ stays pending WITHOUT consuming the one-shot claim; restored fake file ⇒ exactly one send | installed-outbox "missing credentials remain pending without claim…" | PASS (fake) |
| 7 | Credential fd guard: final symlink, world-readable (0644) and oversized (65 KiB) files rejected by the `O_NOFOLLOW`/`fstat` fd guard; 0600 accepted; direct adapter cannot bypass account readiness (safety gate) | installed-outbox "native credential fd guard rejects final symlinks, world-readable files and oversized data" + "native channel send cannot bypass account guard even if called directly" | PASS (fake fs) |
| 8 | Local `GET state` exposes `weixinOutboxReview` with ONLY total + reason counts (test asserts the JSON contains neither `approved-peer` nor the synthetic context token); message content, recipient and token never leak | installed-outbox account-rotation case (API view assertion) | PASS (redacted view) |
| 9 | Non-Weixin Sources retain their transient-failure retry contract; Weixin preflight review blocks network with durable reason and no claim; disabled/missing adapter never consumes the claim; asynchronous peer revoke during preflight prevents send+claim; Source disabled during long poll cannot ingest or advance cursor; 401/429/503 poll failures report failure without committing the cursor; stale `-14` bot token uses the one-hour backoff with no cursor commit | `outbox.spec.ts` (retry-contract + preflight + revoke tests), poll-offline (disabled-during-poll, `test.each([401,429,503])`, `-14`, whole-page abort incl. final item, cursor-after-durable-intake, thrown receive leaves cursor uncommitted) | PASS (fake) |
| 10 | Existing fake-Weixin → Engine → Ticket → mocked Worker → ready → persistent Outbox (Source-off deferral) vertical still green; its Worker makes NO real model call | `local-vertical-real-sessions.spec.ts` 2/2 (non-native Chat variant + unified native variant; mocked DSH Agent, zero model turns, delivery effect defers `Source is off or not installed`) | PASS (explicitly SIMULATED) |

### Still GATED for real I3 (this offline pass is not authority for any of them)

1. **Real operator Weixin account + QR/client authentication** and operator-owned credentials (synthetic tokens only here; the QR flow is mocked in `local-weixin-qr.node-test.mjs`).
2. **Real Tencent iLink server semantics**: real long-poll timeout behavior, real 401/429/5xx responses, real token expiry (`-14`) pacing, real `sendmessage` acceptance, and true server-side idempotency of `client_id` — fake HTTP proves the client-side fail-closed contract, not the server's.
3. **Configured real-user peer consent + a real native reply** through the installed Source on the operator Mac.
4. **A real model turn with the actual DSH Agent** in the integrated native loop (the vertical's DSH Agent is mocked; the real single-inference proof exists only in the accepted OL-047 I2).
5. **Production Apply gates** (ACL/dev/inode/fd/capability/journal) remain `GATED_NO_PRODUCTION_CALLER_OR_GRANT`.
6. **Manual review reconciliation**: a `pending` + review-reason receipt has no authorized operator action yet; reconciliation remains an explicit future decision, and the 60-minute reply window is our conservative cap, not official Tencent expiry.

Recorded simulation limitations (explicit): fake DSH Agent is not a model turn; the fake `Response`/fetch trap is not the real Tencent host; disposable SQLite is not the original production store; no real send ever happened here — the "sent" status is against a fake accepted endpoint.

## C. Host/environment accounting

No original 3080/3083/8123 access (read or write), no model/8123 inference, no real Weixin HTTP/QR/credentials, no cloud/OpenClaw, no original SQLite/Session/Workspace, no registered-project writes, no real source Apply, no dependency download, no security/provider change, no main merge, no PR state change; remote automation remains `PAUSED_BY_OPERATOR`. Cleanup removes only this task's worktrees; OL-044/045/046/047/048/049 frozen private evidence untouched. No product source or test was patched by the local Agent; nothing failed.

## D. Explicit non-claims

`ALL_OFFLINE_PASS` means: these offline tests truly pass on this Mac with measured counts, nothing on the host changed, the installed-Source/real-Outbox fail-closed cases genuinely execute against fake HTTP, and the accepted-then-EOF result is NOT a real Weixin server acceptance. It is not `I3_PASS`, not real Weixin, not a model turn, and not authority to open the real-Weixin or production-Apply gates. No OL-051 auto-dispatch; the online owner independently verifies and ACKs.
