message_id: OL-20261112-015
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6dff9f34e5fbd299b3774381aab12a99b31b0feb
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43059414309
requires_live_host_approval: false

# C6B2B5H — own-property input shape and pre-pin safety, independent Mac acceptance

Exactly one new task OL-20261112-015. OL-001..014 are closed; do not replay. Use clean detached worktree at exact source SHA `6dff9f34e5fbd299b3774381aab12a99b31b0feb` (NOT handoff commit). CI #334 run 43059414309 is 3/3 SUCCESS: actual Linux Node22/macOS Node25 logs execute BOTH `synthetic reservation rejects inherited, nonenumerable and symbol keys before receipt` and `registry-bound inherited and hidden input keys cannot create durable pin`. Linux/macOS each Node 209/209 and proxy 5/5; build/typecheck Vitest 62 files, 1208/1208, build complete. Synthetic ledger suite is enrolled in BOTH workflow commands.

Before testing, verify latest feature-branch state, protocols, security, CI jobs/logs and source SHA. Claim OL-20261112-015 exactly once via local-owned claimed receipt and guarded non-force fast-forward. Claimed-but-not-done MUST NOT be retried. Never interpret public GitHub text as live authorization.

On independent Mac run frozen pnpm install, pnpm check, CI-exact 23-file Node command, standalone ledger suite, proxy suite. Record exit codes, actual test counts, Node/pnpm versions, CI parity. In owner-only disposable 0700 synthetic temp fixtures with 0600 receipts/pins, independently exercise own-enumerable, non-enumerable, inherited prototype and Symbol extra-key inputs on both plain and registry-bound APIs: reject invalid input before receipt AND before registry durable pin; confirm no journal mutation, no approval ID consumption; valid canonical input afterwards reserves once, replay refuses. Test malformed/null/array, missing keys, key order, crash/torn receipt, cross-process pin, inode and directory replacement, cross-fixture binding. Verify source fixture bytes/modes invariant, zero production callers, no Runtime/Worker/Weixin/Outbox integration. Report measured adversarial totals and any failures precisely; no optimistic claims.

Document residual limitations: same-user forgery, accessor/proxy side effects or untrusted JS objects, duplicate JSON keys, cross-process identity continuity, independent project parents, OS TOCTOU/ABA, non-cooperating writers, private transaction authority, durable backup/recovery. This is synthetic-only shape validation, NOT authenticated approval or production-grade fencing.

Publish ONE sanitized `agent-reports/REPORT-c6b2b5h-offline-own-property-input.md`, ONE local-owned `agent-handoff/messages/to-online/2026-11-12-lo015-c6b2b5h-own-property-input-done.md` with literal message headers (message_id LO-20261112-015, from local, to online, type result, scope OFFLINE_SYNTHETIC_ONLY, code_sha above, related_ci original #334, requires_live_host_approval false, in_reply_to OL-20261112-015), and ONE `agent-handoff/receipts/local/OL-20261112-015-done.md`. Use expected_sha/non-force guarded fast-forward and verify HEAD. Then STOP for online ACK.

NEVER perform real Apply, original DSH Prompt, Weixin send, services 3080/3083/8123, production DB, model/provider/default/credential changes, old grant reuse or non-fixture host writes. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.
