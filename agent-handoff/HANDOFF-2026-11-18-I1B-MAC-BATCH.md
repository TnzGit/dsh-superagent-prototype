# OL-20261118-041: consolidated Mac acceptance and host-gate handoff

**Prepared 2026-11-18 by remote ChatGPT. NOT A REAL-HOST AUTHORIZATION.**

Read root LOCAL_AGENT_TASK.md, LOCAL_AGENT_PROTOCOL.md, agent-handoff/STATE.json and MESSAGE_PROTOCOL.md first. This document authorizes nothing on its own; it is the complete runbook for a separately published OFFLINE_SYNTHETIC_ONLY task.

## Verified inputs

- Repo/branch: TnzGit/dsh-superagent-prototype / feat/local-first-wechat-foundation.
- **Exact immutable source SHA: 05937a3a8de5d020f55e6984bbd9660e03f4d3eb.** Test it in a fresh detached disposable worktree, not an advancing branch checkout.
- **Source CI #516:** https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44254449518 (3/3 SUCCESS). Linux/macOS each executed 14 focused Vitest cases: I1A 2, I1B fake-host 7, P3 proposed-plan validator 5. Full Vitest 1222/1222, typecheck/build success. Earlier I1B CI #507 also 3/3.
- I1B added tests/local-ticket-worker-session.spec.ts. It exercises actual Engine receive/evaluateDue/decide, Ticket creation, DshExecutor queued effect, launch/prepareDirectory, real disposable Git/non-Git snapshots, fake Sessions ensure/prompt, isolated preview and idempotent core reply. It does NOT call actual DSH Sessions/AgentDelivery, Worker turn/model or genuine Weixin.
- P3 added src/local-first/real-apply-contract.ts plus tests/real-apply-contract.spec.ts: ONLY a pure proposed-plan rejection filter. It has no file I/O, authorization capability, helper, real Apply or rollback. The original C6B2B6G product baseline and OL-040 acceptance remain closed.

## Authority and stop rules

The operator must manually instruct the local Agent to take OL-20261118-041. Check LOCAL_AGENT_TASK.md for that EXACT task and write an at-most-once claimed receipt before running. No automatic dispatch from the paused online scheduler, changing Git HEAD or a DSH timer. If already claimed without a done receipt, stop and reconcile instead of retrying.

Allowed without new host grant: disposable offline fixtures, local package/build/test execution, private read-only snapshots of host status, read-only analysis and synthetic macOS filesystem experiments confined to fresh temp roots. Do NOT send a genuine Weixin message, perform session/prompt on the original 3080, restart/reconfigure 3080/3083/8123, modify any original DSH Session/Workspace/DB/provider/default, contact cloud inference, update an original registered project or run ANY real source Apply.

All private evidence stays in a NEW owner-only 0700 directory outside the repository and real projects. GitHub is PUBLIC: never push real file paths, log dumps, raw Session/Workspace IDs, Weixin peer/message IDs, context tokens, tokens, secrets, config JSON, original project hashes or host identifiers. Keep only sanitized counts and synthetic project names.

**Stop and report BLOCKED** for mismatched SHA/CI, any unexpected live service or source drift, ambiguous project identity, dual scheduler actually dispatching, request for an unauthorized host operation, failed synthetic containment, uncaught credential output, or an unreviewed real-host change. Do not attempt automatic repair or retry of ambiguous transactions.

## Stage A: private read-only baseline

1. Independently verify source SHA, full CI #516 job result and actual named test lines on both OSes. Verify task ID uniqueness, message source and absence of unprocessed older tasks.
2. Read-only inventory of running Mac: versions of macOS, Node, pnpm, git, DSH; 3080/3083/8123 listener/process status; relevant original DSH Workspace/Session aggregate counts (never IDs); 3083 relay default OFF; selected original provider/model default equality before/after; queue proxy status and current scheduler/old launchd duplicates. Do not change, restart or query private Session history.
3. Create a detached clean worktree at exact source SHA in a brand-new disposable parent; keep production checkouts untouched. Capture private baseline snapshots and the SHA of this worktree. Use separate private report-only worktree later for publication.

## Stage B: maximal OFFLINE suite (no service changes)

From the detached source worktree, run these tests and save only redacted aggregates:

    git rev-parse HEAD
    pnpm install --frozen-lockfile
    pnpm check
    pnpm exec vitest run tests/local-ticket-worker-preview.spec.ts tests/local-ticket-worker-session.spec.ts tests/real-apply-contract.spec.ts
    node --experimental-strip-types --test tests/handoff-convergence.node-test.mjs

Also run the exact Node tests and proxy commands from BOTH local-first-core and macos-portability jobs in .github/workflows/local-first-core.yml; do not substitute an unreviewed glob or skip a newly added suite. Repeat the isolated I1A/I1B/P3 targeted run three times sequentially on Mac (or explain why impracticable). Record exit code, named test count, per-run duration and failures.

Per-case evidence checklist:
- Actual Engine Ticket/Executor Effect launch into genuine disposable non-Git snapshot, fake Session envelope, three-file preview, source byte/mode invariant, one core Outbox reply.
- Clean Git offline clone with no origin; Git fixture remains clean while Worker copy changes.
- Duplicate Trigger/stale launch, cancel-before-launch, missing/unknown project, dirty Git root and counterfeit workspace must all fail closed.
- P3 contract digest stability, path traversal/aliases/secret rejection, metadata/mode/byte limits, non-authorization invariant.
- Imported historical 3080 project/Session selection fails closed; a title or recency must never create an unrelated snapshot Worker.
- Where feasible, add a local OFFLINE adversarial probe for restart/replay, Session mock failure, source drift, symlink/hardlink/special file, case aliases and unsafe subprocess attempts. Use existing exported code, no real host. Mark NOT_TESTED for unavailable steps; do not alter remote-owned source.

All assertions about source equality must cover bytes, modes and unexpected add/delete changes. Tests using a fake SubprocessRuntime exit 1 do NOT prove real credential guard or OS sandbox; record this explicitly.

## Stage C: macOS P3 OS feasibility (disposable temp files ONLY)

Review docs/014-real-apply-boundary.md and REAL_APPLY_GATES.md. Investigate descriptor-relative no-follow walks, stable root fd and inode identity, ancestor replacement/ABA, case-insensitivity, symlink/hardlink, ACL/xattr/flags, noncooperating writer isolation, fsync/journal transition and kill-at-step recovery on synthetic root ONLY. Negative experiments must be bounded, reversible, unprivileged, and may never point into an operator project/home credential/session tree. Do not claim power-cut durability from ordinary process kill. If an OS isolation/writer-quiescence guarantee is absent, report a BLOCKER, never relax real Apply gates.

## Stage D: optional real I2/I3 — HARD PRIVATE APPROVAL BARRIER

**DEFAULT is NOT_AUTHORIZED.** This task DOES NOT AUTHORIZE any live host operation. Even if Stage A–C pass, real I2 requires BOTH full Gate I1 independently accepted (not just the new fake-host 7/7) and a NEW direct human-approved private grant binding disposable project, exact Session/Workspace, time window, allowed actions, model route and rollback. Without both, report I2_BLOCKED_GATE_OR_GRANT and STOP; do not infer permission from this file.

If all gates are independently satisfied, one separately approved I2 may run a real DSH Worker only in an isolated new disposable project copy, with verified workspace-write and local-only model route, create reviewable diff and STOP BEFORE SOURCE APPLY. Preserve original 3080 historical sessions, service configurations and global defaults. Any unexpected drift stops without retry.

I3 is yet another independently approved one-shot real native Weixin peer/context/Session grant, after I2 pass; one true inbound message, one correlated project Ticket/Worker review result and one guarded native Outbox reply, no source Apply. C5.5B prior grant was consumed and may NEVER be reused. 3083 must be restored to original configuration/relay OFF after that separately approved window. No I3 grant = I3_NOT_AUTHORIZED, not a failed offline OL-041.

**Real registered-source Apply is forbidden throughout OL-041**, including single file. P3 source is proposal-only. No permission to modify the original 3080 LAN owner-access model or ports.

## Stage E: invariants, publication and exact result

After each stage compare PRIVATE read-only 3080/3083/8123 listeners, process identity and model defaults, historical Workspace/Session aggregate counts, sources, staging state, queue behavior and services against baseline. Do not alter old state to make the comparison pass. Close synthetic fixtures; never clear an ambiguous journal or a consumed grant. If and only if a separately approved staging step changed a disposable setting, follow its exact authorized rollback and record proof.

Publish one sanitized report at agent-reports/REPORT-ol041-i1b-mac-batch.md, plus one unique message agent-handoff/messages/to-online/2026-11-18-lo041-integrated-mac-batch-done.md and local claimed/done receipts for OL-20261118-041. Use a CLEAN report-only worktree from the latest remote feature HEAD; stage only report/message/receipts and inspect staged privacy and diff. Fast-forward normal push only; never force or edit product code. Give a short status, GitHub report URL and commit; operator need not copy the report.

Required report sections: exact source/CI SHA, stage-by-stage PASS/FAIL/BLOCKED/NOT_TESTED, commands/versions and named test counts, repeated-run results, I1A/I1B/P3 evidence, per-case negative matrix, Git/non-Git unchanged-source proof, actual Sessions/Worker/model/Outbox limitations, macOS P3 OS findings, optional I2/I3 grant/execution status SEPARATELY, production pre/post invariants, cleanup/rollback, one-shot receipt graph, sanitized security review, exact next remote code tasks.

Verdict ALL_OFFLINE_PASS is valid when A–C fully pass even if D was NOT_AUTHORIZED. Never claim REAL_I2_PASS or REAL_I3_PASS without independent genuine host evidence and scoped grants.
