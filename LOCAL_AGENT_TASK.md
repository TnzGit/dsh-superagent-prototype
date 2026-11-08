# LOCAL_AGENT_TASK — CURRENT: C4 OFFLINE 3080 CONTINUATION READINESS

**Read first:** `LOCAL_AGENT_PROTOCOL.md`. **Source of truth:** current feature branch `feat/local-first-wechat-foundation` in `TnzGit/dsh-superagent-prototype`. Previous Gate① and Gate①.5 work is complete; do NOT rerun historical provider setup just because an older task/runbook still exists.

## Current operator authorization

**Offline source review and mock regression tests only.** The operator has NOT approved Gate①.6 Phase B (the live low/high reasoningEfforts relocation), selecting/creating a disposable test Workspace/Session, `session/selectModel`, any 3080 `session/prompt`, a restart, live 8123 inference, or any Weixin relay switch. Preserve existing 3080/3083/8123 processes; original 3080 `0.0.0.0:3080`, `allowUnauthenticated:true`, trustedHosts and existing anonymous LAN access. No OpenClaw.

## Remote code already added

- `src/local-first/dsh-3080-model-gate.ts`: injected-port-only, disabled-by-default disposable-Session model switch + async default save and revision-CAS restoration. **This is not wired to the running 3083 or the 3080 transport.**
- `src/local-first/dsh-3080-new-workspace.ts`: injected-port-only, disabled-by-default native Workspace+fresh Session creation with a private one-shot grant, stage ledger and post-create membership validation. **No live directory or original DSH Session has been created.**
- Node mock suites: `tests/local-dsh-3080-model-gate.node-test.mjs`, `tests/local-dsh-3080-new-workspace.node-test.mjs`. Both are now exercised by Linux and macOS GitHub CI; `docs/007-architecture.md` records these modules.
- First combined code acceptance SHA `fda9b3446ee2f3a9b9fa7c499f527187a3296acf` got all 3 GitHub Actions jobs green in run 168. Recheck HEAD and status before reporting newer code as green.

## Host Agent offline validation (no live mutation)

1. In a separate clean worktree from the current remote feature HEAD, run `pnpm install --frozen-lockfile`, `pnpm check`, and:
   ```sh
   node --experimental-strip-types --test \
     tests/local-dsh-3080-model-gate.node-test.mjs \
     tests/local-dsh-3080-new-workspace.node-test.mjs \
     tests/local-dsh-3080-bridge.node-test.mjs \
     tests/local-dsh-relay-coordinator.node-test.mjs
   ```
2. Compare the injected-port contracts to locally installed DSH 0.2.2-alpha.2's official SessionController, WorkspaceController and SettingsController types **without making API mutation calls**. The future live implementation MUST NOT invent RPC argument shapes. In particular, `workspace/create` adopts an existing directory; `session/create` accepts `workspaceId`; `settings/replace` has `expectedRevision` and must not be called without a current revision.
3. Read-only verify 3080 global default and modelCatalog, existing anonymous LAN access, the 3080/3083/8123 listener/PID invariants. Record only aggregate Workspace/Session counts, not private IDs or history.
4. Identify any mismatch or risk that prevents a future **separately approved** smoke test. If code must be changed, report the issue; remote ChatGPT will fix product source and tests. **Do not edit source locally.**

## Report to GitHub, NOT through the operator

Publish a sanitized final report to `agent-reports/REPORT-c4-offline-native-workspace-model-gate.md` using the dedicated report worktree and a normal non-force push. Include tested SHA, actual `pnpm check` and standalone test counts and exit codes, official API contract findings, read-only listener/default evidence, mock-vs-real distinction, any blocker, and `REAL 3080 SESSION E2E NOT RUN` / `REAL WEIXIN RETURN NOT RUN`. No raw paths, Session IDs, credentials or private logs.

The local Agent's final chat output must be **one brief status line with the verified GitHub report URL and SHA only**. Never paste or attach the report or ask the operator to forward it. Remote ChatGPT retrieves it directly from GitHub when the chat resumes.

**STOP** after this report. Phase B, original 3080 live Session switch/create, real Prompt and any service restart remain separately UNAPPROVED.
