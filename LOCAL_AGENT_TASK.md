# LOCAL_AGENT_TASK — CURRENT: C6B2B4B OFFLINE DESIGN REVIEW + DSH SCHEDULER CHECK

New handoff task: OL-20261110-003, type: task, scope: DOCS_ONLY (not the old OL-002 standby ACK).
Repository: TnzGit/dsh-superagent-prototype, branch: feat/local-first-wechat-foundation.
Exact verified code baseline: 55d482a385636297ec942a01db80d77b0569f96e, CI #244 3/3 success. New task/docs commits change HEAD only; verify both the baseline CI and latest source task content.
C6B2B4A is accepted ALL_OFFLINE_PASS; do not rerun it.

## Gate 0: inspect existing DSH hourly task READ-ONLY

The operator reports migration of hourly local polling from launchd to a DSH scheduled task. This is NOT proof of actual autonomous Agent dispatch. Read agent-handoff/LOCAL_WATCHER_SPEC.md. Inspect only the existing schedule/last run/inbox claim state and whether a true timer-triggered Agent execution occurred. No new task creation, changes to DSH services, provider credentials, global defaults, model, production Sessions or restarts. Read-only check old launchd registration; if both may dispatch same inbox, report DUAL_SCHEDULER_RISK and do not change them without separate approval. If no real headless local execution proof, mark SCHEDULER_RUNNING_DISPATCH_UNVERIFIED or SCHEDULER_RUNNING_DISPATCH_BLOCKED.

## Gate 1: C6B2B4B static design review

1. Read latest branch agent-handoff/README.md, PROJECT_CONTEXT.md, WORK_QUEUE.md, CURRENT_STATE.md, SECURITY.md, MESSAGE_PROTOCOL.md, LOCAL_WATCHER_SPEC.md, LOCAL_AGENT_PROTOCOL.md, this task and docs/C6B2B4B-source-apply-safety.md.
2. Before substantive work, create append-only local claimed receipt for OL-20261110-003. If an existing claimed-but-not-done receipt exists, DO NOT REPLAY; reconcile and report blocker.
3. In a clean review worktree inspect original C6A/C6B1/C6B2A/B1/B2/B3/B4A source and tests, read-only, no production project inspection or write. Identify at least 15 concrete adversarial negatives, each with currently supported evidence, missing safety guarantee and macOS-compatible test/mitigation.
4. Analyze OS path races, symlinks, hardlinks, APFS case/Unicode alias, ACL/xattrs, external writers, partial batch and fsync/journal crash boundaries, untrusted GitHub grants, one-use receipt, and cross-process fencing. Distinguish design review from a production-capable executor.
5. If needed run EXISTING synthetic tests only in new private disposable fixture; never run any real source file Apply, 3080 Session prompt, native Weixin, 3083, 8123, model/provider changes, DB writes or service restarts.
6. Determine next safe C6B2B4C scope: synthetic-only adversarial harness, and identify what WOULD require a future separate human approval. Do not implement a native writer.

## Gate 2: report and handoff

Publish sanitized agent-reports/REPORT-c6b2b4b-offline-source-apply-safety-design.md and one unique agent-handoff/messages/to-online/<id>.md plus claimed/done receipts under receipts/local/ for OL-20261110-003. Preserve messages as append-only, use normal non-force push and no product code changes. Report actual scheduler verification status (not claimed automatic on timer alone), no raw paths, credentials, real task IDs or private logs.

Final line: ALL_OFFLINE_DESIGN_REVIEW_PASS or BLOCKED_DESIGN/BLOCKED_INFRA + report URL + commit SHA + SCHEDULER_DISPATCH_VERIFIED/SCHEDULER_RUNNING_DISPATCH_UNVERIFIED/SCHEDULER_RUNNING_DISPATCH_BLOCKED/DUAL_SCHEDULER_RISK. STOP.

**No new live-host authorization.** Real project Apply/rollback, model/service changes, historical grants and native Weixin remain prohibited.
