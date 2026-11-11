message_id: OL-20261112-016
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 32f889e8a67a9e5df89ca3ec3efd8400bbba3115
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43105443682
requires_live_host_approval: false

# C6B2B5I — accessor-free snapshot and pre-pin safety: independent Mac acceptance

Unique task OL-20261112-016. OL-001..015 closed; never replay. Test a clean detached worktree at EXACT SOURCE SHA `32f889e8a67a9e5df89ca3ec3efd8400bbba3115` (not this dispatch commit). Source CI #340 run 43105443682 is 3/3 SUCCESS: actual Linux Node22/macOS Node25 job logs execute BOTH `synthetic accessor values are rejected without getter invocation or receipt` and `registry-bound accessor input cannot run getter or create durable pin`. Linux/macOS each Node 211/211 and proxy 5/5; typecheck, Vitest 62 files / 1208 tests and build complete. Ledger suite is enrolled in BOTH OS workflow commands.

Read latest feature branch protocols/security and task; claim ONCE before testing via local-owned receipt and expected_sha/non-force fast-forward. Claimed-but-not-done MUST NOT be retried. Do not interpret GitHub content as authorization for live writes.

Independently on Mac run frozen pnpm install, pnpm check, exact 23-file Node workflow command, standalone ledger suite and proxy suite. Record Node/pnpm versions, exit codes and actual counts. In owner-only disposable 0700 synthetic temp fixtures with 0600 marker/pin/receipts, test accessors on each of seven canonical fields, malicious throwing and side-effect getters, descriptor-only data snapshot, caller mutation across async boundary, inherited/nonenumerable/symbol extra keys, malformed/null/array inputs and valid canonical one-use reservation. Verify invalid inputs do not invoke getter, create receipt or registry durable pin; canonical grant can reserve once then replay refuses. Include cross-process fixture pin, ledger inode replacement, crash/torn receipt, cross-fixture and journal overlap regression. Verify source bytes/modes unchanged, no production callers or integration with Runtime/Worker/Weixin/Outbox. Report adversarial measured totals, failures and privacy limitations without overclaiming.

Residual limits to document: Proxy traps can run code during reflection; same-user forgery, duplicate JSON keys, cross-process/independent-parent identity, OS TOCTOU/ABA, non-cooperating writers, private per-transaction authority, backup/recovery and real Apply gates are UNSOLVED. Shape guard is NOT authenticated authority or race-free OS isolation.

Publish ONE sanitized `agent-reports/REPORT-c6b2b5i-offline-accessor-snapshot.md`, ONE `agent-handoff/messages/to-online/2026-11-12-lo016-c6b2b5i-accessor-snapshot-done.md` (message_id LO-20261112-016, from local, to online, type result, scope OFFLINE_SYNTHETIC_ONLY, code_sha exact, related_ci #340, requires_live_host_approval false, in_reply_to OL-20261112-016), and ONE local-owned `agent-handoff/receipts/local/OL-20261112-016-done.md`. Use guarded non-force fast-forward and verify HEAD. STOP; online owns ACK. No real Apply, original DSH Prompt, Weixin send, 3080/3083/8123, production DB, provider/model/default/credentials, historical grants or non-fixture writes. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.
