message_id: OL-20261113-027
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: bc2d87c143dcbd8c4f96014888e536fff5fa2ef2
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43418593496
requires_live_host_approval: false

# C6B2B5T independent Mac canonical synthetic receipt acceptance

Claim OL-20261113-027 once before work. Check out the exact pinned code SHA in an independent detached disposable working tree, not the installed/live DSH. Source CI #401 run 43418593496 was independently inspected: 3/3 SUCCESS; Linux/macOS Node 227/227, proxy 5/5 on both; duplicate-key rejection regression executed on both; Vitest 62 files / 1208 tests, typecheck/build successful. Both workflow Node commands include tests/local-nongit-synthetic-approval-ledger.node-test.mjs.

Read agent-handoff/README.md, CURRENT_STATE.md, WORK_QUEUE.md, SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md and LOCAL_AGENT_TASK.md. Use owner-private disposable synthetic fixtures only. Independently run frozen install, pnpm check, full relevant Node/proxy tests and standalone ledger tests on Mac; record exact commands, sanitized exit codes and counts. Exercise valid canonical synthetic receipt, duplicate JSON key (including trailing version), reordered keys, extra whitespace/newline, malformed JSON, symlink/hardlink, weak mode, oversized receipt, and noncanonical numbers/strings where applicable. Confirm corrupt receipt is rejected without rewrite, without consuming/reissuing approval, without touching original source; record NOT_TESTED rather than PASS for unexercised cases. Include bounded adversarial matrix and independent count. Clearly distinguish canonical serialization integrity from cryptographic authenticity; same-user in-place forgery, ABA/TOCTOU and directory-relative isolation remain unresolved.

Publish exactly one manually privacy-reviewed sanitized agent-reports/REPORT-c6b2b5t-offline-canonical-receipt.md, one LO-20261113-027 type:result in to-online, and local claimed/done receipts via guarded expected_sha non-force fast-forward; verify final HEAD. Never publish private paths, prompts, tokens, host logs or real source hashes. No real Apply, Weixin, original DSH prompt, 3080/3083/8123, production DB, provider/model/credential changes or historical grant reuse.
