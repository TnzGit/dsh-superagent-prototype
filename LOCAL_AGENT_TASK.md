# LOCAL_AGENT_TASK — CURRENT: CI-MANUAL-DISPATCH (operator approved)

**First read:** `LOCAL_AGENT_PROTOCOL.md`.  
**Repository:** `TnzGit/dsh-superagent-prototype`.  
**Target branch:** `feat/local-first-wechat-foundation`.  
**Operator approval:** explicitly granted in chat on 2026-11-08 for (A) copying the existing workflow file to default `main` and (B) **exactly one manual CI dispatch against the feature branch**. Approval covers only GitHub Actions; not live 3080/3083/8123 changes. **Do not request another approval for this single dispatch**.

## Remote ChatGPT already completed part A

- GitHub `main` now contains `.github/workflows/local-first-core.yml`, committed as **`89607996d3645ba766a84e59a8a94c700c353f3a`**.
- Remote ChatGPT independently fetched both `main` and `feat/local-first-wechat-foundation` copies and confirmed identical bytes / Git blob SHA **`303eddf97a0b83e250b93b28e4bee70a453c13fc`**.
- The workflow declares `workflow_dispatch:` alongside `push` and `pull_request`.
- PR #1 remains OPEN and Draft. The Mac Agent **must not edit `main`**, PR, workflow source, code or host.
- The connected GitHub tool has no workflow-dispatch action. Therefore the authorized manual dispatch is delegated to the local Agent with the operator's own `gh` credentials (and scoped solely to this one workflow/branch).

## Step 1 — Read-only gate checks

Using local GitHub CLI account (without exposing secrets), verify:

```bash
gh api repos/TnzGit/dsh-superagent-prototype/contents/.github/workflows/local-first-core.yml?ref=main --jq '.sha'
gh api repos/TnzGit/dsh-superagent-prototype/actions/workflows/local-first-core.yml --jq '{id,name,path,state}'
gh api repos/TnzGit/dsh-superagent-prototype/pulls/1 --jq '{state,draft,head:.head.sha,base:.base.ref}'
git ls-remote origin refs/heads/feat/local-first-wechat-foundation
```

If the workflow is not visible/active or branch does not exist, do **not** dispatch; report BLOCKED. Do not change any GitHub setting. Read and record exact feature HEAD SHA immediately before dispatch; the report must state this as **`dispatchTargetSHA`**.

## Step 2 — One manual dispatch ONLY

Run exactly once, from a local terminal already authenticated to this user's GitHub account:

```bash
gh workflow run local-first-core.yml \
  --repo TnzGit/dsh-superagent-prototype \
  --ref feat/local-first-wechat-foundation
```

This is the **one approved manual `workflow_dispatch`**. Record command exit code and response, keeping any credential values redacted.

- If the command fails with a permissions error, 404, or "workflow cannot be run", STOP attempts; **do not retry, do not switch credentials, do not try a second REST POST**, and note why.
- If the command exits 0, treat that as **dispatch accepted**, **not** as CI pass. Never issue a second dispatch, even if a run is not immediately visible.
- Do not create an empty commit, alter workflow YAML, modify `main`, edit PR, change Actions settings, or make synthetic pushes.

## Step 3 — Correlate the ONE authorized run

Read-only check `gh run list --repo TnzGit/dsh-superagent-prototype --workflow local-first-core.yml --event workflow_dispatch --limit 10 --json databaseId,headSha,headBranch,status,conclusion,url,createdAt` and matching `gh api repos/TnzGit/dsh-superagent-prototype/actions/runs?event=workflow_dispatch&per_page=10`.

- Match **exact target feature HEAD SHA and dispatch event**, not the old green `177bb997` and not a later report commit.
- If a matching run exists, record run ID, URL, status and each job name: `local-first-core`, `macos-portability`, `dsh-typecheck-and-build`. For a failed job, capture a **redacted** failure synopsis; do not upload raw CI logs.
- It is okay to use bounded read-only observation until the run completes. If still queued/running, report that status, not PASS.
- If no matching run appears, record `DISPATCH_ACCEPTED_BUT_NO_RUN` (if CLI exit 0) or the actual dispatch error; leave the root cause unresolved and recommend GitHub Support escalation. No further dispatch attempts or pushes until the report step below.
- **GREEN** means all three jobs have completed successfully for the matching run; anything else is NOT GREEN.

## Step 4 — Upload a sanitized report as the only new commit

Create only `agent-reports/REPORT-ci-manual-dispatch.md` on feature branch, with:

1. Operator approval scope and the pre-dispatch feature HEAD SHA.
2. Verified `main` workflow commit/blob identity and active state.
3. The **single** dispatch invocation result and whether GitHub accepted it.
4. The matched workflow run URL, id, **headSha**, and the 3 job statuses, or precise NOT COVERED reason.
5. CI outcome: `GREEN`, `FAILED`, `RUNNING`, `DISPATCH_ACCEPTED_BUT_NO_RUN`, or `DISPATCH_REJECTED`.
6. Distinguish `LOCAL BUILD PASS` (C3S `d6e04a4`, Vitest 1206/1206, Node mock 58/58) from current-head **GitHub CI**.
7. Explicit: `REAL 3080 SESSION E2E NOT RUN`; `REAL WEIXIN RETURN NOT RUN`.
8. Confirm no host/service/provider/session/Weixin changes.

Follow `LOCAL_AGENT_PROTOCOL.md` for **manual public-report redaction** and a dedicated clean report-publishing worktree. **Stage only** the single new report. Commit and normal non-force push with local human GitHub credentials. If reporting introduces a new HEAD, do NOT silently re-label its SHA as the CI-tested SHA: the dispatched SHA remains the immutable reference for the run; the report commit itself only changes documentation.

If `git push` is rejected as non-fast-forward, fetch and replay only the sanitized report in a clean reporting worktree; no force-push/reset. If no permission, keep report locally and say BLOCKED.

## Step 5 — STOP

Do not rerun tests, touch `main`, create a second dispatch, approve Actions settings, change CI definitions, or modify live services.

Original DSH 3080 must retain **`0.0.0.0:3080`**, **`allowUnauthenticated: true`**, existing trustedHosts and unrestricted existing anonymous LAN access, plus all historical Workspaces and Sessions. 3083 and 8123 must stay online; no OpenClaw, QR rescan, cloud model routing, model/provider change or real prompt.

Three independent **future** live gates are still UNAPPROVED: (1) test-only 8123 provider and selectModel with global-default rollback, (2) controlled restart, (3) a single user-selected real original DSH Session prompt.

**One-line response to operator:**

`CI-MANUAL-DISPATCH 完成：一次手动触发=<ACCEPTED/REJECTED>，CI=<GREEN/FAILED/RUNNING/NO RUN>（测试SHA <sha>），脱敏报告 agent-reports/REPORT-ci-manual-dispatch.md（报告提交 <sha>）；3080/3083/8123 未动。`

If report push is blocked, replace the report location with `报告上传 BLOCKED` and its concise cause. Do not paste report.
