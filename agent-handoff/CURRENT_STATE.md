# CURRENT_STATE — 2026-11-19 F1/F2 source pass and one manual Mac handoff

STATE.json is the machine authority. OL-042 is ACCEPTED/CLOSED with unique online ACK `agent-handoff/receipts/online/LO-20261118-042-done.md`; its operator Mac Node 249/253 with provenance failures remains a recorded historical discrepancy. New task **OL-20261119-043** is published MANUAL-ONLY OFFLINE_SYNTHETIC/READ_ONLY. It has no automatic dispatch, no live host grant and is not yet locally claimed. Online automation remains PAUSED; no settings/3080/3083/8123/main changes were made by remote coding.

## Frozen newly verified source

- Exact test/source SHA: `6c75c43f43b9133f8796b628155cc278c2025838`; [CI #584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) **3/3 success** at exact SHA. Both Linux and hosted macOS executed Node **254/254** (including 6 native fixture inspector tests), focused Vitest **35/35**, proxy **5/5**, full Vitest **1243/1243**, TS typecheck/build successful.
- **F1:** native READ-ONLY C inspector accepts exactly macOS `com.apple.provenance` xattr name, rejects all others; test-only xattr writer creates nontrivial synthetic fixture solely in OS temp root. Operator macOS 26.3 behavior still NEEDS direct repeat; hosted Mac runner lacks the auto stamp. No security claim about xattr contents, ACLs, external writers or source Apply.
- **F2:** `src/app/sessions.ts` checks active Ticket and requested registered snapshot, then recovered Agent's immutable `session.header.cwd`, resolved DSH WorkspaceRegistry canonical path and filtered `sessionIds` membership before role-model, decoration, permission or prompt. Registered project Worker `agent/created` early decoration is deferred until verified `ensure`; worker tool guard rechecks cached registry membership and Ticket liveness on use. New negative tests cover wrong restored Session, missing registry membership, failed Workspace create, premature decoration and mid-run ownership loss. Source-level path identity only, **no inode/dev or TOCTOU OS sandbox**.
- Full actual original DSH SessionController Agent turn/model/Weixin remains untested; I2/I3 require independent private grants and human stage decision. OS real Apply helper/journal/quiescence still NOT IMPLEMENTED. PR #1 remains DRAFT, unmerged.

## Next manual batch

Full runbook: `agent-handoff/HANDOFF-2026-11-19-F1F2-MAC-VERIFY.md`, task OL-20261119-043; pin exact source SHA and CI #584. Target: previous Mac 4/5 native positive cases MUST become green, unknown xattrs remain rejected, installed DSH 0.2.2-rc.1 API matches source-level F2 assumptions; zero host drift. Local Agent publishes sanitized one-shot LO-043/claimed/done receipts. Remote later reviews/ACKs; no OL-044 or automatic dispatch is implied.
