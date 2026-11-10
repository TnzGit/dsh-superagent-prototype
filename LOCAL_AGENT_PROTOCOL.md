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

The historical C5 setup gates are **complete and must not be repeated**. Past C5, C5.3, C5.4B and C5.5B one-shot approvals are all finished. Any future live gate requires a separately approved new one-shot task; offline mocks, report pushes, and a prior admitted Prompt never grant authorization to resend.

## C5.3 trial completed 2026-11-09: NOT_SUBMITTED / authorization finished

C5.3 did run once with a real human Weixin message. The prepared text hash did not match the exact incoming text after a quote-glyph change; no real 3080 `session/prompt` was issued. The message instead went through the ordinary Engine, and normal 3083 bundle/env was fully restored. Its private `approvalId` was NOT consumed in SQLite because the text gate rejected the message; nevertheless the **user's one-shot C5.3 trial authorization IS FINISHED and may never be reused or re-armed**. The operator's approval was for one human message attempt, not unlimited retries. Do not confuse the ordinary Engine's reply with a successful relay. See the sanitized C5.3 report for evidence.

## C5.4B one-shot trial completed (PARTIAL_5_OF_6_LEGS); grant CONSUMED

A genuine new Weixin message and ONE original disposable 3080 Session `session/prompt` were accepted and verified; 8123 local Qwen inference produced a completed Assistant turn. The response was NOT sent because correlation treated legitimate DSH-owned `runtime-context`, `skill-catalog`, and `time-context` snapshots as foreign user messages and placed the receipt in `review-required`. The operator's one-shot C5.4B grant is PERMANENTLY CONSUMED. The original 3083 bundle/env was restored, original 3080/8123 were untouched, and original historical Sessions and shared default were preserved. **No rerun or retroactive reply** is permitted with that grant or receipt.

## C5.5A offline acceptance — complete

The context-snapshot correlator fix passed synthetic live-trace replay and negative tests. Its scope was strictly offline.

## C5.5B real one-shot native Weixin E2E — 6/6 PASS and authorization CONSUMED

Independent GitHub review confirms the local Agent's sanitized C5.5B report and the report commit CI green. Reported live evidence covers one exact-hash native Weixin inbound, one admitted original disposable 3080 Session Prompt, one local 8123 inference, matching request-ID-correlated Assistant completion, one guarded Outbox reply sent and confirmed received by the operator, and original 3083 bundle/environment restoration with relay default-OFF. C5.4B's prior `review-required` record remains unchanged and was NOT replied to. Expected durable C5.5B Trigger, approval consumption, original Session turn and sent reply remain; these are not residual staging configuration.

**ALL historical C5/C5.3/C5.4B/C5.5B one-shot live grants are permanently finished.** Never use a report publication as new permission.

## C6A offline preview acceptance — completed

C6A synthetic non-Git snapshot/preview passed all local and GitHub CI evidence in its sanitized report. No live project mutation was authorized or performed.

## C6B1 offline single-file apply/rollback acceptance — completed

C6B1 passed synthetic-only safety tests and GitHub CI; its default-OFF module remains disconnected from Runtime, Worker and Weixin. No real source apply/rollback was permitted or performed.

## C6B2A offline batch staging acceptance — completed

C6B2A was independently accepted on code SHA `fbf0a8f`, with complete offline synthetic evidence and green CI #220. The report-only commit #221 experienced macOS runner allocation cancellation while Linux and build passed; this is CI infrastructure status, not grounds to overwrite the report or repeat its complete test sequence.

## C6B2B1 read-only recovery inspection — completed

Independent local synthetic acceptance and baseline CI #223 attempt 2, plus report CI, passed 3/3. The report commit documented an incomplete sealed-batch missing-`seal.json` ENOENT diagnostic that the remote owner corrected with a new negative regression test.

## Current authorization: C6B2B2 OFFLINE PER-FILE AUDIT ONLY

The current `LOCAL_AGENT_TASK.md` permits **only synthetic temporary project tests**, code audit, local CI and ONE sanitized report push. The new C6B2B2 ledger stores private, durable `issued` (human checkpoint) and `confirmed` (read-only observed source state) events. It DOES NOT mutate any project source, call DSH/Weixin, authorize external file mutation, auto-resume, auto-rollback or repair. C5.5B and all previous live one-shot grants remain consumed. Any future real host file mutation requires new explicit human authorization and a separately published scope.

The current running host state and GitHub report must still be proven; a user approval is not proof an action ran. Technical guard failures require STOP + owner-only rollback evidence, not escalating privileges or bypassing safeguards. LAN anonymous access and historical 3080 session preservation remain nonnegotiable.

## Report format and completion message

Each GitHub report includes: task name and tested SHA, commands and exit codes, actual test totals, pass/fail/blocked, CI run SHA (if any), safeguards and what was **NOT RUN**, next blocker, rollback if applicable. Distinguish `MOCK PASS`, `LOCAL BUILD PASS`, `GITHUB CI GREEN / NOT COVERED / FAIL`, `REAL 3080 SESSION E2E NOT RUN`, `REAL WEIXIN RETURN NOT RUN`.

After pushing the report, keep the operator-facing response to **one sentence with an actionable GitHub URL and commit SHA**, e.g.:

`C3S-PUBLISH 完成：已推送脱敏报告 https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-reports/REPORT-existing-dsh-stageC3S-offline.md（提交 abc1234），CI 为 pending；运行服务未动。无需转发报告或上传附件。`

Do not paste or attach the report into chat, generate a report for the operator to forward, or ask the operator to upload/share any local report. The user must not be the report courier. The one-sentence notification is not the report itself. Do not claim a push or CI success before verified. STOP after the assigned task.
