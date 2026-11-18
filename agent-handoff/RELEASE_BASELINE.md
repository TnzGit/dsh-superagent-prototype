# RELEASE_BASELINE — frozen research feature candidate (NOT a production release)

**As reviewed 2026-11-18.** Repo `TnzGit/dsh-superagent-prototype`, feature branch `feat/local-first-wechat-foundation`; no code artifact was deployed by this GitHub review.

## Immutable anchors

- **Product source and tests:** `9adced9a40b5ef80c05d2d7916a54add65c6a8f0` (C6B2B6G). Pinned by immutable commit SHA, not by the advancing branch head.
- **Source Actions:** #485, https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43596061640. 3/3 jobs success, Linux/macOS Node 244/244, proxy 5/5 each, both shared-fence tests actually executed, Vitest 1208/1208 and build successful.
- **Local Mac independent report:** `agent-reports/REPORT-c6b2b6g-offline-shared-fence.md`, report commit `52234ceb80ec781ed3f18df8ac10ab5f2626e664`, #488 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43597825578 (3/3). Accepted remote LO-040 ACK at `agent-handoff/receipts/online/LO-20261114-040-done.md`.
- This is a **synthetic code baseline**, not a live deployment SHA, an authenticated approval, or proof of multi-file source Apply safety.

## Capability boundary

- Genuine Weixin → original DSH 3080 Session → local 8123 model → native Weixin reply: C5.5B real one-shot 6/6 accepted and original staging restored. This is not a persistent production project Worker/Apply path.
- Registered Git/non-Git workspaces, bounded snapshots, change preview and isolated Worker integration code exist. Real Ticket→Worker project mutation end-to-end has not been independently accepted.
- The synthetic one-step batch executor explicitly has no production caller. Single-file non-Git Apply/Rollback is default-off and not proof of production-grade multi-file atomicity.
- C6B2B6G optional per-ID fence works only for cooperating clients sharing one trusted fence root; multiple roots, inode ABA, same-user tampering, external writers/TOCTOU and real private authorization remain gaps.

## Pull request and deployment gate

- [PR #1](https://github.com/TnzGit/dsh-superagent-prototype/pull/1) remains DRAFT and is currently marked non-mergeable (`mergeable_state=dirty`); at review compare feature was 585 commits ahead / one behind `main` with ~365 PR files changed. Main changed independently; do not assume GitHub green CI equals mergeable. Recheck current comparison before resolving conflict.
- Convergence plan: review source by subsystem (A: native Weixin/3080 bridge/model queue, B: registered project Ticket/Worker and preview, C: synthetic safety research and tests). Keep historical reports/hand-off archive distinct from product code during eventual PR cleanup. Never force-push or blindly squash the entire history here.
- No merge into main, no production deployment, no new host side effects and no remote scheduler re-enable were authorized in this consolidation.

## Further proof required

Follow `docs/013-integration-acceptance.md` for isolated project-aware Ticket/Worker E2E and `docs/014-real-apply-boundary.md` for OS-specific execution design. `agent-handoff/REAL_APPLY_GATES.md` is still the hard execution authority limit, never replaced by CI evidence.
