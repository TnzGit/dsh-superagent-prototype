message_id: OL-20261112-021
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 0cf3915ac4acb8d269c7dc7679d3885c38d04415
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43177644003
requires_live_host_approval: false

# C6B2B5N — independent Mac hostile read-only ledgerRoot acceptance

Unique **OL-20261112-021**. OL-001..020 are closed, must not be replayed. Test the EXACT detached source SHA `0cf3915ac4acb8d269c7dc7679d3885c38d04415` (NOT this dispatch commit). Original **CI #368**, run `43177644003`, verified **3/3 SUCCESS**. Inspected real Linux/macOS logs: both execute `read-only synthetic inspection rejects hostile ledger roots before path coercion` and earlier malicious receipt/approval ID tests. Linux/macOS Node **218/218** each, proxy **5/5** each; TypeScript check and build successful; Vitest **62 files / 1208 tests**. The synthetic ledger suite appears in BOTH exact workflow Node commands.

Read current SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md and LOCAL_AGENT_TASK.md. **Claim OL-021 exactly once before testing** using local-owned claimed receipt. If claimed-but-not-done, stop and reconcile: do not retry/replay. In a clean detached worktree pinned to source SHA, use only owner-only disposable synthetic fixtures (0700 directories, 0600 files). Run frozen dependency install, pnpm check, exact workflow Node and proxy test commands, standalone synthetic ledger suite. Record actual Node/pnpm versions, exit codes, suite counts, SHA and clean/source integrity.

Independently reproduce and adversarially extend read-only `inspectSyntheticApproval`: reject non-string/empty `ledgerRoot` before `realpath`/path coercion, including evil `toString` / `valueOf` objects, throwing/nonthrowing Proxy, revoked Proxy, null, number, boxed String, getter-backed/other exotic input; show zero hostile trap/coercion calls, no unintended read or write, no receipt consumption or overwrite. On a valid canonical synthetic root verify a legitimate reservation is inspectable read-only, replay/invalid receipts refuse, receipt bytes/modes remain intact. Test malformed entry schemas, invalid approval IDs, journal/ledger overlap, symbolic links/inode replacement and process-local pin limitations where applicable. All tests use local synthetic fixtures; no real registered project writes. Report actual counts and any failures or untested claims.

Publish exactly ONE sanitized `agent-reports/REPORT-c6b2b5n-offline-ledgerroot-input.md`, one to-online result `agent-handoff/messages/to-online/2026-11-12-lo021-c6b2b5n-ledger-root-done.md` with `message_id: LO-20261112-021`, `in_reply_to: OL-20261112-021`, exact code_sha/source CI/report path, and local `agent-handoff/receipts/local/OL-20261112-021-done.md`. Guarded expected_sha non-force fast-forward, verify HEAD. STOP for online ACK. Do not edit online-owned files or expose private identities, paths, source bytes or secrets.

**Forbidden:** real Apply/real source write, Weixin, original DSH Prompt, 3080/3083/8123, production DB, model/provider/default/credentials, historical grants or live service changes. Same-user forgery, independent-process/global pin identity, OS TOCTOU/ABA, private per-transaction authority, backups/recovery remain unsolved. Synthetic-only results are NOT live authorization.
