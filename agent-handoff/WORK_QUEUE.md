# WORK_QUEUE — 2026-11-19 after one-shot I2 operator consent

STATE.json controls active work; remote scheduling PAUSED and no auto-dispatch. PR #1 Draft; no main/deploy changes.

| Priority | Work | Status / acceptance |
| --- | --- | --- |
| P0 | OL-043 F1/F2 local Mac | CLOSED, online ACK, 254/254 Node, 35/35 focus x3, 1243/1243 Vitest, no host drift |
| P0 | OL-20261119-044 disposable true DSH Worker I2 | **ONE MANUAL CONDITIONAL I2 TASK**. Human direct Prompt, exact source `c0da76b14f4893397428c025670f731e0629555d`, [CI #618](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44482434876). Runbook `agent-handoff/HANDOFF-2026-11-19-OL044-I2-DISPOSABLE-DSH-ONE-SHOT.md`. OS and child-process isolation MUST pass before one model turn; otherwise I2_BLOCKED_* report, never unsafe fallback |
| P1 | I2 true Worker/tool lineage | NOT PROVEN UNTIL local run has genuine Agent/tool invocation + isolated copy-only diff/review/Outbox, model-only 8123, original host zero drift |
| P2 | I3 native Weixin | NOT AUTHORIZED, requires separate private approval and accepted I2 |
| P3 | Real registered-source Apply | FORBIDDEN; native OS helper ACL/inode/dev/external writer/journal/one-shot capability missing |
| P4 | PR #1 | DRAFT, no release/merge/deploy |

No automatic OL-045. The new one-shot approval does not touch original 3080/3083/8123 config, original Workspaces/Sessions, native Weixin or actual registered projects.
