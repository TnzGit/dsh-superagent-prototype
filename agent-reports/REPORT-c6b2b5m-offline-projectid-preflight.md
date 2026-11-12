# REPORT-c6b2b5m — offline hostile-projectId read-only preflight acceptance (Mac)

**Verdict: ALL_OFFLINE_PASS**
**Task:** OL-20261112-020 · C6B2B5M · scope OFFLINE_SYNTHETIC_ONLY
**Pinned source SHA:** `c1fe46ac32a3e92f5d0eb2f5911d298c3afc6409` (fix commit, NOT dispatch commit `a9161dc809c531f6b6c441d095a931b9810864f0`)
**Claim:** `f4500fdf5f6da4d480e3de8775207505a43e1fda` (fast-forward `a9161dc..f4500fd`, remote HEAD verified)
**Host:** macOS (Darwin), Node `v25.9.0`, pnpm `11.7.0`

## A. Source CI #363 (run `43162793306`) — independently verified
- run_number 363, head_sha = `c1fe46a…` (literal fetch `+c1fe46ac…` lines in BOTH OS job logs), attempt 1, conclusion **success**, **3/3 jobs success** with real allocated runners: local-first-core (job 130997743847, runner 1000003090), macos-portability (job 130997743977, runner **1000003088 — genuine macOS runner allocated**), dsh-typecheck-and-build (job 130997744000, runner 1000003089).
- New regression `read-only registry preflight rejects hostile project ID without coercion or registry access` executed in **both** OS logs (Linux 2 hits, macOS 1 hit), alongside the preceding read-only Proxy/accessor regression (Linux 2 hits).
- Counts: Linux Node **217/217 pass / 0 fail** + proxy **5/5**; macOS Node **217/217 pass / 0 fail** + proxy **5/5**; typecheck job Vitest **62 files / 1208 tests** passed, build success. Ledger suite is enrolled in BOTH workflow commands (`grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2; identical 23-file command on lines 28 and 45).

## B. Local Mac suite at pinned detached worktree (`.worktrees/stage-c6b2b5m`, git status 0 lines)
- `pnpm install --frozen-lockfile` exit 0 (Done in 994ms).
- `pnpm check` exit 0: Vitest `Test Files 62 passed (62)` / `Tests 1208 passed (1208)`, `Build complete`.
- CI-exact 24-file Node command (extracted verbatim from workflow line 28) exit 0: `ℹ tests 217 / pass 217 / fail 0` — **exact parity with both CI OS logs**.
- Standalone ledger suite exit 0: **35/35** (new B5M test present in the file).
- Proxy suite exit 0: **5/5** — parity.
- No deviations, no flakes, no cancellations.

## C. Source change reviewed (`2b12320..c1fe46a`, 1-line guard + 17-line test)
- `src/local-first/non-git-synthetic-approval-ledger.ts:278`: `if(typeof projectId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(projectId)) throw Error('Invalid synthetic registry project ID')` — the typeof check now precedes regex coercion, placed AFTER `normalizeSyntheticReservation(reservation)` and BEFORE `registry.get(projectId)`.
- New test at `tests/local-nongit-synthetic-approval-ledger.node-test.mjs:276`: stub registry whose `get`/`assertRegisteredRootIdentity` throw when called; malicious `{toString(){trap++;throw}}`, benign/throwing Proxy, revoked Proxy, boxed `String('synthetic-preflight')`, `null`, `42` → all reject with the guard message, `traps===0`, `registryReads===0`.

## D. Independent adversarial harness — `ok=499 fail=0` (exit 0)
Owner-private 0700 disposable fixtures only (`dsh-project-synthetic-*` + `dsh-ledger-synthetic-*`; 0600 marker/receipts; imports resolved to the stage worktree absolute paths). Groups N1–N6 added for B5M; all carried B4C–B5L layers re-verified at `c1fe46a`:
- **N1** hostile non-string projectId (malicious toString/valueOf object, Proxy with 4 traps, revoked Proxy, boxed String, null, 42, true, [], {}, Symbol, function, Map): all refused `Invalid synthetic registry project ID`; **zero trap execution, zero registry get/identity calls, zero ledger+journal mutation, no durable pin, source bytes+mode invariant**.
- **N2** valid canonical `synthetic-app`: preflight returns frozen canonical facts; reserves exactly once; replay of the same approval ID refused (`already reserved; human reconciliation required`); hostile id AFTER a valid state is still refused pre-registry and adds **no new receipt**.
- **N3** schema-boundary ids (uppercase, leading dash, 65 chars, leading underscore, dot, empty, `!`, space) refused with **zero registry access**; and positive control: a **schema-legal leading-digit id (`9lives`) passes the guard and reaches the registry** — evidence the guard is schema-only, not a whitelist of known ids.
- **N4** hostile **reservation** with a valid projectId: inherited-key object and Proxy reservation both refused by `Invalid synthetic reservation` before any registry read — reservation guard remains first.
- **N5** hostile id object whose `toString` returns a VALID id is still refused by the typeof guard; `toString` **never executed** (no coercion).
- **N6** fresh OS child process (independent of in-process memory) independently refuses the malicious id: `DENIED|traps=0|reads=0|Invalid synthetic registry project ID`, exit 0.
- Carried layers (re-verified green at this SHA): registry-bound durable-pin identity + read-only preflight, ancestor/root inode replacement (B4F/B4G), cross-fixture + journal overlap, ledger-directory replacement TOCTOU proof, crash/torn 26-byte receipt never repaired, cross-process one-winner fencing (6 children → 1 WIN 5 DENIED), receipt strict schema + corrupt read-only refusal, 0644/symlink/hardlink marker controls, Proxy/accessor/revoked input rejection before reflection (B5I/B5J/B5K), fixture-bound Proxy rejection (B5K), read-only approval-ID + malformed receipt-type hardening (B5L), negative marker matrix, one-use/replay semantics, source bytes+mode invariance throughout.

## E. Gate A.5 — zero production callers
Scan for the module name + all five exports + `normalizeSyntheticReservation` + the new guard message over `src/` and `scripts/` (excluding the module itself and node-tests): **0 hits** (rc=1). Module remains default-OFF, read-only; writes only `wx` 0600 receipt + durable pin inside owner-private 0700 fixtures. No Runtime/Worker/Weixin/Outbox integration at this SHA.

## F. Residual limits (unchanged; shape guard is NOT authenticated authority nor race-free OS isolation)
- Same-user forged pins/markers (integrity evidence, not signature).
- Independent-process/independent-parent global identity (fresh child completes a reservation against a post-swap directory — TOCTOU proof re-verified in carried layers).
- OS TOCTOU / path-ABA (moving the ORIGINAL parent inode back to the identical path passes the best-effort check).
- Non-cooperating external writers; private per-transaction authority; backup/recovery.
- Proxy traps still run user code during reflection on paths that read raw input before the guard (documented in carried M5 limitation at B5J/B5K).
- Real Apply gates all unmet (REAL_APPLY_GATES.md: PRINCIPLE APPROVAL / NO execution enabled).

## G. Scope compliance + rollback
Zero real-host activity: no real Apply/Rollback, no Weixin, no original DSH Session Prompt, no 3080/3083/8123 touch, no production SQLite/DB, no credentials, no model/provider/default changes, no historical grants. All writes confined to owner-private 0700 synthetic temp fixtures; product source never modified locally.
Rollback: remove `.worktrees/claim-c6b2b5m` + `.worktrees/stage-c6b2b5m`; delete `~/.dsh-superagent-private/c6b2b5m/`; revert the claim/done receipt commits on the branch (docs-only, non-force).
