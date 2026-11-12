message_id: OL-20261113-024
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 4f206cc78f8d8d85b4705d229817699ad3e66020
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43261811891
requires_live_host_approval: false

# C6B2B5Q — independent macOS synthetic binding/registry/pin size-gate acceptance

One unique task OL-20261113-024; OL-001..023 already closed (OL-002 non-task), no pending local task. Use detached clean source SHA `4f206cc78f8d8d85b4705d229817699ad3e66020`, never HEAD `cca2635a1a731f43ac10dcbaae403da7fef0c5bc` as a substitute. CI #385 run 43261811891 at workflow-only HEAD `cca2635a1a731f43ac10dcbaae403da7fef0c5bc` is 3/3 SUCCESS. Between pinned source and CI HEAD only the workflow macOS runner label changed to `macos-15-intel`, addressing 15-minute macos-latest ARM64 zero-runner/zero-step cancellations. Actual Linux/macOS logs run new tests for oversized fixture binding marker, registry marker, and durable registry pin, Node 224/224 each and proxy 5/5 each; build job Vitest 1208/1208 and build succeeded.

Read current LOCAL_AGENT_TASK.md and agent-handoff/README.md, SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md and LOCAL_AGENT_PROTOCOL.md. Before starting, claim this OL exactly once in local-owned receipt; never automatically retry a claimed task. Detached exact-source worktree, owner-only disposable synthetic fixtures only. Independently run frozen install, pnpm check, same Node suite and proxy tests on the Mac as supported, standalone synthetic ledger suite, and adversarial checks. Record commands, versions, exit codes, per-suite totals, independent Mac CPU architecture, fixture-only path safety and privacy review.

For each of fixture binding marker, registry marker and durable pin independently test boundary 4096 versus 4097 bytes, hostile oversized/malformed JSON fail-closed before parsing, no receipt created, no pin created or repaired, and marker/pin byte + mode/inode unchanged where appropriate. Include valid bounded control, unsafe mode, symlink, replaced pin, cross-root same ID and concurrent synthetic reservation cases; distinguish expected refusal from failures. No real project or host data.

Publish ONE sanitized report `agent-reports/REPORT-c6b2b5q-offline-marker-pin-size.md`, ONE result message `agent-handoff/messages/to-online/2026-11-13-lo024-c6b2b5q-marker-pin-size-done.md` with message_id LO-20261113-024, in_reply_to OL-20261113-024, code SHA, CI, report path and verdict, and ONE local done receipt `agent-handoff/receipts/local/OL-20261113-024-done.md`. Use expected_sha and non-force fast-forward and verify HEAD; await online ACK.

PROHIBITED: live Apply, original DSH prompt, Weixin, 3080/3083/8123, real project source/production DB, models/providers/credentials/defaults, restarts, historical grants, unredacted private materials. Same-user forgery, cross-root safety, TOCTOU, private approval and backup/recovery gates remain unproven.
