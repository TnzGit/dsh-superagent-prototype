# REPORT-c6b2b5n — Offline hostile read-only ledgerRoot acceptance (Mac)

**Verdict:** ALL_OFFLINE_PASS
**Pinned source SHA:** `0cf3915ac4acb8d269c7dc7679d3885c38d04415` (the fix commit; dispatch commit `b26d858` is NOT the source)
**Claim:** `49e0a7adf55732423ed86528507815f31c30ebed`
**Task:** OL-20261112-021 / C6B2B5N, OFFLINE_SYNTHETIC_ONLY
**Host:** macOS (Apple Silicon workstation), Node `v25.9.0`, pnpm `11.7.0`

## 1. Source-CI reconciliation (CI #368, run 43177644003)

- Run conclusion **success**, attempt 1, head_sha = `0cf3915…`, 3/3 jobs success with real macOS runner allocated (`GitHub Actions 1000003105`).
- Both fetched at the exact source (`+0cf3915ac4acb8d269c7dc7679d3885c38d04415` literal fetch lines in both OS logs).
- New regression `read-only synthetic inspection rejects hostile ledger roots before path coercion` executed in BOTH OS logs (Linux: 2 hits, macOS: 1 hit). Earlier carried tests (malicious receipt/approval IDs, Proxy/accessor preflight, hostile project IDs) also present in both logs (Linux 4, macOS 2).
- Node counts: Linux `# tests 218 / pass 218 / fail 0` + proxy `5/5`; macOS `ℹ tests 218 / pass 218 / fail 0` + proxy `5/5`; typecheck job Vitest `62 files / 1208 tests passed`.
- Workflow enrolls the synthetic ledger suite in BOTH exact Node commands (`grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2, lines 28 and 45 identical).

## 2. Local Gate A.1 (clean detached worktree at pinned source, 0 dirty lines)

- `pnpm install --frozen-lockfile` exit 0.
- `pnpm check` exit 0: Vitest 62 files / 1208 tests passed, build complete.
- CI-exact 27-file Node command exit 0: `ℹ tests 218 / pass 218 / fail 0`.
- Standalone synthetic ledger suite exit 0: 36/36 (incl. both new B5N tests).
- Proxy suite exit 0: 5/5.
- **Exact parity with CI #368**: 218/218, 5/5, 1208.

## 3. Source change reviewed (diff `c1fe46a..0cf3915`)

Module change is ONE line in `src/local-first/non-git-synthetic-approval-ledger.ts`: `inspectSyntheticApproval` (`:102`) now rejects `typeof ledgerRoot!=='string'||!ledgerRoot` with `Invalid synthetic ledger root` **before** `realpath(ledgerRoot)`; plus a 14-line regression test (`tests/local-nongit-synthetic-approval-ledger.node-test.mjs:123`). Guard order: approvalId guard first (`:101`), then ledgerRoot guard (`:102`), then `realpath`/`lstat`/receipt validation (`:103+`).

## 4. Independent adversarial harness — 531 checks, 0 failures

Harness `preflight_acceptance.mts` (owner-only 0700 synthetic fixtures only). New O groups at the pinned source, all carried B4C–B5M layers re-verified green in the same run:

- **O1**: 13 hostile ledgerRoot shapes refused before coercion with **zero toString/valueOf/Proxy-trap invocations** (malicious toString+valueOf, throwing Proxy get+getPrototypeOf, non-throwing get-trap Proxy, revoked Proxy, null, 42, `{}`, boxed String, Symbol, function, Map, getter-backed object, object whose toString returns the valid path), plus empty string; zero ledger mutation in all cases. Proves the typeof-first guard never touches path coercion.
- **O2**: on an EXISTING valid receipt: empty string + all hostile roots refused without consumption/overwrite; receipt bytes, mode `0600` and nlink 1 identical after every hostile inspection; canonical root inspectable read-only with canonical facts; replay of the consumed ID refuses (`already reserved; human reconciliation required`). Audited boundary: `'   '` (truthy non-empty string) passes the input guard then fails closed at `realpath` ENOENT — fail-closed, not a coercion leak.
- **O3**: guard ORDER: hostile id refused first (`Invalid synthetic approval ID`) and the hostile root object never touched; valid-shape missing path fails closed at lstat/realpath (`ENOENT`/`Unsafe synthetic ledger root`), no coercion path.
- **O4**: string roots that pass the input guard still fail closed on the unsafe-mode path: symlinked ledger root → `Unsafe synthetic ledger root`; chmod 0755 → `Unsafe synthetic ledger root` (then restored).
- **O5**: fresh OS child process (independent of any in-process memory) refuses malicious-toString/revoked-Proxy/null/42/boxed-String roots with `coerced=0`, exit 0.
- Carried layers (all green at this SHA): C6B2B4C–B4E preflight/registry binding, B4F inode identity + B4G ancestor identity, B5/B5D durable-pin + receipt strict schema + cross-fixture + ledger-dir replacement + one-use fencing + cross-process 1-WIN/5-DENIED, B5E unexpected-field receipt, B5F reservation input schema, B5G pre-pin validation, B5H own-property keys, B5I accessor-free snapshot + Proxy rejection, B5J fixture-bound Proxy, B5K ledger/journal read-only guards, B5L hostile approval IDs + malformed on-disk identity types + registry-bound preflight, B5M hostile project IDs (N1–N6 incl. `9lives` schema-only positive control).
- Source bytes + full modes of fixture sources invariant after every group.

**Harness bug lessons (this round):** (1) `grant()` arity — generic reservation needs `projectFingerprint` argument; (2) `statSync` not imported in harness — use `lstatSync`; (3) JS operator precedence: `x & 0o7777 === y` parses as `x & (0o7777===y)` — bitwise masks need parentheses in asserts; (4) child `-e` script builder keeps array-join style with single-quoted outer strings.

## 5. Residual limits (re-confirmed, unchanged)

Shape guards are best-effort integrity evidence, NOT authenticated authority and NOT race-free descriptor-relative capability: same-user marker/pin forgery; independent-process and independent-parent global identity; OS TOCTOU/ABA (path-based re-check, not fd-relative); non-cooperating external writers; private per-transaction authority; backup/recovery; real Apply gates all remain UNSOLVED by design. Whitespace-string boundary (`'   '`) is fail-closed at realpath rather than at the input guard — acceptable, no leak.

## 6. Zero-caller scan (Gate A.5)

At `0cf3915`: module name + all five exports + `normalizeSyntheticReservation` + guard messages scanned over `src/` and `scripts/` excluding the module itself and node-tests → **0 hits**. Default-OFF, read-only; the module writes only `wx` 0600 receipts + dir fsync. Workflow enrollment re-confirmed (grep -c = 2).

## 7. Scope compliance

No real Apply, no Weixin, no original DSH Prompt, no 3080/3083/8123 services, no production DB, no model/provider/credential/default changes, no historical grants. Writes ONLY inside owner-only disposable synthetic temp fixtures.

## 8. Rollback

Local additions this round: worktrees `.worktrees/claim-c6b2b5n` + `.worktrees/stage-c6b2b5n` (repo root), private dir `~/.dsh-superagent-private/c6b2b5n/`, updated private claim state (`claim-OL-20261112-021`, `last_head`). Rollback = remove the two worktrees + private dir; claim state files revert to prior `last_head`. No product source modified; no local service configuration touched.
