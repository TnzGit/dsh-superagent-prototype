# CURRENT_STATE — 2026-11-18 I1F remote source convergence

Read STATE.json first. OL-041 has been online ACKed and closed. There is ONE new manual-only OFFLINE task `OL-20261118-042`, with full handoff `agent-handoff/HANDOFF-2026-11-18-I1F-MAC-BATCH.md`; it has not yet been locally claimed. The operator-paused remote automation stays PAUSED, Mac scheduler status unchanged/unverified, no_auto_dispatch true, no I2/I3 or real source Apply permission. PR #1 is still DRAFT/unmerged.

## Latest verified code (not deployed)

- Exact source SHA `ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead`. [CI #550](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819) 3/3 successful, both Linux/macOS explicitly executed **30/30 focused Vitest** (I1A 2, I1B 7, P3 pure 9, I1C AgentDelivery 5, I1D Sessions boundary 6, I1E vertical 1); Node **253/253** including native C inspector 5, proxy 5/5; full Vitest **1238/1238**, typecheck/build success.
- I1D adds real Sessions.ensure active-Ticket and exact configured snapshot directory checks **before SessionController create**; validates local synthetic role-model selection, workspace-write permission and tool restriction, durable request dedup and fail-closed cases under simulated DSH host.
- I1E composes actual Engine→Ticket→DshExecutor→Sessions.ensure→AgentDelivery→isolated snapshot→preview→core Outbox once, still **simulated DSH SessionController/Agent** and **simulated Worker file edits**, no real model turn.
- P3 adds experimental READ-ONLY C openat inspector and cross-platform five-test synthetic matrix. No write API, no production Runtime caller, no ACL/writer-quiescence guarantee, no authenticated Apply or crash recovery.
- **Unresolved:** real recovered DSH Session workspace identity/authorization must be checked independently; requested Ticket directory string equality alone does NOT attest an existing Session's stored workspace. Actual DSH turn/model/Weixin Gate I1/2/3 remain NOT PROVEN. No source Apply.

## Next owner and evidence

Local Agent receives only OL-042 via manual operator handoff, performs concentrated Mac regression and installed DSH API READ_ONLY investigation, no real-host actions. Expected sanitized LO-042 report/claimed/done receipts. Previous OL-041 local ALL_OFFLINE_PASS and online ACK at agent-handoff/receipts/online/LO-20261118-041-done.md; never replay. After LO-042 remote ACKs once and patches any actual DSH workspace identity issue with new CI; only a separately scoped private host grant can authorize future live I2/I3.
