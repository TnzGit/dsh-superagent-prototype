# CURRENT_STATE — concise authoritative state

Read `STATE.json` first. All historical detail, unchanged, was retained in `archive/CURRENT_STATE-through-OL040-2026-11-14.md`. Old blocks in that archive are **not** active tasks.

## Current (2026-11-18)

- **Phase:** `INTEGRATION_CONVERGENCE`; **owner:** remote ChatGPT; **active Mac task:** NONE; **unacked local result:** NONE.
- **Last task:** `OL-20261114-040` (C6B2B6G) locally `ALL_OFFLINE_PASS` and online ACKed with `LO-20261114-040-done.md`; never replay.
- **Pinned source:** `9adced9a40b5ef80c05d2d7916a54add65c6a8f0` (source CI #485, all 3 jobs success); local report commit `52234ceb80ec781ed3f18df8ac10ab5f2626e664` (CI #488 3/3). New documentation/validation commits after this do NOT change the pinned product source.
- **Evidence at pinned source:** Linux and macOS 244/244 Node, 5/5 proxy per OS; 1208/1208 Vitest/build; independent Mac reports 62/62 ledger plus 1541/1541 bounded adversarial checks across four runs. These prove only named synthetic and mocked behavior.
- **Last change:** new optional shared synthetic fence coordinates competing ledgers using the SAME owner-provided root, but independent roots, directory ABA replacement, same-user forgery and uncooperative writers remain bypasses. No production Apply integration.
- **Online scheduled automation:** PAUSED by operator; leave disabled. Mac-side DSH scheduling state has not been inspected here.
- **Live host:** no real project Apply, real Weixin activity, production Session/Workspace/DB/service or provider changes were made during this consolidation. C5.5B earlier validated a one-time real native Weixin-to-original-DSH-to-local-Qwen round trip, not a project Worker/Apply E2E.
- **PR #1:** remains DRAFT and not review-ready, but its add/add CI workflow conflict was resolved with an ordinary two-parent merge `c11d1146b25bcf9cfab8d3cf4304957796cc3dec` preserving the feature's fully tested workflow. Compare now reports 0 behind main, GitHub `mergeable:true`. This is NOT a release/PR merge.

## I1A integration evidence (accepted at source/test SHA `6e9cf91154d018e2f3a61f597cf2171e711c50df`)

- [CI #498](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44248563551) complete SUCCESS, Linux core/macOS portability/typecheck-build 3/3. Both Linux and Mac actual job logs execute 2/2 new cross-module Vitest tests; Node 248/248, proxy 5/5, total Vitest 1210/1210 and build passed.
- Actual `DshExecutor.prepare` Ticket project binding feeds the same `createProjectSnapshot` implementation as the directory preparer; isolated fixture Worker-copy edits yield sorted add/delete/modify preview, sealed private after-images and an `awaiting-human` read-only batch audit. Bad/missing selectors refuse. The source fixture bytes are unchanged.
- **Limit:** this test does NOT call the private `DshExecutor.prepareDirectory` lifecycle, launch a real Worker Session, issue any model prompt, ingest/send real Weixin, or Apply changes. I1A is partial source-chain integration only; full I1 and I2 remain pending.

## Exact next work

Complete repository-first integration acceptance and the separate OS Apply design, not another isolated synthetic ledger microtask. Follow `WORK_QUEUE.md`, `docs/013-integration-acceptance.md`, `docs/014-real-apply-boundary.md` and `RELEASE_BASELINE.md`. No new OL ID until a specifically scoped, safe independent Mac task is needed and authorized.
