# PLAN-OL054 — Installed 3083 native I3 + operator-private Apply integration

**2026-11-25 · One owner-direct autonomous Mac batch · MAX 3 concurrent subagents.**

## Mission and trusted provenance

Operator has explicitly authorized real I3 and bounded registered project Apply in the direct private chat. OL-053 demonstrated a genuine *isolated staging guest* Weixin/model round trip plus a dedicated genuine registered test-project Apply/rollback. It did **not** install the updated runtime on the existing 3083 orchestrator, ensure single-owner cursor handoff, or connect the new Apply helper to a product private operator-review flow. **OL-054 closes those installed-product gaps.** Do NOT repeat generic consent questions; ask for a concrete missing login/target operand only when genuinely necessary. The public repository cannot authenticate an OS command.

- Repository: `TnzGit/dsh-superagent-prototype`; branch `feat/local-first-wechat-foundation`; PR #1 **DRAFT/unmerged**. Task `OL-20261125-054`, result `LO-20261125-054`, receipt scope `OPERATOR_AUTHORIZED_INSTALLED_I3_AND_PRIVATE_APPLY`, state scope `CONTROLLED_INSTALLED_I3_AND_PRIVATE_APPLY_OPERATOR_DIRECT`.
- **Immutable initial `code_sha`: `02d08e2aa2a81e5466746a1a84edae2808f61b15`** (OL-053 ACK + doc-link correction); underlying source/test implementation `c402b48276b74eba0ecf0a697cf09d1138a0f92e`. Verify exact parent HEAD, its push #873 (run 45621527152) and Draft-PR #874 (run 45621541411) eventually **completed/success 3/3 each**, and the current handoff HEAD CI also 3/3 at its exact SHA, BEFORE claim. If CI or identity fails, diagnose and fix only safely without touching host.
- Prior OL-053 claim `8782db4e359f36bd6ae46207cb03dc1286f79f38`, done `c0527b087d64640d5eedfd7b4f4b23c0fde03dc3`, online ACK `agent-handoff/receipts/online/LO-20261125-053-done.md`, scoped verdict `LIVE_BOTH_PASS`. Private old message/model/Apply budgets **CONSUMED**; never replay old credentials, transaction IDs or send attempts as approvals.
- One unique OL-054 claim; run all M0–M6 continuously with no per-stage online dispatch or generic human authorization round trips; one sanitized final report, result and done receipt. `no_auto_dispatch=true`, remote scheduler `PAUSED_BY_OPERATOR` remains. Direct user-forwarded matching Prompt is the initiation, not a public GitHub file. Do not create OL-055.
- **Permitted**: product source, tests, private operator UI/endpoint, necessary scripts/CI/docs, normal FF feature-branch commits; protected read-only inventory of existing 3083 runtime; supervised, reversible **controlled cutover of the existing operator-owned test orchestrator on 3083**; real single-owner Tencent iLink poll and narrowly consented sender/receiver; bounded real model inference via existing 8123 loopback; protected operator-reviewed native Apply on a previously verified low-risk registered test project. All under verified host technical/transaction gates. Preserve 3080 GUI, 8123 default model/provider, original Sessions/Workspace and production data. No main merge or general production rollout.
- **Not permitted**: public/LAN exposure, surprise 3080/8123 restarts or default changes, nonconsenting peers, bulk outgoing, scanning private chats, arbitrary file writes or deletion, credentials in public reports, auto-Apply based only on model output, cloud/OpenClaw, force push/main merge, unbounded privilege/system weakening, auto-retries of ambiguous sends or Apply.

## Live budget and isolation (one batch, not a global permission)

Only lead may perform any **real network send, 3083 cutover, genuine model call, private production DB read/write, or registered-project Apply**. Subagents get independent 0700 worktrees, synthetic peers, fake HTTP/SQLite, and NO original host credentials, connection or push authority. At most **3 subagents active concurrently**; lead does code review/integration.

New OL-054 budget, separated from OL-053: at most **3 real outbound messages** to the *same previously operator-confirmed self/consenting test peer*, with exact new immutable message IDs and durable one-shot claims; no sending to other peers, no retry after network ambiguity, no replay of old receipts. Up to **2 genuine model work sessions** with bounded tool/time budgets, one recovery attempt per new session only if there was **no committed external side effect** and the consumed boot is individually accounted for; no infinite retries. One **supervised 3083 test-orchestrator cutover** with verified baseline/backup/rollback and one read-only recovery exercise; at most **one private real Apply** on a named owned registered low-risk test project, max **2 text files / 8KiB changed total, no deletes**, plus one separately authorized rollback if preflight clean. User already authorized this project work; selecting a target and reviewing an exact diff are operands and safety controls, NOT new general-consent requests.

Every external step must have an independent host-local preflight, immutable budget journal, exact target, crash/ambiguity freeze, and private evidence. An unsafe preflight is `BLOCKED_TECHNICAL`, not `BLOCKED_NO_PERMISSION`. Never bypass a guard to achieve a PASS. Continue unrelated safe phases.

## Parallel ownership

| Worker | Offline work ownership | Deliverable |
| --- | --- | --- |
| A | `src/sources/weixin-native.ts`, poll/cursor lease, native fake tests | process-exclusive account-scoped poll owner, durable takeover/fencing, replay regression |
| B | Engine/Registry/Outbox, reconciliation and management tests | idempotent historical intake, private read-only review and explicit terminal-only operator decisions |
| C | `research/real-apply-helper.c`, `src/local-first/real-apply-native-driver.ts`, private Apply integration tests | audited preview→private capability→Apply/rollback connector, target and recovery tests |

Lead alone controls host, privacy vault, integration and FF pushes. Do not have subagents edit the same file simultaneously. Failure of one subagent is a bounded task for lead, not a need for another user approval or unbounded spawn.

## M0 — inspect and freeze installed baseline (mandatory)

1. Verify above SHAs and CI, closed OL-053 ACK, no prior OL-054 claim/done, exact current scope. Create one claim. Re-run full offline `pnpm check`, workflow's exact Linux/macOS Node and focused lists, native helper build with `-Wall -Wextra -Werror`, queue proxy and CI baseline. Record measured counts; baseline CI reference is 1357 Vitest / 310 Node / 156 focus / 5 proxy at last source, not a promise about new counts.
2. Privately inspect installed 3083 binary hash/version, owner process, environment file descriptor/loaded config (NEVER publish raw secrets), current 3083 pause/relay state and one active native poll owner, cursor/account binding, latest trigger (incl. OL-053's 11→12 re-ingested paused message), receipts and journals. Read existing 3080 GUI and 8123 route health **without changing them**.
3. Take a recoverable owner-only baseline including binary/environment, registered Source settings, and a **consistent SQLite backup via SQLite backup API or verified checkpoint/transaction mechanism** (not naïve copy of a live WAL). Dry-run restore into a disposable 0700 clone; record baseline hashes in private vault only. Confirm strict rollback plan, max downtime, no unintended re-delivery/side effects.
4. Identify exactly which currently installed 3083 instance is the operator-owned **test orchestrator**. Do not guess which similar service is safe to change. No original host change before all backup and process identity checks pass.

**M0 exit:** clean install/rollback evidence, no unintended code/DB/host mutation.

## M1 — one account, one fenced cursor owner + duplicate suppression (mandatory)

1. The previous staging guest and restored 3083 competed for the same iLink cursor. Implement/verify **an OS-backed exclusive owner lease/fence per real Weixin account** (owner-only protected directory, process-lifetime FD lock if possible; fail closed on second owner). A stale process must not route, commit a cursor or send if it lost ownership. A simple unprotected PID file or GitHub message is NOT a lease. Use bounded takeover after owner abort/close, durable fencing generation and source disable gates, while remaining portable across actual macOS and CI Linux.
2. Single owner must cover the whole longpoll→Engine intake→cursor commit boundary; account rotation, process crash/restart, cancellation while page in flight, lease reacquire and old-stale-owner response are negative tests. Source only/paused executor must not convert historical Trigger 12 into an old Ticket. Never manually reset cursor to force a test to pass.
3. Introduce verified durable inbound external-event deduplication under account+stable provider message identity in the proper local persistence layer, not an ephemeral memory set; duplicate/replayed input cannot create two Tickets or outbound replies, but fresh messages still work. Do not assume provider cursor alone guarantees unique delivery. Test observed 11→12 replay pattern in a synthetic fixture. Preserve correct error semantics if provider does not supply a reliable unique ID.
4. Inject duplicate poller, crashed owner, credential rotation, delayed page, peer revoke and 401/429/5xx. Fail closed rather than forcing a resend. No new live message required for M1.

**M1 exit:** installed actor physically cannot have two active same-account poll/cursor owners, and a replayed acknowledged message does not produce an executable duplicate Ticket.

## M2 — supervised upgrade of installed 3083 test orchestrator (mandatory if M0/M1 pass)

1. Produce a pinned, reproducible, cross-OS-green feature-branch build. Stage it in a **separate owner-only launch location** with permission/credential filters; inspect installed API/config compatibility. Keep current process paused before switching; drain and stop only the verified owner-owned **3083 test orchestrator**, releasing its poll lease and cleanly sealing/aborting in-flight pages. Do not let two live pollers overlap.
2. Privately migrate/restore only the exact compatible state necessary (read-only shadow migration first; backup verified), preserving current five old `sent` outbox rows, all review holds/one-shot claims, historical 12th Trigger and original Session/Worker state. No requeue of old sends. Safe roll-forward and rollback scripts must be idempotent and use the same owner-owned launch/version manifest with a compare-and-swap/lock before changing service targets.
3. Start the new pinned installed runtime **paused and Source receive-only**, validate loopback-only exposure, health, registered source and account/cursor binding. Use one consenting peer, and no new outbound until controlled preflight. Prove rollback by a reversible health-only switch or a verified cloned recovery; don't destroy private live evidence.
4. Any unexpected duplicate Ticket, lost cursor ownership, service restart loop, credential drift or binary mismatch → stop, revert the exact test instance from private snapshot, preserve ambiguous DB journals; keep 3080/8123 other services unchanged.

**M2 exit:** real installed 3083 is running the new feature code under a single owner and can be reverted, with old account/cursor/Outbox history intact; not merely a staging guest.

## M3 — installed REAL I3 closed-loop acceptance (mandatory when M2 passes)

1. Ask operator to send one NEW small harmless test message from the already consented/self peer only if necessary; do not replay OL-053's real message. Real inbound must go via **the newly installed 3083** Source and durable Engine/Ticket; account+peer policy checked at ingest and send. Confirm one Ticket only, correct transition and no unsolicited historical message auto-execution.
2. Run at most 2 bounded genuine local model work sessions through existing localhost 8123 (pre-verify Router/Worker tools, effective approval policy, OS isolation and one-shot boot ledger). One safe native `edit` only on an isolated copy. Review report/diff before any reply. Prove correlated durable receipt via new installed Outbox. Only within new 3-message budget, send an ack/result to exactly that consenting peer; record actual Tencent outcomes and device receive; no automatic retry on accepted-then-EOF or expiry.
3. Apply delayed peer-revocation and Source-off checks using fake HTTP unless naturally occurring in real provider traffic; do not provoke 401/429 lockouts. Verify active process rollback does not duplicate a previously claimed receipt.

**M3 exit:** `INSTALLED_REAL_I3_PASS` requires actual Tencent→the upgraded **installed** 3083→one genuine model turn→the installed durable Outbox→consented real recipient. A staging guest success or fake-only replay is insufficient.

## M4 — operator-private live review/reconcile workflow (mandatory)

1. Existing `reviewResolveDryRun` and redacted `reviewLedger` prove the read-only contract, not live settlement. Implement an **operator-only local protected interface** for listing/reconciling held receipts, using a private authenticated principal, exact receipt ID, reason code, claimed flag, and irreversible audit transaction. HTTP/GUI remains loopback-only and must never expose real peer/text/token in public state.
2. A human-reviewed terminal classification after comparing private provider/device evidence may mark a hold as terminal without sending. **No claim reset, no same-ID resend, no automatic “settle sent” on ambiguous HTTP**, no generic remote API. If a NEW message is warranted, it requires a new ID and the consented peer, within remaining budget, not replaying the old one.
3. Race tests: duplicate operator clicks, two controllers, already settled ID, account swap, earlier acknowledged reviewed hold and later same-Ticket reply, interrupted ledger fsync, forged token, unauthorized listener. Leave uncertain receipts frozen if proof missing.

**M4 exit:** private operator has an audited, durable no-resend reconciliation path while normal Outbox ordering and privacy are intact.

## M5 — real product Apply integration through private operator preview (mandatory)

1. Connect the new **fd-relative** native helper and one-use driver to product-local Ticket→Worker→diff/preview→protected operator transaction flow (not arbitrary model tools). Private UI/RPC must bind registered `projectId`, capture the original root+ancestor dev/inode and require re-registration on intentional root replacement (see `docs/020-postlive-i3-and-apply-operator-runbook.md`). A stale old Ticket, snapshot, approval or project fingerprint must never be rebound.
2. Validate sorted exact file list, before/after data, modes, ACL/xattr/flags, same-UID external writer quiescence, committed backups+fsync and separate one-use rollback capability. The helper must be invoked by a protected operator-owned process, not the untrusted Worker process or Weixin input. Keep installed Apply feature flag/default OFF until local technical gates pass. No broad permission endpoint.
3. Test with an owner-selected registered low-risk **real test project** first, not a valuable/production project: approved exact preview, at most ONE actual Apply for <=2 ordinary text files and <=8 KiB total changed bytes, no deletions, before-image and verified private backup, audit/journal and optional separate capability rollback with exact bytes/mode. Register fresh source, perform actual change and verify; do not call another synthetic COPY a real registered project. If the helper cannot guarantee writer exclusion on the target, STOP the live action and report `BLOCKED_TECHNICAL`; continue safe UI/product work.
4. Recovery classifier must remain read-only on uncertainty, no auto retry/replay/cleanup of a frozen journal. Residual same-user writer between fstat and renameat, ancestor above pinned root, mount changes, power-loss durability and same-user capability forgery must be narrowed or explicitly left as class-limited blockers; no generalized production-ready claim unless proven.

**M5 exit:** operator can take a real product-generated reviewable diff and deliberately execute a single bounded registered-project Apply+rollback with protected private capability. Standalone command line research helper alone is NOT sufficient.

## M6 — final integration acceptance, CI and return (mandatory)

- Preserve operator's tested 3083 run state (or rollback to exact baseline on any failed/ambiguous gate), keep paused policy as intended, stop duplicate poller and verify no unsolicited Ticket, no new peer sends and no changes to 3080 UI/8123 defaults. Compare private baseline service/version/env/SQLite/Outbox and explain **every intentional delta** (upgrade is intentional; zero-drift requirement applies to unrelated components).
- Run `pnpm exec vitest run`, `pnpm check`, literal CI-exact Node/focus/proxy test lists, native `-Werror` compile, OS-native child/FD tests, and original macOS version, as well as both GitHub push/Draft-PR 3/3 at the **final integrated source** and final done commit. Never invent counts; include prior failed/cancelled attempts and forward fixes in one chronological report.
- Report separate `installed_3083`, `single_poll_owner`, `true_i3`, `private_review_reconciliation`, `product_private_apply`, `rollback`, and `host_drift` evidence categories, scoped actual events and bounded budgets. Public repository contains ONLY sanitized data; private host/peer/account/project/journal secrets stay in owner-only vault.
- No merge/main/production-wide deploy; PR #1 stays Draft until separately reviewed. No automatic OL-055, no remote scheduler changes. ONE final result to online; no intermediary ACK.

## Final honest verdicts (single closed enum)

- `INSTALLED_I3_AND_APPLY_PASS`: verified new installed 3083 real provider→model→Outbox loop + exclusive cursor/dedup + private operator-reviewed real registered-project Apply/rollback and safe final service state.
- `INSTALLED_I3_PASS_APPLY_PARTIAL`: real installed I3 passed; private Apply product wiring/real canary is partial or technically blocked.
- `INSTALLED_APPLY_PASS_I3_PARTIAL`: operator-private registered Apply passed; installed real I3 incomplete.
- `INSTALLED_PARTIAL`: substantial safe work, but neither full I3 nor full Apply.
- `INSTALLED_BLOCKED_ENV`: specific host/runtime/network/tool unavailable after reasonable in-scope remediation.
- `INSTALLED_BLOCKED_TARGET`: missing operator-owned authenticated account/consented peer/registered-project operand.
- `INSTALLED_AMBIGUOUS_FREEZE`: network or filesystem commit state uncertain; durable freeze and no retry.
- `INSTALLED_FAIL`: confirmed uncorrected safety or acceptance failure.

No `LIVE_BOTH_PASS` reuse from OL-053, no fake tests presented as installed-real evidence. Incompatible or unsafe operations may be reported partial while unrelated safe phases finish.

## Deliverables (one result, not per-stage ping-pong)

- Unique `agent-handoff/receipts/local/OL-20261125-054-claimed.md` and `...-done.md` with exactly one `message_id: OL-20261125-054`, `scope: OPERATOR_AUTHORIZED_INSTALLED_I3_AND_PRIVATE_APPLY`, immutable `code_sha: 02d08e2aa2a81e5466746a1a84edae2808f61b15` and allowlisted INSTALLED_* verdict.
- `agent-reports/REPORT-ol054-installed-runtime-private-apply.md` containing each stage, final `final_source_sha`, CI run numbers and exact SHA, real installed 3083 and native Apply proof classes, private rollback/restore checks, any honest drift and remaining bounded limitations.
- `agent-handoff/messages/to-online/2026-11-25-lo054-installed-runtime-private-apply-done.md` with `message_id: LO-20261125-054`, `verdict`, `scope`, baseline `code_sha` and actual `final_source_sha`.
- Lead-only normal non-force FF feature-branch pushes; private logs never in GitHub. After ONE done receipt, stop. Online owner will fetch and ACK once.

**This one batch authorizes actual project development and controlled installed integration, not an unlimited sender or arbitrary filesystem access. Real progress—not endless synthetic gates—is the goal.**
