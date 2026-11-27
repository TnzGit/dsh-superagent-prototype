message_id: OL-20261112-018
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: ef352b2ec4b3b6992f614673a2a1100ba3408103
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43128992443
requires_live_host_approval: false

# C6B2B5K — independent Mac fixture-bound Proxy pre-read acceptance

Unique OL-20261112-018. OL-001..017 closed; do not replay. Test exact detached source SHA ef352b2ec4b3b6992f614673a2a1100ba3408103, NOT this handoff commit. CI #351 run 43128992443 attempt 2 verified 3/3 SUCCESS: Linux/macOS Node 214/214, proxy 5/5 each, Vitest 1208/1208, typecheck and build SUCCESS. Both OS logs execute "fixture-bound Proxy is refused before binding reads, traps or receipt" in the synthetic ledger suite.

Read SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md and LOCAL_AGENT_TASK.md. Claim once before offline execution; no retry of claimed-but-not-done. In a clean detached worktree pinned to source SHA, run frozen install, pnpm check, exact workflow Node test command, standalone ledger and proxy suite. Use only owner-private disposable synthetic fixtures. Independently test benign/throwing/revoked Proxy fixture-bound inputs, verify zero traps and zero receipt/pin, no early marker or journal reads, plain canonical reservation succeeds once and replay fails. Cover registry-bound Proxy, inherited/non-enumerable/symbol extras, accessors, mutation across async, inode replacement, cross-process pin, malformed/torn receipt and cross-fixture paths. Report actual counts, adversarial matrix, errors, source integrity and residual limitations.

Publish ONE sanitized agent-reports/REPORT-c6b2b5k-offline-fixture-proxy.md, ONE to-online LO-20261112-018 result with code SHA/CI/in_reply_to, and ONE local OL-20261112-018-done receipt, via non-force expected_sha guarded push; verify HEAD. Stop for online ACK. No real Apply, Weixin, original DSH Prompt, production DB, 3080/3083/8123, credentials, provider/model or historic grants. Same-user forgery, OS TOCTOU/ABA, independent-process identity and private authorization/recovery remain unsolved.
