# LOCAL_AGENT_STAGE_C2 — 3080 original-Session output correlation, OFFLINE verification

> **Stages B, C0 and C1 completed. Do not repeat QR pairing or inventory.**
> This instruction tests remote code submitted after the C1 report. It authorizes **NO real Session prompt, NO service restart, NO profile or provider changes**.

## Immutable 3080 LAN compatibility

The user REQUIRES the existing 3080 LAN-wide unauthenticated DSH owner access to remain exactly as-is:
- bind `0.0.0.0:3080`;
- `allowUnauthenticated: true`;
- original `trustedHosts`, LAN access and all currently connected clients;
- no forced login, new cookie/token requirement, firewall restrictions or binding to loopback.

The bridge MAY itself use only `127.0.0.1:3080`; this must not modify or reduce any other LAN client's access.

Keep DSH 3080, native Weixin DSH staging 3083 and Qwen proxy 8123 running. Preserve 27 original Workspaces / 841 original Sessions, all conversation history and current files.

## 1. Fetch remote branch into a separate clean worktree

Repository: `https://github.com/TnzGit/dsh-superagent-prototype`
Branch: `feat/local-first-wechat-foundation`.

Inspect `git status --short` and `git fetch origin feat/local-first-wechat-foundation`. Do not reset any existing worktree, especially `.worktrees/stage-c`, `.worktrees/stage-c1` or the live staging checkout. If necessary create a new `.worktrees/stage-c2` from the fetched branch. Record the EXACT new commit SHA; avoid testing the old C1 `c406fce`.

Remote owns code fixes; local Agent does not modify source code.

## 2. Offline tests — mandatory first

```bash
pnpm install --frozen-lockfile
pnpm check

node --experimental-strip-types --test \
  tests/local-existing-dsh-projects.node-test.mjs \
  tests/local-dsh-3080-bridge.node-test.mjs \
  tests/local-dsh-3080-output.node-test.mjs \
  tests/local-dsh-3080-probe.node-test.mjs \
  tests/local-project-workspaces.node-test.mjs
```

Acceptance:
- The C1 `class-docs.spec.ts` JSDoc failure on `DshBridgeBlocked` is fixed.
- No regressions in `docs.spec.ts`, macOS canonical path tests or original native Weixin tests.
- Official DSH model projection is handled as `{lastUsed, next}`; bridge authorizes **only `next`**, read from exact sequenced `session/projections` baseline rather than cached `session/list` hints. Historical local Qwen usage must not hide a cloud provider selected for the NEXT step.
- `session/list`, `session/projections`, `session/state`, `session/wait` and `session/page` use the exact DSH 0.2.2-alpha.2 RPC envelope; only allowlisted Session IDs may access history readers.
- Real `session/prompt` still needs operator approval, correct original Workspace/Session, current format, idle, `workspace-write`, explicit approved local Qwen model, positive verified 8123 route attestation, and a **durable `persistBeforeSend` receipt stored before HTTP send**.
- Pure correlation must prove matching `user/message.source.rpcId`, same-cut `session/page`, `turn/end.reason.kind === "completed"`, visible assistant text only, refusal for unrelated concurrent users, timeout, incomplete turns, human-input-needed, malformed output, oversized output, altered user surface and missing history. The reply builder must preserve original Weixin peer/messageId/contextToken and stable Outbox ID. Do not call real Weixin send.

If tests fail: record exact output/exit code, do not patch locally, hand back to remote ChatGPT.

## 3. Only read-only 3080 host audit

Use the existing **private** 0600 catalog, never upload it:

```bash
node --experimental-strip-types scripts/probe-dsh-3080.mjs \
  --catalog "$HOME/.dsh-superagent-private/DSH-CATALOG.json"
```

Expect the new audit output to **separate `lastUsedLocalQwen`, `nextSelectedLocalQwen`, `nextUnknownOrDifferent` and `historicalCloudSelections`**. The former C1 output `nonApprovedOrUnknownModel: 841` was misleading because the script looked for a non-existent flat projection. Report counts and explain any drift, without raw Session IDs or private paths.

Do not call `session/prompt`, `session/selectModel`, `session/create`, `session/fork` or migration endpoints. Do not fetch complete Session histories. All new output-correlator checks must use mocks.

## 4. Assess test-only queue route, WITHOUT changing providers

The current `cmp170hx` on 3080 bypasses the one-slot proxy 8123. The bridge has an explicitly operator-configurable approved local route for a future test-only `llm-local-proxy` provider, but this provider **does not exist or become active automatically**.

Review option A from C1:
- create the isolated test-only 8123 provider in 3080 by a **separately approved profile change**;
- avoid touching historical Qwen Sessions;
- `session/selectModel` may persist a new **global default** as a side effect. Investigate a reversible way to isolate that effect before any actual action;
- show profile/Session backup, rollback, exact provider/client auth and smallest possible downtime;
- do not reconfigure `cmp170hx` for all users; do not select cloud models.

The user has NOT yet approved any change, restart, or real prompt. Independent consent is required. The missing 8123 attestation is an expected deployment precondition, not an implementation test failure.

## 5. Report and STOP

Write `REPORT-existing-dsh-stageC2-offline.md`, with:
- exact tested commit SHA, Node/pnpm, exit codes, totals and failures;
- JSDoc and C1 issue closure evidence;
- protocol/correlation unit evidence, with `MOCK PASS` vs `REAL E2E NOT RUN`;
- corrected read-only model projection counts;
- state of 3080 anonymous LAN accessibility (**must remain unchanged**);
- test-only 8123 provider and `selectModel` global-default impact, backup/rollback;
- remaining remote gaps (durable SQLite relay binding, live 3083 integration, receipts, context-token expiry/retries);
- the three independent user approval gates: profile/provider change, controlled restart, single disposable Session prompt.

No code edits, service restarts, historical Session prompts, cloud calls, QR scan, production project modifications or OpenClaw. After reporting, **STOP**.
