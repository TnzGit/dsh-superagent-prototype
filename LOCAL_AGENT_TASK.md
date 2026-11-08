# LOCAL_AGENT_TASK — CURRENT: C5 OPERATOR-APPROVED REAL 3080 WEIXIN E2E

**Mandatory first reads:** `LOCAL_AGENT_PROTOCOL.md` and `LOCAL_AGENT_GATE3_LIVE_E2E_RUNBOOK.md`. **Repo:** `TnzGit/dsh-superagent-prototype`; **branch:** `feat/local-first-wechat-foundation`. Do not execute any older C4 or Gate① runbook as the active task.

## User has ALREADY approved all bounded C5 test gates

The operator explicitly said **"我全都批准"** on 2026-11-08 immediately after remote ChatGPT listed Gate①.6 Phase B, one newly disposable original 3080 Workspace/Session, a scoped Session model switch with shared-default restoration, one real 8123 inference and original DSH Session prompt, and one native Weixin reply. The operator also approved a controlled restart if strictly needed. **Proceed without asking for duplicate consent for these exact actions**, under the constraints in the linked C5 runbook.

**This is ONE disposable end-to-end trial only, not unrestricted historical access.** Preserve all existing original 3080 Workspaces/Sessions/history, listener `0.0.0.0:3080`, `allowUnauthenticated:true`, exact trustedHosts and anonymous LAN access; preserve existing `cmp170hx` provider and global `cmp170hx/Qwen3.8-Flash-Next/xhigh`. Do not restart an active original 3080 host, select an old Session, migrate, copy or overwrite history, run cloud models, re-scan Weixin QR, introduce OpenClaw, or force-push/merge.

## Active execution

Run every stage of `LOCAL_AGENT_GATE3_LIVE_E2E_RUNBOOK.md` in order, using the new remotely implemented classes:

- `src/local-first/dsh-3080-operator-rpc.ts`: real official 3080 RPC transport, exact one-shot Session/Workspace grants.
- `src/local-first/dsh-3080-operator-provision.ts`: private filesystem ledger and official Workspace/Session registration.
- `src/local-first/dsh-3080-new-workspace.ts`: one fresh original Workspace and one fresh original Session; **never any old Session**.
- `src/local-first/dsh-3080-model-gate.ts`: one official `session/selectModel`, observe asynchronous default save, `settings/replace` with `expectedRevision`, readback.
- `src/local-first/dsh-3080-bridge.ts`, `dsh-relay-coordinator.ts`, `dsh-relay-store.ts`, `dsh-3080-output.ts`: one user-originated native Weixin Trigger through original Session and 8123, exact RPC output correlation, single reply.

First run `pnpm check` and all new standalone Node tests in a separate clean worktree and confirm the *same-HEAD* GitHub CI is green. Then take private baselines/backups and proceed to the live actions in the approved order, stopping only at the runbook's **technical safety gates**. No additional operator approval is required. The user sending exactly ONE new Weixin test message may be needed to supply an authentic inbound trigger; do not fabricate that message or interpret this as needing fresh permission.

## Mandatory GitHub-only report (NEVER operator-forwarded)

Publish one sanitized report to `agent-reports/REPORT-c5-real-dsh-3080-weixin-e2e.md` using a report-only clean worktree and a normal non-force push. The report must say which exact stages passed/blocked, GitHub CI SHA, whether original 3080 real Session inference occurred, 8123 route attestation, one-shot Weixin outbound result, host invariants and rollback. Never include private real Workspace/Session IDs, paths, credentials, raw logs or message peer/context tokens.

Final local Agent message to the operator: **one short status line with the GitHub report URL, pushed SHA, and PASS/BLOCKED**. Do not paste the report or ask the user to forward/upload it. Remote ChatGPT fetches everything directly from GitHub when the conversation resumes.

**STOP** after the report, regardless of whether completed or blocked. Do not automatically repeat a real prompt, create another Workspace, add additional providers, change the global model default or execute a second Weixin trial.
