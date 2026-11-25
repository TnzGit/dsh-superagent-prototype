# WORK_QUEUE — OL-054 installed-product convergence, one autonomous batch

Current: `OL-20261125-054`, pending **direct operator-forwarded launch**, no watcher/auto-dispatch. See root `PLAN-OL054.md` for complete M0–M6 schedule, ≤3 concurrent offline subagents, source edits and final verdicts. PR #1 remains Draft/unmerged.

| Phase | Work | Status |
| --- | --- | --- |
| Prev | OL-053 controlled real iLink/model and registered-test-project Apply+rollback | CLOSED `LIVE_BOTH_PASS` scoped, independently ACKed; CI #869/#870 each 3/3 |
| Doc | Re-register if same-path registered root/ancestor replaced, new Ticket and capability | DONE `docs/020-postlive-i3-and-apply-operator-runbook.md` |
| M0 | Private installed 3083 inventory and consistent backup/restore dry run | PENDING one trusted OL-054 launch |
| M1 | Single account poll-owner lease/fencing + durable inbound dedup, no trigger 12 replay | NOT IMPLEMENTED, assigned |
| M2 | Staged reversible new 3083 test-orchestrator cutover | NOT EXECUTED, assigned |
| M3 | Real Tencent→**installed 3083**→genuine local model→Outbox→self-peer | NOT EXECUTED, assigned |
| M4 | Operator-private auditable manual review hold terminal settlement, no resend | NOT IMPLEMENTED, assigned |
| M5 | Native fd-relative Apply helper→private product review→real registered low-risk test source | NOT WIRED, assigned |
| M6 | Cross-OS CI, host rollback/evidence and one final LO-054 | PENDING final |

Technical host/OS/identity gates are checked locally, NOT interpreted as need for another abstract consent. Lead-only live actions; no OL-055 auto issue; original OL-053 send/model/Apply budgets consumed.
