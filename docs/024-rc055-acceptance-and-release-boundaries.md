# 024 — OL-055 independent RC acceptance and remaining release gates

**Status 2026-11-27:** `OL-20261126-055` accepted `RC_READY` by online ACK `agent-handoff/receipts/online/LO-20261126-055-done.md`. This file is a **release review checklist, not operator authorization or an auto-dispatch signal**. PR #1 is Draft/unmerged; installed TEST 3083 remains paused+ready per private host attestation.

## Accepted candidate evidence

- Implementation `89090b3eb02844030a592d8d87e500471599b2b7`, done `cf866a98b3d15b63d154272b22a57fa588039a6f`; final exact-SHA Push #909 (`45899531369`) and PR #910 (`45899538479`) all 3/3 success. Full Vitest 1427, Node 387 each OS, focus 216 each OS. Portable xattr cleanup C test fixture replaces absent Ubuntu `setfattr`; failed #904/#905 are historical, and #906 was superseded.
- Authoritative single-transaction SQLite `operator_audit` with validated journal projection, hardened descriptor/no-follow access, deterministic crash/replay tests, 2000+-message replay simulation, operator UI with safe pause and pre-accept first-line selector feedback, safer (not perfect) native Apply capabilities and fault-injection matrix. See `agent-reports/REPORT-ol055-installed-stability-release-candidate.md` §3–§9.
- Installed owner-operated TEST 3083 was upgraded in one protected maintenance window with an owner-only SQLite backup/clone restore, process/runtime ready and paused, minimal operational metrics and no new live sends/model/Apply. Two failed intermediate boots are documented; gen 12 final, installed bundle link recoverable but actual rollback unexecuted. Private vault records are not independently accessible through GitHub.

## Operator maintenance caution

The fail-closed path ancestor check identified a group-writable external volume root (`0775`) and the local agent changed it to `0755`. **Do not indiscriminately run `chmod g+w` to revert while this instance relies on that ancestor guard**. If writable group access is truly required, use a distinct owner-only application root or a planned stopped-service migration, back up and verify before re-enabling it. Keep the 3083 executor paused except for a new protected bounded test. Never rewind the live DB to an older backup without accounting for new Tickets, cursors and Outbox receipts.

The new operator page is read-only/status-oriented, with an idempotent pause action. It does **not** offer broad Send/Apply controls or authorization to run the Worker unattended. Public GitHub task and ACK markdown must never be used as host-command identity. Old OL-055 grants, including **unused** 0/2 message and 0/1 Apply limits, expire when the task closes.

## Draft PR release review (independent, not an automatic merge)

1. Confirm the PR reviewer's exact code SHA, all GitHub CI and change summary. Obtain meaningful independent source/security review of `src/app/operator-review.ts`, poll lease, Engine idempotency, browser operator route, native Apply helper and driver, capability marker/opt-in, install manifest and rollback scripts. Do not infer security review from CI.
2. Verify operator UX: authentication only on loopback and correct token rotation lifecycle; no peer identifiers, chat text, file secrets or raw private paths leak into UI or public reports. Audit rate limits reset on restart and track possible multi-process bypass.
3. Verify DB journal ledger invariants and crash consistency with real storage semantics; track long-term seen-set retention, lease file/mount alias and cursor/account rotation, not merely a single fake test.
4. Native Apply **separate adversarial trust decision**: same effective UID can forge `0600` markers; noncooperative writer races after final preimage verification and before `renameat`; cross-root boundaries and mounts are not globally fenced; power loss is not equivalent to process kill. `sudo -n` requiring password is not a request to turn off sudo protections. A distinct-UID approval helper or OS user-presence primitive would materially improve the proof, but requires deliberate operator provisioning. Until then keep general Apply default OFF and test-project scope explicit.
5. Review upgrade and rollback through `docs/023-installed-operator-runbook-update-rollback.md`: one active poll owner/account, preserve current live cursor and receipts, backup original state, test the old bundle only on a clone if migration is not reversible. The live test 3083 rollback is retained but **not executed**; do not claim otherwise.
6. Prepare PR release notes/changelog and explicit owner decision on whether to merge; do not auto-merge or advertise general production readiness from `RC_READY` alone.

## Deferred non-blocking vs production-blocking risks

| Risk | Candidate scope | General production |
| --- | --- | --- |
| Same-UID capability/marker forgery | Accepted only under trusted single-user TEST process boundary | Requires stronger independent identity or explicitly narrowed threat model |
| Noncooperating same-UID writer leaf race / PATH ABA / mount | Fail-closed when detected; residual acknowledged | Requires stronger writer exclusion or scoped guarantees |
| Power-loss journaling ordering beyond SIGKILL | Documented ambiguity/freeze semantics | Recovery validation needed before strong durability claims |
| Bearer token vs named human | Explicit token-possession gate in private loopback UI | Identity and audit semantics need a separate decision |
| In-memory rate-limit window reset on restart | Documented, bounded test UI | Evaluate persistent/rate-limited token lockout if needed |
| Rollback clone-only for old bundle | Adequate for bounded RC gate; protected path retained | Live upgrade procedure needs separately approved verification |
| Node 22 local macOS absence | Linux CI provides Node 22; Mac CI Node 25 | Dual OS/version support must follow release matrix |

**Next owner: online for scoped PR/security review and release planning. No active local task, no auto OL-056, remote automation stays PAUSED.**
