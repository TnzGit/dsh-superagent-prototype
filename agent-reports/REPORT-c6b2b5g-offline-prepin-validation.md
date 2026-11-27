# C6B2B5G — Local Mac registry-bound pre-pin input validation acceptance (sanitized)

**Verdict: ALL_OFFLINE_PASS**
**Pinned tested code SHA:** `959f8346dd77505af432762c17428e21f505a45c` (clean detached worktree, `git status` 0 lines; NOT the dispatch handoff commit)
**Task:** `OL-20261111-014` (OFFLINE_SYNTHETIC_ONLY). Claimed once (`86fc7fa44bf9b0c7eb0535595605facde89f03e0`), never replayed OL-001…013.

## Gate A — CI parity + full offline suite (measured, not prefilled)

- CI #329 (run `43039758160`) at pinned SHA: `dsh-typecheck-and-build`, `local-first-core`, `macos-portability` all conclusion=success (3/3). Real macOS runner allocated (job ids 130588244638/130588244987/130588245122). New B5G test `registry-bound invalid reservation input leaves no durable pin or receipt` present in BOTH OS job logs (Linux: 2 occurrences; macOS: 1); both fetched the exact pinned SHA (`+959f834…` fetch line). Linux and macOS both report `tests 207 / pass 207 / fail 0` for the Node suite and `tests 5 / pass 5` for the proxy suite. Vitest (typecheck job): 1208/1208 passed. Ledger suite enrolled in both OS workflow commands (grep count = 2).
- Local host: macOS, Node `v25.9.0`, pnpm `11.7.0`.
- `pnpm install --frozen-lockfile` exit 0. `pnpm check` exit 0: Vitest **62 files / 1208 tests** all pass, build complete (matches CI 1208/1208).
- Verbatim CI-exact 23-file Node command on Mac: **207/207 pass**, exit 0 (matches CI `tests 207` on both OSes).
- Standalone ledger suite: **25/25** (the new B5G test among them; exit 0). Queue-proxy suite: **5/5** (exit 0).

## Source change reviewed (90586e9 → 959f834)

Exactly the fix for the OL-013 I6 finding: a full input-validation guard (key-set equality on the 7 canonical keys + per-field type/schema checks) is now the FIRST statement of `reserveRegistryBoundSyntheticApproval`, throwing `Invalid synthetic reservation` BEFORE `inspectRegistryBoundSyntheticApproval`, before the durable pin write, and before any receipt/journal mutation. Plus docs/handoff closure of OL-013. No other source changes.

## Gate B — synthetic adversarial harness (285 checks, ok=285 fail=0)

Disposable `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` fixtures directly under canonical OS temp; `0600` marker/pin/receipts only. Zero real-project writes; source bytes+mode invariant proved after sequences.

B5G-specific groups (J1–J7):
- **J1 CORE:** registry-bound input with all 7 canonical fields + one unexpected enumerable field refused `Invalid synthetic reservation` BEFORE any durable pin, receipt, or journal mutation (no pin file, zero receipts, journal empty, ledger inode unchanged, source invariant); the valid canonical input then reserves once (pin + exactly one hash-named receipt) and cannot be replayed (`already reserved`).
- **J2** each of the 7 canonical keys deleted individually → refused before pin/receipt; after all negatives the canonical input still reserves.
- **J3** input-shape negatives (null/undefined/empty object/partial object/`[]`/wrong per-field types: numeric approvalId/version/previewDigest, out-of-set operation, non-hex fingerprint, null transactionId, numeric/empty journalRoot, empty approvalId) all refused before any write; **audited positive:** a frozen canonical-7 object is VALID (freeze is not an invalidation) and reserves.
- **J4 ORDERING PROOF:** on a fixture with NO binding marker, an extra-key input reports `Invalid synthetic reservation` (guard precedes inspect) rather than the marker error — the validation really runs first.
- **J5 limitation (audited, NOT_COVERED):** inherited (prototype) and non-enumerable keys are invisible to `Object.keys` → accepted on the registry-bound path too (pin+receipt written). Shape guard, not authentication.
- **J6** fresh OS process (no shared memory) denies registry-bound extra-key input (`DENIED:Invalid synthetic reservation`, pin=false, recv=0).
- **J7** refused input while a prior pin exists leaves the pin and receipt byte-identical (no mutation of durable state).
- **I6 REMOTE FIX VERIFIED:** at `959f834` the OL-013 finding (pin written before the input guard on the registry-bound path) is resolved — rejection now leaves NO durable pin.

Carried-over regressions re-verified at `959f834`: full B5/B5C/B5D/B5E/B5F layers (G1–G27, H1–H10, I1–I10: durable pin guards, cross-fixture binding and precedence, 6-way cross-process one-winner, crash-after-partial terminal invariants, inode/deletion/ledger-directory continuity, receipt strict schema, generic-path input strict schema) plus registry-bound preflight negative matrix (uppercase/unknown ID, fingerprint mismatch, alt journal, marker guards, nested fixture, readOnly/git ineligible, ancestor/root symlink swaps, ordinary same-path replacements) and C6B2B4D fencing (one-use, duplicate reconciliation, 26-byte partial terminal + corrupt-inspector no-repair, fresh-approval-ID cross-process single winner).

## Known limitations (documented, NOT fixed — remote owns the code)

- Not authenticated approval: same-user forgery (forged receipt/pin/marker with canonical field set) remains accepted; prototype/inherited and non-enumerable keys bypass the `Object.keys`-based set equality (J5).
- Duplicate JSON keys collapse last-wins (H7); differing values surface as value corruption.
- Cross-process continuity: fresh processes do not inherit in-memory identity evidence (pin cross-instance coverage is the durable parent pin only); independent project parents have separate pins; OS TOCTOU/ABA; external writers uncooperative.
- Private transaction authority, backup and recovery: unresolved. No production-grade fencing claimed.

## Gate A.5 — deployment constraint

Zero production callers: grep for the module name, all five exports and the error string over `src/` + `scripts/` (excluding the module itself and node-tests) → **0 hits** (rc=1). Module imports only Node builtins plus `projectFingerprint`/`LocalProjectRegistry` types — no Runtime/Worker/Weixin/Outbox/original-DSH integration. Default-OFF, read-only except `wx 0600` receipt + dir fsync. Workflow enrollment confirmed on both OS commands (grep count = 2).

## Scope compliance

No real project Apply, no original DSH Session Prompt, no Weixin send, no 3080/3083/8123 changes, no production SQLite, no model/provider/default/credential changes, no historical live grant reuse, no non-fixture host writes. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.

## Rollback

Local-only additions this round: detached worktrees `.worktrees/claim-c6b2b5g` and `.worktrees/stage-c6b2b5g`, harness/report under `~/.dsh-superagent-private/c6b2b5g/` (0700 dir, 0600 files), private claim state update. Remove worktrees + private dir to restore prior state; branch advanced only by the claim + docs commits (normal non-force fast-forward pushes, no force, no rebase).
