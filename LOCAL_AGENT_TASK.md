# LOCAL_AGENT_TASK — HOLD: CI RECOVERY APPROVAL REQUIRED

**Standing instructions:** Read `LOCAL_AGENT_PROTOCOL.md` before any future assignment.  
**Current status:** `HOLD` — no new Mac Agent task is authorized.  
**Repository:** `TnzGit/dsh-superagent-prototype`. **Feature branch:** `feat/local-first-wechat-foundation`.

## Latest accepted evidence

- `agent-reports/REPORT-existing-dsh-stageC3S-offline.md` documents Mac offline checks on `d6e04a4`: `pnpm check` exit 0, TypeScript PASS, Vitest **1206/1206**, tsdown build PASS; nine Node mock suites **58/58 PASS**. No real original Session prompt or Weixin return.
- `agent-reports/REPORT-ci-trigger-diagnostic.md` was published at commit **`810acfae102df057981daaf12be6a51306ef4760`**, which remote ChatGPT verified as the branch HEAD at receipt time.
- Despite multiple normal feature-branch pushes, the workflow `Local-first core tests` has no new runs after 2026-11-07T19:11:02Z. Repo Actions enabled, workflow active, branch filter matches, `[skip ci]` absent; even the operator's human-credential report push produced no Actions run/check-run. **Root cause unconfirmed** (event delivery/queue malfunction suspected, not proven).
- GitHub official docs: `push` workflow can run from a feature branch without a workflow file in default `main`; **`workflow_dispatch` requires the workflow file on the default branch**. Do not conflate these requirements. Additional blind pushes are not useful.

## Next decision (operator approval is required, and has not been granted)

**Recommended CI recovery:** Remote ChatGPT adds **only** `.github/workflows/local-first-core.yml` to default `main` (copying the reviewed workflow already on the feature branch; no feature code merge, no DSH host operation) and then, using the operator's GitHub credential, performs **one explicitly authorized manual `workflow_dispatch`** targeted at the feature branch and records run URL/SHA. This is a distinct modification to `main` and must never happen without the operator's **specific prior approval**. If manual dispatch also creates no run, stop and escalate to GitHub Support with the two missing-run SHAs and actions state evidence rather than make more repository edits.

**Alternative:** Open a GitHub Support request about missing Actions runs, without modifying `main`. Support availability depends on the operator's GitHub plan. No Support submission has been authorized.

## STOP and protect host

Until remote ChatGPT updates this file with explicit permission and an executable task, Mac Agent must not create commits, push, run GH workflow, change Actions settings or `main`, rerun historical probes, touch production profiles, invoke real Session prompts, restart 3080/3083/8123, or change local model defaults.

3080 must retain **`0.0.0.0:3080`, `allowUnauthenticated: true`, existing trustedHosts and unrestricted existing anonymous LAN access**, as operator-requested behavior. Existing 27 Workspaces and 841 Sessions must remain intact.

Three separate future operational approvals remain mandatory: (1) test-only 8123 provider + selectModel with global-default rollback, (2) controlled restart, (3) one real prompt to a user-selected disposable original Session.

**No reply or work is required from Mac Agent while this file reads HOLD.**
