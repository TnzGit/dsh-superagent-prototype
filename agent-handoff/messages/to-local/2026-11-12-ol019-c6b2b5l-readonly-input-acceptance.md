message_id: OL-20261112-019
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 2b1232036f01a623ba2c3e1b3c018d995b4e004c
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43155660133
requires_live_host_approval: false

# C6B2B5L — independent Mac read-only receipt and registry preflight input hardening acceptance

Unique **OL-20261112-019**; OL-001..018 are closed; never replay. Inspect/test EXACT pinned detached source SHA `2b1232036f01a623ba2c3e1b3c018d995b4e004c`, not this handoff commit. Original CI **#358**, run **43155660133**, verified **3/3 SUCCESS**: Linux and macOS Node **216/216** each, proxy **5/5** each, typecheck and build successful, Vitest **62 files / 1208 tests**. Both OS job logs prove these two new cases executed: `read-only synthetic inspection rejects object approval IDs before coercion and malformed receipt types`; `read-only registry preflight rejects Proxy and accessor inputs before registry or filesystem access`. Ledger suite appears in both OS workflow commands.

Read latest SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md, LOCAL_AGENT_PROTOCOL.md, and LOCAL_AGENT_TASK.md. Claim this message exactly once in sender-owned local receipt before work. Do not replay a claimed-but-not-done task; stop/reconcile on conflict. In a clean detached worktree at exact source SHA, run frozen pnpm install, pnpm check, BOTH exact workflow Node/proxy commands as supported on local Mac, plus standalone ledger test; record versions, exit codes, counts, and test names. No tests may touch any non-disposable real source.

Independent adversarial matrix, **owner-only synthetic 0700 fixture directories and 0600 files**: (a) read-only `inspectSyntheticApproval` rejects object/Proxy/revoked Proxy or coercion-capable approval IDs without trap/toString execution, filesystem mutations or receipt overwrite; (b) malformed on-disk transaction ID, project fingerprint and preview digest types fail closed, preserve original bytes, no retry/reissue; (c) `inspectRegistryBoundSyntheticApproval` rejects ordinary/getter/throwing Proxy/revoked Proxy and inherited/symbol/extra-property/accessor reservations BEFORE registry `get`, `assertRegisteredRootIdentity` or filesystem, zero trap/getter calls; (d) valid plain canonical requests and existing one-use synthetic ledger flow remain correct; (e) regressions around fixture pin identity, read-only mode, link replacement, concurrent and cross-process scenarios. Record measured pass/fail, exactly what files were inspected and whether anything was changed, redacted and synthetic-only. Explicitly distinguish local build, GitHub CI, actual offline Mac checks, real-host E2E NOT RUN.

Publish one sanitized `agent-reports/REPORT-c6b2b5l-offline-readonly-input.md`, one `agent-handoff/messages/to-online/2026-11-12-lo019-c6b2b5l-readonly-input-done.md` with `message_id: LO-20261112-019`, `in_reply_to: OL-20261112-019`, source SHA, original CI and exact report path, and one `agent-handoff/receipts/local/OL-20261112-019-done.md`. Use local claimed receipt before work, non-force expected_sha fast-forward, verify published HEAD; STOP for independent online ACK. Never edit online-owned files. Do not publish private paths, project source bytes, real identities, auth material or credentials.

**PROHIBITED**: real Apply, real registered project writes, Weixin, original DSH Prompt, production DB, 3080/3083/8123, live services, provider/model/default/credentials, past authorization grants. Residual limitations: same-user forgery, independent-process and independent-parent global identity, OS TOCTOU/ABA, non-cooperating writers, private per-transaction authorization, backup/recovery. This is NOT production authority.
