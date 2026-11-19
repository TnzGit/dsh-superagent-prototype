# WORK_QUEUE — remote work after OL-042 ACK (2026-11-19)

No active local task, no pending ACK; online automation operator-PAUSED and auto-dispatch prohibited. See STATE.json.

| Priority | Workstream | Current status / acceptance |
| --- | --- | --- |
| P0 | OL-042 Mac offline | CLOSED, ACKed LO-042; report CI #565 3/3; Mac Node native 4 failing cases explicitly recorded |
| P0/F1 | Native read-only inspector rejects macOS com.apple.provenance | REMOTE FIX PENDING: exact recognized system stamp only, keep all unknown/user xattrs denied; add synthetic Mac regression and reverify operator Mac |
| P0/F2 | Recovered DSH Worker Session Workspace identity | BLOCKED CONFIRMED: current ensure trusts resolveAgent; remote patch to compare Session header cwd, resolved registry Workspace membership and expected snapshot, error before any permission/model/prompt/rename; missing APIs fail closed |
| P1 | Full I1 synthetic source vertical | PARTIAL PASS, CI #550; actual SessionController/Agent/model/tool turn remains untested |
| P2 | Operator Mac follow-up for F1/F2 | NOT DISPATCHED; only after fixes and CI, requires fresh operator manual authorization; no live host by default |
| P3 | Native OS real Apply helper | DESIGN ONLY, NO WRITE API; ACL, provenance, fd identity, external writer quiescence, one-shot private approval, journal/recovery remain blocked |
| P4 | I2/I3 and PR release | NOT AUTHORIZED / Draft unmerged |

No original 3080/3083/8123 session, Weixin, provider, model default or real source Apply can be operated from these public files.
