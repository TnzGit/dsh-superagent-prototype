# C6B2B5L — independent Mac offline acceptance: read-only receipt + registry preflight input hardening

**Verdict: ALL_OFFLINE_PASS** (2026-11-12, macOS host). Real-host E2E / real Apply / Weixin / live services: **NOT RUN**.

- Task: `OL-20261112-019` (OFFLINE_SYNTHETIC_ONLY). Dispatch HEAD `8c97c49c5785d035a285e0dd5bd4532075e8c08d`; **pinned source SHA `2b1232036f01a623ba2c3e1b3c018d995b4e004c`** (inspected/tested at this exact detached SHA, not the handoff commit).
- Local claim receipt HEAD: `0292047a479dcfd2033003422d32f95b30b0da53` (non-force fast-forward `8c97c49..0292047`).
- Host: macOS, Node v25.9.0, pnpm 11.7.0, clean detached worktree at pinned SHA (`git status` 0 lines).

## A. Source CI #358 (run 43155660133) — verified 3/3 SUCCESS (attempt 1)

- `head_sha` = `2b1232036f01a623ba2c3e1b3c018d995b4e004c`; all three jobs completed/success: `local-first-core` (job 130974964051, runner 1000003073), `macos-portability` (job 130974964350, **runner 1000003074 allocated — genuine macOS**), `dsh-typecheck-and-build` (job 130974964303).
- Both new regression tests visibly executed on **both** OS logs (`read-only synthetic inspection rejects object approval IDs before coercion and malformed receipt types`; `read-only registry preflight rejects Proxy and accessor inputs before registry or filesystem access`): Linux log 2 hits each, macOS log 1 hit each; both logs contain the literal fetch of `+2b1232036f01a623ba2c3e1b3c018d995b4e004c`.
- Counts: Linux Node **216/216 pass, 0 fail** + proxy **5/5**; macOS Node **216/216 pass, 0 fail** + proxy **5/5**; typecheck job: Vitest **62 files / 1208 tests** passed, build success.
- Ledger suite enrolled in **both** OS workflow Node commands (`grep -c` = 2 in `.github/workflows/local-first-core.yml`, lines 28 and 45, identical file lists).

## B. Local Mac CI-parity runs at pinned 2b12320

- `pnpm install --frozen-lockfile` exit 0 (Done in 1.4s).
- `pnpm check` exit 0 — Vitest 62 files / 1208 tests, build complete.
- CI-exact workflow Node command (26 files, extracted verbatim from workflow line 28): exit 0, Node **216/216 pass, 0 fail**.
- Standalone ledger suite: exit 0 **34/34** (includes both new B5L tests plus all B4C–B5K tests).
- Proxy HTTP suite: exit 0 **5/5**.
- All counts exactly match CI #358.

## C. Source changes verified at pinned SHA (diff `ef352b2..2b12320` = commits `b9289bd` + `2b12320`, +10/−2 in one module)

1. `inspectSyntheticApproval` (`src/local-first/non-git-synthetic-approval-ledger.ts:101`): approval ID guard is now `typeof approvalId!=='string' || !ID.test(...)` — object/Proxy/boxed-String IDs are refused **before** any coercion or filesystem access.
2. Receipt validation (`:118-120`): `transactionId`, `projectFingerprint`, `previewDigest` each require `typeof === 'string'` before regex checks — malformed on-disk identity types fail closed as `Corrupt synthetic reservation; human reconciliation required` with the original bytes preserved.
3. `inspectRegistryBoundSyntheticApproval` (`:275`): `reservation=normalizeSyntheticReservation(reservation)` is now the FIRST statement — hostile reservations are rejected before `registry.get`, `assertRegisteredRootIdentity`, and before any filesystem access (previously only the reserve paths normalized).

## D. Independent adversarial matrix (owner-only 0700 synthetic fixtures, 0600 files)

Harness: disposable `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` roots only; every check records whether files were inspected or changed. **RESULT: ok=456 fail=0.**

- **L1 (read-only ID hostility):** throwing `toString`/`valueOf` object ID refused with **coerced=0** (never executed); Proxy (boxed-String target) refused with **traps=0**; revoked Proxy refused; boxed `String` (typeof object) refused; all with **zero FS mutation**; after a real reservation exists, hostile IDs leave the receipt bytes, mode (0600) and nlink=1 **unchanged** (no overwrite/retry).
- **L2 (malformed on-disk identity types):** `transactionId=null`, `projectFingerprint={}`, `previewDigest=42`, `transactionId=[]`, `projectFingerprint=true` each fail closed with the corrupt-reservation error; the malformed receipt bytes are **preserved** by the read-only inspection; re-reserving the same approval never reissues (`already reserved; human reconciliation required`); an unexpected key on disk also fails closed and is preserved.
- **L3 (registry-bound preflight, hostile reservation shapes):** extra-key plain, inherited-prototype, non-enumerable, Symbol-keyed, enumerable accessor with throwing getter, malicious Proxy (get/getPrototypeOf/ownKeys/getOwnPropertyDescriptor traps throwing), revoked Proxy, and even a benign get-trap Proxy are ALL refused with `Invalid synthetic reservation` **before** the registry is touched — verified with a stub registry whose `get`/`assertRegisteredRootIdentity` throw on any call: **registryReads=0**, **traps=0**, zero ledger+journal mutation, **no durable pin** created.
- **L4 (valid plain canonical flow post-B5L):** valid registry-bound reservation still reserves once, inspection returns the canonical frozen facts (projectId/fingerprint/ledgerRoot/journalRoot), replay refuses, plain `inspectSyntheticApproval` returns the canonical receipt.
- **L5 (cross-process):** a fresh OS child process (separate interpreter, no in-memory state) refuses the object ID (`DENIED:Invalid synthetic approval ID`), **coerced=0**, zero receipts, exit 0 — identical to the parent behavior.
- All carried layers re-verified at 2b12320: G1–G27 durable-pin/fixture identity + inode/dir replacement, cross-process pin continuity, torn/crash partial receipts (never auto-repaired), I/J/K own-property + Proxy + accessor guards, M/N fixture-bound pre-read normalization (B5K), C6B2B4D one-winner cross-process fencing (6 independent children → 1 WIN 5 DENIED), full negative marker matrix; every refusal leaves **zero new receipts** and source bytes+mode invariant.

## E. Residual limitations (unchanged, shape guard is NOT authenticated authority)

Same-user marker/pin forgery (integrity evidence, not a signature); independent-process and independent-parent global identity; OS TOCTOU/ABA and path-ABA re-match; non-cooperating external writers; private per-transaction authorization; backup/recovery. Real Apply gates remain unmet (`REAL_APPLY_GATES.md`).

## F. Callers and scope

- Gate A.5 at 2b12320: module name, all five exports, `normalizeSyntheticReservation` — **zero production callers** (scan of `src/` + `scripts/` excluding the module itself and tests: 0 hits). Default-OFF read-only module; writes only `wx` 0600 receipt + directory fsync.
- Scope compliance: no real Apply, no real registered-project writes, no Weixin, no original DSH Prompt, no production DB, no 3080/3083/8123 restarts, no provider/model/default/credential or historic-grant changes. All writes confined to 0700 disposable synthetic fixtures (removed after each case).

## G. Rollback

Nothing on this host was modified beyond: two disposable git worktrees (`.worktrees/claim-c6b2b5l`, `.worktrees/stage-c6b2b5l`) and the private harness directory under `~/.dsh-superagent-private/c6b2b5l/`; removing them restores the prior state. Published commits are append-only docs; branch history untouched.
