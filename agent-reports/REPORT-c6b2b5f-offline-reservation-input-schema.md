# C6B2B5F — Local Mac synthetic reservation input strict-schema acceptance (sanitized)

**Verdict: ALL_OFFLINE_PASS**
**Pinned tested code SHA:** `90586e989b0b8eaf6b170611f560f2f824cc01df` (clean detached worktree, `git status` 0 lines; NOT the dispatch handoff commit)
**Task:** `OL-20261111-013` (OFFLINE_SYNTHETIC_ONLY). Claimed once (`c554e956850eefd8873dab30a8644f3ccba4ca0e`), never replayed OL-001…012.

## Gate A — CI parity + full offline suite (measured, not prefilled)

- CI #324 (run `43030672907`) at pinned SHA: `dsh-typecheck-and-build`, `local-first-core`, `macos-portability` all conclusion=success (3/3). Real macOS runner allocated (runner 1000002903). New B5F test `synthetic reservation rejects unexpected input keys before consuming approval` present in BOTH OS job logs (Linux: 2 log occurrences; macOS: 1 — test name + run header); both fetched the exact pinned SHA (`+90586e98…` in the fetch line of both logs). Linux and macOS both report `tests 206 / pass 206 / fail 0` for the Node suite and `tests 5 / pass 5` for the proxy suite. Vitest (typecheck job): 62 files / 1208 tests passed. Ledger suite enrolled in both OS workflow commands (grep count = 2).
- Local host: macOS, Node `v25.9.0`, pnpm `11.7.0`.
- `pnpm install --frozen-lockfile` exit 0. `pnpm check` exit 0: Vitest **62 files / 1208 tests** all pass, build complete (matches CI 1208/1208).
- CI-exact 23-file Node command on Mac: **206/206 pass**, exit 0 (matches CI `tests 206` on both OSes).
- Standalone ledger suite: **24/24** (the new B5F test among them; exit 0). Queue-proxy suite: **5/5** (exit 0).

## Gate B — synthetic adversarial harness (224 checks, ok=224 fail=0)

Disposable `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` fixtures directly under canonical OS temp; `0600` marker/pin/receipts only. Zero real-project writes; source bytes+mode invariant proved after sequences.

B5F-specific groups (new at `90586e98`: key-set guard at the top of `reserveSyntheticApproval` — non-object/array rejected, `Object.keys(reservation).sort().join(',')` must equal exactly the 7 canonical keys, throws `Invalid synthetic reservation` BEFORE any field validation or write):
- **I1 CORE:** all-7-valid-canonical + one unexpected enumerable field → refused `Invalid synthetic reservation` **before any receipt**; ZERO receipts; journal untouched; the SAME untouched approval ID can then be reserved once with exactly 7 canonical fields (`reserved`), and cannot be replayed (`already reserved`); inspect returns exactly the canonical receipt keys; source fixture bytes+mode invariant.
- **I2** refusal leaves no partial artifact: ledger dir dev/ino unchanged, zero receipts, no auto-cleanup needed (nothing ambiguous to reconcile).
- **I3** input-shape negatives all refused before any write: null, undefined, `[]`, frozen array, partial object, wrong types per field (approvalId number, version string, operation out-of-set, fingerprint non-hex, digest number, transactionId null, journalRoot number, empty approvalId) → all `Invalid synthetic reservation`, zero receipts.
- **I4** every one of the 7 required keys deleted individually → key-set guard refuses; after all negatives the canonical input still reserves.
- **I5 limitation (audited, distinct PASS/NOT_COVERED):** inherited (prototype) and non-enumerable keys are INVISIBLE to `Object.keys` → they pass the key-set guard and the reservation succeeds (one receipt). Own-enumerable extra is still refused. The guard validates the OWN ENUMERABLE set only — not authentication.
- **I6 FINDING for remote:** on the registry-bound path the durable pin is written BEFORE the key-set guard runs (the guard lives inside `reserveSyntheticApproval`, reached via `reserveFixtureBoundSyntheticApproval` at the end of `reserveRegistryBoundSyntheticApproval`): an extra-key input on this path leaves the durable pin written while the receipt is refused (pinExists=true observed; zero receipts). Reported, not fixed locally (local must not modify product source).
- **I7** key-set check is set-equality and order-insensitive: a full permutation of the 7 canonical keys reserves successfully (sorted comparison).
- **I8** fresh OS process (no shared memory) denies extra-key input `Invalid synthetic reservation`; zero receipts written by the child.
- **I9** B5E receipt-side controls re-verified at B5F: extra-key RECEIPT rejected `Corrupt synthetic reservation`, byte-identical after rejection (read-only), consumed approval stays non-replayable under tamper.
- **I10** ledger-directory inode replacement (rename-aside + fresh mkdir) still refused `ledger directory identity changed` at B5F; new dir holds zero receipts (cross-fixture/G21/G22 semantics intact).

Carried-over regressions re-verified at `90586e98`: full B5/B5C/B5D/B5E layers (G1–G27, H1–H10: durable pin guards, cross-fixture binding and precedence, 6-way cross-process one-winner, crash-after-partial terminal invariants, inode/deletion/ledger-directory continuity, error-message no-path-leak, receipt strict schema) plus registry-bound preflight negative matrix (uppercase/unknown ID, fingerprint mismatch, alt journal, marker guards, nested fixture, readOnly/git ineligible, ancestor/root symlink swaps, ordinary same-path replacements) and C6B2B4D fencing (one-use, duplicate reconciliation, 26-byte partial terminal + corrupt-inspector no-repair, fresh-approval-ID cross-process single winner).

## Known limitations (documented, NOT fixed — remote owns the code)

- **Not authenticated approval:** extra-key input validation is a shape guard; same-user forgery (forged receipt/pin with canonical field set) remains accepted; prototype/inherited and non-enumerable keys bypass `Object.keys`-based set equality (I5).
- **Duplicate JSON keys:** last-wins collapse (H7); differing duplicate values surface as value corruption, not key-set violation.
- **Cross-process pin continuity / independent project parents / OS TOCTOU / ABA / external writers:** unchanged (fresh processes do not inherit in-memory identity evidence; mid-flight swaps complete in fresh processes).
- **Private transaction authority, backup and recovery:** unresolved. No race-free filesystem security claimed.
- Registry-bound ordering finding (I6): pin-before-input-guard leaves a durable pin when input is refused (receipt still refused; no double-write).

## Gate A.5 — deployment constraint

Zero production callers: grep for the module name, all five exports and the new error string over `src/` + `scripts/` (excluding the module itself and node-tests) → **0 hits** (rc=1). The module imports only Node builtins plus `projectFingerprint`/`LocalProjectRegistry` types — no Runtime/Worker, no Weixin/Outbox, no original-DSH integration. Default-OFF, read-only except `wx 0600` receipt + dir fsync. Workflow enrollment confirmed on both OS commands (grep count = 2).

## Scope compliance

No real project Apply, no original DSH Session Prompt, no Weixin send, no 3080/3083/8123 changes, no production SQLite, no model/provider/default/credential changes, no historical live grant reuse, no non-fixture host writes. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.

## Rollback

Local-only additions this round: detached worktrees `.worktrees/claim-c6b2b5f` and `.worktrees/stage-c6b2b5f`, harness/report under `~/.dsh-superagent-private/c6b2b5f/` (0700 dir, 0600 files), private claim state update. Remove worktrees + private dir to restore prior state; branch advanced only by the claim + docs commits (normal non-force fast-forward pushes, no force, no rebase).
