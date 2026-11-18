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
- **PR #1:** draft, divergent from `main` and currently GitHub marks mergeability `dirty`; no merge/rebase/force-push authorized by this consolidation.

## Exact next work

Complete repository-first integration acceptance and the separate OS Apply design, not another isolated synthetic ledger microtask. Follow `WORK_QUEUE.md`, `docs/013-integration-acceptance.md`, `docs/014-real-apply-boundary.md` and `RELEASE_BASELINE.md`. No new OL ID until a specifically scoped, safe independent Mac task is needed and authorized.
