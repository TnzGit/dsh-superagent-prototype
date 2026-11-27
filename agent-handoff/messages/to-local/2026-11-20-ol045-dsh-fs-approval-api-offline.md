message_id: OL-20261120-045
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 5578b19ae1a3326093884dc0324e1ebf1577dfaa
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44577086561
manual_operator_forwarding_required: true
original_host_live_grant: NOT_GRANTED

# OL-045 read-only DSH approval/fs API compatibility

Run exactly ONE manual-only OFFLINE source/installed-package inspection per agent-handoff/HANDOFF-2026-11-20-OL045-DSH-FS-APPROVAL-API-OFFLINE.md. CI #648 is independently green on frozen SHA. This task does NOT authorize new DSH process, model inference, any actual approval request, tool execution on real DSH, original source mutation, 3080/3083/8123 writes/restarts, Weixin or real Apply.

Verify in a private disposable source checkout: Node 255/255, focus 37/37, proxy 5/5, full Vitest 1245/1245, TS/build. Inspect installed local DSH package source/types READ ONLY for `dsh-user-approval` policy `never` semantics and whether `dsh-fs-sandbox` native edit avoids inner Seatbelt subprocess; inspect scope/guard API for `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1`. No actual DSH Worker or model call. If can't attest installed API, use OFFLINE_BLOCKED_API, never infer I2 success. Before/after production host baseline zero drift, report to GitHub and unique receipts once. OL-044's live consent is CONSUMED and cannot be replayed.
