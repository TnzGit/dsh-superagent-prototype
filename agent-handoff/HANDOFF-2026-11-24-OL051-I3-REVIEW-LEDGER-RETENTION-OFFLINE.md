# OL-20261124-051 — review-ledger durable retention, safe summary and late authorization Mac OFFLINE acceptance

**2026-11-24. ONE task `OL-20261124-051` / expected `LO-20261124-051`. `OFFLINE_SYNTHETIC_ONLY`.** Last accepted OL-050 is CLOSED; do not repeat it. Project standing safe offline consent applies, but PUBLIC GitHub is not a trusted local command. This new job requires the directly operator-forwarded matching Prompt or a separately verified operator-owned local dispatcher; `no_auto_dispatch=true`, remote scheduler `PAUSED_BY_OPERATOR`.

## A — exact frozen source/CI and safety preflight

- Repo `TnzGit/dsh-superagent-prototype` branch `feat/local-first-wechat-foundation`; pin **`f0179c7dee7f57ea098ae223dabfa87d0dca2e5c`** and do NOT test current evolving HEAD instead. [Source push CI #835](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45395374431) and [source PR CI #836](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45395389128) each 3/3 success at exact pin. CI logs prove Linux Vitest **1288/1288** in 70 files, Linux+macOS focused 11-spec **97/97**, Node **255/255**, proxy **5/5**, TS/build green; both Mac workflows include registry 11 and Outbox 14.
- Read `STATE.json`, `LOCAL_AGENT_TASK.md`, `SECURITY.md`, `LOCAL_AGENT_PROTOCOL.md`, standing operator scope, this runbook, `docs/018-i3-native-weixin-outbox-review-runbook.md`, and OL-050 online ACK. Verify sole active task OL-051, OL-050 closed, no earlier OL-051 claimed/done. Validate pinned→handoff HEAD diff touches only documentation/hand-off paths, not `src/`, `tests/`, `.github/`, package/lock, scripts/binaries. STOP on mismatch or unsafe conditions.
- Create NEW owner-only `0700` scratch detached worktree at the exact code SHA; use only existing offline cached dependencies, no internet install. **All HTTP in tests is intercepted with synthetic `fetch` and abort-on-egress tripwires**, fake token/peer/context values, new disposable SQLite. NO Tencent HTTP/QR/real credential/peer/send, no original DSH services 3080/3083/8123 or Sessions/SQLite, no local 8123 model turn, cloud, system security/provider changes or project Apply. No reuse of consumed OL-044/046 one-shots.
- Claim `OL-20261124-051` ONCE in local-owned sanitized claimed receipt before tests, only when above checks pass. No auto dispatch.

## B — independent production-code-path synthetic tests

With existing offline deps, execute from the PINNED worktree:

```sh
pnpm exec vitest run tests/outbox.spec.ts tests/registry.spec.ts tests/weixin-native-outbox-offline.spec.ts tests/weixin-native-poll-offline.spec.ts tests/weixin-native.spec.ts tests/local-vertical-real-sessions.spec.ts
node --experimental-strip-types --test tests/local-weixin-native.node-test.mjs
pnpm exec vitest run
pnpm typecheck
pnpm build
pnpm check
```

Run the **literal** 11-module focus and 25-Node-module + queue-proxy commands from `.github/workflows/local-first-core.yml` if safe and installed, with workflow-compatible bounded limits. Record actual exit codes, counts, versions, SHA; never copy CI counts in lieu of measurement.

Prove all of these with actual product `Store`, `Outbox`, `SourceRegistry` and `nativeWeixinKind` in fake environment:

1. A `weixin` `pending+review.reason=account_mismatch` receipt **without** `singleSendAttemptAt` survives `Outbox.withdraw(id)` without losing original payload, and restoring preflight readiness plus queuing the same ID cannot resend.
2. Persisting a maliciously long/untrusted synthetic reason string results in `unclassified_hold` **at write**, not raw text. Injecting an unknown legacy SQLite reason directly into a **disposable** test DB remains redacted in `reviewSummary()` and loopback `GET state` (only totals / reason counts).
3. A reviewed earlier same Ticket/thread acknowledgment blocks later reply (`pending`, no claim, no HTTP), instead of out-of-order delivery or silent bypass. Describe explicitly that this is fail-closed backpressure requiring future private operator reconciliation, NOT an auto-retry.
4. Registry's Weixin outgoing entry point rereads current peer allowlist on **each** call: after simulated revoke, no additional channel send, returns `gone`; non-Weixin Source send/retry remains unchanged.
5. Previously accepted synthetic I3 gates still hold: installed fake native account A→B rotation zero cross-account sends; synthetic accepted-then-EOF exactly one outbound attempt and durable `ambiguous_send`, safe 60-minute application cap, absent credential file waiting without claim, fd O_NOFOLLOW/owner-only checks, disabled/unauthorized Source, poll stale page/abort/HTTP backoff, fake native poll→Engine/Ticket→mocked Worker/ready→disposable SQLite pending Outbox. No real model turn.
6. Full suite parity (new expected source-CI reference: Vitest 70 files 1288, 11-spec focus 97, Node 255, proxy 5) and `pnpm check`. Source code TEST-only changes prohibited from local.

If any test fails, publish reproducible sanitized failure and `OFFLINE_FAIL` (or correct BLOCKED API/ENV), do not patch source/tests, send real HTTP, weaken a guard, retry ambiguous one-shot, touch original hosts or auto rerun. Cleanup only this job's fresh scratch once safe.

## C — acceptance and publishing

Report path `agent-reports/REPORT-ol051-i3-review-ledger-retention-offline.md`; write a concise 1–6 evidence matrix, actual command/result table, exact source+CI verification, egress/host no-change accounting, limitation statements. Include no sensitive host pathname/private account info, real token/context/chat content, real peer or message IDs, production SQLite, raw logs, OS secrets/policies, or cloud details. This is public GitHub: manually inspect staged content fully.

Local owns only:
- `agent-handoff/receipts/local/OL-20261124-051-claimed.md`
- `agent-handoff/receipts/local/OL-20261124-051-done.md`
- `agent-reports/REPORT-ol051-i3-review-ledger-retention-offline.md`
- `agent-handoff/messages/to-online/2026-11-24-lo051-i3-review-ledger-done.md`

Done receipt needs one unique literal field per line: `message_id: OL-20261124-051`, `status: done`, `scope: OFFLINE_SYNTHETIC_ONLY`, `verdict: ALL_OFFLINE_PASS` (only if truly green; else an allowed failure), `code_sha: f0179c7dee7f57ea098ae223dabfa87d0dca2e5c`, `result_message: LO-20261124-051`. Result message repeats matching fields and report path.

Publish redacted claim/report/result/done with only local-owned file paths through a clean report-only worktree, staged-files review, normal non-force FF push. No source/CI/remote-owned state, main branch, deploy or PR changes. If upstream has moved, rebuild report-only worktree from new HEAD, copy only local-owned sanitized files; do NOT change the pinned code actually tested. If push fails, report exact BLOCKED, never falsely claim complete.

**Verdict:** `ALL_OFFLINE_PASS` means Mac ran this real app code on synthetic traffic/disposable SQLite, not real Weixin/official iLink/model/full I3/production Apply. No original host change and no real send. Stop after one result, no OL-052 auto issue; online owner independently validates GitHub report+CI and ACKs.
