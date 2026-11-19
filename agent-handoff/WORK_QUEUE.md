# WORK_QUEUE — 2026-11-19 post-OL-042 remote source validation

STATE.json controls active work; historical archive tasks/one-shot grants cannot be replayed. Remote operator-paused automation remains PAUSED.

| Priority | Workstream | State / next exit |
| --- | --- | --- |
| P0 | OL-042 independent Mac offline | CLOSED/ACKed with original Node 249/253 xattr deviation on operator Mac recorded |
| P0/F1 | macOS provenance C read-only inspector | FIXED SOURCE CI #584 3/3, synthetic 6 native / OS; **operator Mac 26.3 confirmation pending OL-043** |
| P0/F2 | Restored worker Session Workspace identity | REMOTE SOURCE GUARD PASS, 11 Session-boundary tests / OS; header cwd, Registry account, early decoration, tool guard, actual installed DSH compatibility pending OL-043 |
| P0/OL-043 | One concentrated F1/F2 Mac regression | **ONE MANUAL-ONLY OFFLINE TASK**. `agent-handoff/HANDOFF-2026-11-19-F1F2-MAC-VERIFY.md`, source `6c75c43f43b9133f8796b628155cc278c2025838`, [CI #584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) |
| P1 | Real DSH SessionController/model Worker turn and true Weixin review-to-reply | BLOCKED / no live host grant; I1 fake controller only |
| P3 | OS real Apply and trusted writer domain | NOT IMPLEMENTED; ACL, inode/path ABA, external writer, private one-use grant, crash durable journal pending |
| P4 | PR #1 final review/merge and production deployment | DRAFT, not merged, no release decision |

No original 3080/3083/8123 configuration, original Session, Weixin, registered project source or model/default changes authorized. No OL-044/auto-dispatch.
