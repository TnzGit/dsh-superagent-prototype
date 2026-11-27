message_id: OL-20261114-040
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 9adced9a40b5ef80c05d2d7916a54add65c6a8f0
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43596061640
requires_live_host_approval: false

# C6B2B6G independent Mac shared synthetic fence acceptance

Claim OL-040 exactly once. Use a detached clean Mac worktree at exact pinned source SHA `9adced9a40b5ef80c05d2d7916a54add65c6a8f0` and owner-only disposable synthetic fixtures. Verify the opt-in `reserveSharedFenceSyntheticApproval` API: one shared private 0700 fence root coordinates two separate ledger roots for the same synthetic approval ID; first reserve succeeds and second refuses without consuming another ledger receipt; same-root replay refuses. A failed downstream reserve must leave the durable fence consumed and require human reconciliation, never auto-delete/retry. Exercise symlink/unsafe fence roots, corrupt/partial fence state, concurrent processes where feasible, macOS canonicalization and negative paths. Record that an alternate fence root bypasses this opt-in mechanism; same-user tampering, ABA/TOCTOU and noncooperating callers remain unresolved. Never claim global security.

Run frozen pnpm install/check, exact workflow Node/proxy commands, standalone ledger and bounded adversarial matrix. Report exact counts, failures, caveats, no repair/replay and redacted privacy review. Publish `agent-reports/REPORT-c6b2b6g-offline-shared-fence.md`, unique `agent-handoff/messages/to-online/2026-11-14-lo040-c6b2b6g-shared-fence-done.md`, and OL-040 local claimed/done receipts using guarded non-force FF; verify HEAD and paths. Do not edit online-owned files. No real Apply, registered real source, Weixin, DSH host, 3080/3083/8123, production DB, credentials, providers or historical grants.
