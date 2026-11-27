# REPORT-c6b2b5j — Offline Mac synthetic acceptance: Proxy input rejection + pre-pin safety (C6B2B5J / OL-20261112-017)

**Verdict: ALL_OFFLINE_PASS** (synthetic-only; no overclaim of authentication or race-free isolation).

## Scope and pins
- Task OL-20261112-017 (OFFLINE_SYNTHETIC_ONLY, requires_live_host_approval: false). Claimed ONCE at claim commit `c4226cf66d0bd875de349183f4c8b08e84dbeb27` (dispatch HEAD `2ef1c66e0ac24ec51c33cba7cbc95beffa2bafec`).
- Tested EXACT detached source SHA `6c9b7dfc99bd7f66fd1370410c695eeef1f2b6de` (pinned source, NOT the dispatch commit), clean worktree (`git status` 0 lines). Schema validated: `6c9b7df…` literal in current `LOCAL_AGENT_TASK.md` (grep count 1).
- Host: macOS, Node v25.9.0, pnpm 11.7.0. Owner-only 0700 disposable synthetic fixtures + 0600 marker/pin/receipts only.

## Gate A.1 — CI #346 (run 43113707101) + local full suite with exact count parity
- CI #346: head_sha=6c9b7df, run_number 346, conclusion success, 3/3 jobs (dsh-typecheck-and-build / local-first-core / macos-portability). Both OS logs fetch `+6c9b7dfc99bd7f66fd1370410c695eeef1f2b6de` literally; BOTH new Proxy regressions execute in BOTH OS logs (`synthetic reservation rejects Proxy inputs without invoking traps or writing receipt` — Linux 2 hits / macOS 1 hit; `registry-bound Proxy input is refused before pin and without executing traps` — Linux 2 / macOS 1).
- CI counts: Linux Node tests 213 / pass 213 / fail 0; macOS Node ℹ tests 213 / pass 213 / fail 0; both OS proxy 5/5; typecheck/build Vitest 62 files / 1208 tests passed, build complete. Ledger suite enrolled in BOTH OS workflow commands (grep -c = 2; identical 23-file command, lines 28 and 45).
- Local at pinned source: `pnpm install --frozen-lockfile` exit 0 (Done in 777ms); `pnpm check` exit 0 (Vitest 62/62 files, 1208/1208, build complete); CI-exact 23-file Node command exit 0 **213/213 fail 0**; standalone ledger suite exit 0 **31/31** (both B5J Proxy tests present at lines 54 and 430); proxy suite exit 0 **5/5**. Exact parity with CI #346.
- CI #344/#345 were cancelled (remote notes, not counted); our evidence is #346 only.

## Gate B — adversarial harness at 6c9b7df: ok=376 fail=0 exit 0
M-groups for the B5J fix (all refuse with `Invalid synthetic reservation` BEFORE any filesystem operation):
- M1 benign Proxy with canonical data keys: refused by `utilTypes.isProxy`, **zero traps executed** (get/getOwnPropertyDescriptor/ownKeys/getPrototypeOf counters stay 0), zero receipts; canonical plain object then reserves once and replay refuses (`already reserved`).
- M2 throwing-trap Proxy (getPrototypeOf/ownKeys/getOwnPropertyDescriptor throw): refused with traps=0 — user-controlled trap code never runs.
- M3 revoked Proxy (`Proxy.revocable` + revoke): refused BEFORE `getPrototypeOf` (a revoked proxy would throw TypeError on any trap), zero receipts; canonical reserves after refusal.
- M4 registry-bound Proxy: refused BEFORE the durable pin and before the receipt — no `.dsh-synthetic-ledger-pin.json`, zero receipts, approval ID not consumed; canonical reserves once, replay refuses.
- M6 fresh independent OS child process (`node --experimental-strip-types --input-type=module -e`): refuses benign-trap Proxy (traps=0) and revoked Proxy; exit 0; zero ledger writes before canonical reserve; canonical reserves after refusals — native `isProxy` works cross-process.
- L5 rewritten from the OL-016-era "Proxy accepted, traps ran" residual-limit assertion to post-B5J refusal semantics (the OL-016 L5 finding is fixed; the residual-limit evidence is preserved as M5 below).
- L6 accessor redefined onto a canonical field: still refused by the `hasOwn(value)` descriptor check, zero receipts (carried from B5I).
- Carried layers re-verified at 6c9b7df: own-property refusals (inherited/non-enumerable/Symbol), accessor+snapshot layers (K/L), pre-pin validation (I/J), registry/inode/directory replacement, cross-fixture, crash/torn receipt, journal overlap, preflight negative matrix, C6B2B4D one-winner fencing (6 independent OS children → 1 WIN 5 DENIED): all fail closed, zero new ledger entries, source bytes+mode unchanged throughout.

**NEW FINDING (for remote, minimal repro included):** the `reserveFixtureBoundSyntheticApproval` path validates the fixture binding marker against the RAW reservation input (`b.projectFingerprint!==reservation.projectFingerprint` → get trap runs; `realpath(reservation.journalRoot)` → get trap runs) BEFORE delegating to `reserveSyntheticApproval`, where the `isProxy` guard finally fires. Measured at 6c9b7df: a Proxy input to the fixture-bound API executes its `get` trap during binding validation (trap counter >0) before the reservation is refused; fail closed, zero receipts. This path is test-only (zero production callers) and registry-bound/plain paths normalize with `isProxy` first — but the asymmetry means fixture-bound callers can still execute user-controlled reflection code on a Proxy input. Suggested remote fix: normalize (or at least `utilTypes.isProxy`-reject) at the top of `reserveFixtureBoundSyntheticApproval` too. Harness M5 documents the measured behavior as a limitation, NOT a pass of the fix.

## Gate A.5 — production wiring
Zero production callers (scan over src/ and scripts/ excluding the module itself and node tests: 0 hits for module name, all 5 exports, `normalizeSyntheticReservation`, `isProxy` guard string). Default-OFF read-only; no integration with Runtime/Worker/Weixin/Outbox. Workflow ledger-suite enrollment grep -c = 2 (both OS commands).

## Residual limitations (unchanged, documented, never overclaimed)
Same-user forgery (marker is integrity evidence, not a signature); duplicate JSON keys last-wins; cross-process memory identity / independent project parents; OS TOCTOU/ABA; non-cooperating external writers; private per-transaction authority; backup/recovery; real Apply gates. The shape guard + snapshot + native isProxy is best-effort integrity evidence, NOT authenticated authority or race-free OS isolation.

## Scope compliance
No real Apply, no original DSH Session Prompt, no Weixin send/receive, no services 3080/3083/8123, no production DB, no model/provider/default/credential change, no historical grants, no non-fixture writes. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.

## Rollback
Local-only additions: worktrees `.worktrees/claim-c6b2b5j` and `.worktrees/stage-c6b2b5j`, private dir `~/.dsh-superagent-private/c6b2b5j/` (0700), private claim state file. Removing the worktrees and the private dir restores the previous local state; GitHub-side additions are docs-only (report + LO-017 + done receipt).
