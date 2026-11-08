# REPORT — CI-MANUAL-DISPATCH (single authorized workflow_dispatch, sanitized)

Date: 2026-11-08. Operator approval (chat, 2026-11-08): (A) workflow file copied to default `main` (done by remote ChatGPT), (B) **exactly one** manual dispatch against `feat/local-first-wechat-foundation`. Scope: GitHub Actions only; no live host changes. No further approval requested for this dispatch; per task rules the local Agent made no second attempt, no credential switch, no alternate REST POST.

## Step 1 — Gate checks (read-only, all passed)

- `main` workflow file blob SHA: `303eddf97a0b83e250b93b28e4bee70a453c13fc` (identical to the feature-branch copy per remote verification) at `.github/workflows/local-first-core.yml`; size 3122.
- Workflow registry: id `410395262`, name `Local-first core tests`, path `.github/workflows/local-first-core.yml`, state **active**; declares `workflow_dispatch` alongside `push`/`pull_request`.
- PR #1: `open`, **draft**, base `main`, head `4d8b3d33d6d230ac11fad9ec4a5a76a23564ba5a`.
- Branch HEAD immediately before dispatch (`dispatchTargetSHA`): **`4d8b3d33d6d230ac11fad9ec4a5a76a23564ba5a`** (`git ls-remote` confirmed).

## Step 2 — The single dispatch invocation

Command (local human-authenticated GitHub CLI, credentials never printed):
`gh workflow run local-first-core.yml --repo <repo> --ref feat/local-first-wechat-foundation`

Result: **exit code 1** — `HTTP 422: Actions has been disabled for this repository` on `POST .../actions/workflows/410395262/dispatches`.

→ **DISPATCH_REJECTED**. No retry performed.

## Step 3 — Correlate the run

No `workflow_dispatch` run exists for the target SHA (nor for any SHA): the repository's `actions/runs?event=workflow_dispatch` total is 0; dispatch was rejected before any run was created. Not GREEN, not RUNNING — **CI = DISPATCH_REJECTED** for `dispatchTargetSHA 4d8b3d3`.

## Step 4 — Contradictory permission evidence (fact vs unknown, no root-cause claim)

- **FACT**: dispatch endpoint answered 422 "Actions has been disabled for this repository".
- **FACT**: `GET actions/permissions` on the same account returns `enabled: true, allowed_actions: "all"`; the selected-actions endpoint 409s with "All actions and workflows are allowed on this repository"; restricted-permissions endpoint 404 (unknown class).
- **POSSIBLE EXPLANATIONS (unproven)**: (a) the CLI account's token lacks a scope/permission the dispatch endpoint requires and GitHub surfaces it as a generic 422 "disabled" message; (b) a repository/org-level Actions state the read-only permissions API does not reflect (e.g. enterprise/admin disable on the owner's plan); (c) transient API-side inconsistency. Root cause left unresolved per task rules.
- Recommendation: **GitHub Support escalation** (or operator-side UI check whether the workflow's "Run workflow" button is visible on the Actions tab); no local Agent setting changes were made or proposed as executed actions.

## Step 5 — Acceptance-status separation

- **LOCAL BUILD PASS** (previously verified offline, C3S baseline `d6e04a4`): `pnpm check` exit 0, Vitest 1206/1206, tsdown build pass, Node mock tests 58/58. This remains valid independent of CI.
- **GitHub CI for current head `4d8b3d3`**: DISPATCH_REJECTED (no run at all). Older green run `177bb997…` (pull_request, 2026-11-07) does NOT represent current code.
- **REAL 3080 SESSION E2E NOT RUN**; **REAL WEIXIN RETURN NOT RUN**.

## Host invariants (confirmed, untouched)

3080 keeps `0.0.0.0:3080`, `allowUnauthenticated: true`, original trustedHosts, unrestricted anonymous LAN access, all historical Workspaces/Sessions. 3083 and 8123 online; no provider/model/session/Weixin/host changes; no QR rescan; no OpenClaw; no cloud model calls; no real prompt. No `main`/PR/workflow-YAML/Actions-setting edits by this Agent; the report commit below is documentation-only.

## Redaction note

This GitHub copy omits local absolute paths, usernames, internal/LAN addresses, actor logins, private catalog locations, credential values and raw CI logs. Sanitized per protocol; staged single-file commit, normal non-force push with the operator's own credentials.
