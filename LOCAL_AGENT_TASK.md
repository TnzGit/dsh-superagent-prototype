# LOCAL_AGENT_TASK — HOLD: GitHub Support review required

**Read before any future assignment:** `LOCAL_AGENT_PROTOCOL.md`.  
**Current state:** **HOLD — no Mac Agent operations are authorized now.**  
**Development branch:** `feat/local-first-wechat-foundation`.

## Accepted CI diagnosis

- Mac Agent single operator-authorized `workflow_dispatch` against feature SHA `4d8b3d33d6d230ac11fad9ec4a5a76a23564ba5a` was **REJECTED** (HTTP **422** `Actions has been disabled for this repository`). No retry.
- GitHub Actions workflow is `active`, and authenticated local `GET actions/permissions` returned `enabled:true, allowed_actions:all`. Despite normal owner-credential pushes and prior successful Actions runs, no new workflow was created after `2026-11-07T19:11:02Z`.
- The existing CI workflow was previously added **alone** to `main` as specifically authorized, commit `89607996d3645ba766a84e59a8a94c700c353f3a`, identical blob `303eddf97a0b83e250b93b28e4bee70a453c13fc`. This did not restore Actions execution.
- The redacted authoritative reports reside in `agent-reports/REPORT-ci-trigger-diagnostic.md` and `agent-reports/REPORT-ci-manual-dispatch.md`.
- GitHub Docs explicitly state that a repository/account may be in a separate **GitHub-controlled Actions disabled state**, for which toggling ordinary Actions settings will not restore access; GitHub Support must review. This is a **strong lead, not a confirmed root cause**.

## What to do next

A ready-to-review **unsent** GitHub Support case draft is available at **`GITHUB_ACTIONS_SUPPORT_CASE.md`**. Only the operator, using their GitHub account, should submit it via https://support.github.com/ if they choose to contact Support. Remote ChatGPT cannot claim ticket submission. If GitHub requests diagnostic information, preserve credentials and private data; share it only within the private ticket.

No further commits, dispatches, GitHub Actions settings toggles, feature-code changes, CI retries or test runs by the local Agent until remote ChatGPT updates this task with fresh, narrowly scoped approval. **The prior approval authorized one manual dispatch, now consumed.**

## Preserved acceptance and live host constraints

C3S **LOCAL BUILD PASS** on `d6e04a4`: `pnpm check` exit 0, Vitest 1206/1206, build PASS; mock Node 58/58 PASS. This is separate from **GITHUB CI NOT COVERED / DISPATCH_REJECTED**.

Keep original DSH 3080 `0.0.0.0:3080`, `allowUnauthenticated: true`, original trustedHosts, and existing anonymous LAN clients **unchanged**. Preserve 27 Workspaces / 841 Sessions, and running 3083 / 8123. No OpenClaw, QR rescan, cloud model routing, provider/default model change, live Session prompt or service restart.

Three future, independent, **still-unapproved** live operations remain: (1) test-only provider+selectModel and global-default rollback, (2) controlled restart, (3) one user-selected real original Session prompt.

**STOP. No Mac Agent reply is needed while HOLD.**
