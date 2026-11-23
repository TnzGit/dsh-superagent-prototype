# WORK_QUEUE — I3 OFFLINE gaps after LO-048 ACK (2026-11-24)

Remote automation PAUSED_BY_OPERATOR and no_auto_dispatch true; no active local task, PR #1 Draft/unmerged.

| Priority | Work | State |
| --- | --- | --- |
| P0 | I2 disposable DSH native edit + review | **ACKed PASS OL-047**, limited to isolated synthetic COPY, not production |
| P0 | OL-048 offline fake Weixin | **ACKed ALL_OFFLINE_PASS**; full 1256 Vitest / 255 Node, CI #772/#773 3/3. NO real I3 |
| P0 | Unified I3 fake vertical | **REMOTE OFFLINE NEXT:** genuine pollNativeWeixin fake fetch → actual Engine intake/Decision/Ticket + synthetic Worker report-ready → pending unsent Core Outbox |
| P0 | Poll negative tests | **REMOTE OFFLINE NEXT:** HTTP 401/429/503/-14 retry schedules, token account rotation, mid-page abort uncommitted cursor |
| P1 | Real I3 Weixin | NOT AUTHORIZED; no QR/credentials/real sending |
| P2 | Original registered source Apply | GATED: ACL/fd-root/dev/inode/writer lock/one-use consent/crash journal |
| P3 | PR #1 | DRAFT unmerged / undeployed |

No OL-049 auto issue. Public GitHub cannot by itself trigger Mac host operations; safe offline source/test maintenance requires no repeat approval.
