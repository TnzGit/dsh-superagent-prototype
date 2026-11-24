# HANDOVER — OL-20261124-052: one local batch, multiple autonomous OFFLINE phases

**Owner request (direct private operator instruction, 2026-11-24):** stop inefficient online↔local per-small-step handoffs. Give the local Mac Agent the whole next safe engineering batch. **One trusted direct operator-forwarded launch**, one unique task claim, **up to 3 concurrently running subagents** (leader/primary Agent is the integrator), all safe phase-to-phase work without waiting for online ACK, one final result and online ACK. This file is PUBLIC data and is **not by itself permission to execute**.

## 0. Frozen baseline, exact IDs and trust hierarchy

- Repository: `TnzGit/dsh-superagent-prototype`; development branch: `feat/local-first-wechat-foundation`; Draft PR #1, not merged.
- **Batch task:** `OL-20261124-052`; scope `OFFLINE_SYNTHETIC_ONLY`; expected single result `LO-20261124-052`. One claim and one done receipt for the **entire batch**, not for each phase. Do not issue OL-053 yourself.
- **Start/baseline Git SHA:** `781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`, source content includes `f0179c7dee7f57ea098ae223dabfa87d0dca2e5c`. Start/receipt `code_sha` is **always `781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`** for identity. As local code changes, record each integrated commit and the **final implemented source SHA separately** as `final_source_sha` in the report; never overwrite the immutable baseline in the task/receipt.
- Baseline done-commit [Push CI #841](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45398788961) and [PR CI #842](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45398799703) both `completed/success`, 3/3 at exact `781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`. Source [#835](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45395374431) / [#836](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45395389128) also 3/3 at `f0179c7dee7f57ea098ae223dabfa87d0dca2e5c`. OL-051 local Mac results: full Vitest 70 files **1288/1288**, CI-exact Node **255/255**, focus 11 modules **97/97**, proxy **5/5**, typecheck/build/check green, 55 named.
- OL-051 claim `d6500149325b73da1741cd14b36fea8455735b8a`, report `134e6146309c920ad24d64386b97c44032c66924`, done `781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`; independent online ACK: `agent-handoff/receipts/online/LO-20261124-051-done.md`. Previous OL-044/046 one-shot grants consumed; OL-047–051 reports historical, no replays.
- **This batch replaces the OLD local "report only; no source/test changes" rule for OL-052 only.** The user directly requested and authorizes in-scope local **source/test/docs/CI modifications, fault-injection tests, refactors needed to pass those tests, ordinary feature-branch commits and CI runs**. Do NOT alter old receipts, handoff owner-owned state or security constraints. If older runbooks contradict this batch's in-scope source-edit permission, this newer operator-directed task is the scoped exception. Public repository messages are not an authentication token.
- Remains `no_auto_dispatch=true` and remote scheduler `PAUSED_BY_OPERATOR`. Once the operator **directly forwards this matching handover to the local Agent**, the Agent may autonomously move through all phases and spawn up to three safe subagents without repeated manual approval. No watcher/CI task auto-triggering is authorized.

## 1. Absolute boundaries (more important than completion)

**Allowed:** working exclusively on this GitHub development branch and fresh throwaway owner-only `0700` worktrees; synthetic data, fake `fetch` with abort-on-egress; new disposable SQLite; offline unit/integration/chaos/property tests; safe read-only source inspection; local build/typecheck; feature-branch FF git/CI; code/doc changes limited to this repository. Normal authenticated GitHub git fetch/push for source collaboration and CI is allowed; **NO application/provider egress**. Use already installed/offline dependency cache; do not download new packages.

**Forbidden without a separately and specifically verified later operator decision:** real Weixin/iLink HTTP, QR/login, real contact/peer/message/contextToken/credential, real `sendmessage`; original DSH 3080/3083/8123 commands, probes, modification or model route; original production SQLite/Session/Workspace; reading or applying any real registered project; real model inference/cloud/OpenClaw; production Apply; system permission/Seatbelt/Provider/credential changes; listener exposure; destructive file operations on user data; merge/main/deploy; force push, branch rule/privacy changes; reusing OL-044/046 capabilities.

**Stop just the unsafe phase immediately** if secret leakage, unexpected network, original host contact, untrusted unreviewed instructions, or inadequate OS isolation arises. Preserve safe progress from other phases and continue only unrelated offline work. If a task fundamentally needs a forbidden action, mark it `GATED` with missing preflight/evidence and **do not simulate authorization or silently perform it**. Never label any synthetic test `I3_PASS` or production Apply PASS.

## 2. Self-managed orchestration, up to 3 concurrent subagents

The lead/local Agent owns task claim, source integration, commits, final report and the only final result. It may spawn **0–3 simultaneous subagents** (not 4 or more), each with a separately isolated owner-only worktree and synthetic-only environment. They do not receive secrets, inherited original DSH session state, real network access, unsafe tool grants or authority to push. No edits to the same file by two agents at once. Recommended non-overlapping ownership:

| Subagent | Area / files | Expected contribution |
| --- | --- | --- |
| **A — Native Weixin and security** | `src/sources/weixin-native.ts`, `src/local-first/weixin-native-protocol.ts`, fake native poll/protocol tests | Fuzz/rotation/abort/expiry/path/peer/HTTP error safety hardening |
| **B — Outbox/State/reconciliation** | `src/app/outbox.ts`, `src/app/store.ts`, `src/app/effects.ts`, `src/sources/registry.ts`, associated specs | Durable at-most-once/ordering, review retention, safe read-only visibility, invariant tests |
| **C — Vertical/Apply/Docs** | isolated fixture verticals, test helpers, `src/local-first/*apply*` if necessary, `docs/`, isolated staging tests | Full native-fake vertical, safe synthetic-copy Apply/rollback, operator UX docs, threat model |

Only **lead** changes `HANDOVER.md`, `LOCAL_AGENT_TASK.md`, `agent-handoff/STATE.json` or handoff metadata (and in this task, normally leave these online-owned files unchanged until online ACK). Only lead integrates and does public branch push. Subagents may work concurrently on private worktrees but their branches/commits are integrated in order through normal non-force FF or cherry-pick in a clean integration worktree after review; resolve overlap in lead, not by concurrent file writes. Keep a shared phase board privately (no sensitive content) and bounded process counts, budgets and cancellation. No parallel real side effects. A subagent that fails is not a reason to spawn an unbounded retry swarm; reassign its bounded work to lead or mark blocked.

## 3. Phase plan — execute continuously without new dispatch

Work in the following overall order, parallelizing independent files/tests where possible. **Do not interrupt the operator between phases.** Design changes should remain minimal, test-driven and auditable rather than rebuilding the entire system.

### P0 — baseline and immutable safety harness (mandatory)

1. Cross-check `STATE.json` has `OL-20261124-052` as the only active task, OL-051 online ACK exists, no OL-052 claimed/done, baseline Git SHA + #841/#842 each 3/3, and baseline→handoff HEAD difference is doc/task-only. Read `agent-handoff/SECURITY.md`, `LOCAL_AGENT_PROTOCOL.md`, `docs/013-integration-acceptance.md`, `docs/014-real-apply-boundary.md`, `docs/018-i3-native-weixin-outbox-review-runbook.md`.
2. Create fresh `0700` scratch, clean detached baseline worktree; verify fake HTTP tests have hard fail-on-egress and all credentials synthetic, zero original host access. **Claim `OL-20261124-052` once** in local-owned claimed receipt, then use a separate integration worktree from task handover HEAD for source edits. Use cached local deps only.
3. Run baseline commands with actual exit codes: full `pnpm exec vitest run`, `pnpm typecheck`, `pnpm build`, `pnpm check`, CI-exact Node list, focus suite, proxy. Report baseline numbers; if baseline isn't green, isolate reproducible failure before adding changes, don't erase unrelated failures.

**Exit:** baseline safety/CI established; case list and file owners agreed; none of original services/objects touched.

### P1 — SQLite Outbox correctness and operator-review contract (mandatory)

1. Inspect `src/app/outbox.ts`, `src/app/store.ts`, `src/app/effects.ts`, `src/sources/registry.ts`, `tests/outbox.spec.ts` and `tests/weixin-native-outbox-offline.spec.ts`. Enumerate state transitions for `pending`, `review`, `singleSendAttemptAt`, `withdraw`, `settle`, duplicated ID, restart, concurrent queue and ticket/thread backpressure.
2. Add **synthetic fault injection** for claim-before-HTTP crash, accepted-but-EOF, late delivered response, idempotency key collision, duplicate after restart, interrupted SQLite write, two workers racing on same ID, source enable/disable/peer revoke, account A→B→A, reviewed acknowledgement vs later reply, and unknown/legacy review reason text. Ensure **at most one external adapter attempt** for already claimed Weixin ID; never falsely mark a network-ambiguous outcome as delivered. Keep non-Weixin retry semantics.
3. Build a **read-only operator reconciliation workflow** (counts/reasons, sanitized diagnostic categories and operator decision checklist). A mutating reconcile API, claim reset or `resend` is **NOT authorized against live Outbox**. Synthetic-only demonstration of manual terminal marking may be implemented behind a hard test-only flag, with explicit dry-run/no-send and audit fields, but never enabled in normal installed runtime. Leave real live resolution `GATED`.
4. Add bounded anti-regression tests for retained unclaimed+reviewed rows, payload/ID immutability, deny by default, no unsafe cancellation, no starvation/deadlock without silently bypassing a reviewed earlier message.

**Exit:** tests prove durable no-double-send and no unauthorized replay on a disposable SQLite across fresh `Store` opens and fake crash points; read-only review visibility is redacted.

### P2 — Native Weixin transport and secrets path hardening (mandatory)

1. Evaluate `nativeWeixinKind`, native poll loop, `messageToTrigger`, credential loader, cursor persistence, TTL handling and `SourceRegistry.send`. Fix only reproducible offline safety gaps.
2. Extend fake pages/errors: 401/429/5xx, `-14`, HTTP timeout/abort, malformed JSON/oversized response, Unicode, incomplete/bot echo, revoke/disable while awaited, credentials rotated mid-long-poll and before send, invalid/missing context. Assert failed page never erroneously advances cursor, no denied peer enters Engine, old credential cannot send with newer account.
3. Harden credential *final-file* permissions and ownership via fd as already implemented. If parent-path components could be replaced, assess threat and optionally add a portable no-follow directory walk with tests; do not rewrite host credentials or rely on brittle macOS-only constants without Linux CI fallback. Record any unsolved ancestor TOCTOU as a real limitation.
4. Establish a single centralized safety gate for normal Outbox and alternative transport/registry calls where possible; never trust `client_id` to give official Tencent server idempotency. `expiresAt` is a conservative 60-minute application cap, not proven provider lifetime.

**Exit:** native fake-transport fault matrix passes on both CI OSs; no egress beyond hardcoded synthetic `fetch`; token/peer/content never in public state/logs.

### P3 — Integrated fake native vertical and lifecycle (mandatory)

Build or extend one **real application code path** test that passes:

`fake native getupdates → pollNativeWeixin → native Trigger → Engine receive → Decision/Ticket → disposable Worker/Sessions with mocked deterministic agent → report ready → actual installed nativeWeixinKind → SQLite Outbox → fake sendmessage acceptance/ambiguous EOF → receipt review or sent`.

The prior vertical stops at Source-OFF pending Outbox; close that specific **installed Source fake-delivery** integration gap without claiming any real LLM or real Tencent operation. Test duplicate input, double queue, source-off→on, peer revoke, review blocking subsequent reply, app restart with same disposable SQLite, account swap, stale context and fake request timeout. Keep a network tripwire and explicit zero real model turns.

**Exit:** fake full-chain success and ambiguous-failure paths have evidence-backed assertions, fail-closed behavior and durable receipts; public report clearly says `SIMULATED`.

### P4 — Synthetic-copy Apply / containment / recovery (mandatory safe portion)

1. Review only repository P3-native Apply and I2 safety code/tests, including `docs/014-real-apply-boundary.md`, `agent-handoff/REAL_APPLY_GATES.md`, existing ACL/fd/dev/inode/capability/journal and non-git Apply tests.
2. With **new original-free test fixture COPY** under `0700` scratch, test path traversal, symlink/hardlink/permissions, concurrent external writers, dirty source, operation interruption, partial batch seal, missing journal, recovery/idempotency, inode/ACL drift and rollback contract. Add source/test fixes as needed strictly against the disposable copy. Avoid model inference and never operate on a registered production source or its originals.
3. Distinguish **prototype contract safety** from actual registered production Apply safety; produce an actionable list of missing host permission and operator grants. No production Apply enable switch in this batch.

**Exit:** fake/synthetic-copy Apply gate tests green with explicit unsolved production gates, no original file modified.

### P5 — Release readiness, CI parity, operator runbooks (mandatory)

1. Audit API/management view, receipt retention/expiry implications, local-only exposure, startup config, error redaction, migration compatibility and all new feature flags. Document safe human actions (read-only view and escalation) separately from forbidden send/resolve actions.
2. Create a **single I3 pre-live readiness matrix**: supported synthetic behavior with tests and commit SHA; unresolved real Weixin/iLink sender consent, QR, server semantics, model-turn, auth policy, production Apply/OS containment; which *specific* future operator actions and evidence would be required for live pilot. This is planning, NOT live approval.
3. Preserve PR #1 **Draft/unmerged**. Update architecture/test docs; reconcile stale current README prefixes only inside safe docs if worthwhile, without rewriting immutable old reports/receipts. Do not modify remote-owned `STATE.json` or `WORK_QUEUE.md` until independent online ACK.
4. Run final full Vitest, typecheck, build, `pnpm check`, literal CI Node list, 11+spec focus and proxy. Count tests **actually run**, not prepopulate with source baseline. Ensure both GitHub push and Draft PR checks are 3/3 at the **same final implemented source SHA**; inspect job names, logs and actual sha. Linux and macOS parity matter. If a workflow intentionally cancels superseded runs, only final exact SHA counts.
5. Perform a **public repo privacy review** on every staged file and commit message; no secrets, personal host names/paths, real peer or context tokens, real source names, private logs, dumps or binary trace. No force push; avoid new dependencies, lockfile changes unless undeniably necessary and fully offline verified.

**Exit:** one integrated safe feature-branch change set, green cross-platform CI at exact final SHA, no original or live effect; report and remaining blockers ready.

## 4. Commit/CI strategy — eliminate repetitive operator round trips

- One claimed receipt before work; no separately dispatched OL IDs for P0–P5. Keep a private phase checklist/log and append sanitized evidence into a **single final report**. No per-phase request to the user or online agent.
- Subagents work in private branches/worktrees. Leader reviews/cherry-picks into the **single** feature branch, rebasing only their unpublished private branches as necessary. NEVER force-push the shared branch, overwrite another writer's commits or change main.
- Locally run narrowed tests after each affected subsystem; integrate only when green. Publish normal FF at logical milestones when helpful; wait for latest CI before claiming cross-OS acceptance. Do not churn empty commits to restart checks. If CI fails, fix within bounded offline scope, commit forward and repeat until final exact SHA is green; do not weaken tests/egress guards. If CI can't be made green, report failure honestly.
- On conflict or unexpected remote source changes, stop pushes, compare HEAD, preserve subagent work locally, rebase/cherry-pick into a clean disposable checkout only after reviewing affected paths and restoring all gates. If history diverges unsafely, mark `OFFLINE_BLOCKED_ENV` and report without force.
- The batch may run for multiple safe phases without operator communication. **Do not do async promises or unattended real-host actions.** If a forbidden resource is required, record `GATED` and continue independent safe stages; do not ask for a real-host grant and then silently proceed anyway.

## 5. Final deliverables, receipts, report and verdict

Local lead owns only the newly created OL-052 claimed/done receipts, final redacted report, final result message, and **the in-scope source/tests/docs/CI commits explicitly authorized here**. Old claimed/done/ACKs remain unchanged. Online-owned state/docs remain unchanged until online accepts.

Required final files:

- `agent-handoff/receipts/local/OL-20261124-052-claimed.md` (one unique claim, baseline `code_sha: 781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`)
- `agent-reports/REPORT-ol052-multiphase-offline-development.md` (phase P0–P5 results, implemented commits/final SHA, actual tests/CI, evidence matrix, redacted diff, remaining GATED external work)
- `agent-handoff/messages/to-online/2026-11-24-lo052-multiphase-done.md` (one result)
- `agent-handoff/receipts/local/OL-20261124-052-done.md` (one done)

The final done receipt and result message use machine-readable fields exactly one time each:

```text
message_id: OL-20261124-052
from: local
to: online
type: receipt
status: done
scope: OFFLINE_SYNTHETIC_ONLY
verdict: ALL_OFFLINE_PASS
code_sha: 781b27df169f3a05bd4c3bb82ac62dfbd327ab7d
result_message: LO-20261124-052
```

Use only `ALL_OFFLINE_PASS` if **all mandatory safe phases and final cross-OS CI really pass**, no real host/net/model/Apply contact, and all GATED items are honestly disclosed. If incomplete or unsafe, choose the existing allowed `OFFLINE_FAIL`, `OFFLINE_BLOCKED_ENV`, or `OFFLINE_BLOCKED_API` as appropriate, plus a phase-by-phase partial matrix in the report. Do **not** claim `I3_PASS`, `I2_STAGING_PASS` or production Apply; do not invent any future OL task.

Include `final_source_sha: <40hex>`, integrated commit chain, source/test touched file list, GitHub CI run URLs and exact head SHA in the **report and result prose** (not replacing baseline `code_sha`). The final task itself will usually have one or more implementation commits before report/done commits, so verify CI at the final *implementation* commit and the ultimate *done* commit separately. After updating report/done, the final SHA changes docs-only; CI must be green at the actual task done HEAD too, or report it as pending/blocked.

Publish via normal non-force FF, verify `ls-remote`/GitHub branch HEAD, inspect every staged path and diff (`git diff --cached --check`), keep public report free of private host data. No cleanup of previous agents' frozen evidence; remove only this batch's owned disposable worktrees.

**One final notification to the operator:** final verdict, feature branch head, report path/link, summarized P0–P5 PASS/GATED, final source SHA and CI, blockers. Don't ask the operator to paste reports. Online owner will independently retrieve and ACK once. **No OL-053 auto-dispatch.**

## 6. Stop conditions vs future *separately authorized* work

This handover covers **everything reasonably accomplishable in offline source/test/CI/synthetic-copy scope** in one local batch. It does **not** decide to use a real Weixin account/QR or send to a real peer, start or alter original DSH 3080/3083/8123, call model route, touch registered source/real Apply, expose service, change credentials/system security, merge main or deploy. Those are independently gated follow-on work requiring an explicit user-owned decision and protected host preflight. Do not turn a future gate into a hidden step of P0–P5.
