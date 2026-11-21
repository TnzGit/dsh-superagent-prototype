# C6B2B5H — Local Mac own-property input-shape and pre-pin safety acceptance (sanitized)

**Verdict: ALL_OFFLINE_PASS**
**Pinned tested code SHA:** `6dff9f34e5fbd299b3774381aab12a99b31b0feb` (clean detached worktree, `git status` 0 lines; NOT the dispatch handoff commit `527cea3…`)
**Task:** `OL-20261112-015` (OFFLINE_SYNTHETIC_ONLY). Claimed once (`4c588aa1fb831c284088ab1cf85aebeb47dd5b23`), never replayed OL-001…014.

## Gate A — CI parity + full offline suite (measured, not prefilled)

- CI #334 (run `43059414309`) at pinned SHA: `dsh-typecheck-and-build`, `local-first-core`, `macos-portability` all conclusion=success (3/3). Real macOS runner allocated (check-run ids 130659776395/130659777183/130659776909). BOTH new own-property tests `synthetic reservation rejects inherited, nonenumerable and symbol keys before receipt` and `registry-bound inherited and hidden input keys cannot create durable pin` present in BOTH OS job logs (Linux: 2 occurrences each; macOS: 1 each); both fetched the exact pinned SHA (`+6dff9f3…` fetch line). Linux and macOS both report `tests 209 / pass 209 / fail 0` for the Node suite and `tests 5 / pass 5` for the proxy suite. Vitest (typecheck job): 1208/1208 passed. Ledger suite enrolled in both OS workflow commands (grep count = 2).
- Local host: macOS, Node `v25.9.0`, pnpm `11.7.0`.
- `pnpm install --frozen-lockfile` exit 0. `pnpm check` exit 0: Vitest **62 files / 1208 tests** all pass, build complete (matches CI 1208/1208).
- Verbatim CI-exact 23-file Node command on Mac: **209/209 pass**, exit 0 (matches CI `tests 209` on both OSes).
- Standalone ledger suite: **27/27** (both new B5H tests among them; exit 0). Queue-proxy suite: **5/5** (exit 0).

## Source change reviewed (959f834 → 6dff9f3)

Exactly the fix for the OL-014 J5/I5 finding: both input guards (`reserveSyntheticApproval` :29-32 and `reserveRegistryBoundSyntheticApproval` :339-344) now use `Reflect.ownKeys` + `Object.getPrototypeOf(reservation)===Object.prototype` + every-key-must-be-string instead of `Object.keys`, throwing `Invalid synthetic reservation` for prototype-inherited keys, non-enumerable (defineProperty) keys and Symbol keys. Guards remain the FIRST statement of both paths — rejection happens before receipt/journal (plain) and before `inspectRegistryBoundSyntheticApproval` / durable pin write (registry-bound). Plus docs/handoff closure of OL-014. No other source changes.

## Gate B — synthetic adversarial harness (316 checks, ok=316 fail=0)

Disposable `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` fixtures directly under canonical OS temp; `0600` marker/pin/receipts only. Zero real-project writes; source bytes+mode invariant proved after sequences.

B5H-specific groups (K1–K7):
- **K1 CORE (plain API):** inherited-prototype, non-enumerable, and Symbol extra keys each refused `Invalid synthetic reservation` BEFORE any write (zero receipts, journal unchanged); the valid canonical input then reserves once and replay refuses (`already reserved`) — refused shapes never consume the approval ID.
- **K2 CORE (registry-bound):** all three refused shapes rejected before BOTH the durable pin AND the receipt (no pin file, zero receipts, journal unchanged); same approval ID then reserves once (exactly one pin + one hash-named receipt) and replay refuses — no approval consumption by refusals.
- **K3 key order:** canonical 7 keys in a different insertion order still accepted (sorted set-equality) and replay refuses.
- **K4:** own-enumerable extra key still refused on both APIs (carried regression).
- **K5 audited:** null-prototype object (`Object.create(null)`) refused by the prototype check.
- **K6 audited limitation:** guard reads key NAMES only via `Reflect.ownKeys`; accessor getters are never invoked during the guard — value-level side effects (getters/proxies on untrusted JS objects) remain NOT_COVERED.
- **K7:** fresh OS process (no shared memory) denies all three shapes (`DENIED:Invalid synthetic reservation` ×3, pin=false, recv=0).
- **J5/I5 re-post-fixed:** the OL-014 harness's pre-fix assertions updated — at `6dff9f3` inherited/hidden keys are REFUSED on both plain and registry-bound paths (they were accepted pre-fix), and canonical inputs still reserve.
- **J1–J4, J6–J7, I1–I10 (carried):** pre-pin ordering proof, per-key deletion matrix, shape negatives, ordering proof on marker-less fixture, cross-process denial, refused-input-does-not-mutate-prior-pin, receipt strict schema, crash/partial invariants all re-verified at `6dff9f3`.

Carried-over regressions re-verified at `6dff9f3`: full B5/B5C/B5D/B5E/B5F/B5G layers (G1–G27, H1–H10, I1–I10, J1–J7: durable pin guards, cross-fixture binding and precedence, 6-way cross-process one-winner, crash-after-partial terminal invariants, inode/deletion/ledger-directory continuity, receipt strict schema, generic+registry input strict schema) plus registry-bound preflight negative matrix (uppercase/unknown ID, fingerprint mismatch, alt journal, marker guards, nested fixture, readOnly/git ineligible, ancestor/root symlink swaps, ordinary same-path replacements) and C6B2B4D fencing (one-use, duplicate reconciliation, 26-byte partial terminal + corrupt-inspector no-repair, fresh-approval-ID cross-process single winner).

## Known limitations (documented, NOT fixed — remote owns the code)

- Shape guard, not authenticated approval: same-user forgery (canonical 7-key object with fabricated values) remains accepted.
- Accessor/proxy value side effects and untrusted JS objects (K6): guard reads key names only; getters on values are invoked later in field validation and could observe side effects — NOT_COVERED.
- Duplicate JSON keys collapse last-wins (H7); differing values surface as value corruption.
- Cross-process continuity: fresh processes do not inherit in-memory identity evidence (pin cross-instance coverage is the durable parent pin only); independent project parents have separate pins; OS TOCTOU/ABA; external writers uncooperative.
- Private transaction authority, backup and recovery: unresolved. No production-grade fencing claimed.

## Gate A.5 — deployment constraint

Zero production callers: grep for the module name, all five exports and the error string over `src/` + `scripts/` (excluding the module itself and node-tests) → **0 hits** (rc=1). Module imports only Node builtins plus `projectFingerprint`/`LocalProjectRegistry` types — no Runtime/Worker/Weixin/Outbox/original-DSH integration. Default-OFF, read-only except `wx 0600` receipt + dir fsync. Workflow enrollment confirmed on both OS commands (grep count = 2).

## Scope compliance

No real project Apply, no original DSH Session Prompt, no Weixin send, no 3080/3083/8123 changes, no production SQLite, no model/provider/default/credential changes, no historical live grant reuse, no non-fixture host writes. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.

## Rollback

Local-only additions this round: detached worktrees `.worktrees/claim-c6b2b5h` and `.worktrees/stage-c6b2b5h`, harness/report under `~/.dsh-superagent-private/c6b2b5h/` (0700 dir, 0600 files), private claim state update. Remove worktrees + private dir to restore prior state; branch advanced only by the claim + docs commits (normal non-force fast-forward pushes, no force, no rebase).
