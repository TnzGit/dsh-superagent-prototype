# 023 — Installed operator runbook: update, rollback, health, and emergency freeze

**As of 2026-11-26.** This runbook consolidates the OL-055 S3 operator-facing controls for the installed loopback test orchestrator. It is public-safe: it names procedures, files by role and manifest fields, never private vault paths, tokens, account or peer identities. Companion evidence stays in the private vault ledger and `agent-reports/REPORT-ol055-installed-stability-release-candidate.md`. The bearer token authenticates **possession**, not a named human (see `docs/022-real-apply-trust-threat-model.md`).

## Supported runtime and installation shape

- Node: `^22.19.0 || >=24.0.0` (the workflow runs the CI-exact Node list under both; local hosts may run a newer Node — strip-only-safe sources must not use parameter properties). macOS 15+ on both arm64 and Intel images; canonical path behavior differs between `/var` and `/private/var` (assert through `realpath`).
- The installed service is a loopback Web server on the test port with the orchestrator profile; the bundle is selected by a `link:` entry in the profile package. A launch manifest (schema 1: `generation`, `mode`, `target_pid`, `binary`, `bundle_link`, `profile_home`, `state_dir`, `credentials_env`, `port`) is the CAS authority for which bundle owns the port. The manifest and the cutover lock live in the operator-private launch directory; a stale lock means **human reconciliation required**, never auto-forced.
- One native Weixin poll owner per account, fenced by the account-scoped lease database beside the real credentials file. Do not run an overlapping guest for the same account. The operator status page shows the poll owner's fingerprint plus durable lease generation (a read-only peek; it never blocks on a reserved lease).

## Update (roll-forward) procedure

1. Preflight on the running instance: verify the target process identity holds the port, the test database, the profile home and the credentials env; run `PRAGMA integrity_check`; record the row-count baseline (Triggers, Tickets, Outbox by status, KV, Decisions) and take a fresh owner-only SQLite backup (`.backup`, then verify integrity on the copy).
2. Stop the old instance (TERM, bounded wait, then SIGKILL; confirm the port is released; bump the generation to `stopped`).
3. Stage the new pinned build in the launch directory and run the package install there so the bundle's own `node_modules` are present — a staged build **without** its dependencies boots with `ERR_MODULE_NOT_FOUND` and leaves the port held by a half-booted process.
4. Point the profile `link:` at the staged build, re-assert the operator profile patch, reinstall the profile, and verify the resolved link target before booting.
5. Boot and wait for the state endpoint to answer `paused`, `runtime ready`, `weixin ready`. Bump the generation to `new` with the new pid and bundle link.
6. Post-window verification: integrity check again; row counts must be identical (a new additive table may appear; no row loss); no pending Outbox must have become `sent` without a send; the real lease directory must be untouched; the new routes must answer 401 without the token and 200 with it. Keep the Executor paused outside a logged acceptance window.

## Rollback procedure

Stop the new instance (same bounded TERM/SIGKILL), point the `link:` back at the previously tested bundle, restore the saved original profile patch, reinstall the profile, verify the link target, boot, wait for `paused`+`ready`, bump the generation to the previous bundle mode. A normal restart must never replay old inbox events; the durable dedup and cursor state carry across the cutover (proven offline in `docs/019-i3-prelive-readiness-matrix.md` classes and the OL-055 replay specs). The rehearsal order old→new→new→old on a private clone is the pre-gate; the live window is at most one supervised restart per logged task.

## Operator status page and safe actions

The loopback-only `operator/status` view (Operator tab; reachable only with the operator's own grant; the page never fetches before the grant is entered) shows the installed build/version/manifest, the controlled Executor's paused/running/queued/max-workers, source connection health, poll owner fingerprint + lease generation, queue health, redacted pending/review holds with the journal-vs-ledger verdict, model-route health (state+code only), policy version and the last durable checkpoint. It renders no secrets, no payload text, and offers no generic send or Apply. The only safe UI action is the idempotent Executor pause/resume (`operator/executor/pause`, strict body, scope-named confirm that says it sends nothing; cancel performs no request). Authorization is server-side: grant check, same-origin + management-request header, per-window rate bounds (reads/mutations per window, request body cap), per-route audit. Restart resets the in-memory rate window (documented on the page).

## Token rotation

Rotation is never hot: the grant is read when the service is installed and is not re-read per request. Rotating the token requires a reinstall that replaces every operator route at once; with the grant file absent, the operator routes are absent (404), not half-installed.

## Crash consistency and emergency freeze

One authoritative durable audit commit: the SQLite audit ledger and the terminal transition commit in the same transaction; the JSONL journal is only its validated, idempotent projection (re-projected on reopen; a projection the ledger or receipt state cannot corroborate freezes reconciliation). If the journal root is stale or swapped, reconciliation freezes with a shape-only diagnostic. On any ambiguity — an external send/write/recovery state that is uncertain — freeze: preserve receipts and journals, classify `AMBIGUOUS`, never auto-repair, never auto-retry, never auto-clean. A crash-partial receipt is never overwritten; reconciliation is a human act (`docs/020-postlive-i3-and-apply-operator-runbook.md`). The journal file itself is opened with `O_NOFOLLOW` on every access and checked on its own descriptor (regular file, owner-only mode, one hard link, bounded size, owner- or root-owned ancestors that are not group/world writable unless sticky). If an ancestor directory is group-writable, harden it (or move the state dir under an owner-only tree) before booting; the guard is fail-closed by design.

## Apply re-registration on inode change

After an intentional root or ancestor replacement, a trusted operator must re-register the target project and issue an entirely new Ticket/snapshot/preview/capability; old identity evidence remains invalid. The capability is one-use with nonce + expiry + quiescence gates, bound to the exact preview id, and rollback is a separate one-use capability. The registration-time trust limits (same-UID marker forgery, the preimage→rename race window, power-loss durability beyond fsync+SIGKILL, mount-table changes) are stated in `docs/022-real-apply-trust-threat-model.md`; do not advertise race-free or unconditional production safety.
