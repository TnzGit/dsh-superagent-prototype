# LOCAL_AGENT_PROTOCOL — permanent GitHub handoff contract

> This is the standing collaboration protocol between the operator, remote ChatGPT and the Mac Agent. Read it with the active `LOCAL_AGENT_TASK.md` on every run. The current task file, not the last chat message or an older stage document, defines what work is authorized.

## Where work goes

- Repository: `TnzGit/dsh-superagent-prototype`.
- Current development branch: `feat/local-first-wechat-foundation`.
- Stable task entry point: `LOCAL_AGENT_TASK.md`. **Remote ChatGPT** updates this file for each new task.
- Local Agent uploads the redacted final report to `agent-reports/<report-name>.md` **on that feature branch**, using the operator's own authenticated GitHub Git credentials.
- **GitHub is the sole full-report handoff channel.** After a normal push is verified, the local Agent gives a **single short completion notification** containing status, GitHub report path/URL and pushed commit SHA. **Do not include the report body, an attachment, raw logs, or instructions asking the operator to copy/paste/upload/forward the report to remote ChatGPT.** Remote ChatGPT reads the report directly from GitHub on its next turn; the operator is not responsible for transporting report content.
- **Do not make the operator relay even the short notification as a mandatory workflow step.** ChatGPT in an ordinary chat cannot spontaneously notice a new commit without a subsequent chat turn or a separately configured scheduled monitoring task. A short completion notification is informational, not a request to carry data. If the operator wants push-triggered or scheduled automatic notices, first configure and explicitly approve the appropriate automation; until then, avoid promising zero-touch asynchronous delivery.
- When a task is blocked by GitHub permissions, credentials or remote branch drift, do not claim upload success. Leave the local report and respond in one sentence with `BLOCKED` and the precise cause.

## Responsibility and authority

1. **Remote ChatGPT** owns product source code, architecture, tests, docs and PR changes on the feature branch.
2. **Local Agent** owns host inventory, read-only checks, offline builds and offline mock tests, report drafting, **sanitized report Git commits and normal pushes only**.
3. Permission to upload a report is **not** permission to edit product code, change a live server, alter a GitHub Actions workflow, run `session/prompt`, update providers/models or restart services.
4. Do not modify `main`, merge the PR, force-push, amend old commits, reset existing worktrees, push tags, create an empty commit, or change Actions settings. A report commit is a real, meaningful documentation commit and can legitimately trigger CI.
5. Keep a dedicated clean *report-publishing worktree* at the latest fetched remote feature HEAD. Stage **only** the one allowed `agent-reports/*.md` artifact (or explicitly authorized report files), inspect `git diff --cached --name-only` and `git diff --cached --check` before committing. Never stage `.` or `-A`.
6. If `git push` rejects non-fast-forward because remote ChatGPT committed meanwhile, fetch, rebuild a new disposable report-only worktree from current remote HEAD and apply **only** the sanitized report; then normal push. Never force-push or rewrite history.

## Public-repository confidentiality (mandatory)

This repository is public. Treat every pushed report, commit message, GitHub issue and task document as world-readable.

- **Never push** raw Weixin/iLink tokens or credentials, `contextToken`, API keys, auth headers, cookies, local account names, home directories, LAN/internal IP addresses, private full paths, real private Workspace/Session IDs, raw catalog JSON, original 3080 Session prompts or conversation histories, real Weixin peer/message IDs, private diagnostic dumps, stack traces containing secrets, complete environment variable values, or host-level configuration files.
- Summarize host evidence as aggregate counts, version numbers, results, safe source filenames and test names. Reproduce errors with synthetic identifiers and redacted paths. Do not attach raw `.check_out.txt`, `.offline*.txt`, `.probe_out.txt`, logs or the 0600 private catalog.
- A grep-only check is not enough: **manually inspect the entire staged report** for identifying data. If unsure whether a line is private, remove it. Record that the GitHub report is redacted.
- Do not publish private config contents even to explain why 3080 runs without authentication. Only summarize the operator-required invariant.

## Immutable host requirements

The existing 3080 DSH must **remain** `0.0.0.0:3080`, `allowUnauthenticated: true`, existing trustedHosts, and anonymously accessible to existing LAN clients. This behavior is operator-required, **not a security remediation to propose**. Preserve the 27 existing Workspaces, 841 Sessions, history and live directories. Client-side relay loopback calls do not change host access.

Keep existing 3080/3083/8123 processes online unless a future task includes a **separately granted** restart approval. No OpenClaw, cloud-model selection, new Weixin QR, private Session history copying, profile change, or real original Session prompt without separate operator approval.

The 3 pending operational gates remain independent:
1. test-only 8123 provider + scoped `selectModel` with global-default backup/rollback;
2. controlled restart window;
3. one real prompt to an operator-chosen disposable original 3080 Session.

Offline mocks and report pushes never grant any of these.

## Report format and completion message

Each GitHub report includes: task name and tested SHA, commands and exit codes, actual test totals, pass/fail/blocked, CI run SHA (if any), safeguards and what was **NOT RUN**, next blocker, rollback if applicable. Distinguish `MOCK PASS`, `LOCAL BUILD PASS`, `GITHUB CI GREEN / NOT COVERED / FAIL`, `REAL 3080 SESSION E2E NOT RUN`, `REAL WEIXIN RETURN NOT RUN`.

After pushing the report, keep the operator-facing response to **one sentence with an actionable GitHub URL and commit SHA**, e.g.:

`C3S-PUBLISH 完成：已推送脱敏报告 https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-reports/REPORT-existing-dsh-stageC3S-offline.md（提交 abc1234），CI 为 pending；运行服务未动。无需转发报告或上传附件。`

Do not paste or attach the report into chat, generate a report for the operator to forward, or ask the operator to upload/share any local report. The user must not be the report courier. The one-sentence notification is not the report itself. Do not claim a push or CI success before verified. STOP after the assigned task.
