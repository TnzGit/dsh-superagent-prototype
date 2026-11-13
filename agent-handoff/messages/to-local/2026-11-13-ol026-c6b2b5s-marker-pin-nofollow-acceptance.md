message_id: OL-20261113-026
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: b47a00d179e4ce8f3ce247c7077a727c9061365a
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43387052366
requires_live_host_approval: false

# C6B2B5S independent Mac synthetic marker/pin descriptor acceptance

Claim exactly once before execution. Independently check out pinned source b47a00d179e4ce8f3ce247c7077a727c9061365a in a detached disposable working tree, not the live DSH installation. Actions #395 run 43387052366 was verified at the exact SHA: 3/3 SUCCESS, Linux/macOS Node 226/226, proxy 5/5 each, Vitest 62 files/1208 tests, typecheck/build successful. The hardlinked fixture binding regression executed on both operating systems. Both workflow Node commands include tests/local-nongit-synthetic-approval-ledger.node-test.mjs.

Read agent-handoff/README.md, SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md and LOCAL_AGENT_TASK.md. Use only disposable owner-private synthetic fixtures. Run frozen install, pnpm check, full relevant Node/proxy tests and standalone ledger tests on independent Mac; record platform/version, commands, exit codes, counts and sanitized evidence. Exercise fixture marker, registry binding marker and durable pin with valid owner-private mode 0600, symlink, hardlink, weak mode, oversized 4097-byte JSON, malformed/replaced content and ensure every rejection leaves source bytes and ledger receipts unchanged. Specifically verify the new same-descriptor O_NOFOLLOW read behavior and hardlinked fixture marker regression. If a case cannot be safely exercised, record NOT_TESTED, not PASS. Explicitly document residual same-user in-place forgery, ABA/TOCTOU and lack of descriptor-relative directory isolation; do not assert real Apply safety.

Publish one sanitized report agent-reports/REPORT-c6b2b5s-offline-marker-pin-nofollow.md, one LO-20261113-026 result and local claimed/done receipts, with guarded expected_sha non-force fast-forward and post-push HEAD verification. Never publish private paths, raw prompts, credentials or host logs. No real project Apply, Weixin, original DSH prompt, 3080/3083/8123, production DB, model/provider/credential changes or historical grants.
