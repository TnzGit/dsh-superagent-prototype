# REPORT-c6b2b5o — Offline hostile path-input acceptance across all exported synthetic APIs (Mac)

**Verdict:** ALL_OFFLINE_PASS
**Pinned source SHA:** `f25207d6cd2549eafceb13ec52d21823bdb9c3af` (the fix commit; dispatch commit `1b6d7502f8afda7963077094bcc88778df6fa1c0` is NOT the source)
**Claim:** `a9e1b96018b2b3bb3036aa6568d5987e6e1d3e27`
**Task:** OL-20261112-022 / C6B2B5O, OFFLINE_SYNTHETIC_ONLY
**Host:** macOS (Apple Silicon workstation), Node `v25.9.0`, pnpm `11.7.0`

## 1. Source-CI reconciliation (CI #373, run 43188575956)

- Run conclusion **success**, attempt 1, head_sha = `f25207d…`, 3/3 jobs success with real macOS runner allocated (`GitHub Actions 1000003121`).
- Both OS logs fetch at the exact source (literal `+f25207d6cd2549eafceb13ec52d21823bdb9c3af` fetch lines) and execute BOTH new path-validation cases — `all synthetic ledger root entry points reject hostile non-string and blank paths before side effects` and `fixture and registry synthetic entry points reject hostile fixture paths before registry or pin access` (Linux: 2 hits each, macOS: 1 hit each).
- Node counts: Linux `# tests 220 / pass 220 / fail 0` + proxy `5/5`; macOS `ℹ tests 220 / pass 220 / fail 0` + proxy `5/5`; typecheck job Vitest `62 files / 1208 tests passed`.
- Workflow enrolls the synthetic ledger suite in BOTH exact Node commands (`grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2, lines 28/45 identical 23-file command).

## 2. Local Gate A.1 (clean detached worktree at pinned source, 0 dirty lines)

- `pnpm install --frozen-lockfile` exit 0 (Done in 1.6s).
- `pnpm check` exit 0: Vitest 62 files / 1208 tests passed, build complete.
- CI-exact 23-file Node command exit 0: `ℹ tests 220 / pass 220 / fail 0`.
- Standalone synthetic ledger suite exit 0: 38/38 (both new B5O tests present).
- Proxy suite exit 0: 5/5.
- **Exact parity with CI #373**: 220/220, 5/5, 1208.

## 3. Source change reviewed (diff `c1fe46a…0cf3915 → f25207d`, +49/−1)

Four guards added in `src/local-first/non-git-synthetic-approval-ledger.ts` (module-only; tests +38 lines):
- `reserveSyntheticApproval` (`:62-65`): `typeof ledgerRoot!=='string'||!ledgerRoot.trim()` → `Invalid synthetic ledger root` **before** the first `lstat`.
- `inspectSyntheticApproval` (`:106`): `!ledgerRoot` tightened to `!ledgerRoot.trim()` — this directly absorbs the OL-021 audited boundary (a whitespace-only root previously passed the typeof guard and only failed closed later at `realpath` ENOENT; it is now refused at the input guard with zero FS contact).
- `reserveFixtureBoundSyntheticApproval` (`:145-147`): fixtureRoot guard after `normalizeSyntheticReservation`, before `lstat(fixtureRoot)`.
- `inspectRegistryBoundSyntheticApproval` (`:285-288`): fixtureRoot guard before `projectId` validation, `registry.get`, identity attestation and filesystem; `reserveRegistryBoundSyntheticApproval` inherits the same gate through its delegation.

## 4. Independent adversarial harness — 671 checks, 0 failures

Harness `preflight_acceptance.mts` (owner-only 0700 synthetic fixtures only). New P groups at the pinned source; all carried B4C–B5N layers re-verified green in the same run:

- **P1**: generic `reserveSyntheticApproval` + `inspectSyntheticApproval` against 13 hostile ledgerRoot shapes (malicious toString+valueOf, throwing Proxy get+getPrototypeOf, non-throwing get-trap Proxy, revoked Proxy, null, 42, true, array, plain object, boxed String, Symbol, function, Map) → all refused with **zero toString/valueOf/trap invocations** and zero ledger mutation; empty string refused on both entry points; source bytes+mode+entry count invariant.
- **P2**: blank/whitespace ledgerRoot (`'   '`, `'\t'`, `'\n'`, `' '`, `' \t '`) refused at the INPUT guard across reserve+inspect (post-fix boundary; the OL-021 whitespace audit is now closed); coercion-capable object refused, toString never executed; zero mutation.
- **P3**: `reserveFixtureBoundSyntheticApproval` + `inspectRegistryBoundSyntheticApproval` + `reserveRegistryBoundSyntheticApproval` against 12 hostile fixtureRoot shapes vs a stub registry whose `get`/`assertRegisteredRootIdentity` throw when called → **zero coercion/trap invocations, zero registry reads, zero receipts, no durable pin in the disposable parent**, source invariant.
- **P4**: object whose `toString` returns the VALID path still refused by the typeof guard (toString never executed); canonical plain paths reserve exactly once and replay denies on all three bound APIs (`already reserved; human reconciliation required`); registry-bound inspect returns canonical frozen facts.
- **P5**: on an EXISTING receipt+durable pin, hostile ledger/fixture roots across all five APIs cannot consume or overwrite: receipt bytes, mode 0600, nlink 1 unchanged; pin bytes+mode unchanged; no additional receipt; canonical inspection still succeeds after the barrage.
- **P6**: fresh OS child process (independent of any in-process memory) — 6 hostile shapes × 4 entry points = 24 refusals, `coerced=0`, `recv=0`, exit 0.
- Carried layers (all green at this SHA): B4C–B4E preflight/registry binding, B4F inode identity, B4G ancestor identity, B5/B5D durable pin + strict receipt schema + cross-fixture + ledger-dir replacement + one-use fencing + cross-process 1-WIN/5-DENIED, B5E unexpected receipt fields, B5F reservation input schema, B5G pre-pin validation, B5H own-property keys, B5I accessor-free snapshot + Proxy rejection, B5J fixture-bound Proxy, B5K read-only guards, B5L hostile approval IDs + malformed on-disk identity types, B5M hostile project IDs (incl. `9lives` schema-only positive control), B5N hostile ledger roots (O1–O5).
- Source bytes + full modes invariant after every group.

**Harness bug lesson (this round):** child `-e` script read `process.argv[2..5]` directly — with `node -e` argv[0] is the binary and user args start at argv[1]; fixed to `process.argv.slice(1)` destructuring (the pattern every other child group in this harness uses).

## 5. Residual limits (re-confirmed, unchanged)

Shape guards are best-effort integrity evidence, NOT authenticated authority and NOT race-free descriptor-relative capability: same-user marker/pin forgery; independent-process and independent-parent global identity; OS TOCTOU/ABA (path-based re-check, not fd-relative); non-cooperating external writers; private per-transaction authority; backup/recovery; real Apply gates all remain UNSOLVED by design. Proxy traps still run user code wherever reflection touches raw input (all five entry points now normalize/guard first, so the known raw-read windows are closed for path inputs).

## 6. Zero-caller scan (Gate A.5)

At `f25207d`: module name + all five exports + `normalizeSyntheticReservation` + both guard messages scanned over `src/` and `scripts/` excluding the module itself and node-tests → **0 hits**. Default-OFF, read-only; the module writes only `wx` 0600 receipts + dir fsync. Workflow enrollment re-confirmed (grep -c = 2).

## 7. Scope compliance

No real Apply, no Weixin, no original DSH Prompt, no 3080/3083/8123 services, no production DB, no model/provider/credential/default changes, no historical grants. Writes ONLY inside owner-only disposable synthetic temp fixtures.

## 8. Rollback

Local additions this round: worktrees `.worktrees/claim-c6b2b5o` + `.worktrees/stage-c6b2b5o` (repo root), private dir `~/.dsh-superagent-private/c6b2b5o/`, updated private claim state (`claim-OL-20261112-022`, `last_head`). Rollback = remove the two worktrees + private dir; claim state files revert to prior `last_head`. No product source modified; no local service configuration touched.
