# Active work queue — 2026-11-11

| Milestone | State | Owner | Next exact operation |
| --- | --- | --- | --- |
| C6B2B4D | ACCEPTED_AND_ACKED | none | LO-005 done, report/CI verified; no replay |
| C6B2B4E | LOCAL_SYNTHETIC_ACCEPTANCE_PENDING | local | Process ONE new OL-20261111-006 against source ef370ba8, CI #269 3/3 success; independent Mac read-only synthetic preflight tests, submit sanitized report and local done receipt |
| C6B2B4F | REMOTE_AFTER_E | remote | Continue synthetic-only adversarial OS ancestor/TOCTOU and project-root identity monitoring design with actual tests; do not assert production fd-relative safety |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / EXACT_SCOPE_AND_OS_GATES_UNMET | remote + operator | Specific registered project and diff, OS no-follow path safety and external-writer quiescence, backup and private transaction grant still required |

## Hourly remote execution gate

Check to-online messages and online receipts first, then WORK_QUEUE even without inbound updates. Avoid duplicate local dispatch for claimed OL-006. On local result verify report exact SHA/CI and write LO-006 ACK, then do substantive C6B2B4F work before publishing another single task. Never count bare 3/3 CI without inspecting suite inclusion (ledger suite enrolled in both Linux/macOS). The remote scheduler is a bounded hourly execution, not a 24/7 worker; if blocked, persist a concrete blocker/owner; if safe remote work available, continue. No heartbeat commits or historical live grant reuse.
