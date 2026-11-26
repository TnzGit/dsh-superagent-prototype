# REPORT-ol055 — Installed stabilization / operator UX / release candidate (OL-20261126-055)

Operator-authorized single batch (S0–S6, direct operator chat grant 2026-11-26). One uninterrupted run; no per-stage dispatch, no OL-056. Verdict: **RC_READY**. Draft PR #1 kept unmerged.

## 1. Baselines and immutable SHAs

- Task baseline `code_sha: a38b394d4a47a97d7f1ce3cb4332a05253a4d030`; dispatch head `f16885e80c5dab511291e24e5d22ff00e3485b3b`; claim commit `9618b9442c9550abac40269977318c149daa3fc9` (non-force FF push verified first).
- Final source SHA (all code+docs): `1d7a614c8d3bcdaf3c6e73ba7778783ac1b28093` (12 integration commits + 1 runbook commit on the claim head).
- Baseline→dispatch diff: 14 files, docs/task/state/handoff-verdict-test only, zero src/, zero workflows, zero lockfiles. Push CI #898 (run 45751194856) and Draft PR CI #899 (run 45751202266): 3/3 each before claim.

## 2. S0 — offline baseline at the pinned source (all exit 0, local macOS, Node v25.9.0)

| Check | Result |
| --- | --- |
| CI-exact Node list | 340 / 340 pass |
| CI-exact focus Vitest list | 190 / 190 pass (13 files) |
| Full Vitest | 1395 pass / 73 files |
| OpenAI queue proxy step | 5 / 5 |
| `pnpm check` (typecheck+test+build) | exit 0 |

Host freeze (read-only): operator-owned test 3083 listener pid verified (manifest gen 6, mode new, bundle link = prior tested build), `paused True`, runtime `ready`, weixin `ready`, load 0/0/3; DB counts trigger 14 / ticket 2 / outbox 8 (all terminal `sent`) / kv 22 / decision 11; real account-scoped poll lease directory present and untouched; owner-only SQLite backup taken and integrity-verified (229376 B, `PRAGMA integrity_check` ok; dry-run clone restore ok).

## 3. S1 — operator audit/journal crash consistency (three-agent merge, all cherry-picked onto the claim head)

Authoritative durable audit commit: the SQLite `operator_audit` ledger is the authority; the terminal transition and its audit row commit in the SAME transaction (first-writer-wins on (kind,id,principal)); the JSONL journal is only a validated, idempotent projection (fixed canonical field order, re-projected on reopen, corroboration required — an uncorroborated projection freezes reconciliation with a shape-only diagnostic and no repair). Journal access: exact `O_NOFOLLOW` open on every path (read/append/validation independently), checked on its own descriptor (regular file, owner-only mode, one hard link, owner uid, bounded size, owner- or root-owned ancestors not group/world writable unless sticky), descriptors closed explicitly on every exit (proven by fd counting across 40 constructions). A symlinked/hardlinked/group-writable journal root is refused before any chmod and the foreign file is never modified. Diagnostics shape-only: no payload, no token.

New tests (all registered in both CI lists): `tests/local-operator-journal-hardening.node-test.mjs` 7 pass; `tests/operator-durable-commit.spec.ts` 13 crash-point tests pass (commit-before-fsync lost-projection re-project and never re-sent; external write that cannot land never declares an uncommitted effect accepted; rolled-back transaction leaves no projection and no audit; file-fsync-before-SQLite-commit corroboration freeze with receipt pending and recovery = truncate + human re-reconcile; terminal trigger classification survives the split and is never re-classified; replayed terminal receipts refused 400; stale/swapped journal root freeze shape-only; old valid journal/receipts still replay; migration additive `CREATE TABLE IF NOT EXISTS operator_audit` + index). Bearer lifecycle: non-loopback install throws; same-origin + management-request gate; grant read once at install and never hot-swapped — rotation requires a reinstall replacing every operator route at once; missing grant = routes absent (404), not half-installed (operator service resolved per request). Rate bounds 120 reads / 30 mutations per 60 s window → 429 with `retry_after_ms`; bodies capped 4 KiB → 400; a refused request accepts nothing (receipt stays pending, audit count unchanged). Negative tests present: two concurrent controllers + race, interrupted tail, stale/journal-root swap, SQLite-commit-before-file-fsync, file-fsync-before-SQLite crash, token replacement, replayed reviewed hold, pending trigger with a live Eval refused fail-closed, unauthorized HTTP (forged/missing token), already-terminal receipts. Never a reset/resend: only terminal `no_resend` or independently evidenced `confirmed_sent`.

Residual (honest): the in-memory rate window resets on process restart (documented on the status page).

## 4. S2 — poll ownership, durable replay, restart ambiguity

`tests/local-weixin-poll-lease-hostile.node-test.mjs` 8 pass: same-UID hostile lease-DB substitution threats against the pinned-inode fence (a foreign swap of the lease DB path is refused via remembered (dev,ino); fresh-process takeover semantics). `tests/weixin-native-durable-dedup-offline.spec.ts` 6 pass: replay suppression past the FIFO 2000-entry seen set — replaying >2000 distinct updates then an old update cannot create a second Ticket through the real Engine. `tests/weixin-native-restart-ambiguity-offline.spec.ts` 7 pass: cursor durability and restart ambiguity (an ambiguous page boundary classifies freeze-preserved, never auto-replayed).

## 5. S3 — operator UX + first-line selector feedback + runbook

Private loopback-only `GET operator/status` view + Operator tab in the installed client (reachable only with the operator's own grant; the page does not fetch before the grant is entered): installed build/version/manifest + state dir, controlled Executor paused/running/queued/max-workers + health, source states, poll owner fingerprint + durable lease generation (read-only peek; never blocks on a reserved lease), queue health, redacted pending/review holds with journal-vs-ledger verdict, model-route health (state+code only, detail never rendered), policy version, last durable checkpoint. No secrets, no payload text rendered (asserted). ONE safe action: idempotent `POST operator/executor/pause` (strict body; 400 on extra/typed fields) that changes nothing external and sends nothing, with a scope-named confirm that says it sends nothing; cancel performs no request. No generic send/Apply button anywhere; server-side enforcement (grant check, same-origin, rate window, strict schema, per-route audit). `tests/panel-operator.spec.tsx` 5 pass; `tests/panel-overview.spec.tsx`/`tests/panel-panel.spec.tsx` updated for tab order (操作员/Operator between 执行 and 设置) and pass.

Selector feedback (fixes the OL-054 mistake that consumed one model session + one outbound): `src/local-first/request-selector-feedback.ts` verifies the first-line parse BEFORE the expensive Router/Engine accept using the same accepted grammar as `projectIdFromRequest` (grammar not weakened; still the sole parser). Bilingual Chinese+English corrections with exact examples, including the joined-selector mistake and an invalid ID. Wired into the accept path for local-only deployments: a mistyped request is refused before `engine.decide`, creating no Ticket and no acknowledgement. `tests/local-request-selector-feedback.node-test.mjs` 14 pass + a route-level negative test in `tests/tools.spec.ts` (27/27).

Runbook: `docs/023-installed-operator-runbook-update-rollback.md` — supported Node/macOS, installation shape (profile `link:` + launch manifest CAS fields), roll-forward procedure (including the dependency-staging requirement learned in the live window), rollback procedure, status page and safe actions, token rotation semantics, crash consistency and emergency freeze, Apply re-registration on inode change. `tests/docs.spec.ts` 6/6 pass (numbering, link rules, merge-marker, 007 inventory).

## 6. S4 — Apply trust boundary

Native helper (`research/real-apply-helper.c`, builds clean under Apple clang 21 with `-std=c11 -Wall -Wextra -Werror -O2` and `-Wmisleading-indentation`-clean under GCC 16): fail-closed ACL probe (`no_acl` via `acl_get_fd` at root/components/target/parent/tx-dir/post-verify); inherited-descriptor scan (`scan_inherited_fds` refuses a non-CLOEXEC directory fd inherited across exec whose (dev,ino) collides with the expected registered root, bounded by `getdtablesize` clamped to 4096); new crash stop point `stop_after=renamed` (after `renameat`/`linkat`/`unlinkat`, before the dir fsync); read-only `marker` subcommand (`OK MARKER <dev> <ino> <mode> <nlink>`) probing the 0600 capability file through the helper's own no-follow fd (macOS flags/ACL/xattr blind spots Node cannot see).

Driver + connector: every fresh capability carries the canonical ancestor chain (path+dev+ino, re-lstat'd at verification so an ancestor ABA or a symlinked ancestor fails closed even when the project inode is moved back) and the exact `previewId` binding (both optional at parse so legacy fixtures still parse; two previews sharing one plan digest can never cross-rebind). Durable strict owner-only `apply-opt-in` record is the restart-surviving protected config: the env flag alone does NOT survive restart; malformed, forged-principal, hardlinked or ACL-stamped records keep the path OFF. Post-apply re-observation through the helper refuses inode swap / after-image mismatch with no silent retry; receipts gain `postObservations`; Worker (`DSH_SUPERAGENT_TICKET`) still can never execute Apply.

New suites: `tests/local-real-apply-kill-matrix.node-test.mjs` 8/8 (crash after any `renameat` before audit/fsync classifies AMBIGUOUS + durable freeze, never auto-repaired/retried/cleaned), `tests/local-real-apply-trust-hardening.node-test.mjs` 9/9. `docs/022-real-apply-trust-threat-model.md` records the measured verdict: seatbelt writer exclusion is feasible on real macOS and blocks every same-UID mutation class over an exact subpath, but only for operator-launched confined processes (narrows, never eliminates); a distinct-UID approval helper is the only thing that defeats same-UID marker forgery and is not runnable on this host (`sudo -n` requires a password); `openat` alone is never race-free (the leaf swap between the final preimage check and `renameat` is winnable); no user-presence primitive on this host, so named-human approval is unprovable — only possession of the 0600 grant.

## 7. S5 — soak, clone rehearsal, live maintenance window, canary decision

Clone rehearsal (0700 private clone, fake transport, executor paused): old→new boot, new→new restart, new→old rollback — every boot reached `paused` + `weixin ready`; DB stable across the cutover (trigger 14 / ticket 2 / outbox 8 all terminal `sent`, zero pending, no auto re-send, kv 22); clone poll-lease account hash differs from the real account hash, real lease untouched; bounded fake-transport soak with restart + error bursts, >2000-entry replay covered by the S2.2 specs. Decision recorded: `REHEARSAL_PASS`, zero live budget.

Live supervised maintenance window (one logged window on the operator-owned test 3083, OL-055 budget 1/1):
1. Preflight: target pid verified (3083 + test DB + profile home + credentials env); `PRAGMA integrity_check` ok; baseline counts identical to S0 freeze (14/2/8-sent/22/11); fresh owner-only backup taken and integrity-verified.
2. Attempt 1 (staged build without its own `node_modules`) failed `ERR_MODULE_NOT_FOUND zod` — half-booted process held the port; manually stopped, generation bumped (honest intermediate failure, no drift).
3. Attempt 2: deps installed; boot refused by the NEW S1 ancestor guard — the volume root of the workspace tree was group-writable `0775`. Host-state delta recorded: hardened to `0755` (reversible `chmod g+w`; fail-closed guard working as designed). Stopped manually, generation bumped.
4. Attempt 3 (gen 12, new pid): up — `paused True`, runtime `ready`, weixin `ready`, load 0/0/3.
5. Post-window verification: `PRAGMA integrity_check` ok; row counts identical (zero drift); outbox still 8/8 `sent`; WAL 0 pages; DB grew only by the additive `operator_audit` table + index (+12288 B); real account-scoped lease directory untouched (status view shows the real account fingerprint + lease generation 5); `operator/status` route live: 401 without the token, 200 with `x-operator-token`, ledger `{"receipts":[]}` (all baseline receipts terminal); pre-existing reconcile ledger route live (401/200); idempotent pause action returns `{"paused":true}` with zero external effect; client bundle contains the Operator tab.
6. Process health (S5.4): RSS 234688 KB → 223888 KB over a 60 s soak, CPU 0.3–0.4 %, FDs 63→64, threads 14, no event-loop stall observed; practical thresholds from observed baselines recorded in the private ledger, no universal SLA claimed.

Canary decision: `CANARY_NOT_NEEDED` — OL-053/OL-054 already proved the genuine Tencent closed loop + real Apply on installed runtimes, the clone rehearsal covers the cutover, and forcing a live send would consume send/model budget against the executor-paused posture without adding independent value (the plan does not force a live send for CI green). Actual OL-055 budget consumed: **0/2 real outbound, 0/1 model session, 0/1 registered Apply + rollback, 1/1 supervised maintenance window**. Executor returned to paused+ready.

## 8. S6 — merged integration and exact CI

Three private worktree branches (`ol055-a` 3 commits, `ol055-b` 5 commits, `ol055-c` 3 commits) cherry-picked and rebased onto the claim head as 12 commits ending `c7a40212c7f55e71d9ddcadf272248f2caf519a7`, plus the runbook commit → final source `1d7a614c8d3bcdaf3c6e73ba7778783ac1b28093`. Merge conflicts (workflow Node/focus list overlap, `weixin-poll-lease.ts` import, `docs/007` row) resolved as unions; a stray-YAML repair commit followed (list-union script left bare continuation lines inside the workflow; `yaml.safe_load` validated after repair). No guard was weakened; no test removed.

Measured at the final source SHA on this host (Node v25.9.0; the ubuntu CI step pins Node 22 and the macOS step Node 25 — sources are strip-only-safe, whole Node list verified under Node 25):

| Check | Baseline | Final | Exit |
| --- | --- | --- | --- |
| CI-exact Node list | 340 | 387 / 387 pass | 0 |
| CI-exact focus Vitest | 190 | 216 / 216 (16 files) | 0 |
| Full Vitest | 1395 / 73 files | 1427 / 77 files | 0 |
| macOS proxy step (proxy+journal+hardening+selector) | 5 | 34 / 34 | 0 |
| `pnpm check` | 0 | 0 (build 849.24 kB) | 0 |

Deltas: Node +47 (SubA 8, SubB 22, SubC 17); focus +26 (durable-commit 13, selector-feedback node-suite counted in Node list); Vitest +32 tests / +4 files (durable-commit, panel-operator, dedup, restart-ambiguity). All local logs retained in the private vault ledger (4 entries; every live operation explicitly ledgered, lead-only).

## 9. Release-candidate readiness matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Installed service restart/health (supervised recovery) | PASS | clone old→new→new→old + live window attempt3 + zero-drift verification; two honest failed attempts recorded |
| Private operator UX | PASS | status view + one idempotent safe action + server-side auth/rate/audit; 5 panel tests + live route probe |
| Poll ownership / replay after eviction | PASS | hostile fence suite + >2000 seen-set replay spec through the real Engine; live lease generation unchanged |
| Journal/SQLite crash consistency | PASS | same-transaction audit ledger, validated idempotent projection, 13 crash-point specs, O_NOFOLLOW hardened journal access |
| Apply trust boundary | PASS (bounded) | ACL/inherited-fd/marker probes, ancestor chain + previewId binding, opt-in record restart semantics, kill matrix freeze, docs/022 threat model |
| Rollback | PASS | one-use separate rollback capability (OL-054 proven); clone rollback rehearsal; live rollback path preserved, not executed |
| Native provider limitations | PARTIAL | same-UID marker forgery, preimage→rename race, power-loss beyond fsync+SIGKILL, mount-table changes, distinct-UID helper not runnable here — all within the declared bounded trust model |
| Access/privacy | PASS | loopback-only, grant possession (never a named human), sanitized views, no secrets/payload rendering |
| Portability | PASS | both-OS CI lists union-registered; macOS canonicalization suite; GCC -Werror clean; Node 22/25 dual-range respected locally |
| Known issues | documented | rate window resets on restart; clone lease health read from durable state, not a live probe in tests; first-line grammar unchanged (pre-accept feedback only) |

`RC_READY` declared: controls complete, cross-platform regressions green (local CI-exact at final SHA), crash consistency + long-term replay acceptance pass, supervised installed recovery works, exact CI green at the done SHA (polled below), limitations within the bounded trust model, Draft PR still unmerged.

## 10. Honest residuals and rollback of this round's local changes

- Host-state delta: the workspace volume root was hardened from `0775` to `0755` (restore: `chmod g+w` on that volume root). The OL-055 launch bundle is staged in the operator-private launch directory; the live listener is the new manifest generation (gen 12, mode new, prior tested bundle link retained for `cutover.sh rollback`, un-executed).
- SQLite: only the additive `operator_audit` table + index (no row changes; pre-window backup + fresh in-window backup both integrity-ok).
- Real Weixin, real registered projects' Apply, 3080 GUI, 8123 proxy, model defaults, historical grants: untouched this round (0 live sends, 0 model sessions, 0 Apply).
- Carried trust-model limits (docs/022 + every report): same-user marker forgery, cross-root fencing absent, PATH ABA best-effort, OS TOCTOU, external writers, capability bearer ≠ named human, registration-time trust for frozen approvals.
- Node 22 itself is not installed on this host (v25.9.0 only) — the ubuntu CI step is the authority for Node 22 behavior.
