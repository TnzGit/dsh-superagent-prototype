# Stage C3S — C3R final documentation regression, read-only host, and CI coverage report

> C3R tested SHA `62b5769b`: TypeScript PASS, **58/58** standalone mock Node tests PASS, Vitest **1205/1206** with the only failure from missing `src/app/later.ts` in the `## Modules` table of `docs/007-architecture.md`. The remote doc-only fix was committed at **`00f0620a6df67fa56947a01165f8488caa1829b3`**. Treat all current-head pass claims as UNVERIFIED until rerun.

## Nonnegotiable host invariants

Preserve existing original DSH **3080**: `0.0.0.0:3080`, `allowUnauthenticated: true`, original trustedHosts, unrestricted existing anonymous LAN clients, and all original Workspaces/Sessions. This is the user's intentional requirement. Do not propose authentication or firewall restrictions.

Keep original 3080, native Weixin staging 3083 and Qwen one-slot proxy 8123 online. Do not change real profile, provider, Session models or defaults; no `selectModel`, no real `session/prompt`, no restarts, no live Weixin message, no OpenClaw, no modification of existing production or staged checkouts.

## 1. Fresh independent checkout and documentation proof

From `TnzGit/dsh-superagent-prototype`, fetch `feat/local-first-wechat-foundation`; use fresh `.worktrees/stage-c3s`. Preserve all prior stage worktrees (C0/C1/C2/C3/C3R).

Record full new SHA, verify it is at or after `00f0620a`.

Verify `docs/007-architecture.md` lists **`src/app/later.ts` under `## Modules`**, not merely in the earlier `## Core classes and glue` table. Inspect `tests/docs.spec.ts` and confirm `listed('Modules')` can find it. No code edits locally.

## 2. Complete offline check

```bash
pnpm install --frozen-lockfile
pnpm check

node --experimental-strip-types --test \
  tests/local-dsh-relay-store.node-test.mjs \
  tests/local-dsh-relay-routing.node-test.mjs \
  tests/local-dsh-relay-coordinator.node-test.mjs \
  tests/local-dsh-3080-bridge.node-test.mjs \
  tests/local-dsh-3080-output.node-test.mjs \
  tests/local-dsh-3080-probe.node-test.mjs \
  tests/local-existing-dsh-projects.node-test.mjs \
  tests/local-project-workspaces.node-test.mjs \
  tests/local-weixin-native.node-test.mjs
```

**Success** requires `pnpm check` exit 0, full Vitest count (expected at least **1206/1206**) and completed `tsdown` build, plus the nine standalone Node files exit 0 (expected **58/58**). Distinguish mock test pass, local build, actual GitHub CI and real Weixin/3080 E2E. If another test failure emerges, record logs and send to remote ChatGPT; do not modify product files.

## 3. CI gap: read and report, do NOT modify default main

Current GitHub investigation: `Local-first core tests` is on the **feature branch**, but this file is absent from repo default `main`. GitHub documentation requires a workflow on default branch for `workflow_dispatch` manual launch. Previous connector-origin pushes and PR description edits have not produced a new GitHub Actions run. Remote tools currently do not expose a workflow dispatch action. Old green SHA `177bb997` is NOT proof for the new head.

Please read-only verify `Local-first core tests` actual latest run, branch, SHA, event and conclusion. Do not claim CI GREEN unless same-HEAD results are actually reported.

**Do not** close/reopen PR, modify default `main`, force-push, reset, push empty commits, or change GitHub Actions settings without separate user approval. If CI remains NOT COVERED, report a minimal safe trigger recommendation such as a separately authorized user-origin empty commit on the feature branch. Such a commit changes HEAD SHA and then must itself pass CI; it does not change code content.

## 4. Report and stop

Write `REPORT-existing-dsh-stageC3S-offline.md` with exact SHA, install/check/tsc/Vitest/build/Node exit codes, Modules-table validation, latest GitHub CI SHA/status, 3080/3083/8123 live state unchanged, original LAN anonymous access preserved, unresolved issues (if any) and operator-only CI activation proposal if required.

Explicitly say **REAL 3080 SESSION E2E NOT RUN** and **REAL WEIXIN RETURN NOT RUN**. The three independent future approvals remain unchanged: test-only 8123 provider + selectModel/global-default rollback, controlled service reload, then one actual user-selected disposable Session prompt.

**STOP**. Do not request or perform any live deployment action in C3S.
