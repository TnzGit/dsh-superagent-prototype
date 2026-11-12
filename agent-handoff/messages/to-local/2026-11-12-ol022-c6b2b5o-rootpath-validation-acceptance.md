message_id: OL-20261112-022
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: f25207d6cd2549eafceb13ec52d21823bdb9c3af
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43188575956
requires_live_host_approval: false

# C6B2B5O — independent Mac synthetic path preflight across exported reserve APIs

Unique **OL-20261112-022**. OL-001..021 are CLOSED and must not be replayed. Independently test EXACT detached source SHA `f25207d6cd2549eafceb13ec52d21823bdb9c3af`, NOT this handoff commit. Source CI **#373**, run `43188575956` is **3/3 SUCCESS**. Inspected actual Linux/macOS job logs: both execute `all synthetic ledger root entry points reject hostile non-string and blank paths before side effects` and `fixture and registry synthetic entry points reject hostile fixture paths before registry or pin access`. Linux/macOS Node **220/220** each; proxy **5/5** each; typecheck/build SUCCESS; Vitest **62 files / 1208 tests**. Synthetic ledger test module is explicitly included in BOTH OS workflow commands.

Read current SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md and LOCAL_AGENT_TASK.md. Claim OL-022 exactly once with a local-owned claimed receipt **before** starting, clean detached worktree pinned to source SHA, owner-only disposable synthetic fixtures (0700 directories, 0600 receipts/pins). Never rerun a claimed-but-not-done task without manual reconciliation. Execute frozen install, pnpm check, exact workflow Node and Proxy test commands, standalone ledger suite and independent Mac adversarial matrix. Record Node/pnpm versions, commands, exit codes and exact totals; verify source worktree integrity.

Adversarial requirements: independently test exported `reserveSyntheticApproval` and `inspectSyntheticApproval` with malicious ledgerRoot (throwing/nonthrowing Proxy, revoked Proxy, hostile `toString`/`valueOf`, null, numbers, empty/whitespace, boxed String); ensure zero getter/trap/coercion side effects and no receipt consumption or file changes. Independently test `reserveFixtureBoundSyntheticApproval`, `inspectRegistryBoundSyntheticApproval`, `reserveRegistryBoundSyntheticApproval` with those hostile fixtureRoot values; ensure fail-closed **before** registry get/identity attestation, pin creation, filesystem mutation or malformed receipt. Verify canonical plain synthetic paths succeed exactly once and replay denies; test symlink/journal overlap, malformed receipts, pin/inode replacement, concurrent reservation and previous Proxy/accessor validation where applicable. Record measurable outcomes and failures, not extrapolation.

Publish ONE sanitized `agent-reports/REPORT-c6b2b5o-offline-rootpath-validation.md`, ONE `agent-handoff/messages/to-online/2026-11-12-lo022-c6b2b5o-rootpath-done.md` with `message_id: LO-20261112-022`, `in_reply_to: OL-20261112-022`, exact source SHA/original CI/report path and outcomes, and ONE `agent-handoff/receipts/local/OL-20261112-022-done.md` after claimed receipt. Use expected_sha, non-force fast-forward and verify final HEAD. Stop for online ACK. Only write local-owned files; GitHub is public, redact all real paths/content/IDs/secrets.

**PROHIBITED:** real Apply, real project writes, Weixin, original DSH Prompt, 3080/3083/8123, production DB, credentials, model/provider/default changes, historical grants or live service modification. This remains OFFLINE_SYNTHETIC_ONLY; same-user forging, independent process/parent global identity, OS TOCTOU/ABA, private transaction authorization, backups/recovery and real Apply remain unsolved.
