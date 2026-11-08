# LOCAL_AGENT_TASK — CURRENT: C3S-PUBLISH

**Current owner:** Mac Agent. **Status:** ready, report-publish-only.  
**Read first:** `LOCAL_AGENT_PROTOCOL.md` (mandatory standing rules).  
**Current branch:** `feat/local-first-wechat-foundation` in `TnzGit/dsh-superagent-prototype`.

## Goal

Stage C3S has **already** completed locally and is green for offline checks. **DO NOT rerun C3S, rewrite source, re-probe 3080, or mutate any running service.** This task is only to publish a **carefully redacted** version of the existing C3S report as a meaningful Git commit authored and pushed with the operator's GitHub credentials. Then observe whether the branch's existing GitHub Actions workflow runs on the new report commit.

Baseline originally checked (old tip `d6e04a4821f7c04ca46ed9013f61dc739d6b722c`):
- `pnpm check` exit 0: `tsc --noEmit` PASS; Vitest **1206/1206** in 62 files; `tsdown` build PASS.
- Nine pure Node mock files **58/58 PASS**.
- Original 3080 catalog 27 Workspaces, 841 Sessions; no drift. 3080 LAN anonymous access unchanged; 3083 and 8123 online unchanged.
- **Current GitHub CI NOT COVERED**; latest old green workflow run applied only to `177bb997`. **REAL 3080 SESSION E2E NOT RUN / REAL WEIXIN RETURN NOT RUN.**

## Steps

1. Fetch the remote feature branch normally. **Do not** use earlier C3S testing worktree for commits; create a new clean disposable `.worktrees/stage-report-c3s` from the latest `origin/feat/local-first-wechat-foundation` (branch name unique and local). Preserve every previous worktree and the production/staging checkouts.
2. Find the original local `REPORT-existing-dsh-stageC3S-offline.md` from the prior C3S stage. Prepare **one sanitized public markdown report** at `agent-reports/REPORT-existing-dsh-stageC3S-offline.md` in the new reporting worktree, maintaining all factual test totals, tested SHA, CI gap and safeguards. Do not upload the original report file verbatim if it contains identifying metadata. Do not upload raw log files. You may quote source filenames and synthetic IDs; redact or omit user home paths, private catalog paths, Session and Weixin IDs, real peer addresses, contextTokens, credentials, internal LAN IPs, machine usernames and private diagnostic traces.
3. Manually inspect the **entire** staged report for public safety. Stage **only** `agent-reports/REPORT-existing-dsh-stageC3S-offline.md`. Verify `git diff --cached --name-only` lists exactly that file and `git diff --cached --check` succeeds. This file must be a meaningful, newly committed report; **do not create an empty commit**.
4. Commit message: `docs(agent-report): publish redacted Stage C3S offline acceptance`. Normal, **non-force** `git push origin HEAD:feat/local-first-wechat-foundation` with the **local operator's GitHub credentials**, not CI `GITHUB_TOKEN` or bot credentials. If rejected for non-fast-forward, fetch the newest feature HEAD and replay **only this sanitized report** from an isolated reporting worktree; never reset or force-push. If permission is absent, stop and report `BLOCKED` in one sentence (no report chat attachment unless operator specifically asks).
5. Confirm `git ls-remote origin refs/heads/feat/local-first-wechat-foundation` equals the report commit SHA, and `gh api repos/TnzGit/dsh-superagent-prototype/contents/agent-reports/REPORT-existing-dsh-stageC3S-offline.md?ref=feat/local-first-wechat-foundation` returns the committed public report (never print credential values).
6. Read-only check GitHub workflow `Local-first core tests` for a run corresponding to **the new report-commit SHA**. A local operator Git push is expected to trigger the already-existing `push` workflow even though `workflow_dispatch` cannot run while the workflow file is absent from default `main`. If CI appears, report its current status and exact head SHA; if it completes, report actual PASS/FAIL, never assume success. If no run appears, report `CI NOT COVERED` with no extra commits or risky workaround.
7. **STOP.** Do not modify `main`, workflows, PR, 3080/3083/8123, Provider, model/global default, Session, historical project, firewall, auth, or QR pairing. Do not do any real original-DSH prompt or Weixin delivery.

## One-sentence chat return

Successful push example:
`C3S-PUBLISH 完成：脱敏报告已上传 agent-reports/REPORT-existing-dsh-stageC3S-offline.md（提交 <7-12位SHA>），CI=<实际状态>，3080/3083/8123 未动。`

Blocked example:
`C3S-PUBLISH BLOCKED：报告已脱敏但 GitHub push 被拒（<简短原因>），未改动任何服务。`

No report pasted to the chat. Remote ChatGPT will read it via GitHub. The current task file will be updated for the **next** Stage, so always reread it before the next assignment.
