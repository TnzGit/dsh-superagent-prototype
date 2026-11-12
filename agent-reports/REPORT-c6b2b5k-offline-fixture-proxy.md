# C6B2B5K — Mac offline fixture-bound Proxy pre-read acceptance

Verdict: **ALL_OFFLINE_PASS** (synthetic disposable fixtures only; no real Apply/DSH Prompt/Weixin/services/production DB touched).

- Task: OL-20261112-018 (OFFLINE_SYNTHETIC_ONLY), claim receipt commit `55afde68491032a781b905291cedecbb36ca7c26` (dispatch HEAD `17048ccd82f43ff72f04bdb0b1f0088854b6f546`).
- Pinned SOURCE commit tested: `ef352b2ec4b3b6992f614673a2a1100ba3408103` (`fix(synthetic): reject fixture-bound Proxy before marker and journal reads`), NOT the handoff commit. Clean detached worktree, `git status` 0 lines. Host: macOS, Node v25.9.0, pnpm 11.7.0.

## A.1 CI evidence (#351 = run 43128992443, attempt 2)
- 3/3 jobs success, head_sha = `ef352b2…`; real macOS runner allocated (`GitHub Actions 1000003055`; job ids: macos 130908753457, linux 130908753739, typecheck 130908753985).
- New regression `fixture-bound Proxy is refused before binding reads, traps or receipt` executed in BOTH OS logs (Linux 2 hits, macOS 1 hit). Both OS logs contain literal `+ef352b2ec4b3b6992f614673a2a1100ba3408103` fetch line.
- Linux Node 214/pass 214/fail 0 + proxy 5/5; macOS Node 214/214/0 + proxy 5/5; typecheck job Vitest 62 files / 1208 tests passed; build success.

## A.2 Local parity at pinned ef352b2
- `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62 files/1208, build complete).
- CI-exact 23-file Node command exit 0: 214/214/0 (identical command in both OS workflow entries; ledger-suite grep count 2: lines 28 and 45).
- Standalone ledger suite exit 0: 32/32 (new B5K test present at `tests/local-nongit-synthetic-approval-ledger.node-test.mjs:136`); proxy suite exit 0: 5/5. Exact count match with CI #351.

## A.3 Source change
`reserveFixtureBoundSyntheticApproval` (`src/local-first/non-git-synthetic-approval-ledger.ts:133`) now calls `reservation=normalizeSyntheticReservation(reservation)` as its FIRST statement — before `lstat(fixtureRoot)`, binding-marker read, journal realpath and any raw field access. This is the remote fix of the OL-20261112-017 finding (fixture-bound path previously validated the binding against the RAW input, so a Proxy `get` trap ran before the `isProxy` guard). Diff is 3 source lines + 20-line regression test only.

## B. Independent adversarial harness (owner-private 0700 disposable fixtures)
`preflight_acceptance.mts` retargeted to the stage worktree; **RESULT ok=410 fail=0** (exit 0). B5K groups:
- N1 malicious Proxy (throwing get/getPrototypeOf/ownKeys/getOwnPropertyDescriptor) fixture-bound → refused `/Invalid synthetic reservation/`, **traps=0**, zero receipts, no durable pin (guard holds before any marker/journal read).
- N2 benign non-throwing get-trap Proxy fixture-bound → refused, traps=0.
- N3 `Proxy.revocable` revoked input → refused; zero receipts; canonical 7-field reservation then succeeds once; replay refuses `/already reserved; human reconciliation required/`.
- N4 accessor getter defined on EACH of the 7 canonical fields (throwing) → refused without invocation (calls=0) on the fixture-bound path; zero receipts after all refusals.
- N5 Proxy input with a MISMATCHED binding-marker fingerprint → still refused with traps=0: isProxy guard precedes marker fingerprint compare (no raw read path taken).
- N6 fresh OS child process: fixture-bound benign-trap Proxy refused `REFUSED:0` (traps=0), revoked refused, zero ledger files, canonical reserves once, replay refuses — exit 0.
- M5 (carried from B5J) updated to post-fix expectations: traps=0 confirms the ef352b2 fix of the OL-017 finding.
- All carried layers re-verified at ef352b2: plain + registry-bound Proxy/inherited/non-enumerable/symbol/accessor/mutation-across-async matrices, root+ancestor inode identity, durable-pin cross-process continuity, crash/torn receipt (26-byte partial never overwritten; inspector fails closed; no repair), cross-fixture + journal-overlap refusals, one-use + duplicate + 6-independent-children one-winner fencing, full negative marker/ledger matrix; source bytes+mode invariant throughout (zero writes outside owner-only fixtures).

## A.5 Production wiring
Caller scan (module name + all 5 exports + `normalizeSyntheticReservation` + `isProxy`) over `src/` and `scripts/` excluding the module itself and node-tests: **0 hits** — default-OFF, read-only synthetic ledger, no Runtime/Worker/Weixin/Outbox caller at ef352b2.

## Residual limitations (unchanged, confirmed by harness)
Same-user marker forgery (marker = integrity evidence, not a signature); OS TOCTOU/ABA (path identity re-attestation is best-effort, not a race-free descriptor-relative capability); independent-process identity; cross-root generic-reserve fencing; private per-transaction authority and backup/recovery — all UNSOLVED by the shape guard. Proxy traps are rejected before any reflection (traps=0 verified), but a non-Proxy plain object remains fully attacker-controlled for the same-user threat model. Real Apply gates NOT RUN (offline synthetic only).

## Scope compliance + rollback
No real project/Apply/Rollback, no DSH service (3080/3083/8123 untouched), no Weixin, no original Session Prompt, no production SQLite, no provider/model/historic-grant changes, no credentials in any published artifact (leak scan 0 hits). Local changes this round: new worktrees `.worktrees/claim-c6b2b5k` and `.worktrees/stage-c6b2b5k`, private files under `~/.dsh-superagent-private/c6b2b5k/` and `handoff-watch/state/` (claim→done, last_head); rollback = remove the two worktrees + private dir, nothing else.
