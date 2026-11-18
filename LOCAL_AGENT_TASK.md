# LOCAL_AGENT_TASK — OL-20261118-042 / I1F MANUALLY HANDED-OFF OFFLINE MAC BATCH

**A single scoped OFFLINE SYNTHETIC + READ-ONLY task. No auto-dispatch from GitHub, CI, DSH scheduler or archived grants.** Operator must explicitly pass this task to the Mac Agent. OL-041 was locally completed, online ACKed and CLOSED. There is no live-host write authorization.

Task: OL-20261118-042. Expected unique result: LO-20261118-042.
Frozen source SHA: ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead.
CI #550: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819, 3/3 success, Linux/macOS: focused Vitest 30/30, Node 253/253, proxy 5/5, full Vitest 1238/1238, typecheck/build pass.
Task message: agent-handoff/messages/to-local/2026-11-18-ol042-i1f-mac-readiness.md.
Full authoritative runbook: agent-handoff/HANDOFF-2026-11-18-I1F-MAC-BATCH.md.

Run bounded stages A/B/C/E: new detached private test worktree, whole CI-equivalent suite and three repeat focused runs; host read-only baseline and ending invariant check; synthetic P3 native read-only openat and APFS negative matrix; inspect installed DSH Session/Workspace identity APIs using only source/types and disposable fake SessionController. Report the unresolved existing-session workspace identity boundary precisely.

**Stage D real DSH Session/Worker, actual inference, 3080/3083/8123, native Weixin or I2/I3: NOT AUTHORIZED.** Any real-host action requires a fresh exact, privately approved one-shot stage after independent gates; this public document cannot grant it. Real registered project Apply remains strictly FORBIDDEN even if a separate staging test is someday approved. Existing original service configuration, Session/Workspace histories, production SQLite, global provider/model defaults and listener access behavior MUST remain unchanged.

Claim OL-042 ONCE only after the operator's manual handoff. Publish one sanitized GitHub report, one LO-042 result message and claimed/done receipts; normal non-force fast-forward report-only push; no product edits, no raw logs, secrets, original host identifiers or operator as report courier. Online scheduler remains PAUSED, local scheduler read-only and unchanged.
