# C6B2B5I — Offline Mac acceptance: accessor-free snapshot and pre-pin safety (OL-20261112-016)

**Verdict: ALL_OFFLINE_PASS.** Independent Mac synthetic acceptance of the accessor-snapshot guard at EXACT SOURCE SHA `32f889e8a67a9e5df89ca3ec3efd8400bbba3115` (pinned source, not the dispatch commit `bc350bc`).

## A. Environment
- macOS (Apple Silicon, ExternalIntel volume), Node v25.9.0, pnpm 11.7.0.
- Isolated detached worktree `.worktrees/stage-c6b2b5i` at `32f889e` (git status 0 lines).
- No live host writes: services 3080/3083/8123, Weixin, DSH Runtime/Worker, production SQLite, provider/model defaults untouched. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.

## B. Gate A.1 — CI #340 + local parity (exact count match)
- CI #340 run 43105443682: head_sha=`32f889e`, run_number 340, 3/3 SUCCESS per job; real macOS runner 1000003017 allocated.
- Both new accessor regressions present in BOTH OS job logs: `synthetic accessor values are rejected without getter invocation or receipt` and `registry-bound accessor input cannot run getter or create durable pin`.
- Both OS fetched `+32f889e8a67a9e5df89ca3ec3efd8400bbba3115`; Linux Node 211/211 + proxy 5/5; macOS Node 211/211 + proxy 5/5; typecheck job Vitest 62 files / 1208 passed, build complete.
- Workflow enrolls the ledger suite in BOTH OS commands (grep -c = 2: Linux line 28, macOS line 45; identical 23-file command).
- Local: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/1208, build complete); CI-exact 23-file Node command exit 0 **211/211**; standalone ledger suite exit 0 **29/29** (both new B5I tests present); proxy suite exit 0 **5/5**.

## C. Source review (6dff9f3..32f889e, src+tests only, +59/-21)
- New `normalizeSyntheticReservation()` in `src/local-first/non-git-synthetic-approval-ledger.ts`: shape check via `Object.getOwnPropertyDescriptors` (7 canonical string keys, `Object.hasOwn(descriptor,'value')` — accessors rejected WITHOUT invoking getters), field validation on the SNAPSHOT, returns `Object.freeze(value)`; whole body wrapped in `try{...}catch{throw Error('Invalid synthetic reservation')}` (swallows any getter/proxy throw as a single rejection — no leak of getter errors).
- Both `reserveSyntheticApproval` and `reserveRegistryBoundSyntheticApproval` now call it as their FIRST statement (registry-bound: before inspect, before durable pin, before receipt). TS narrowing (`descriptors[key as string]!`) fixes the TS2345/TS2532 we reported at `5741657`.
- 2 new tests: plain-API throwing getter (calls===0, zero receipts, canonical reserves after) and registry-bound (calls===0, no pin in parent, zero receipts, canonical reserves after).

## D. Gate B — adversarial harness (`~/.dsh-superagent-private/c6b2b5i/preflight_acceptance.mts`, owner-only 0700 fixtures, 0600 marker/pin/receipts): FINAL ok=355 fail=0 exit 0
- L1: accessor on EACH of the 7 canonical fields (throwing getter) refused `/Invalid synthetic reservation/` BEFORE any filesystem operation; getter NEVER invoked (calls=0); zero receipts; canonical 7-key input still reserves once afterwards.
- L2: non-throwing side-effect getter that would return a valid value — still refused without invocation.
- L3 (the bug B5I fixes): data-only snapshot survives caller mutation across the async boundary — after starting `reserveSyntheticApproval` and then mutating `approvalId`/`operation` on the original object, the receipt is hash-named from the SNAPSHOT `approvalId` and its JSON contains `approval-synthetic-00001`/`apply`, NOT the mutated `99999`/`rollback`.
- L4: registry-bound accessor input: getter not invoked, NO durable pin, zero receipts; canonical reserves once, replay refuses (`already reserved; human reconciliation required`).
- L5 (residual limit PROVEN): a Proxy with canonical data keys is accepted and its traps RUN during guard reflection (getOwnPropertyDescriptor/ownKeys/getPrototypeOf counted) — snapshot is taken from trap results; reflection is not authenticated.
- L6: enumerable accessor redefined onto a canonical field is refused by the `hasOwn(value)` check; zero receipts.
- K6 (rewritten for post-B5I semantics): extra own-enumerable accessor key refused via keys.length!==7 through descriptors; getter never invoked during snapshot.
- K1–K7, I5/I6, J1–J7 and all carried G/H layers (own-property refusals, pre-pin validation, fixture/registry binding, inode/dir replacement, cross-fixture, crash/torn receipt, journal overlap, preflight negative matrix, C6B2B4D one-winner fencing incl. 6 independent OS children) re-verified at `32f889e`: all fail closed, zero new ledger entries, source bytes+mode unchanged.
- Source invariance: app/main.txt bytes + full mode identical after every group.

## E. Residual limitations (documented, NOT solved — same as prior rounds)
Proxy traps can run code during reflection (L5 measured); same-user marker/pin forgery; duplicate JSON keys last-wins; cross-process memory identity not inherited (durable pin carries it, independent parents can bypass); OS TOCTOU/ABA; non-cooperating external writers; private per-transaction authority; backup/recovery; real Apply gates. Shape guard + snapshot is best-effort integrity evidence, NOT authenticated authority or race-free OS isolation.

## F. Gate A.5
Caller scan (module name + all 5 exports + normalizeSyntheticReservation) over `src/`+`scripts/` excluding the module itself and node-tests: rc=1, ZERO hits. Default-OFF, read-only; module writes only wx 0600 receipt + pin + dir fsync. Workflow grep -c = 2.

## G. Rollback
Only local additions: worktrees `.worktrees/claim-c6b2b5i` (claim commit `872b227f7404adac21b6125413c218700168b8f8`) and `.worktrees/stage-c6b2b5i`; private dir `~/.dsh-superagent-private/c6b2b5i/` (0700); private claim state file (0600). No service, provider, model, or production-config changes. Remove the two worktrees + private dir to restore prior state.
