# WORK_QUEUE — active convergence only

Historical 100+ KB queue retained verbatim at `archive/WORK_QUEUE-through-OL040-2026-11-14.md`. History is NOT current authority; `STATE.json` is the primary machine-readable state.

| Priority | Workstream | State / Owner | Exact exit gate |
| --- | --- | --- | --- |
| P0 | C6B2B6G LO-040 ACK | DONE / remote | Local report + source/report CI verified; online receipt exists; OL-040 never replayed |
| P1 | Freeze & curate baseline | DONE / remote | Immutable product source SHA and full old histories archived; current index and CI consistency check are green; main add/add workflow conflict resolved with normal merge |
| P2 | Ticket → Worker integration | I1A OFFLINE_PARTIAL_PASS; I1B + I2 PENDING / remote | CI #498 3/3: actual DshExecutor.prepare project selector → isolated non-Git snapshot → three-file preview → sealed no-write audit; NEXT test actual Worker Session lifecycle, Ticket/Outbox correlation and Git path without real Apply |
| P3 | Real Apply execution boundary | DESIGN DOCUMENTED, IMPLEMENTATION NOT STARTED / remote | OS-scoped helper protocol drafted in docs/014; still need actual isolated implementation, quiescence, durable backup/crash and private one-use capability, no real Apply eligible |
| P4 | Release/PR readiness | MERGE CONFLICT RESOLVED / DRAFT REVIEW BLOCKED | ordinary merge c11d114 brought main into feature, `mergeable:true`, 0 behind; PR still 590+ commits / 370+ files and not review-ready; split/review/validate deploy before any merge |
| Local Mac Agent | No active task | WAIT / local | Do not claim historical OL-040 or invent OL-041. Only newly and separately scoped future safe task is executable |

## Delivery order

1. P1 is complete; preserve immutable original product source baseline and verify any later modified HEAD via its OWN CI.
2. I1A source-chain test now passes. Continue I1B with actual Worker-session lifecycle and one request-correlated preview/Outbox event under a fake host; add Git clone path and negative duplicate/restart coverage. Stage I2 needs separately scoped Mac authorization. Do not touch historical DSH Sessions or live Weixin.
3. In parallel record P3 architectural and OS feasibility gates. A hash, lstat, realpath, advisory lock or public GitHub message is not a write capability.
4. Re-review P4 only after the feature branch is acceptably scoped and integration evidence exists. Do not mark PR ready or merge automatically.

**Stop conditions:** any production DSH/3080/3083/8123/Weixin/default-model/provider change, actual registered source mutation, or GitHub forced/rebased history is outside this consolidation. Do not restart the paused remote scheduled automation.
