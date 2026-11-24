# WORK_QUEUE — one operator-directed batch OL-052, not per-phase handoffs

`no_auto_dispatch=true`, remote scheduler `PAUSED_BY_OPERATOR`, PR #1 Draft/unmerged. Read **root `HANDOVER.md`** for full autonomous plan, safety, subagents, acceptance and final result.

| Work | Owner | Status |
| --- | --- | --- |
| OL-047–050 isolated I2/fake Weixin and Outbox | Historical | ACKed for individually limited synthetic scope only |
| OL-051 review ledger/late allowlist synthetic Mac | Local done, online ACK | **CLOSED `ALL_OFFLINE_PASS` OFFLINE**, done `781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`, CI #841/#842 both 3/3, ACK `agent-handoff/receipts/online/LO-20261124-051-done.md` |
| OL-052 P0 baseline/strict isolated fake harness | Local lead | PENDING **one direct operator-forwarded task launch** |
| OL-052 P1 durable Outbox/review; P2 native Weixin | Local subagents/lead | Within same task, no interim operator approval or online dispatch |
| OL-052 P3 full installed fake vertical; P4 synthetic-copy Apply | Local subagents/lead | Within same task, offline-only; high-risk real host functions remain GATED |
| OL-052 P5 docs/readiness + cross-OS CI + one final report | Local lead | Must deliver final SHA and one LO-052; local source/test edits authorized in this one batch |
| Real Tencent I3, original host, live Outbox and production Apply | Operator separate decision | **GATED**, outside OL-052 |
| Main merge/PR release/cloud | Operator separate decision | **GATED**, PR Draft |

No OL-053 auto issue, no automatic watcher. Subagents ≤3 simultaneous, separate worktrees, no independent push. Online ACK after the **entire** OL-052 result, not after every phase.
