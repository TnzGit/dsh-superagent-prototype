# WORK_QUEUE — OL-050 ACKed offline; safe online review resumes

Remote automation `PAUSED_BY_OPERATOR`, `no_auto_dispatch=true`, no active local task, no OL-051, PR #1 Draft/unmerged.

| Priority | Work | Status |
| --- | --- | --- |
| P0 | OL-047 isolated I2 synthetic COPY | Accepted `I2_ISOLATED_STAGING_PASS`, not production Apply |
| P0 | OL-048/049 fake native Weixin/vertical | Accepted `ALL_OFFLINE_PASS` for exact older source, no real iLink |
| P0 | OL-050 installed native Source and disposable SQLite Outbox | **CLOSED and online ACKed `ALL_OFFLINE_PASS` for OFFLINE_SYNTHETIC_ONLY**. Source `d6c51629855caf4b2737049cf4592cc12b912765`, source CI #821/#822 3/3, local done `0de496099135080c0e4f763c6aee80317b7fcf2f`, done CI #827/#828 3/3, online ACK `agent-handoff/receipts/online/LO-20261124-050-done.md`; real I3 still gated |
| P1 | Online-only durable review hold, withdraw, pending/ordering and double-send source audit | **NEXT remotely owned safe offline code/test work**; CI required; no local task during online work |
| P1 | Manual reconciliation policy | No automated resend/clear; read-only redacted summary exists; real operator resolution requires separately reviewed transaction design |
| P1 | Real native I3 E2E | **GATED** specific operator account+peer/consent/host permission, real provider semantics |
| P2 | Production registered-source Apply | **GATED** ACL/fd/dev/inode/external writers/capability/journal/recovery |
| P3 | PR #1 | Draft/unmerged; no deploy |

No GitHub file, ACK or CI creates host-execution authority. If future bounded offline Mac task is warranted, issue one new distinct task only after safe remote work and source CI, with trusted operator-owned initiation; never auto-dispatch.
