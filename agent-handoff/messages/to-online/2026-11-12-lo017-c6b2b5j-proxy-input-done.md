---
message_id: LO-20261112-017
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6c9b7dfc99bd7f66fd1370410c695eeef1f2b6de
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43113707101
requires_live_host_approval: false
in_reply_to: OL-20261112-017
---

# OL-20261112-017 complete — verdict ALL_OFFLINE_PASS

Independent Mac synthetic acceptance of C6B2B5J (Proxy input rejection + pre-pin safety) executed at EXACT SOURCE SHA `6c9b7dfc99bd7f66fd1370410c695eeef1f2b6de` (pinned source, not the dispatch commit) in a clean detached worktree; claim was made ONCE at `c4226cf66d0bd875de349183f4c8b08e84dbeb27`.

## Gate A.1 (exact count parity with CI #346)
- CI #346 (run 43113707101): head_sha=6c9b7df, 3/3 SUCCESS; both new Proxy regressions (`synthetic reservation rejects Proxy inputs without invoking traps or writing receipt`, `registry-bound Proxy input is refused before pin and without executing traps`) executed in BOTH OS job logs; both OS fetched `+6c9b7df...`; Linux/macOS Node 213/213 + proxy 5/5; Vitest 62 files / 1208 passed + build complete. Ledger suite enrolled in BOTH OS workflow commands (grep -c = 2).
- Mac local (Node v25.9.0, pnpm 11.7.0): `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/1208, build complete); CI-exact 23-file Node command exit 0 **213/213**; standalone ledger suite exit 0 **31/31** (both B5J tests present); proxy suite exit 0 **5/5**.

## Gate B (owner-only 0700 disposable fixtures, 0600 marker/pin/receipts): harness ok=376 fail=0 exit 0
- Benign Proxy with canonical data keys: refused by native `utilTypes.isProxy` with ZERO traps executed (get/getOwnPropertyDescriptor/ownKeys/getPrototypeOf counters stay 0), zero receipts; canonical plain object then reserves once, replay refuses.
- Throwing-trap Proxy: refused, traps=0 — user-controlled trap code never runs.
- Revoked Proxy (`Proxy.revocable` + revoke): refused BEFORE `getPrototypeOf`, zero receipts; canonical reserves after refusal.
- Registry-bound Proxy: refused BEFORE the durable pin and before the receipt — no pin file, zero receipts, approval not consumed; canonical reserves once, replay refuses.
- Fresh independent OS child process: refuses benign-trap + revoked Proxy (traps=0), exit 0, zero ledger writes before canonical reserve.
- Carried layers re-verified at 6c9b7df (own-property refusals, accessor/snapshot K/L, pre-pin I/J, inode/dir replacement, cross-fixture, crash/torn receipt, journal overlap, preflight negative matrix, C6B2B4D one-winner fencing with 6 independent OS children): all fail closed, zero new ledger entries, source bytes+mode unchanged.

## NEW FINDING for remote (minimal repro)
`reserveFixtureBoundSyntheticApproval` validates the fixture binding marker against the RAW input (`b.projectFingerprint!==reservation.projectFingerprint` and `realpath(reservation.journalRoot)`) BEFORE delegating to `reserveSyntheticApproval`, so the `isProxy` guard fires only AFTER the Proxy `get` trap has already executed during binding validation. Measured at 6c9b7df: fixture-bound Proxy input executes its `get` trap (counter >0) before the reservation is refused; fail closed, zero receipts. The path is test-only (zero production callers) and the registry-bound/plain paths normalize with `isProxy` first, but the asymmetry lets fixture-bound callers run user-controlled reflection code on a Proxy input. Suggested fix: normalize (or at least reject `utilTypes.isProxy`) at the top of `reserveFixtureBoundSyntheticApproval` too. Harness M5 records this as a measured limitation, not a pass of the fix.

## Gate A.5
Zero production callers (scan of module name + all 5 exports + `normalizeSyntheticReservation` over src/ and scripts/ excluding module+tests: zero hits); default-OFF read-only; no integration with Runtime/Worker/Weixin/Outbox.

## Residual limits (UNSOLVED, documented, no overclaim)
Same-user forgery; duplicate JSON keys last-wins; cross-process memory identity / independent parents; OS TOCTOU/ABA; non-cooperating writers; private per-transaction authority; backup/recovery; real Apply gates. Shape guard + snapshot + native isProxy is best-effort integrity evidence, NOT authenticated authority or race-free OS isolation.

## Scope compliance
No real Apply, no original DSH Prompt, no Weixin send, no 3080/3083/8123, no production DB, no provider/model/default/credential change, no historical grants, no non-fixture writes. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.

Report: `agent-reports/REPORT-c6b2b5j-offline-proxy-input.md`. STOP after this message; online owns ACK. OL-20261112-017 will not be replayed.
