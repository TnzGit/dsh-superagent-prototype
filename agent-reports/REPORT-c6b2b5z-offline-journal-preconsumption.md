# REPORT-c6b2b5z — C6B2B5Z independent Mac synthetic journal pre-consumption refusal acceptance

**Verdict: ALL_OFFLINE_PASS** (OFFLINE_SYNTHETIC_ONLY; synthetic 0700 fixtures only; zero product source edits locally; no live host, no real Apply, no Weixin, no DSH services touched)

- Task: OL-20261114-033, dispatched at HEAD `9dfc7ac3ad58d6481e61352436fdb09b0d25db71`, claimed exactly once at `7048577f415e1e0785db2b8668b9a359b39fe53a` (non-force fast-forward onto dispatch HEAD, `ls-remote` verified). The claimed receipt's `claim_sha` metadata was corrected to the pushed claim commit by an ancestry-complete follow-up commit `2d45512db3292c607f41d6728fe751da8b6004fe` (the amend-placeholder technique left a stale pre-amend SHA; recorded openly, not silently rewritten — same class as the OL-032 audit caveat).
- Pinned source: `9051e0fe972f7f6d623321112933d51455ab76e6` ("C6B2B5Z: honor macOS canonical temp ancestor while refusing journal leaf aliases"), detached worktree, `git status` 0 lines. C6B2B5Z = `c475df0` + `9051e0f`; `9051e0f` contains the earlier `39220a5` inspect-side 0o500 hardening as an ancestor (merge-base verified).

## A. Environment
- macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (identical to prior OL reports; all local runs on this host).

## B. Source CI verification (exact pinned head_sha)
- Actions #440 run `43552817695`: `completed` / `success`, attempt 1, `head_sha === 9051e0f…` exact, **3/3** jobs success (`macos-portability`, `dsh-typecheck-and-build`, `local-first-core`).
- Actual job logs: Linux leg `ok 165 - synthetic reservation refuses noncanonical and unreadable journal before consuming ID` + `# pass 235 / # fail 0` + proxy `# pass 5`; macOS leg `✔ synthetic reservation refuses noncanonical and unreadable journal before consuming ID (25.89ms)` + `ℹ pass 235 / ℹ fail 0` + proxy `ℹ pass 5`. Vitest 1208/1208, typecheck/build pass.
- Prior CI #439 (attempt SHA `c475df0`) failed on macOS because /var vs /private/var ancestor spelling was incorrectly treated as unsafe — fix included in the exact pinned SHA; #439 is NOT pass evidence.
- Dispatch-vs-pinned diff (`001b2b3..9051e0f` reverse): 4 handoff/docs files only — zero src/test drift; CI evidence valid for the pinned source.
- Gate A.5: `grep -rn inspectSyntheticApproval src/` → definition site only (`:149`) = **NO_PRODUCTION_CALLERS**.

## C. Local Mac parity at pinned source (disposable detached worktree)
| step | result | exit |
|---|---|---|
| `pnpm install --frozen-lockfile` | clean | 0 |
| `pnpm check` | build complete 1309ms, no flake this round | 0 |
| CI-exact 23-file Node suite (workflow list) | **235/235** | 0 |
| proxy suite | **5/5** (unbounded — macOS has no `timeout` binary) | 0 |
| standalone ledger suite | **53/53** (+2 = the two C6B2B5Z tests) | 0 |
| Vitest | **62 files / 1208 tests** | 0 |

## D. Source review of the C6B2B5Z guard
`src/local-first/non-git-synthetic-approval-ledger.ts` `reserveSyntheticApproval`:
- `c475df0` adds a pre-consumption journal preflight at `:107-118` — placed AFTER the unsafe-lstat root check (`:102-104`) and BEFORE the exclusive receipt creation `open(file,'wx')` (`:130`): refuses `!isAbsolute(x)` || `normalize(x)!==x` || `realpath(x)!==x` || `(lstat.mode&0o500)!==0o500` as raw `Unsafe synthetic journal root`, and the overlap guard (`:120-125`) likewise precedes creation. Comment records: best-effort path preflight, NOT fd-relative/ABA-safe.
- `9051e0f` fixes the macOS ancestor false-positive: the identity comparison becomes `journal !== join(realpath(dirname(input)), basename(input))` — only the LEAF must be canonical against its canonical parent; ancestor spelling (/var vs /private/var) is honored. Leaf symlinks still refused (lstat isSymbolicLink + leaf mismatch).
- Inspect-side preflight (`:203-217`) unchanged at pinned except the inherited `(mode&0o500)!==0o500` clause from `39220a5`; whole block blanket-caught to the sanitized `Corrupt synthetic reservation; human reconciliation required`.
- Writer (`:139-141`) stores `realpath(journal)` canonical by construction (seven-field fixed writer order carried from C6B2B5W).
- AUDITED ORDER FACTS (Z5, verified on pinned): a consumed-ID attempt with an unsafe journal hits the pre-consumption guard BEFORE the EEXIST one-use check (message is raw `Unsafe synthetic journal root`, not `already reserved`); on the registry-bound path the fixed-binding journal comparison precedes the unsafe-journal check (`Synthetic registry journal differs from fixed binding` wins for an alias input).

## E. Adversarial harness (`~/.dsh-superagent-private/c6b2b5z/preflight_acceptance.mts`, fresh approval IDs, 0700 fixtures)
Carried B4C–B5Y layers re-run at the pinned source: **ok=1215 fail=0** after one audited-delta patch (Y8 owner-only `0600` journal, previously ACCEPTED at a022177, now REFUSED by the 0o500 traversal-bit requirement; 0700 still accepted); full suite with new Z-groups: **ok=1263 fail=0, exit 0**.

- Z1 pre-consumption refusal matrix: dotdot-aliased, leaf-symlink, relative, double-slash forms all refused BEFORE any receipt exists — zero ledger entries, receipt file absent, approval ID never consumed; same ID with the valid journal then reserves and one-use is enforced post-success; receipt stores canonical realpath.
- Z1 AUDITED: trailing-separator input is ACCEPTED pre-consumption (POSIX `normalize` preserves the trailing separator so `normalize(x)===x` holds, and the leaf-vs-canonical-parent comparison strips it; `dirname("/a/b/")` is `/a`) — the written receipt is still canonical realpath with no trailing separator.
- Z2 owner unreadable/unsearchable journal refused pre-consumption: write-only 0200, search-only 0100, read-only 0400, and stricter 0600 all refused (`mode&0o500!==0o500`), zero entries, ID intact each time; restore 0700 → same ID reserves; replay refused after success.
- Z3 macOS canonical temp-ancestor POSITIVE CONTROL (mirrors the pinned fix): the fixture's realpath is `/private/var/folders/…`; a constructed `/var/folders/…` spelling of the SAME real directory is ACCEPTED by reserve (ancestor spelling honored), and the receipt stores the `/private/var/…` canonical realpath; inspection returns it unchanged. A leaf symlink alias in the same position is still REFUSED — ancestor spelling honored ≠ leaf alias honored.
- Z4 overlap refused pre-consumption in all three shapes (equality with the ledger, descendant-of-ledger, ancestor-of-ledger): zero entries (excluding the fixture's own child dir), ID intact; valid non-overlapping journal then reserves.
- Z5 failed attempts NEVER create/overwrite/recover a receipt or durable pin: a registry-bound reserve refused via an alias journal leaves NO pin and NO receipt; after a successful reserve, a failed consumed-ID attempt leaves existing receipt bytes untouched byte-for-byte (no recovery/rewrite).
- Z6 fresh OS child (no in-process state): alias journal → raw `Unsafe synthetic journal root` reserve-side taxonomy with zero ledger entries; valid 0700 journal → RESERVED (positive control). (Harness bug found+fixed: `node -e` places the extra arg at `argv[1]`, not `argv[2]`.)
- Z7 AUDITED LIMITS: a REAL, owner-private (0700), non-overlapping forged directory is ACCEPTED by the pre-consumption guard — integrity evidence, not authenticity (same-user forgery residual); journal-path ABA (different inode moved into the identical path after reserve) STILL PASSES inspection — journal dev/ino is never pinned, checks are path-based best-effort, not fd-relative (contrast: ledger ROOT identity is pinned at registry registration).

## F. Open gates / residual limits (NOT claimed as solved; remote owns fixes)
- Same-user forgery: a real private non-overlapping directory still passes (Z7).
- Journal path ABA / TOCTOU: no journal dev/ino pinning, no fd-relative capability (Z7).
- Generic `reserveSyntheticApproval` cross-root re-reserve fencing still absent (registry-bound path IS fenced via the durable pin).
- Private transaction authority, backup/recovery, real Apply gates, live host: unresolved.
- Trailing-separator acceptance is a path-format audited behavior, not a defect.

## G. Not tested / not touched
Real Weixin, OpenClaw, DSH GUI (3080), model proxy (8123), 3083 bridge services, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback, credentials. Zero product source edits locally; zero heartbeat/config changes. STOP after publication; awaiting remote ACK and the next dispatch.
