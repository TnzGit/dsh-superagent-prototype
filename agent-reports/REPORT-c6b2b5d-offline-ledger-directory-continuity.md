# C6B2B5D — Local Mac synthetic ledger-directory continuity acceptance (sanitized)

**Verdict: ALL_OFFLINE_PASS**
**Pinned tested code SHA:** `ec02969523f49cd9f8c1f44bbe2c417865e8ccd4` (branch `feat/local-first-wechat-foundation`, clean detached worktree, `git status` 0 lines)
**Task:** `OL-20261111-011` (OFFLINE_SYNTHETIC_ONLY). Claimed once (`6df2e02280d4fa277f1522cf8b37c3fa40a54384`), never replayed OL-001…010.

## Gate A — CI parity + full offline suite (measured, not prefilled)

- CI #310 (run `42988522928`) at pinned SHA: `dsh-typecheck-and-build`, `local-first-core`, `macos-portability` all conclusion=success (3/3). Real macOS runner allocated (`macos-latest`, runner 1000002777). New B5D test `same registry refuses ledger directory replacement before issuing a new receipt` present in BOTH OS logs; Linux and macOS both report `pass 204` on the CI-enrolled file list. Ledger suite is enrolled in both OS commands (workflow grep count = 2).
- Local host: macOS, Node `v25.9.0`, pnpm `11.7.0` (Node 22 is the CI Linux target; local ran the same suite on 25 as the macOS job does).
- `pnpm install --frozen-lockfile` exit 0. `pnpm check` exit 0: Vitest **62 files / 1208 tests** all pass, build complete.
- CI-exact file list on Mac: **204/204 pass** (matches CI `pass 204` on both OSes). Broader `ls tests/*.node-test.mjs` + probe list: **209/209** (superset, consistent).
- Standalone ledger suite: **22/22** (4 B5D-era tests). Queue-proxy suite: **5/5**. All exit 0.

## Gate B — synthetic adversarial harness (126 checks, ok=126 fail=0)

Disposable `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` fixtures with `0600` marker/pin/receipts only. Zero real-project writes; source bytes+mode invariant proved after every sequence.

B5D-specific groups (new at `ec02969`):
- **G21 CORE:** same-registry ledger-directory inode replacement with deterministic rename-aside (old inode kept alive via rename, fresh `mkdir` at identical path, different dev/ino pair verified): second reservation refused `Synthetic registry ledger directory identity changed` BEFORE any write; ZERO receipts in the fresh dir; original receipt retained in renamed dir; a third attempt still refused (refusal does not update the remembered identity).
- **G22 precedence fix verified:** while the pinned ledger dir is swapped, a cross-fixture (fixture B) attempt reports `conflicting fixture ledger binding` FIRST — the cross-fixture rejection precedes the dir-identity check, B ledger untouched, A receipt intact. This is the `ec02969` repair of the CI #309 regression (assertion-vs-message mismatch).
- **G24** ledger dir moved away WITHOUT replacement → fail closed (`Unsafe synthetic registry private directory`), no new receipt.
- **G25** symlinked ledger dir replacement → refused by non-symlink preflight rule, original retained.
- **G26** mid-reservation swap in the SAME registry instance (reservation already in flight): fails closed via remembered-identity error, zero receipts in new dir.
- **G27** new identity-change error messages leak NO raw private paths.

Carried-over regressions re-verified at `ec02969`: full B5 pin-identity suite (G13–G16: rename-aside deletion refusal, same-content 0600 replacement pin refused, fresh-process non-inheritance, deletion bypass), pin guards (corrupt/partial/0644/symlink/4-key/forged), registry-bound preflight negative matrix (OL-006/007/008 layers: uppercase/unknown ID, fingerprint mismatch, alt journal, marker guards, nested fixture, readOnly/git ineligible, ancestor/root symlink swaps, ordinary same-path root replacement, mid-preflight race), C6B2B4D fencing (one-use, duplicate reconciliation, 26-byte partial terminal + corrupt-inspector no-repair, 6 independent OS children on fresh approval ID → 1 WIN / 5 DENIED, 1 receipt total), error-path no-path-leak checks.

## Known limitations (documented, NOT fixed — remote owns the code)

- **Cross-process non-inheritance (G23):** a fresh OS process has no remembered in-memory ledger-dir identity and ACCEPTS a swapped ledger dir (second receipt lands in the fresh dir; original retained). Same as pin identity: in-memory evidence is process-local.
- **TOCTOU (G26 fresh process):** a reservation started in a new process whose ledger dir is swapped mid-flight completes WIN against the post-swap dir (receipt in new dir). The check is best-effort read-only evidence, not an fd-relative race-free capability.
- **Same-user forgery:** the private marker/pin is integrity evidence, not a signature; a same-user attacker can forge/replace it.
- **Cross-root:** generic `reserveSyntheticApproval` still re-reserves the same ID under an alternate independent ledger root (no cross-root fencing).
- No MAC/key-backed authenticated capability exists.

## Gate A.5 — deployment constraint

Zero production callers: grep for the module name / `reserveRegistryBoundSyntheticApproval` / `syntheticLedgerDirIdentities` over `src/` + `scripts/` (excluding the module itself and node-tests) → **0 hits**. Default-OFF, read-only except `wx 0600` receipt + dir fsync. New `syntheticLedgerDirIdentities` WeakMap is captured/re-checked inside the reservation path only.

## Scope compliance

No real Apply, no DSH Prompt/3080/3083/8123 touch, no real Weixin, no model/proxy default changes, no production SQLite writes, no product source edits, no historical grants consumed. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.

## Rollback

Local-only additions this round: two detached worktrees (`.worktrees/stage-c6b2b5d`, `.worktrees/claim-c6b2b5d` → report worktree), harness/report files under `~/.dsh-superagent-private/c6b2b5d/` (0700/0600), private claim state update. Remove worktrees + private dir to restore prior state; branch advanced only by the claim + docs commits (normal non-force fast-forward pushes, no force, no rebase).
