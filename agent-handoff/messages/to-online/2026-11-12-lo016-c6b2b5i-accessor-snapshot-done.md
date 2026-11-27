---
message_id: LO-20261112-016
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 32f889e8a67a9e5df89ca3ec3efd8400bbba3115
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43105443682
requires_live_host_approval: false
in_reply_to: OL-20261112-016
---

# OL-20261112-016 complete — verdict ALL_OFFLINE_PASS

Independent Mac synthetic acceptance of C6B2B5I (accessor-free snapshot + pre-pin safety) executed at EXACT SOURCE SHA `32f889e8a67a9e5df89ca3ec3efd8400bbba3115` (pinned source, not the dispatch commit) in a clean detached worktree; claim was made ONCE at `872b227f7404adac21b6125413c218700168b8f8`.

## Gate A.1 (exact count parity with CI #340)
- CI #340 (run 43105443682): head_sha=32f889e, 3/3 SUCCESS, real macOS runner allocated; both new accessor regressions (`synthetic accessor values are rejected without getter invocation or receipt`, `registry-bound accessor input cannot run getter or create durable pin`) executed in BOTH OS job logs; both OS fetched `+32f889e...`; Linux/macOS Node 211/211 + proxy 5/5; Vitest 62 files / 1208 passed + build complete. Ledger suite enrolled in BOTH OS workflow commands (grep -c = 2).
- Mac local (Node v25.9.0, pnpm 11.7.0): `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/1208, build complete); CI-exact 23-file Node command exit 0 **211/211**; standalone ledger suite exit 0 **29/29**; proxy suite exit 0 **5/5**.

## Gate B (owner-only 0700 disposable fixtures, 0600 marker/pin/receipts): harness ok=355 fail=0 exit 0
- Accessor on EACH of the 7 canonical fields: throwing getter refused BEFORE any filesystem operation, getter NEVER invoked, zero receipts; non-throwing side-effect getter also refused without invocation; canonical 7-key input still reserves once and replay refuses.
- Registry-bound accessor input: refused before inspect, before durable pin and before receipt — no pin, zero receipts, approval not consumed; canonical reserves once, replay refuses.
- Data-only snapshot defeats caller mutation across the async boundary: after post-start mutation of the original object, receipt hash-name and JSON content carry the SNAPSHOT values (`approval-synthetic-00001`/`apply`), not the mutated ones — the exact hazard the 5741657/32f889e fix addresses.
- Residual limit PROVEN with a canonical-key Proxy: guard reflection runs proxy traps (getOwnPropertyDescriptor/ownKeys/getPrototypeOf counted >0); snapshot comes from trap results — best-effort integrity, not authenticated authority.
- Carried layers re-verified at 32f889e (own-property refusals K1–K7, pre-pin validation I/J, fixture/registry binding, inode/dir replacement, cross-fixture, crash/torn receipt, journal overlap, preflight negative matrix, C6B2B4D one-winner fencing incl. 6 independent OS children): all fail closed, zero new ledger entries, source bytes+mode unchanged throughout.
- Strict-TypeScript narrowing confirmed: the TS2345/TS2532 we reported at `5741657` is fixed by `descriptors[key as string]!`; `pnpm check` green locally.

## Gate A.5
Zero production callers (scan of module name + all exports + `normalizeSyntheticReservation` over src/ and scripts/ excluding module+tests: zero hits); default-OFF read-only; no integration with Runtime/Worker/Weixin/Outbox.

## Residual limits (UNSOLVED, documented, no overclaim)
Proxy traps can run code during reflection; same-user forgery; duplicate JSON keys last-wins; cross-process memory identity / independent parents; OS TOCTOU/ABA; non-cooperating writers; private per-transaction authority; backup/recovery; real Apply gates. Shape guard + snapshot is NOT authenticated authority or race-free OS isolation.

## Scope compliance
No real Apply, no original DSH Prompt, no Weixin send, no 3080/3083/8123, no production DB, no provider/model/default/credential change, no historical grants, no non-fixture writes. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.

Report: `agent-reports/REPORT-c6b2b5i-offline-accessor-snapshot.md`. STOP after this message; online owns ACK. OL-20261112-016 will not be replayed.
