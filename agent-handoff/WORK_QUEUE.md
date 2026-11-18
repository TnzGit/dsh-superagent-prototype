# WORK_QUEUE — active convergence only

Historical 100+ KB queue retained verbatim at `archive/WORK_QUEUE-through-OL040-2026-11-14.md`. History is NOT current authority; `STATE.json` is the primary machine-readable state.

| Priority | Workstream | State / Owner | Exact exit gate |
| --- | --- | --- | --- |
| P0 | C6B2B6G LO-040 ACK | DONE / remote | Local report + source/report CI verified; online receipt exists; OL-040 never replayed |
| P1 | Freeze & curate baseline | IN PROGRESS / remote | Immutable source SHA and CI recorded, archived full old state without deletion, short live status + validation CI, draft PR merge blockers documented |
| P2 | Ticket → Worker integration | PLAN_READY, NOT ACCEPTED / remote | Synthetic fixture-driven Ticket routing/registered project selection → isolated Git/non-Git Worker snapshot → change preview → human-review record demonstrated end-to-end with zero real source writes; real-host staged E2E separate |
| P3 | Real Apply execution boundary | DESIGN_REQUIRED / remote | OS-scoped path-safe helper design + per-project quiescence + durable before-images/manual recovery + authenticated private one-use transaction authority; no real Apply until explicit target and all gates pass |
| P4 | Release/PR readiness | BLOCKED / remote | Resolve PR #1 `dirty` mergeability and 585+ commit review scope without force-push or merging into main automatically; split or review manageable changes, verify deployment separately |
| Local Mac Agent | No active task | WAIT / local | Do not claim historical OL-040 or invent OL-041. Only newly and separately scoped future safe task is executable |

## Delivery order

1. Finish P1 and validate CI at the exact consolidation HEAD.
2. Implement P2 with tests that exercise the existing project-aware **Ticket → Worker → diff preview** path rather than adding isolated ledger negative tests. First all-offline, then plan a separately authorized disposable Mac staging E2E. Do not touch historical DSH Sessions or live Weixin.
3. In parallel record P3 architectural and OS feasibility gates. A hash, lstat, realpath, advisory lock or public GitHub message is not a write capability.
4. Re-review P4 only after the feature branch is acceptably scoped and integration evidence exists. Do not mark PR ready or merge automatically.

**Stop conditions:** any production DSH/3080/3083/8123/Weixin/default-model/provider change, actual registered source mutation, or GitHub forced/rebased history is outside this consolidation. Do not restart the paused remote scheduled automation.
