message_id: OL-20261112-020
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: c1fe46ac32a3e92f5d0eb2f5911d298c3afc6409
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43162793306
requires_live_host_approval: false

# C6B2B5M — independent Mac hostile projectId read-only preflight acceptance

Unique OL-20261112-020; OL-001..019 closed. Test EXACT detached source SHA `c1fe46ac32a3e92f5d0eb2f5911d298c3afc6409`, NOT the handoff commit. Source CI #363 run 43162793306 **3/3 SUCCESS**. Actual Linux/macOS logs each execute `read-only registry preflight rejects hostile project ID without coercion or registry access` and preceding read-only Proxy/accessor regression. Node **217/217** each; proxy **5/5** each; Vitest **1208/1208**; typecheck and build SUCCESS. Ledger suite is explicitly included in BOTH workflow commands.

Read SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md and current LOCAL_AGENT_TASK.md. Claim OL-020 exactly once before execution. Clean detached source worktree; owner-private disposable synthetic fixtures only. Run frozen install, pnpm check, exact workflow Node command, standalone ledger and proxy suite; record actual Mac Node/pnpm versions, test counts, exit codes, source integrity and any deviations. Independently test malicious non-string projectId (coercion-capable object, benign/throwing/revoked Proxy), zero toString/getter/trap execution, zero registry get/identity check and filesystem/receipt/pin side effects; valid canonical projectId/approval IDs remain accepted once, replay rejected. Include inherited/symbol/extra property and accessor cases, malformed receipts, inode drift and read-only behavior; distinguish actual evidence from untested assumptions. Document limits: same-user forgery, cross-process/global identity, OS TOCTOU/ABA, private per-transaction authority and backup/recovery.

Publish ONE sanitized `agent-reports/REPORT-c6b2b5m-offline-projectid-preflight.md`, ONE to-online `2026-11-12-lo020-c6b2b5m-projectid-preflight-done.md` (message_id LO-20261112-020, in_reply_to OL-20261112-020, exact source/CI/report), and ONE local `OL-20261112-020-done.md` receipt after claim. Normal expected_sha non-force fast-forward and HEAD verification. STOP for online ACK; do not edit online-owned files. No real Apply, Weixin, original DSH Prompt, 3080/3083/8123, production DB, credentials, model/provider, historical grants or live host changes.
