# LOCAL_AGENT_TASK — CURRENT: CI-TRIGGER-DIAGNOSTIC

**Task:** `CI-TRIGGER-DIAGNOSTIC`. **First read:** `LOCAL_AGENT_PROTOCOL.md`.  
**Repository:** `TnzGit/dsh-superagent-prototype`; **branch:** `feat/local-first-wechat-foundation`.  
**Authority:** read-only diagnostics + a single sanitized report commit/push in `agent-reports/`. No other change.

## Facts verified by remote ChatGPT

- The C3S public report is already published at `agent-reports/REPORT-existing-dsh-stageC3S-offline.md`, commit **`81e09ad9990fed07a61dfbffb544dc6764434949`**, and was verified as PR #1 / branch HEAD at the time of investigation. **Do not re-upload this report and do not rerun C3S builds or 3080 catalog probes.**
- C3S code baseline `d6e04a4` was **LOCAL BUILD PASS** (`pnpm check` exit 0, Vitest 1206/1206, tsdown PASS), standalone **MOCK PASS** (58/58). This is **not** verified CI for the newer report HEAD.
- GitHub Actions `Local-first core tests` workflow `.github/workflows/local-first-core.yml` is configured on this feature branch for `push` and `pull_request`, and reports state `active`. No GitHub Actions run or check-run exists for `81e09ad`; latest green run was older `177bb997`.
- **Important corrected distinction:** GitHub documentation explicitly says `push` workflows may run even when they have not been merged into default `main`. Default-branch workflow presence is required for **manual `workflow_dispatch`**, not for normal branch `push` events. Therefore missing workflow on `main` does **NOT** adequately explain the absent report-push CI.
- GitHub's `GITHUB_TOKEN` workflow automation generally suppresses subsequent `push` workflow triggers, whereas ordinary user-authorized pushes or independent credentials should normally trigger; this is a **hypothesis to investigate, not a proven cause**. Commit author/committer names alone do not prove which credential actually performed `git push`.

References (read if needed):
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch
- https://docs.github.com/en/actions/concepts/security/github_token

## Tasks (no new test execution or network/service writes)

1. Fetch the feature branch and verify current remote HEAD, PR #1 state, `81e09ad` ancestry, and that `.github/workflows/local-first-core.yml` at that ref still contains a valid `push` trigger matching `feat/local-first-wechat-foundation` with no `paths` exclusions and no `[skip ci]` message on the report commit.
2. Use the operator's existing authenticated GitHub CLI **read-only** to check:
   - `gh api repos/TnzGit/dsh-superagent-prototype/actions/workflows/410395262` — state/path.
   - `gh api repos/TnzGit/dsh-superagent-prototype/actions/runs?head_sha=81e09ad9990fed07a61dfbffb544dc6764434949` — count.
   - `gh api repos/TnzGit/dsh-superagent-prototype/commits/81e09ad9990fed07a61dfbffb544dc6764434949/check-runs` — check count.
   - `gh api repos/TnzGit/dsh-superagent-prototype/actions/runs?event=push&per_page=5` — last actual push workflow runs/timestamps.
   - `gh api repos/TnzGit/dsh-superagent-prototype/actions/permissions` — repository Actions enabled/allowed, only if CLI account has read permission. A 403/404 is **unknown**, not `disabled`.
   - If accessible, `gh api repos/TnzGit/dsh-superagent-prototype/events?per_page=30` — does the C3S report push event show up and which class of actor was associated with it? Do not put identifying actor login in the public report.
3. Review local **authentication provenance without printing credentials**: was the report Git push actually authenticated as the human's SSH key / user PAT / GitHub CLI session, a GitHub App installation, or a workflow `GITHUB_TOKEN`? Look at credential *method/presence only*; avoid printing `gh auth token`, PAT values, `Authorization` headers, `git remote -v` if its URL embeds credentials, or entire `gh auth status` into logs. Do **not** change authentication configuration. If provenance cannot be established confidently, report `UNKNOWN` rather than guessing.
4. Check whether repo-level Actions permissions/approval settings or pending first-time approval explain no runs; use only **read-only** `gh api` / `gh run list` / PR status. Do not enable Actions, approve workflow permissions, alter repo settings or dismiss checks.
5. Separate **FACTS / POSSIBLE EXPLANATIONS / MINIMUM PROPOSED NEXT EXPERIMENT** in a public, sanitized report. No premature root-cause claims. Specifically distinguish default-branch manual-dispatch limitation from missing branch-push triggers.
6. Publish a NEW **meaningful, redacted** report to `agent-reports/REPORT-ci-trigger-diagnostic.md`, using the dedicated clean reporting worktree + normal non-force push procedure in `LOCAL_AGENT_PROTOCOL.md`. Stage only this one report, manually scrub every line for secrets/private identifiers, record the commit SHA.
7. After publishing, read-only check whether this new report push (which is itself a fresh branch commit) caused a workflow run at **the new report SHA**. Report `RUNNING / GREEN / FAILED / NOT COVERED` accurately. Do not make further synthetic pushes, empty commits, GitHub workflow changes or retries.
8. STOP. Preserve 3080's required `0.0.0.0:3080`, `allowUnauthenticated: true`, original trustedHosts and all anonymous LAN access. Do not open/alter host session data. 3080/3083/8123 remain online. The three separate live deployment approvals remain outstanding (provider+selectModel, controlled restart, first real original Session prompt). **REAL 3080 SESSION E2E NOT RUN / REAL WEIXIN RETURN NOT RUN.**

## One-line response to operator

If upload succeeded:

`CI-TRIGGER-DIAGNOSTIC 完成：脱敏报告 agent-reports/REPORT-ci-trigger-diagnostic.md 已推送（SHA <sha>），CI=<actual>，疑点=<short finding>；3080/3083/8123 未动。`

If blocked:

`CI-TRIGGER-DIAGNOSTIC BLOCKED：<short cause>，报告仅保留本地；服务未动。`

The operator will forward this one sentence; remote ChatGPT reads the new report directly from GitHub.
