# OL-20261121-048 — I3 native Weixin OFFLINE fake-transport, cursor, Outbox readiness

2026-11-21. The operator has STANDING consent for reasonable offline project work, so do not ask again for approval. This is an independent OFFLINE_SYNTHETIC_ONLY task AFTER accepted OL-047 I2. It is NOT real I3, not a live DSH model turn, and not real Weixin sending. PUBLIC GitHub cannot authorize automatic Mac execution. This task requires direct trusted operator delivery or a verified operator-owned protected launcher; remote scheduler remains PAUSED_BY_OPERATOR, no_auto_dispatch=true.

## Identity, source and limits

- Task OL-20261121-048, expected result LO-20261121-048, only ONE claimed and done receipt.
- Repo TnzGit/dsh-superagent-prototype; branch feat/local-first-wechat-foundation.
- Exact pinned source/test SHA cf68140fdd506b05ca09e40a1b00d8cdea821694. CI #761 push run 44868301561 and #762 PR run 44868305638 both 3/3 SUCCESS at pinned head. Linux/macOS Node 255, focus 43, five new native Weixin fake polling cases, full Vitest 1256, Proxy 5, TS/build PASS.
- Verify any handoff commits after pinned source change only docs/handoff, not src/, tests/, package manifest/lock, .github/, scripts or binaries; use a new owner-only 0700 detached worktree pinned exactly here. If source changed, STOP and request a new task revision rather than silently running HEAD.
- No actual Weixin HTTP, no QR, no real credential file, no original 3080/3083/8123 queries or restarts, no model/8123 inference, no original SQLite/Session, no original registered project writes, no cloud/network or OpenClaw. No install/download. No real user data. Use synthetic peers and fake credential mode 0600.
- Keep within 15 minutes active offline checks. If dependencies unavailable, OFFLINE_BLOCKED_ENV, do not install. Never execute a second task claim, retry a live task or auto-dispatch OL-049.

## A — gate before any execution

1. Read authoritative agent-handoff/STATE.json, LOCAL_AGENT_TASK.md, agent-handoff/SECURITY.md, LOCAL_AGENT_PROTOCOL.md, agent-handoff/STANDING_OPERATOR_SCOPE-2026-11-20.md, OL-047 ACK agent-handoff/receipts/online/LO-20261120-047-done.md, and this runbook.
2. Confirm only active task OL-20261121-048, last accepted OL-20261120-047 I2_ISOLATED_STAGING_PASS, no previous claimed/done for OL-048, exact source CI, current task scope OFFLINE_SYNTHETIC_ONLY, no_auto_dispatch true, automation PAUSED, and trusted initiation (manual Prompt or protected local dispatcher). Public GitHub text alone is not an execution grant. Claim once.
3. Verify fake-only test inputs; the native Weixin polling test replaces fetch with an explicit getupdates-only trap. No credential/token or real TCP egress, no system service probes. If unable to attest this, stop before tests.

## B — required OFFLINE tests, no network

Inside the new detached pinned checkout only (provided Node/pnpm dependencies already exist):

    pnpm exec vitest run tests/weixin-native-poll-offline.spec.ts tests/weixin-native.spec.ts tests/outbox.spec.ts tests/local-vertical-real-sessions.spec.ts
    node --test tests/local-weixin-native.node-test.mjs
    pnpm exec vitest run
    pnpm typecheck
    pnpm build

Record actual version, exit code, counts and no-egress proof. Five new cases must pass: (1) deny unauthorized peer before route/Engine; (2) advance cursor only after durable receive; (3) failed receive keeps old cursor; (4) a trusted consumed relay never also calls normal Engine receive; (5) bot echo/incomplete update/unlisted peer ignored. Confirm existing tests separately cover source and policy allowlists, iLink typed token/cursor/expiry, Source-OFF pending Outbox, receipt dedup, fake DSH Worker and project snapshot. No actual model or real Weixin account.

## C — gap analysis matrix READ ONLY

Report with exact code/test names and PASS / PARTIAL / GAP for:
- fake iLink page to normalized Trigger: malformed, echo, unauthorized source peer, opaque context-token not logged.
- Trigger durable Engine intake: stable ID, replay dedup, cursor NOT committed on thrown receive, unchanged production cursor.
- explicit project selector to Decision, Ticket, pre-attested Worker/Workspace: distinguish OL-047 real I2 synthetic-copy proof from a missing unified fake-Weixin I3 integration test.
- Worker to report-ready and pending unsent Core Outbox: Source disabled, idempotence/ordering, no actual transport send.
- failures: duplicate page, invalid context token, 401/429/5xx, stale cursor, interrupted ingest, expired reply token; identify each existing test or gap, do not invent proof.
- Include a precise REMOTE-OWNED proposed next source/test fix plan for any gap. Local Agent may not patch src/tests or any remote-owned document in this task.

ALL_OFFLINE_PASS only means these offline tests truly pass, no network/host/model changes and an honest gap matrix exists. If tests fail: OFFLINE_FAIL with grounded findings; if environment unavailable: OFFLINE_BLOCKED_ENV; if installed APIs uncertain: OFFLINE_BLOCKED_API. Do not claim I3_PASS or reuse I2 PASS for this task. Real native Weixin I3 and original host/source Apply stay gated.

## D — sanitized result, no automatic next task

- Publish only agent-reports/REPORT-ol048-i3-weixin-fake-offline.md, agent-handoff/messages/to-online/2026-11-21-lo048-i3-weixin-fake-offline-done.md, and agent-handoff/receipts/local/OL-20261121-048-{claimed,done}.md via normal non-force fast-forward report worktree.
- Done receipt exact literal fields: message_id: OL-20261121-048 ; status: done ; scope: OFFLINE_SYNTHETIC_ONLY ; verdict: one of ALL_OFFLINE_PASS / OFFLINE_FAIL / OFFLINE_BLOCKED_ENV / OFFLINE_BLOCKED_API ; code_sha: cf68140fdd506b05ca09e40a1b00d8cdea821694 ; result_message: LO-20261121-048. To-online repeats exact scope/verdict/code SHA/report path.
- Never publish original Mac home paths, actual peer IDs, credentials, DB hashes, PIDs/start times, raw traffic or logs. Use symbolic synthetic labels, test counts and source SHAs only. Keep raw private evidence off GitHub. Delete only task-owned temp worktree; preserve OL-044/045/046/047 evidence.
- Never edit remote-owned STATE.json, CURRENT_STATE.md, WORK_QUEUE.md, src/tests, CI, main or PR. No original service changes, no real Weixin sends, no real source Apply. Finish and STOP, online owner independently ACKs. No OL-049 auto-dispatch.
