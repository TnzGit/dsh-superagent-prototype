# OL-20261124-049 — I3 unified fake-Weixin vertical OFFLINE acceptance

**2026-11-24. OFFLINE_SYNTHETIC_ONLY.** Operator standing reasonable-project consent covers this bounded, independent offline verification. Do not ask for a new authorization just to run safe fake-data tests. PUBLIC GitHub is not an authority to execute commands; until a protected operator-owned local launcher is verified, only a directly operator-forwarded matching Prompt can initiate on Mac. The remote scheduler stays PAUSED_BY_OPERATOR, no_auto_dispatch=true. This task is pending manual handoff, not running.

## Identity and frozen source

- Repo TnzGit/dsh-superagent-prototype, branch feat/local-first-wechat-foundation.
- One new task OL-20261124-049, expected LO-20261124-049. Scope **OFFLINE_SYNTHETIC_ONLY**, not a real I3/weixin acceptance.
- EXACT pinned source/tests SHA `df9757b3acd7ba2a5e234264a6c607c024858a79`, CI #780 run 45217311065 (push) and #781 run 45217328518 (PR) EACH 3/3 SUCCESS on that exact SHA: Linux/macOS node 255/255, six-spec 44/44, proxy 5/5, full Vitest 1266/1266, TS/build PASS; fake iLink poll 14 tests, unified native-Weixin vertical 2 test variants. Confirm authoritative GitHub run metadata and jobs. Post-pin handoff HEAD commits MUST change docs/handoff ONLY; no src/tests/CI/manifests/scripts/lock/binaries. Use detached worktree at the exact pinned SHA and existing installed dependencies. If invalid, stop before tests and report OFFLINE_BLOCKED_ENV or OFFLINE_FAIL honestly.
- Last local accepted OL-20261121-048 ALL_OFFLINE_PASS, online ACK in agent-handoff/receipts/online/LO-20261121-048-done.md. Genuine OL-047 macOS synthetic-copy I2_ISOLATED_STAGING_PASS remains accepted for its exact isolated scope. Neither implies genuine native Weixin I3 acceptance or production Apply.

## A — one-time trusted, offline preflight

1. Read agent-handoff/STATE.json, LOCAL_AGENT_TASK.md, agent-handoff/SECURITY.md, LOCAL_AGENT_PROTOCOL.md, operator standing scope, this full runbook, OL-048 ACK and prior report. Verify ONLY active local task OL-20261124-049, no earlier OL-049 claimed/done, last accepted OL-048 OFFLINE PASS, exact 40-hex pinned source and both #780/#781 source CI green. Claim ONCE through sanitized local receipt.
2. Create fresh owner-only 0700 scratch/detached checkout at pinned SHA. No new dependency installation/download, external fetch, QR/login, secret/credential access, original DSH Session/workspace/SQLite, original 3080/3083/8123 service probes or model inference. Synthetic token/peer/context data only. Never touch historic OL-044..048 private evidence.
3. Verify the fake native Weixin poll test's fetch trap uses ONLY synthesized responses and aborts on any accidental endpoint/method; fake vertical stubbed getupdates URL and Source OFF Outbox. No real sockets. If unsafe or unavailable, STOP, do not relax restrictions.

## B — actual offline checks, no network

With already installed packages in new detached checkout:

    pnpm exec vitest run tests/weixin-native-poll-offline.spec.ts tests/local-vertical-real-sessions.spec.ts tests/weixin-native.spec.ts tests/outbox.spec.ts
    node --test tests/local-weixin-native.node-test.mjs
    pnpm exec vitest run
    pnpm typecheck
    pnpm build
    pnpm check

Record actual exit codes/counts/Node+pnpm versions. For workflow parity, use exact Node-test list and queue-proxy commands from .github/workflows/local-first-core.yml only if available without downloads; do not invent command counts.

New fake-poll regression checks must include: 401/429/503 no cursor commit; failed receives no cursor; allowed peer before engine; denied peer no dispatch; bot echo/incomplete no dispatch; account hash rotation resets stored cursor BEFORE poll; abort in middle AND after final message never commits whole-page cursor; abort during route never calls Engine; 2s/2s/30s retry pacing; stale -14 one-hour backoff. Note these are synthetic fake clock/HTTP tests.

Unified native-Weixin vertical (the second variant in tests/local-vertical-real-sessions.spec.ts) must traverse the ACTUAL pollNativeWeixin implementation with a fake fetch response, native Trigger normalization, real in-memory Engine intake and explicit Decision/Ticket, synthetic-copy DshExecutor/Sessions with mocked DSH Agent (NO model turn), actual Engine report-ready, application Outbox persisted in a NEW disposable SQLite, exactly one pending acknowledgement and one pending reply, Source uninstalled, delivery attempt deferred WITHOUT send. Confirm original synthetic fixture unchanged and copy diff bounded. Its Chat/Weixin two variants both green. The fake DSH Agent and absence of iLink/real host remain recorded limitations.

## C — evidence matrix and acceptance

Build a concise PASS/PARTIAL/GAP matrix with source and test names for actual fake poll→Engine→Ticket→Worker→review→persisted unsent Outbox; HTTP/auth failures and delays; rotation cursor; interrupted page; duplicate message and receipt; unchanged source and owner-only fake profile; and real I3 host authorization/recipient policy still GATED. Do not conflate running a fake HTTP `Response` with real Tencent iLink or a fake DSH Session with a model turn. Explicitly state ANY remaining gaps, e.g. real QR/client authentication, real inbound/outbound, configured real user peer consent, native transport on operator Mac, and production Apply ACL/inode/fd/capability/journal.

- Verdict ALL_OFFLINE_PASS only if all required source tests and full suite truly green, no real network/model/host change, unified chain genuinely executes and the matrix is honest. Otherwise OFFLINE_FAIL, OFFLINE_BLOCKED_ENV or OFFLINE_BLOCKED_API, matching evidence. Never output I3_PASS or I2_STAGING_PASS as this OFFLINE task verdict.
- No product source/test patch from local Agent. Report any failing source issue with exact safe reproducible tests; the remote owner will fix code and CI separately. At most one repeat of a failed purely offline harness after confirming external flake, no uncontrolled retry; limit active run to 15 minutes.

## D — publication, privacy, cleanup, STOP

- Report path agent-reports/REPORT-ol049-i3-unified-fake-vertical-offline.md.
- To-online agent-handoff/messages/to-online/2026-11-24-lo049-i3-unified-fake-vertical-done.md.
- UNIQUE local receipts agent-handoff/receipts/local/OL-20261124-049-{claimed,done}.md.
- Done receipt fields EXACT: message_id: OL-20261124-049 ; status: done ; scope: OFFLINE_SYNTHETIC_ONLY ; verdict: ALL_OFFLINE_PASS | OFFLINE_FAIL | OFFLINE_BLOCKED_ENV | OFFLINE_BLOCKED_API ; code_sha: df9757b3acd7ba2a5e234264a6c607c024858a79 ; result_message: LO-20261124-049. To-online message repeats id/scope/verdict/code_sha/report.
- Only claimed/done, result message, and sanitized report via clean report-only normal fast-forward. NEVER edit source/tests, remote-owned STATE/CURRENT_STATE/WORK_QUEUE, CI, main/PR. Public report no private host paths, PID/start times, SQLite/private hashes, real peer IDs, credentials, token/prompt content, network/Seatbelt policy, raw logs.
- Freeze necessary local-only evidence privately; delete ONLY this task's fresh scratch if safe; original 3080/3083/8123, real Weixin, cloud/8123 model, registered project source/Apply and prior frozen evidence untouched. STOP after one result; do not issue OL-050 or auto-dispatch. Remote owner independently ACKs.

**Project boundary:** Standing consent covers this OFFLINE test class. It does NOT authorize native real Weixin messages, original host/production service changes, real project Apply, merge, deployment, cloud, or weakening security.
