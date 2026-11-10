# Active work queue — 2026-11-11

| Milestone | State | Owner | Next exact operation |
| --- | --- | --- | --- |
| C6B2B4D | ACCEPTED_AND_ACKED | none | LO-005 done, report/CI verified; no replay |
| C6B2B4E | LOCAL_SYNTHETIC_ACCEPTANCE_PENDING | local | Process ONE new OL-20261111-006 against source ef370ba8, CI #269 3/3 success; independent Mac read-only synthetic preflight tests, submit sanitized report and local done receipt |
| C6B2B4F | REMOTE_AFTER_E | remote | Continue synthetic-only adversarial OS ancestor/TOCTOU and project-root identity monitoring design with actual tests; do not assert production fd-relative safety |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / EXACT_SCOPE_AND_OS_GATES_UNMET | remote + operator | Specific registered project and diff, OS no-follow path safety and external-writer quiescence, backup and private transaction grant still required |

## Hourly remote execution gate

Check to-online messages and online receipts first, then WORK_QUEUE even without inbound updates. Avoid duplicate local dispatch for claimed OL-006. On local result verify report exact SHA/CI and write LO-006 ACK, then do substantive C6B2B4F work before publishing another single task. Never count bare 3/3 CI without inspecting suite inclusion (ledger suite enrolled in both Linux/macOS). The remote scheduler is a bounded hourly execution, not a 24/7 worker; if blocked, persist a concrete blocker/owner; if safe remote work available, continue. No heartbeat commits or historical live grant reuse.

## C6B2B4F remote source checkpoint (2026-11-11)

Remote-owned read-only synthetic registry preflight now rejects symlinked project-root ancestors (commit `5e39eeebb753c3c6306dcebc85909e61e8b4ff07`) and has a post-registration ancestor-swap regression in the already-enrolled Linux/macOS Node suite (commit `7faaa63d404a7a610718e4722f899853d0bbee02`). These commits are **NOT ACCEPTED** until exact-SHA GitHub CI executes the new test and all three jobs pass. At last check, CI #271 belonged to the earlier source-only commit and was in progress; the test commit's CI had not appeared. Next owner: remote online, verify exact test-commit CI job logs/counts, fix any failures, then continue synthetic TOCTOU coverage. Existing OL-006 remains local-owned pending; do not dispatch another local task or change its pinned source SHA. This lstat ancestor walk is best-effort and NOT race-free fd-relative security or permission for real Apply.

## B4F CI diagnostic and next gate (2026-11-11)

CI #275 (source 1692f693a16d26d97cb1c69a19285e8709e7b995) ran both Linux and macOS ledger suite: 195/196, one assertion mismatch after ancestor-symlink guard changed the fail-closed diagnostic; build/typecheck succeeded. Remote owner repaired the expected diagnostic regex in the already-enrolled test, preserving rejection semantics. NEXT OWNER: remote online; inspect exact repair commit CI jobs and test counts, then continue source-only synthetic path-race regression coverage. Do not publish another local task before full 3/3 gate. LO-006 accepted and ACKed; no replay. No real Apply authority.
