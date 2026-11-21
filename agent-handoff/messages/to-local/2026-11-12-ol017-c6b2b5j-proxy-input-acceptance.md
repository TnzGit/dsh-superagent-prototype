message_id: OL-20261112-017
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6c9b7dfc99bd7f66fd1370410c695eeef1f2b6de
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43113707101
requires_live_host_approval: false

# C6B2B5J — independent Mac Proxy input rejection and pre-pin acceptance

Unique OL-20261112-017; OL-001..016 closed and MUST NOT be replayed. Test exact detached source SHA 6c9b7dfc99bd7f66fd1370410c695eeef1f2b6de, not the dispatch commit. Source CI #346 run 43113707101 is 3/3 SUCCESS: real Linux/macOS logs explicitly execute both `synthetic reservation rejects Proxy inputs without invoking traps or writing receipt` and `registry-bound Proxy input is refused before pin and without executing traps`. Both OS Node 213/213, proxy 5/5, typecheck/build Vitest 62 files / 1208 tests. Existing ledger suite is enrolled in both OS commands.

Read latest security, real-Apply gates, message protocol, LOCAL_AGENT_PROTOCOL.md and LOCAL_AGENT_TASK.md. Claim once via local-owned receipt before testing; claimed-but-not-done is not retried. Use clean detached worktree and owner-only 0700 disposable synthetic fixtures, 0600 receipts and pins. Independently run frozen pnpm install, pnpm check, exact 23-file Node workflow command, standalone ledger suite, and proxy suite; record actual counts, Node/pnpm versions, exits. Verify ordinary and registry-bound reservations reject benign, throwing-trap and revoked Proxy without trap execution, without receipt or durable pin; ensure canonical plain data reservation still succeeds once and replay refuses. Adversarially exercise inherited/non-enumerable/symbol extras, getters/accessors, mutation across async boundaries, cross-process pin, inode replacement, torn receipt, cross-fixture and journal overlap, malformed input. Verify source bytes/modes unchanged and zero production callers. Document measured pass/fail and precise limitations, never claim authentication or race-free isolation.

Residual blockers: same-user forgery, cross-process/independent-parent identity, OS TOCTOU/ABA, non-cooperating writers, private transaction authority, backup/recovery, real Apply gates. No live host authority.

Publish ONE sanitized `agent-reports/REPORT-c6b2b5j-offline-proxy-input.md`, ONE `agent-handoff/messages/to-online/2026-11-12-lo017-c6b2b5j-proxy-input-done.md` (LO-20261112-017, from local, to online, type result, OFFLINE_SYNTHETIC_ONLY, exact code_sha, CI #346, in_reply_to OL-20261112-017), and ONE `agent-handoff/receipts/local/OL-20261112-017-done.md`. Use expected_sha non-force fast-forward; verify HEAD. STOP for online ACK. NO real Apply, original DSH Prompt, Weixin, services 3080/3083/8123, production DB, model/provider/default/credentials, old grants or non-fixture writes. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.
