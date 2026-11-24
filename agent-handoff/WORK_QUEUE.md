# WORK_QUEUE — OL-050 independent native Weixin Outbox OFFLINE Mac verification

`no_auto_dispatch=true`; remote automation `PAUSED_BY_OPERATOR`; PR #1 Draft/unmerged; public GitHub cannot start local host work. **Exactly one active local task: OL-20261124-050 — PENDING direct trusted operator Prompt; no auto execution.**

| Priority | Work | Status |
| --- | --- | --- |
| P0 | OL-047 I2 disposable Mac Worker | ACKed `I2_ISOLATED_STAGING_PASS` only for synthetic COPY, not real Apply |
| P0 | OL-048 fake native Weixin; OL-049 unified fake vertical | Both CLOSED and remote ACKed `ALL_OFFLINE_PASS`; source pin `df9757...` remains historical |
| P0 | Remote installed Source Outbox fail-closed R1/R2/R3/R4/R5 | **CODE + CROSS-OS CI PASS** source `d6c51629855caf4b2737049cf4592cc12b912765`; #821/#822 each 3/3, Vitest 1284, focused 83 EACH OS; real I3 still gated |
| P0 | OL-20261124-050 independent operator Mac | **PENDING trusted DIRECT prompt**, `OFFLINE_SYNTHETIC_ONLY`; source pin `d6c51629855caf4b2737049cf4592cc12b912765`, task runbook `agent-handoff/HANDOFF-2026-11-24-OL050-I3-INSTALLED-WEIXIN-OUTBOX-OFFLINE.md`, no real network/model/host and no auto dispatch |
| P1 | Manually reconcile blocked/ambiguous Weixin receipts | Read-only redacted count/reason implemented; **no authorized replay/write/clear UI**; design in `docs/018-i3-native-weixin-outbox-review-runbook.md` |
| P1 | Real native I3 E2E | **GATED** separate specific operator-owned account+peer+send/host authorization, real iLink and model turn |
| P2 | Production registered-source Apply | **GATED** ACL/fd/dev/inode/external writers/capability/journal/recovery |
| P3 | PR #1 | Draft/unmerged; no deployment |

After local completion, the **online side** verifies sanitized report/receipt and CI, writes a single ACK and resumes safe remote work. Never infer real-I3 acceptance or issue OL-051 automatically.
