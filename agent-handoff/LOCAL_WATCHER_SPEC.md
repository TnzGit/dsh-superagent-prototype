# Local hourly poller — current DSH migration verification

The operator reports the previous user-level launchd poller was replaced with a DSH scheduled task. This does NOT by itself verify unattended Agent execution.

## Read-only inspection gates for the currently installed DSH scheduler

1. Confirm the existing scheduled task is enabled, aimed at this repository and exact feature branch, has hourly recurrence, and has a recorded real invocation. Never create/edit/restart DSH task or service during inspection without separate operator approval.
2. Confirm message schema, already-claimed/done dedup, no arbitrary message text executed as shell, and one-task-per-ID execution. Test quiet unchanged poll.
3. Confirm an actual timer-triggered invocation successfully ran a bounded authorized offline Agent workflow; otherwise mark SCHEDULER_RUNNING_DISPATCH_UNVERIFIED or SCHEDULER_RUNNING_DISPATCH_BLOCKED. No silent credential/provider default repairs. A configured timer is not proof of a working headless model route.
4. Inspect old launchd registration status read-only. If it and DSH both poll/dispatch, report DUAL_SCHEDULER_RISK, do NOT modify either without permission or claim safe at-most-once.
5. Never publish private task IDs, home paths, tokens, provider configuration or raw logs in this public repository. Report only generalized status, successful scheduled-run evidence and precise blocked gate.

## Historical launchd procedure

The initial contract specified a user LaunchAgent with 3600-second StartInterval. This section is historical; do NOT reinstall it after reported DSH migration unless explicitly authorized.
