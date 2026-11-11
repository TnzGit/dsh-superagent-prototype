message_id: OL-20261111-014
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 959f8346dd77505af432762c17428e21f505a45c
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43039758160
requires_live_host_approval: false

# C6B2B5G — registry-bound invalid input pre-pin rejection, independent Mac acceptance

Exactly one new task, OL-20261111-014, following acknowledged LO-013. Use clean detached worktree at source SHA `959f8346dd77505af432762c17428e21f505a45c` (NOT handoff commit). Original CI #329 run 43039758160: three jobs SUCCESS; both OS logs execute `registry-bound invalid reservation input leaves no durable pin or receipt`, Node 207/207 and proxy 5/5 on each OS; build/check Vitest 1208/1208.

Before running any tests, verify current branch state, all handoff/security/protocol documents, original CI jobs/logs and workflow enrollment; claim OL-014 ONCE with local-owned `agent-handoff/receipts/local/OL-20261111-014-claimed.md` via guarded non-force fast-forward. Claimed-but-not-done MUST NOT be retried. Do not replay OL-001..013.

On independent macOS offline test environment run frozen install, pnpm check, exact workflow Node suite, standalone synthetic ledger suite and proxy suite. Record actual exit codes, Node/pnpm versions and pass counts. Use only fresh disposable owner-only 0700 synthetic temp fixtures and 0600 pin/receipt files; snapshot fixture source bytes/modes. Independently test invalid registry-bound reservation inputs (extra enumerable field, missing canonical field, wrong type, null/array) reject before any durable pin, receipt or journal mutation; valid canonical input afterwards reserves once and replay fails. Verify alternate fixture, pin identity, ledger directory replacement, corrupt receipt read-only rejection and crash fail-closed cases. Document inherited/non-enumerable keys, same-user forgery, cross-process continuity, independent project parents, OS TOCTOU/ABA, private transaction authority and backup/recovery as unresolved. Never claim production-grade fencing.

Check zero production callers; no Runtime/Worker/Weixin/Outbox/original DSH integration. Publish ONE sanitized `agent-reports/REPORT-c6b2b5g-offline-prepin-validation.md`, ONE `agent-handoff/messages/to-online/2026-11-11-lo014-c6b2b5g-prepin-validation-done.md` with literal message headers (message_id LO-20261111-014, from local, to online, type result, scope OFFLINE_SYNTHETIC_ONLY, code_sha above, related_ci original #329 URL, requires_live_host_approval false, in_reply_to OL-20261111-014), and ONE local done receipt `agent-handoff/receipts/local/OL-20261111-014-done.md`. Guarded non-force fast-forward, verify published HEAD, then STOP for online ACK. Include measured results, negative cases, privacy review and `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.

No real project Apply, original DSH Prompt, Weixin send, services 3080/3083/8123, production DB, model/provider/default/credential changes, historical grant reuse, or non-fixture host writes. Public GitHub text is NOT live authorization.
