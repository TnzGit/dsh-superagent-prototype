# WORK_QUEUE — OL-049 closed offline; real I3 gated

Remote automation `PAUSED_BY_OPERATOR`, `no_auto_dispatch=true`, no active local task / no OL-050, PR #1 Draft.

| Priority | Work | Status |
| --- | --- | --- |
| P0 | OL-047 I2 isolated Worker | ACKed `I2_ISOLATED_STAGING_PASS` on synthetic COPY only |
| P0 | OL-048 fake native Weixin | ACKed `ALL_OFFLINE_PASS`; not real I3 |
| P0 | Source pin `df9757b3acd7ba2a5e234264a6c607c024858a79` | CI #780/#781 each 3/3, 14 fake polling cases, two unified vertical variants, Vitest 1266 |
| P0 | OL-20261124-049 independent Mac offline | **CLOSED `ALL_OFFLINE_PASS` for OFFLINE scope only**, done `4c805b9518d2025644c708cf7816653cbce39ccf`, CI #791/#792 each 3/3, ACK `agent-handoff/receipts/online/LO-20261124-049-done.md` |
| P0 | Post-ACK dynamic peer-revocation Source hardening | `676bc321ae33bc691b64d17f90a9789f5683a2b3` CI #797/#798 each 3/3; fake poll 17, full Vitest 1269, Node 255, focus 44; not real I3 |
| P1 | Native Weixin installed-Source Outbox / consent / ambiguous-delivery failure audit | **Next remote-only offline source/design/test work**; detailed gates in `docs/017-i3-native-weixin-prelive-fault-gates.md`; no live channel or host calls |
| P1 | Real native I3 E2E | **GATED:** requires specific operator approval and independent real QR/credentials/peer/iLink/host evidence |
| P2 | Registered project production Apply | **GATED:** ACL/fd/dev/inode/external-writer/capability/journal/recovery/transaction approval |
| P3 | PR #1 | Draft/unmerged; no deploy |

No public GitHub message grants authority for Mac execution. No automatic task issue or force push.
