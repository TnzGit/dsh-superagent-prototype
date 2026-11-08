# REPORT — Stage C3S offline verification + CI coverage status (redacted public copy)

Task: `LOCAL_AGENT_STAGE_C3S.md` (final doc fix, full build, CI coverage). Date: 2026-11-08.
All work was offline + read-only; no running service was touched.

## Tested baseline

- Branch `feat/local-first-wechat-foundation`, tested commit SHA: `d6e04a4821f7c04ca46ed9013f61dc739d6b722c` (tip at test time; includes fix `00f0620a` registering `src/app/later.ts` in the `docs/007-architecture.md` `## Modules` table).
- Fresh disposable testing worktree (previous stage worktrees and the staging checkout preserved, no reset).
- Node v25.9.0 (macOS); pnpm 11.24.0 with corepack honoring `packageManager: pnpm@11.7.0`; DSH runtime 0.2.2-alpha.2 (unchanged).

## Offline verification matrix

| # | Item | Result | Status |
|---|------|--------|--------|
| 1 | `pnpm install --frozen-lockfile` | exit 0 (~1.2 s) | PASS |
| 2 | `pnpm check` = `tsc --noEmit` → `vitest run` → `tsdown` build | exit 0; TypeScript pass; Vitest **62 files, 1206/1206** (the single C3R failure in `tests/docs.spec.ts` is closed); tsdown build succeeded (14 files / ~776 kB) | PASS (LOCAL BUILD PASS) |
| 3 | Nine pure Node mock test files (`local-dsh-relay-store`, `local-dsh-relay-routing`, `local-dsh-relay-coordinator`, `local-dsh-3080-bridge`, `local-dsh-3080-output`, `local-dsh-3080-probe`, `local-existing-dsh-projects`, `local-project-workspaces`, `local-weixin-native`) | **58/58 PASS**, exit 0 | PASS (MOCK PASS) |
| 4 | Security gates without regression: cloud-model refusal (`modelSelection.lastUsed` vs `next`), Session allowlist for history APIs, durable receipt persisted before send, one-shot operator approval non-replayable, exact `requestId` output correlation, Weixin context-token expiry not silently refreshed | all corresponding tests pass | PASS |
| 5 | Read-only 3080 probe script against the private operator-owned catalog (official `POST /api/session/list` only) | exit 0; **zero drift** vs C2/C3/C3R baseline: 27 Workspaces, 841 Sessions, 1 running, 286 migration-required, 551 lastUsedLocalQwen, 552 nextSelectedLocalQwen, 289 nextUnknownOrDifferent, 76 historicalCloudSelections, `readyForLivePrompt: false` | PASS |
| 6 | Real 3080 Session relay E2E | not executed | REAL 3080 SESSION E2E NOT RUN |
| 7 | Real Weixin receiving a relay result | not executed | REAL WEIXIN RETURN NOT RUN |

## Doc-fix closure evidence

`src/app/later.ts` (added by the Later-marker refactor commit `2890641`) now appears in the `## Modules` table row of `docs/007-architecture.md`, so `tests/docs.spec.ts` module-inventory check passes; this was the only `pnpm check` failure in Stage C3R.

## GitHub CI status (read-only check)

- Workflow `Local-first core tests` (`.github/workflows/local-first-core.yml` on the feature branch) is active, but the workflow file is **absent from default `main`**, so `workflow_dispatch` is unavailable per GitHub rules (matches the remote finding).
- Historical runs: the only green run is for the old SHA `177bb997…` (pull_request event); three newer runs (older PR heads) were cancelled by concurrency.
- **The current tip `d6e04a4` (and report-relevant commits `62b5769`, `00f0620a`) has no workflow run.** → **GITHUB CI = NOT COVERED**. The old green SHA must not be used as acceptance for the current code.
- Minimal trigger plan (requires separate operator approval, not executed locally): operator pushes one empty commit on the feature branch with their own credentials → `push` trigger runs the workflow for the new HEAD SHA. Constraints honored: no changes to `main`, no PR close/merge, no force-push, no Actions setting changes, no empty commit created by the local Agent this stage.

## Host invariants confirmed (read-only)

- 3080 DSH keeps `0.0.0.0:3080`, `allowUnauthenticated: true`, existing trustedHosts and LAN anonymous access — operator-required deployment property, unchanged, not a remediation item.
- 3083 Superagent staging and 8123 Qwen one-slot proxy stayed online; not restarted or stopped.
- Providers, model selection, global default, historical Workspaces/Sessions, private catalog file (0600) and all previous worktrees untouched. No QR rescan, no cloud model call, no OpenClaw, no real Session prompt.

## Status legend

`MOCK PASS` · `LOCAL BUILD PASS` · `GITHUB CI NOT COVERED` · `REAL 3080 SESSION E2E NOT RUN` · `REAL WEIXIN RETURN NOT RUN`

## Next blocker / pending gates

1. CI coverage for current SHA (await operator-approved minimal trigger above).
2. Remaining remote implementation gaps (from Stage C3 report): live 3083 routing integration for the relay coordinator, real context-token refresh/retry policy, chat-side durable project-binding persistence.
3. Three independent operator approval gates remain: ① test-only 8123 provider + scoped `selectModel` with global-default backup/rollback; ② controlled restart window; ③ one real prompt to an operator-chosen disposable original 3080 Session.

## Rollback

This stage made zero changes to running services or production configuration. Local artifacts: one disposable testing worktree plus this report; rollback = delete the worktree. Redaction note: this GitHub copy omits home paths, private catalog location, LAN/internal addresses, usernames, Session/Weixin identifiers and raw logs; facts and totals are preserved.
