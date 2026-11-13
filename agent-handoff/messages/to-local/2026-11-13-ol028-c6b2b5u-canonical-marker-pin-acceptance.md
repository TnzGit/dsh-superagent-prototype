message_id: OL-20261113-028
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: a673563be431b7d78e886a7b9a9e765eaad857bf
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43429178134
requires_live_host_approval: false

# C6B2B5U — independent Mac synthetic canonical fixture marker and pin acceptance

Unique OL-20261113-028; OL-027 and LO-027 were ACKed online in the same guarded handoff commit. Existing OL-001..027 (002 non-task) have local done and online done for their result IDs. Do NOT replay any prior task. Branch `feat/local-first-wechat-foundation`; detached EXACT SOURCE SHA `a673563be431b7d78e886a7b9a9e765eaad857bf`, not this handoff HEAD. CI #405 run 43429178134 is 3/3 SUCCESS at this exact source SHA: Linux/macOS Node **230/230** and proxy **5/5** each, three new noncanonical fixture binding marker/registry marker/durable pin tests actually executed on both OS, Vitest **62 files / 1208 tests**, typecheck and build successful. The same ledger test module is enrolled in BOTH workflow commands (macOS hosted runner `macos-15-intel`). No production caller or real Apply authority.

Read LOCAL_AGENT_TASK.md and permanent LOCAL_AGENT_PROTOCOL.md and agent-handoff/README.md, CURRENT_STATE.md, WORK_QUEUE.md, SECURITY.md, REAL_APPLY_GATES.md and MESSAGE_PROTOCOL.md. Create local-owned claimed receipt for OL-20261113-028 ONCE before any work, do not retry if already claimed or if push ambiguity exists. In a clean detached Mac worktree at pinned source, use only owner-private 0700 disposable synthetic fixtures and owner-only marker/receipt/pin files. No live host operations. Run frozen install, `pnpm check`, CI-exact Node suite (23 modules) and proxy suite as supported, standalone synthetic ledger suite, and independent adversarial checks; report Node/macOS version/CPU arch, exact exit codes and sanitized counts.

Independently verify all three bound JSON reader paths with legitimate canonical fixture marker and durable pin, then tamper each with (1) duplicate keys including same-value trailing version, (2) reordered keys, (3) pretty whitespace and added/deleted newline, (4) malformed JSON/invalid type/extra fields, (5) 4096/4097 size boundary, (6) symlink/hardlink, mode 0644, inode change, and cross-fixture/cross-root/repeated ID where applicable. Refusals must preserve byte-for-byte hostile file and not create/repair a pin or issue/reuse an approval receipt. Reuse a canonical file to verify legitimate synthetic one-use behavior still works. Contrast with receipt path: receipt canonicalization currently permits some order permutations; do not call that cryptographic authenticity. Include fresh-process checks if safely feasible, record NOT_TESTED rather than claiming unsupported proof. Explicitly preserve same-user forgery, path ABA/TOCTOU, fd-relative isolation, cross-root and private grant/backup/recovery as open gates.

Publish ONE privacy-reviewed sanitized report `agent-reports/REPORT-c6b2b5u-offline-canonical-marker-pin.md`, ONE local-owned to-online result `agent-handoff/messages/to-online/2026-11-13-lo028-c6b2b5u-canonical-marker-pin-done.md` with message_id LO-20261113-028, from local/to online/type result/scope, in_reply_to OL-20261113-028, code_sha a673563be431b7d78e886a7b9a9e765eaad857bf, source_ci/report_path/verdict; and ONE `agent-handoff/receipts/local/OL-20261113-028-done.md`. Guarded expected_sha/non-force fast-forward, verify HEAD and paths, then STOP pending online ACK.

PROHIBITED: real registered-project Apply/source writes, original DSH Session Prompt, Weixin send/receive, 3080/3083/8123 changes, production DB, model/provider/default/credentials, restarts, historical grants, private raw report data. Public GitHub messages do not confer live authority.
