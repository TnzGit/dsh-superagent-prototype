> **CLOSED/HISTORICAL — 2026-11-27:** OL-055 accepted `RC_READY` strictly for its bounded installed TEST 3083 release candidate. Final source `89090b3eb02844030a592d8d87e500471599b2b7`, done `cf866a98b3d15b63d154272b22a57fa588039a6f`, ACK `agent-handoff/receipts/online/LO-20261126-055-done.md`. **No active local task; never rerun this plan or its old send/model/Apply/maintenance ceilings.** Use `docs/024-rc055-acceptance-and-release-boundaries.md` for release review, not auto host execution.

# PLAN-OL055 — Installed runtime stabilization, operator UX and release candidate

**One autonomous operator-direct macOS batch, 2026-11-26 · Up to 3 subagents concurrently · No intermediate handoff.**

## 0. Objective: make the proven installed product dependable and maintainable

**Do not re-prove OL-053 staging or OL-054 baseline real I3 just to make another PASS.** OL-054's verified feature code `d9d7e3e488fab500a5f57cc64952455ce1cbd0f5` performed a genuine Tencent iLink inbound → installed operator-owned TEST 3083 → real local model Worker native edit → durable Outbox → 3 real outbound, plus one operator-private real registered low-risk test-project Apply and exact rollback. The installed 3083 is *PAUSED+READY*, native poll connected. This is a genuine, bounded PASS, not general production/autonomous Apply release.

This batch upgrades that result into an operator-usable, reversible, **candidate release**: correct transactional reconciliation, replay/cursor durability beyond 2000 entries, owner/security boundary review, robust operator UI, tested restart/rollback, minimal installation docs and a strict release checklist. Address failures with source fixes, measured tests and forward-only commits; do not gate already approved reasonable engineering behind another general consent question.

### Authority, fixed anchors and no auto-run

- Repo `TnzGit/dsh-superagent-prototype`; branch `feat/local-first-wechat-foundation`; PR #1 **DRAFT/unmerged**. Task `OL-20261126-055`, result `LO-20261126-055`; receipt scope `OPERATOR_AUTHORIZED_INSTALLED_STABILITY_RELEASE_CANDIDATE`, machine local_batch scope `INSTALLED_STABILITY_RELEASE_CANDIDATE_OPERATOR_DIRECT`.
- **Immutable task-start `code_sha: a38b394d4a47a97d7f1ce3cb4332a05253a4d030`**, OL-054 independent online ACK HEAD; final new task handoff HEAD will differ and is to be verified by exact SHA. OL-054 final implementation SHA `d9d7e3e488fab500a5f57cc64952455ce1cbd0f5`; done HEAD `5f1f6f26980df9d9fd085f144aac5c711c4dde0d`. GitHub #892/#893 at implementation and #894/#895 at done are each 3/3 success, independently confirmed. OL-054 ACK runs (#896/#897) may be superseded by this handoff; **do not assert a cancelled job is green**.
- Before claim, verify source pin `a38b394d4a47a97d7f1ce3cb4332a05253a4d030`, current last accepted LO-054 ACK, **CURRENT exact task-handoff HEAD** Push + Draft-PR CI each 3/3 `completed/success`, and pin→HEAD diff limited to docs/task/state and the handoff convergence test allowlist. If these fail, diagnose and correct online/offline test or docs only before touching installed 3083.
- Exactly one claim, one done receipt, one final report and result over this entire run; no intermediate online ACK, no OL-056 auto task. Never reuse OL-054 send/message/model/Apply IDs or caps. Public GitHub is untrusted for host launch: the operator's directly forwarded matching Prompt (or an independently verified owner-protected dispatcher) starts this task. `no_auto_dispatch=true`, remote scheduler `PAUSED_BY_OPERATOR` remain.
- User already granted normal project development and bounded real integration. Do not ask generic "may I continue?" at each step. Only request a concrete missing operand (e.g. human QR interaction, selecting one owned low-risk project, confirming a specific diff) if essential. These inputs are not a repeat project authorization.

### Scope and live budgets

Source/test/docs/CI, private loopback operator UX, controlled **operator-owned test 3083** upgrade/restart/rollback experiments, existing localhost 8123 inference route and a previously consented **self-owned Weixin test peer** are in scope **when exact host identity, private security/backup, rollback and no-unintended-send gates pass**. No broad production rollout.

New, separate **OL-055 budgets**: at most **2 real outbound test messages** (one self/consenting peer, exact new immutable IDs, zero automatic retry), at most **1 genuine model-driven Worker session** (strict tool/time/token budget, no model-route/provider default changes), at most **1 registered low-risk real test-project Apply** with ≤2 ordinary text files/≤8KiB/no deletes and **separate one-use rollback** only if needed for integration; 1 supervised test-3083 restart/roll-forward/rollback window with private verified backup. These are ceilings, NOT required activities: if synthetic and read-only verification suffices, consume zero live sends/model/Apply. No old OL-054 allowance carries over. Keep 3083 paused outside the short explicitly logged acceptance window. A normal software restart is not an excuse to replay old inbox events.

Still **excluded**: random peers/groups, old personal chat history, arbitrary original 3080/8123 config/restarts, public/LAN/cloud egress, provider/model-default changes, system security weakening, user-data deletion/overwrite, valuable non-test project writes, automatic model Apply, replay of ambiguous sends, general production project enablement, force push/history rewrite, main merge/release/deploy or repository privacy changes.

## 1. Lead + up to THREE simultaneous offline subagents

Lead: private host preflight, sensitive evidence vault, live 3083/runtime coordination, one-time claim/result, integration review, protected operator test and GitHub non-force FF. Subagents: **synthetic fixtures only** in independent 0700 worktrees, no real credentials/peers/3083 listener/8123 model use, no private files, no independent shared-branch pushes. Concurrent subagents **≤3 total**.

| Subagent | Source ownership (coordinate collisions with lead) | Proof |
| --- | --- | --- |
| A | `src/local-first/weixin-poll-lease.ts`, `src/sources/weixin-native.ts`, Engine replay store & native poll tests | same-account single owner, path/DB swap refusal, >2000 replay after eviction, account rotation/rollback |
| B | `src/app/operator-review.ts`, operator routes, SQLite audit store/schema and UI tests | atomic cross-restart terminal classification, journal crash/symlink/fd safety, private operator usability |
| C | `src/local-first/real-apply-operator-connector.ts`, native driver/helper, OS helper and tests | stronger host/principal/quiescence boundaries and honest power-loss/UID/ancestor threat model |

Lead reviews security-critical changes. Failed subagent bounded work reverts to lead; no extra external budget and no fourth simultaneous subagent.

## 2. Stages S0–S6 (one uninterrupted batch)

### S0 — collect full installed health and close evidence gaps before code

1. Verify immutable task/claim, exact CI, and parent report. Re-run CI-exact Node, focus and full Vitest, `pnpm check`, native `-Wall -Wextra -Werror` on macOS and Linux CI. Record measured counts, not inherited numbers (last reference: Node **340**, focus **190**, full Vitest **1395**, not guaranteed for updated source).
2. Lead private host audit: installed 3083 version hash/manifest generation, listener and loopback binding, paused Executor, native poll owner/lease path and *single* 3083 controller, exact live SQLite and WAL ownership, backups and private journals. Validate observed state against OL-054 report, not a guessed baseline. Detect unexpected drift and freeze affected live action.
3. Make **consistent SQLite backup** via Backup API + integrity check, retain original pre-existing data; dry-run restore only into a new owner-only `0700` clone. Do NOT reset live cursor/DB to older snapshot or mutate real Outbox/Trigger rows to make acceptance green.
4. Enumerate actual product UI, release/documentation and operator control gaps; keep a redacted risk/evidence ledger for S1–S6. Document no external side effects of read-only preflight.

### S1 — repair operator journal, SQLite transaction and private auth lifecycle (HIGH PRIORITY)

1. Audit `src/app/operator-review.ts`: constructor `fchmodSync(openSync(host.journal, O_RDWR), 0o600)` may leave a descriptor unclosed and must not follow or repair a malicious symlink; inspect/read/append paths independently for correct `O_NOFOLLOW`, owner/mode, link count, bounded size, ancestor/root identity, and fd lifecycle. **Fix defects rather than assuming the old 0600 file suffices.** Tests must prove no foreign file modification, fd leak or sensitive diagnostics on symlink/hardlink/owner replacement.
2. Address the **SQLite commit vs external fsync journal split**: establish ONE authoritative durable audit commit invariant (e.g. same-transaction SQLite audit ledger plus validated idempotent external projection, or a formally verified recoverable two-phase state machine). A crash at every transition must never authorize a second send, lose terminal Trigger classification, or falsely declare an uncommitted effect accepted. Freeze ambiguity and explain every recovery step. Retain old valid journal/receipts and support additive migrations safely.
3. Protect bearer-token lifecycle: deny exposure on non-loopback or missing config; ensure same-origin and CSRF-style protections, token rotation/restart without partial control, request rate and size bounds, and audit principal distinction as far as OS allows. Explicitly report **bearer possession ≠ named-human authentication**; do not fabricate an identity proof.
4. Negative suite: two concurrent controllers, interrupted tail, stale/journal-root swap, SQLite commit-before-file fsync, file fsync-before-SQLite crash, token replacement, replayed reviewed hold, pending Trigger with live Eval, unauthorized HTTP, and already terminal receipts. Only terminal no-resend or independently evidenced confirmed-sent; never claim reset/resend.

**S1 exit:** recovery is deterministic, private operator controls cannot tamper arbitrary same-user files via bad descriptors, and every terminal classification has a traceable nonreplayed durable outcome.

### S2 — long-lived native poll ownership and replay retention

1. Examine SQLite `BEGIN IMMEDIATE` lifetime-held lock and fencing generation (at OL-054, lease DB next to token file). Prove account/credential normalization, database path pinning/no-follow, owner modes, symlink/hostile same-UID directory replacement, WAL and alias path cases, as well as two 3083/staging processes with disjoint state dirs. A stale old owner must never route, send or cursor-commit after takeover. Add crash/restart/rotation/lease-file ABA tests.
2. Existing per-account dedup uses a FIFO **2000-entry** seen set plus Engine Trigger-ID backstop. Replay more than 2000 distinct updates with provider ID collision/absence/malformed variants, followed by an old update; prove durable duplicate effects cannot create a second executable Ticket/outbound claim. If proof fails, introduce appropriately bounded durable keyed retention with schema migration/retention policy. Do not solve by silently dropping fresh legitimate messages.
3. Test cursor persistence, 401/429/-14 failures and accepted-then-EOF ambiguity with fake HTTP. Restart with pending reviewed receipts and terminal historical trigger, ensure no auto-requeue or unpause. Account swap, peer revocation during await and delayed in-flight responses should fail closed; no real Tencent lockout/flood simulation.
4. Explicitly document threats beyond same-UID user boundary if they cannot be solved without a different OS principal. Consider stronger sandbox/sidecar isolation only if it can be measured on the real Mac and reversed cleanly.

**S2 exit:** a long-running installed single-owner replay/lease guarantee with bounded storage growth and regression coverage, not just a short pilot.

### S3 — safe operator interface and maintainable installation workflow

1. Provide a **private, loopback-only operator status/management UI** (or adapt the existing local 3083 UI) showing: exact installed build/manifest, paused Executor state, source connection health, poll owner/lease generation, queue health, redacted Ticket/Outbox review state, model-route health (no secrets), last checkpoint/backups and recoverability. No public exposure and no arbitrary shell.
2. Add safe actions with explicit local auth and precise scope: pause/resume controlled test Executor (idempotent), read-only ledger, one terminal classify/reconcile with audit, exact Apply preview/review/one-use capability/rollback only after operator-side checks. UI must never make external sends or Apply simply by opening a dashboard or clicking a generic confirm. Server-side checks, not hidden buttons, enforce authorization.
3. Correct missing first-line selector/command usage that consumed one model and an outbound in OL-054: present clear Chinese and English examples, verify parse syntax and user feedback before expensive Router/Worker invocation when safe. Do not weaken accepted grammar arbitrarily; add a negative test for selector joined to first command line.
4. Deliver installation/update/rollback operator runbook, supported Node/macOS features, 3083 launch/bundle manifest recovery, private token rotation, original data backup, re-register on inode change and emergency freeze. Resolve docs lint, missing links, architecture inventory; no raw private host values.

**S3 exit:** owner can operate and understand the installed test service from a private UI/runbook without editing raw SQLite, watching opaque logs or trusting public GitHub task text.

### S4 — Apply trust and recovery boundary (no general production grant)

1. Threat model: non-cooperating **same UID** writer can race between final native preimage check and `renameat`; it can also forge 0600/0700 capability markers and change ancestors/mounts. Determine whether an OS-isolated approval-helper identity or a pinned mount/writer exclusion is feasible for actual macOS. Never claim `openat` alone is universally race-free.
2. Harden capability issuance and post-apply results against exact target switch, stale root+ancestor identity, inherited file descriptors, journal symlink/hardlink/ACL/xattr/flags tamper, multiple preview IDs with same plan and wrong principal. Keep Worker proposal separate from any privileged Apply executor. Prove the default-OFF feature flag remains OFF after restart unless protected operator config specifically opts in.
3. Adversarial fuzz/kill matrix on **fresh owner-controlled registered test projects** only: before-image journal fsync failures, power-loss semantic *limitations*, crash after any `renameat` and before audit/fsync, external writers and manual recovery classification; no auto retry. If provably safe on a named low-risk real registered test project, optionally one new bounded canary Apply + distinct rollback under the new OL-055 budget, otherwise no live write.
4. Report which failures are unfixable without a distinct OS UID or authenticated user-presence primitive. For those, enforce a restrictive running mode rather than weakening guards. Do not permit broad valuable project Apply from an untrusted model message.

**S4 exit:** narrower measured Apply authority with auditable limits and a practical operator recovery story; not a blanket production-green assertion.

### S5 — soak, install/rollback rehearsal and minimal real canary

1. Simulate multi-day uptime with bounded, accelerated fake clock/fake transport or realistic short local soak, including >2000 messages, delayed pages, restart and provider error bursts, with no real peer spam. Fault-inject process kill and owner lease takeover in cloned isolated 3083 instance; verify integrity, WAL recovery, poll owner and no repeated Outbox sends.
2. Rehearse old→new→old and new→new restart/rollback on a **consistent 0700 private clone**, not on live DB if a destructive migration cannot be reversed. Live operator-owned TEST 3083 may receive at most **one controlled rollback/restart window** only after backup, monotonic manifest CAS and exact process identity checks; preserve paused executor and no two simultaneous pollers. If unsafe, report a concrete blocker and retain current tested installation.
3. If one exact live canary adds independent value, under new limits (≤2 new real outbound to previously consented self peer, ≤1 bounded real model session), route a **new** harmless message through actual installed 3083; verify actual inbound, accepted Ticket, report and terminal durable receipt, then return Executor to paused+ready. Do not force a live send for CI green. No reusing OL-054 message IDs or claiming Tencent server at-most-once on ambiguous failures.
4. Record measured memory/FD/SQLite growth, pending handles, event-loop stalls and process health; choose practical budget thresholds from observed baselines and report any overrun rather than guessing a universal SLA.

**S5 exit:** measured restart, lease/replay recovery and operator-visible health, with no uncontrolled production drift.

### S6 — release candidate and final one-shot reporting

1. Merge reviewed source/tests/docs/CI changes once; run typecheck/build and full CI-exact cross-OS Node/focus/proxy and Vitest, native clang/GCC `-Werror`, docs/architecture tests. Fix failures forward without removing tests/guards. Verify both Push and Draft PR CI at **final source SHA** and again at final report/done SHA (each exact 3/3). Record honest failed intermediate runs.
2. Publish **one public-safe Release Candidate readiness matrix**: installed service restart/health, private operator UX, poll ownership/replay after eviction, journal/SQLite crash consistency, Apply trust boundary, rollback, native provider limitations, access/privacy, portability and known issues. Mark each `PASS`, `PARTIAL` or `BLOCKED_TECHNICAL` with actual evidence; reserve `RC_READY` only if required invariants genuinely pass.
3. Keep **PR #1 Draft/unmerged** by default; prepare an exact PR review summary, risk classification, minimal install instructions and a suggested release checklist, but do **NOT** merge main or deploy broadly. Main merge/product-wide deployment is a separate release act, not a CI side effect.
4. Final report: private operator host facts redacted, source baseline and final source SHA, real canary and actual budget consumed, current 3083 version/paused and rollback state, journal/replay and Apply residuals, source+done CI at exact SHAs, artifacts and one honest verdict. Lead pushes nonforce FF and publishes ONE `LO-20261126-055`, claimed/done receipts; no OL-056 creation or online ACK between phases.

## Final verdict allowlist (one only; no PASS from fake-only claims)

- `RC_READY`: operator-private controls and cross-platform regressions complete, SQLite/audit crash consistency and long-term replay acceptance pass, installed 3083 supervised recovery works, exact CI green; recorded known limitations are within declared bounded trust model. Draft PR still not merged.
- `RC_SAFE_PARTIAL`: substantial tested hardening, but one or more release readiness gates remain precisely limited and not misreported.
- `RC_BLOCKED_ENV`: reproducible external Mac/CI/provider/runtime problem prevents a mandatory stage, while safe work still completed.
- `RC_BLOCKED_TARGET`: the only missing live operand is a self-owned consenting test peer or registered low-risk test project; keep source tasks going.
- `RC_AMBIGUOUS_FREEZE`: an external send/write/recovery state is uncertain; preserved receipts/journals, no retry.
- `RC_FAIL`: a confirmed, unresolved security or functional failure makes candidate unsafe.

Public report must not contain private account/peer/token, raw message or session text, real project paths/hashes, private vault paths or launch environment. GitHub CI cannot independently confirm a personal Mac state. All new local live operations remain lead-only, explicitly ledgered, within the **new** OL-055 limits.

## Delivery paths (one batch)

- `agent-handoff/receipts/local/OL-20261126-055-claimed.md`, `...-done.md`; `message_id: OL-20261126-055`, `scope: OPERATOR_AUTHORIZED_INSTALLED_STABILITY_RELEASE_CANDIDATE`, immutable `code_sha: a38b394d4a47a97d7f1ce3cb4332a05253a4d030` even when final code changes.
- `agent-reports/REPORT-ol055-installed-stability-release-candidate.md` with evidence tables and final source SHA, code and final done CI SHAs, host-state deltas and private-vault evidence class.
- `agent-handoff/messages/to-online/2026-11-26-lo055-installed-stability-release-candidate-done.md`, `message_id: LO-20261126-055`, exact verdict and final source SHA.
- Do not claim an online ACK until it is later independently committed. Do not issue OL-056. Keep remote scheduler `PAUSED_BY_OPERATOR` and `no_auto_dispatch=true` throughout.

**The goal is an actually maintainable installed agent, not another authorization loop or fake green acceptance.**
