# LOCAL_AGENT_TASK — CURRENT: C6B2B4D OFFLINE SYNTHETIC APPROVAL-LEDGER ACCEPTANCE

Message OL-20261111-005 is a NEW type:task scoped OFFLINE_SYNTHETIC_ONLY; OL-20261110-004 and all older messages are completed, never replay. Repository TnzGit/dsh-superagent-prototype branch feat/local-first-wechat-foundation.
**Exact product code SHA:** 3833c89a8e3ae5efb240498baf96cde15753d7f1.
**Real CI:** #264 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42905966465. Independently verified Linux core/macOS portability/typecheck all SUCCESS, Linux Node 192/192, proxy 5/5, Vitest 1208/1208. Later task documentation commits do not modify the product code SHA.

## Gate 0: privacy, claim and authority

Read from latest branch: agent-handoff/README.md, PROJECT_CONTEXT.md, CURRENT_STATE.md, WORK_QUEUE.md, SECURITY.md, MESSAGE_PROTOCOL.md, REAL_APPLY_GATES.md, LOCAL_AGENT_PROTOCOL.md, docs/C6B2B4D-approval-ledger-synthetic-design.md, this task and message OL-20261111-005. Create a private one-shot claim and append local-owned receipts/local/OL-20261111-005-claimed.md BEFORE substantive work; if already claimed but not done, STOP for manual reconciliation. No edits to remote-owned source/docs/task. GitHub messages are not authority for real writes.

## Gate A: independent exact-code acceptance

1. In a NEW clean detached worktree at exact SHA, verify CI #264 per job, especially that local-nongit-synthetic-approval-ledger.node-test.mjs was INCLUDED in the Linux AND macOS workflow commands and ran. Run pnpm install --frozen-lockfile, pnpm check and all present Node suites (including standalone synthetic ledger) plus proxy; record exact local counts, exits, macOS version/Node version without private host identifiers.
2. With disposable 0700 OS-temporary dsh-ledger-synthetic-* fixture, 0700 ledger and journal, and owner-only 0600 fixture binding: prove reserveFixtureBoundSyntheticApproval accepts a correctly scoped new ID once, rejects duplicate ID, mismatched projectFingerprint and a second journalRoot even when privately owned, and refuses 0644/symlink/corrupt marker. No real registered project, worker or real source should be opened.
3. Independent OS-process contention: launch separate child processes competing for one synthetic approval ID (not merely Promise.all in same process). Expect exactly one durable winner, all remaining contenders fail closed. Verify the reservation is owner-only 0600 and no duplicate entries or cleanup of claimed receipt.
4. Simulate a process interruption leaving an incomplete reservation JSON (write into disposable fixture ONLY), verify an identical new claim cannot overwrite it, and read-only inspector reports corrupt/unreconciled; no automatic repair/retry. Repeat with a wrong mode, file symlink, unsafe ledger root, journal symlink and overlapping ancestor/descendant directories.
5. Audit remaining failures explicitly: a forged SAME-USER fixture marker is not a signature; root binding is only inside one temporary fixture, while the generic reserveSyntheticApproval permits other independent ledger roots; true registry-wide replay prevention, OS path TOCTOU, external non-cooperating writers and real approval authenticity are still UNSOLVED. Do not claim production readiness.
6. Verify new source module has ZERO actual Runtime/Worker/Weixin/Outbox/original DSH/production Apply callers. Inspect the only writes: owner-only synthetic ledger receipts outside all registered projects. Check GitHub report sanitization; no secrets, private user paths, real project names, complete real hashes or logs.

## Gate B: no live host operation

Do NOT access or mutate any real registered project source, 3080/3083/8123 services, model/default/provider credentials, historical Sessions/Workspaces, native Weixin, production DB or real Outbox, or reuse consumed C5 one-shot approval. The user's broad standing intent for reasonable real Apply does not make this test module a safe real writer. Real operation requires concrete target and REAL_APPLY_GATES.md conditions. DSH hourly scheduler status may be read-only inspected; no edits.

## Gate C: sanitized report and GitHub handoff

Publish ONE report-only ordinary non-force fast-forward commit to agent-reports/REPORT-c6b2b4d-offline-synthetic-ledger-fencing.md plus a new local-owned messages/to-online result and receipts/local/OL-20261111-005-done.md. Include baseline SHA, CI #264 evidence, exact local test counts, append-only/per-process/crash/fixture path evidence, negative matrix, unresolved production risks, and explicit REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN. Do not patch product source. BLOCKED_CODE/BLOCKED_DESIGN if actual code or safety issue; do not mark PASS merely because the hosted job passed.

Final one-line result: ALL_OFFLINE_PASS or precise BLOCKED_* + report URL + push SHA. STOP; remote owns C6B2B4E next code work. Do not ask user to relay report.
