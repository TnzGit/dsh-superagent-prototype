# CURRENT_STATE — 2026-11-19 LO-043 accepted / live host still gated

Machine authority: `STATE.json`. OL-043 is CLOSED with unique online ACK `agent-handoff/receipts/online/LO-20261119-043-done.md`. **No active local task, no pending online ACK, no auto-dispatch**. Online ChatGPT automation remains operator-PAUSED; Mac scheduler unchanged/unknown. PR #1 DRAFT/unmerged. No original 3080/3083/8123 or main changes.

## Evidence (offline, not live Worker)

- Immutable F1/F2 remote source: `6c75c43f43b9133f8796b628155cc278c2025838`, CI #584 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757 **3/3**. Linux/hosted macOS each Node 254/254, focused 35/35, proxy 5/5, full Vitest 1243/1243; TS/build passed.
- Independent operator Mac report `agent-reports/REPORT-ol043-f1f2-mac-verify.md`, done SHA `0645388000bf9ec9938b970adbadbb3620264973`, CI #597 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44476080849 **3/3**. Local macOS 26.3 full Node **254/254**, previous provenance-specific 4 failures corrected; native file-path inspector **6/6 x3**; focus **35/35 x3**; proxy 5/5, full Vitest **1243/1243**, TS/build. Local A/B/C/E PASS, no original service/source drift; true DSH/Weixin/model Stage D was NOT AUTHORIZED.
- F1 now accepts *exactly named* macOS provenance xattr in research-only read inspector, rejects unknown user xattrs. **ACL-bearing fixture still ACCEPTS**, confirming ACL invisibility and that research inspector IS NOT a production Apply security check.
- F2 installed DSH 0.2.2-rc.1 Workspace/Session API compatible in read-only inspection, and restored foreign Session attestation rejects in synthetic tests. Canonical path string identity is NOT inode/dev or a race-free OS/worker sandbox; no authentic Worker tool or LLM turn yet.

## Next phase

Remote prepares an **I2 staging approval proposal** only, not an executable OL task, with isolated disposable service/data/project and no real source Apply. Operator must separately grant any live DSH/model action and choose exact temporary target, model/port and cleanup. A proposal document is not permission. Future I3 native Weixin requires another grant. OS-native Apply helper/ACL/external writer/journal remains blocked under REAL_APPLY_GATES.
