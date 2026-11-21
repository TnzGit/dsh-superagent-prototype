# GitHub Support case — Actions rejects manual dispatch while permissions API says enabled

> **Draft only. Not submitted.** Prepared from the redacted, public operator reports on 2026-11-08. The repository owner should review and submit via the [GitHub Support portal](https://support.github.com/) using their own account. Do **not** paste credentials or raw private host logs into a public GitHub issue.

## Subject

GitHub Actions appears disabled for a user-owned public repository despite `enabled:true`; `workflow_dispatch` HTTP 422 and all `push` events stopped creating runs.

## Suggested support description (English)

Hello GitHub Support,

Please investigate whether there is a GitHub-controlled Actions restriction or an internal event/authorization state on this repository and its owner account.

**Repository:** https://github.com/TnzGit/dsh-superagent-prototype (public, personal **User** owner, not an organization).  
**Workflow:** `.github/workflows/local-first-core.yml` / ID `410395262`, `Local-first core tests`.  
**Default branch:** `main`.  
**Target feature branch:** `feat/local-first-wechat-foundation`.

**Observed behavior, 2026-11-08:**

1. The last workflow run in the repository was created **2026-11-07T19:11:02Z**, for older SHA `177bb997967f7c7636af26fc17c972f97c23e1f4`. Since then, multiple ordinary branch pushes from the repository owner's authenticated Git credentials have succeeded but produced **no** GitHub Actions runs.
2. `GET /repos/TnzGit/dsh-superagent-prototype/actions/permissions` returned `{"enabled":true,"allowed_actions":"all"}` on the operator's authenticated CLI; the workflow registry reported state `active`. The workflow YAML declares `push` on the feature branch, `pull_request`, and `workflow_dispatch`. No `paths` filters or `[skip ci]` markers explain the missing runs.
3. To enable manual dispatch, we copied **only** the same workflow file to `main` in commit `89607996d3645ba766a84e59a8a94c700c353f3a`; it is byte-identical to the feature-branch workflow (Git blob `303eddf97a0b83e250b93b28e4bee70a453c13fc`).
4. A **single** manual attempt against feature SHA `4d8b3d33d6d230ac11fad9ec4a5a76a23564ba5a` with the repository owner's authenticated GitHub CLI was rejected:
   - `gh workflow run local-first-core.yml --repo TnzGit/dsh-superagent-prototype --ref feat/local-first-wechat-foundation`
   - **exit 1, HTTP 422: `Actions has been disabled for this repository`**
   - endpoint: `POST /repos/TnzGit/dsh-superagent-prototype/actions/workflows/410395262/dispatches`
   - no workflow run or check run was created for this event.
5. The diagnostic report, uploaded through the owner's credentials, was committed as `810acfae102df057981daaf12be6a51306ef4760`, and the later manual-dispatch report commit `8b0fc5afb85417928286e08167e77d42bdf2a12e` also created **no** Actions runs.

**Question for GitHub:** Is Actions execution blocked at a separate repository/account eligibility/abuse-protection level despite the repository permissions API reporting enabled? If so, please review the restriction and identify what the owner must do to restore CI. Alternatively, can you inspect the `workflow_dispatch` 422 request and missing `push`/PR run delivery since 2026-11-07T19:11:02Z, and advise on recovery?

GitHub's [official repository Actions settings guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) notes that an account or repository can be in a separate GitHub-controlled disabled state even if normal settings are configured; changing ordinary Actions permissions may not restore access.

**Relevant sanitized public reports:**
- https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-reports/REPORT-ci-trigger-diagnostic.md
- https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-reports/REPORT-ci-manual-dispatch.md

The operator verified offline checks independently: TypeScript + Vitest 1206/1206 + build all PASS, plus 58/58 pure Node tests PASS at code baseline `d6e04a4`. These are **not** claims that GitHub CI executed. We have not altered running production services.

Thank you.

## Before submitting

- If the Support portal asks for an exact request timestamp, include the **actual recorded UTC timestamp** from the local GitHub CLI if retained; do **not** invent a time. The operator can supply the real GitHub `X-GitHub-Request-Id` from existing output if saved, but should **not** retry the dispatch merely to obtain it.
- Share additional account/support-only information in the **private ticket** when GitHub Support requests it, not in this public repository.
- Do not change Actions settings or invoke further dispatches simply to test a theory. Await guidance/explicit operator approval.
- This draft was created only to facilitate support; **no GitHub Support ticket has been filed** by remote ChatGPT.
