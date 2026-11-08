# REPORT — CI-TRIGGER-DIAGNOSTIC (read-only GitHub diagnostics, sanitized)

Task: `LOCAL_AGENT_TASK.md` / CI-TRIGGER-DIAGNOSTIC. Date: 2026-11-08. No tests rerun, no service or repo settings touched. Repository visibility confirmed **public**; default branch `main`.

## FACTS (verified, read-only)

1. **Workflow definition** — `.github/workflows/local-first-core.yml` (workflow id 410395262, state `active`) at both `81e09ad…` tree and current branch HEAD contains:
   `on: push: branches: [feat/local-first-wechat-foundation]` plus `pull_request` and `workflow_dispatch`; **no `paths` filters, no `[skip ci]` in the report commit message** (`docs(agent-report): publish redacted Stage C3S offline acceptance`). The workflow file does exist in the pushed branch's tree (verified via `git cat-file -e`).
2. **Ancestry/PR** — report commit `81e09ad9…` is an ancestor of branch HEAD `1a0cf205…`; PR #1 is `open`, head = `1a0cf20`, `mergeable_state: clean`.
3. **No CI for the report commit** — `actions/runs?head_sha=81e09ad…` → `total_count: 0`; `commits/81e09ad/check-runs` → `total_count: 0`; the only check-suite is from an **external GitHub App** (slug `claude`) in `queued` state, not from GitHub Actions.
4. **Repo-wide Actions state** — `actions/permissions`: `enabled: true`, `allowed_actions: "all"`; `runs?status=queued` → 0; `runs?event=workflow_dispatch` → 0.
5. **Timeline of last runs** — every stored run (30 most recent, all `pull_request` events) and the last `push`-event runs were created **on 2026-11-07 only** (last any-kind run created `2026-11-07T19:11:02Z`, success on old SHA `177bb997…`; push-event runs of 2026-11-07 were created then cancelled by the workflow's own `cancel-in-progress` concurrency). `runs?created>2026-11-08T00:00:00Z` → **0 runs**: **after ~2026-11-07 19:11Z, no workflow run of any event type has been created for this repository**, despite the repository event stream showing multiple branch pushes to `feat/local-first-wechat-foundation` during 2026-11-08 (all by a single human-owner-class account; login withheld per protocol).
6. **Push-trigger worked before** — the 2026-11-07 `event=push` runs prove `push` triggers DO fire on this branch even though the workflow file is absent from `main` (so the remote's "default branch not required for push events" correction is consistent with evidence).
7. **Push provenance (local machine, method/class only, no values printed)** — the report push was performed over HTTPS using the macOS keychain credential helper (`osxkeychain`) with the human-owner account — a **human personal-access-token class** credential (same account the GitHub CLI session uses; token class `ghp_…`, scopes include `repo`/`workflow`). SSH keys exist locally but were not used for this push. Provenance of the remote ChatGPT-side pushes is **UNKNOWN** from this machine (commit author metadata alone does not identify the push credential; some author fields on recent remote commits read `agent`, committer fields read the operator host — inconclusive).
8. **Missing event index** — the repository `events` list (30 items) includes 2026-11-08 pushes up to `62b5769` but does NOT include the local report push `81e09ad` nor HEAD `1a0cf20` — likely event-index lag or partial delivery; recorded as a fact, not interpreted.
9. **Prior offline acceptance stays as published** — C3S baseline `d6e04a4` remains `LOCAL BUILD PASS` (pnpm check exit 0, Vitest 1206/1206, tsdown pass) and standalone `MOCK PASS` (58/58); not rerun this stage. Host invariants unchanged (3080 LAN anonymous owner access kept; 3080/3083/8123 online; providers/models/history untouched). `REAL 3080 SESSION E2E NOT RUN` / `REAL WEIXIN RETURN NOT RUN`.

## POSSIBLE EXPLANATIONS (explicitly not root-cause conclusions)

- **A. GITHUB_TOKEN / App-credential suppression hypothesis** — pushes made with workflow or App credentials normally do not re-trigger `push` workflows. Weakened by fact 7: this machine's own human-PAT push also produced no run; however the remote-side push credential is UNKNOWN, so this hypothesis cannot be dismissed either.
- **B. GitHub-side event delivery/queue interruption on this repository between 2026-11-07 19:11Z and now** — supported by fact 5 (all events stopped producing runs) and fact 8 (event index gaps). No repository setting changes were visible to explain it.
- **C. Actions service state change not visible through the read-only API surface used** — e.g., per-workflow activation state nuances; the permissions API reports enabled/all, so this is residual uncertainty only.
- Default-branch-file limitation (`workflow_dispatch` unavailability) remains a separate, well-understood limitation and does NOT explain missing push runs (fact 6).

## MINIMUM PROPOSED NEXT EXPERIMENT (already in motion; needs no new settings change)

Publishing this very report is itself a **fresh human-credential branch push** (meaningful commit, non-empty, normal non-force push). After pushing, read-only check whether a `Local-first core tests` run exists **at the new report SHA**; if it appears → report RUNNING/GREEN/FAILED accurately; if not → `NOT COVERED`, and the minimal follow-up (separate operator approval) is a single human push from an alternate checkout/credential path, or contacting GitHub support about event delivery — **no workflow edits, no empty commits, no Actions setting changes, no main-branch changes**.

## Constraints honored

No rerun of C3S builds/probes, no service restarts, no PR/main/workflow modifications, no synthetic pushes, no credential changes, no secret values printed (keychain/gh inspected by method/class only). Redacted: local absolute paths, usernames, LAN IPs, actor logins, private catalog locations, raw logs.
