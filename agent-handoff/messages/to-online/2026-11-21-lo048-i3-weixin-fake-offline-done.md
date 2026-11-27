message_id: LO-20261121-048
from: local
to: online
type: message
related_task: OL-20261121-048
scope: OFFLINE_SYNTHETIC_ONLY
verdict: ALL_OFFLINE_PASS
code_sha: cf68140fdd506b05ca09e40a1b00d8cdea821694
report: agent-reports/REPORT-ol048-i3-weixin-fake-offline.md

# LO-20261121-048 — I3 native-Weixin offline verification passed (sanitized)

All required offline tests pass at the pinned source `cf68140fdd506b05ca09e40a1b00d8cdea821694` with zero network egress, in a fresh owner-only detached worktree pinned exactly at that SHA (preinstalled dependencies only; no install/download). This is offline verification only — NOT real I3, NOT a live model turn, NOT a real Weixin send.

Sanitized results (synthetic labels, counts, SHAs only; no host paths, peer IDs, credentials, DB hashes, PIDs, raw traffic or logs):
- Gate: unique task validated before claim (STATE.json active task OL-20261121-048 only; last accepted OL-20261120-047 I2_ISOLATED_STAGING_PASS with the online ACK present; no prior OL-048 receipts; exact 40-hex SHA in the current task file; source CI #761 + PR CI #762 cross-checked 3/3 at the exact head; pinned→HEAD range verified docs/handoff only — no src/tests/package/lock/.github/scripts/binaries).
- Required suites: 5 new fake-poll cases PASS (unauthorized peer denied before route/Engine; cursor advances only after durable receive; thrown receive leaves the cursor uncommitted for safe redelivery; consumed one-shot relay never also calls ordinary Engine receive; bot echo/incomplete update/unlisted peer skipped without dispatch or send). `local-weixin-native` node tests 6/6; relay ledger/routing/coordinator node tests 28/28; native-source spec 3/3; Outbox spec 4/4 (Source-OFF pending, late-kind, dedup, C5 never-retry-after-ambiguous-failure); I1E vertical 1/1 (Engine→Ticket→Executor→ensure→delivery→preview→report-ready→Outbox reply, no source writes).
- Full suites: Vitest 69 files 1256/1256 PASS; CI-exact workflow node-test list 255/255 PASS; queue-proxy 5/5 PASS; six-spec focus set 43/43 PASS; `tsc --noEmit` PASS; tsdown build PASS (14 files, 792 kB); `pnpm check` PASS.
- No-egress proof: the polling test's `fetch` trap fails the test on any endpoint other than the getupdates POST; all protocol tests inject fake fetchers; no 3080/3083/8123 probe, no model inference, no QR, no real credential file used.
- Gap matrix (read-only, honest): chain links PASS for malformed/echo/group discard, unauthorized-peer denial, opaque context-token carry + expiry-gone, stable-id replay dedup, cursor commit/redelivery, report-ready→pending unsent Outbox (fake transport), and the OL-047 real-I2 proof. GAPS: (1) no unified fake-Weixin I3 integration test running the real poll loop through Engine→Ticket→Worker→report-ready→Outbox in one fake harness (the vertical test uses a non-Weixin trigger; poll-offline stops at Engine receive); (2) non-2xx poll path (401/429/5xx) and the backoff schedule (2s→30s after 3 failures, 1h on stale -14) are implemented but untested offline; (3) account-rotation cursor reset untested; (4) abort-mid-page partial-commit untested. The report contains a precise remote-owned fix plan for each gap (new integration test, HTTP-status + backoff test with fake clock, rotation test, abort test). The local Agent patched nothing.
- Host accounting: no original service query/restart, no inference, no real Weixin HTTP/QR/credential, no cloud/OpenClaw, no production SQLite/Session/Workspace access, no registered-project writes, no real Apply; only task-owned worktrees cleaned; OL-044/045/046/047 evidence preserved.
- No OL-049 auto-dispatch; PR #1 stays DRAFT/unmerged; online owner independently ACKs.
