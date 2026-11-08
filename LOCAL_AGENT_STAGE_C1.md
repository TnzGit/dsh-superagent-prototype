# LOCAL_AGENT_STAGE_C1 — 3080 continuity and model safety preflight (after C0)

> **C0 COMPLETE. DO NOT REPEAT THE 27-workspace / 841-session inventory or scan Weixin QR.** The user has already approved pairing and the native Weixin test remains online. This handoff begins only after the remote C0 bugfix and strict local DSH RPC adapter code are fetched from `feat/local-first-wechat-foundation`. It is NOT permission to send a test prompt or restart an existing process.

## Immutable running hosts

- Mac existing DSH (valuable historical Workspaces/Sessions): port **3080**, **must retain** the operator-required LAN listener `0.0.0.0` and current `allowUnauthenticated: true` / trustedHosts anonymous owner-access behavior. These are intentional compatibility requirements, not defects to remediate in this task.
- Native Weixin Superagent staging: **3083**, already paired and message-tested.
- Serialized Qwen OpenAI proxy: **8123**, currently used by 3083. The 3080 DSH default Qwen provider is **NOT routed through 8123**.

**Keep all three online and untouched** in this C1 preflight. Preserve all 3080 Session logs, Workspace IDs and data; do not migrate/upgrade 0.2.2-alpha.2, copy its profile into 3083, select a different model, or create a new project. Never use the old OpenClaw.

## C1.1 Independent worktree / offline tests

Check `git status --short`; fetch `origin feat/local-first-wechat-foundation` without hard reset; if the existing worktree is dirty, use another independent worktree. Commit/PR changes belong to remote ChatGPT only.

```bash
pnpm install --frozen-lockfile
pnpm check
node --experimental-strip-types --test \
  tests/local-existing-dsh-projects.node-test.mjs \
  tests/local-dsh-3080-bridge.node-test.mjs \
  tests/local-dsh-3080-probe.node-test.mjs \
  tests/local-project-workspaces.node-test.mjs
```

The remote code should have corrected the documentation forward link/module inventory and macOS `/var` fixture realpath issue. These commands MUST NOT request new Weixin QR or submit any real DSH Session prompt. If tests fail, report exact minimal error to remote ChatGPT; do not modify product code locally.

## C1.2 Only the existing supported READ-ONLY RPC

Use the already-created **private** 0600 `~/.dsh-superagent-private/DSH-CATALOG.json`; never upload it, tokens, raw Session IDs or full directory paths.

```bash
node --experimental-strip-types scripts/probe-dsh-3080.mjs \
  --catalog "$HOME/.dsh-superagent-private/DSH-CATALOG.json"
```

The script uses only `POST http://127.0.0.1:3080/api/session/list`; it does not use nonexistent `workspace/list`, call `session/prompt`, upgrade a Session, or change a provider. Confirm the report's aggregate metadata still matches or explain why it changed, without publishing private identifiers. If a specific disposable Workspace/Session was previously designated by the user, an optional `--project <private-alias> --session <private-session-id>` shows only refusal reasons; otherwise omit them.

The library `src/local-first/dsh-3080-bridge.ts` uses the exact `client-request` / `server-response` envelope, matching RPC IDs, `payload.args._request`, Origin header and exact loopback destination. It is **not integrated into live 3083 Weixin routing** and defaults to refusal of real requests.

## C1.3 Preserve 3080 LAN compatibility; validate model and Session safety without changes

1. Confirm by reading the existing configuration and the already-proven baseline that 3080 remains bound to `0.0.0.0`, that `allowUnauthenticated: true` and trustedHosts still provide LAN clients' established unauthenticated access, and that existing LAN users/workflows are unaffected. No repeated active security probing, no other-host scans.
2. **Hard operator requirement: preserve LAN anonymous access.** Do not propose or perform a rebind to `127.0.0.1`, disabling `allowUnauthenticated`, adding login tokens, requiring authentication, blocking LAN access with a firewall/ACL, changing trustedHosts or restricting 3080's existing routes. Those changes would break the user's intended access pattern. Record the inherent trust exposure in the report *as an explicitly accepted design property*, not as a blocker or an authorization request. The new 3083 bridge may separately restrict its own outbound target to `127.0.0.1:3080` and require its own strict allowlists/consent/model gates; this must not change 3080's listener or who can access it.
3. Confirm whether 3080's `cmp170hx` provider still targets vLLM directly. It previously bypassed 8123. A real continuation trial cannot preserve strict one-slot inference unless the selected Session is verified to use 8123. **Do not change every historical Session's model or the global provider by accident.** Official `session/selectModel` may persist a new DSH global default.
4. Identify, only with user approval, a *disposable* current-format Workspace/Session. If a Workspace has multiple Sessions, have the user select the exact Session; `migration-required` (286 historically), `running`, `danger-full-access` and nonlocal/cloud Session selections are refused. Don't infer safety merely from `running:false`.
5. Audit possible choices for an isolated *test-only* queued local provider configuration in the real 3080 host, with precise affected Sessions, backup, single-slot proxy credential path, rollback. This audit MUST NOT enact a change in C1.

The remote adapter's submit gate requires all of the following before a single real prompt: manual user authorization, exact original workspace and Session membership, allowed disposable Session ID, valid current format, idle, `workspace-write`, exact `cmp170hx/Qwen3.8-Flash-Next`, a positive 8123 route attestation callback and verified queue route. **C1 cannot satisfy the last condition with the current direct-to-vLLM provider**, so do not override or weaken the guard.

## C1.4 Report and stop

Write `REPORT-existing-dsh-stageC1-preflight.md` with PASS/FAIL/BLOCKED/NOT RUN, pinned code SHA, `pnpm check` and Node test results, actual read-only 3080 probe, confirmation that the operator-required anonymous LAN access remains unchanged, model queue-route plan, safe disposable test Workspace/Session *without disclosing identities*, approval requests only for actual future provider/test-Session actions (not for changing 3080 LAN/auth), rollback steps, and remote code blockers.

**STOP** after report. Only after remote ChatGPT's code checks pass and the user explicitly approves a controlled, limited change/test may a later stage use `session/prompt`. Do not request Weixin QR again or modify valuable old Sessions. Work with original DSH 3080, not a fresh copy pretending to have its history.
