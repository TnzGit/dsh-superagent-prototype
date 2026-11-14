# REPORT-c6b2b6b — C6B2B6B independent Mac synthetic missing-child sanitation acceptance

**Verdict: ALL_OFFLINE_PASS** (OFFLINE_SYNTHETIC_ONLY; synthetic 0700 fixtures only; zero product source edits locally; no live host, no real Apply, no Weixin, no DSH services touched)

- Task: OL-20261114-035, dispatched at HEAD `0df6c1c3cbb26933d84c75314502ddd814c122e7`, claimed exactly once at `b549df72546f6958e9bd6e0b37ec55f56bc7420a` (non-force fast-forward onto dispatch HEAD, `ls-remote` verified). The claimed receipt's `claim_sha` metadata corrected by ancestry-complete follow-up commit `e00dd0b37c262bf5f319601d2e3e5f4774de506d` (same class as OL-032/033/034 audit caveats, recorded openly).
- Pinned source: `5a994bbb2f2258aff4a53a28ec88b1c6e02d800d` ("handoff: record #454 test failure and corrected #455 CI wait"; the C6B2B6B fix is commit `b1fc3cc748e074355e7298abdcfa65656fe8c7ca` + tests `e50ee9e`/`9c341c3`), detached worktree, `git status` 0 lines.

## A. Environment
- macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (identical to prior OL reports).

## B. Source CI verification (exact pinned head_sha)
- Actions #456 run `43558344499`: `completed` / `success`, `head_sha === 5a994bb…` exact, **3/3** jobs success (`macos-portability`, `dsh-typecheck-and-build`, `local-first-core`).
- History noted openly: #454 FAILED due a test-only `basename(file)` reference on a missing fixture child; `9c341c3` replaced it with `file.slice(root.length+1)` before #456; #455 cancelled (superseded). #456 is the valid evidence.
- Actual job logs: BOTH strict-inspection regressions executed on both legs — Linux `ok 213 strict … rejects canonical forgeries …` + `ok 214 strict … rejects missing/corrupt marker, unsafe journal and symlink fixture without replay` + `# pass 237 / # fail 0`, proxy `# pass 5 / # fail 0`; macOS `✔ strict synthetic fixture inspection rejects canonical forgeries … (34.97ms)` + `✔ …rejects missing/corrupt marker, unsafe journal and symlink fixture without replay (50.58ms)` (includes the new missing-child loop) + `ℹ pass 237 / fail 0`, proxy `ℹ pass 5 / fail 0`; Vitest `62 passed (62)` files, typecheck/build pass.
- Dispatch-vs-pinned diff (`5a994bb..0df6c1c`): handoff/docs files only — zero src/test drift; `5a994bb` verified as an ancestor of the dispatch HEAD. CI evidence valid for the pinned source.
- Gate A.5: `grep -rn inspectFixtureBoundSyntheticApproval src/` excluding the definition → empty = **NO_PRODUCTION_CALLERS**.

## C. Local Mac parity at pinned source (disposable detached worktree)
| step | result | exit |
|---|---|---|
| `pnpm install --frozen-lockfile` | Done in 1.1s | 0 |
| `pnpm check` | build complete 1329ms, no flake this round | 0 |
| CI-exact 23-file Node suite (workflow list) | **237/237** | 0 |
| proxy suite | **5/5** (unbounded — macOS has no `timeout` binary) | 0 |
| standalone ledger suite | **55/55** (incl. the two strict-inspection tests with the new missing-child loop) | 0 |
| Vitest | **62 files / 1208 tests** | 0 |

## D. Source review of the C6B2B6B sanitation
`src/local-first/non-git-synthetic-approval-ledger.ts` `inspectFixtureBoundSyntheticApproval` child loop (`:255-264`): the per-child `lstat` + checks (isDirectory / isSymbolicLink / `(mode&0o077)!==0` / `(mode&0o500)!==0o500` / `realpath(dir)!==dir`) are now wrapped in `try { … } catch { throw Error('Unsafe synthetic fixture private directory') }` — a MISSING (or otherwise error-throwing) private child no longer leaks raw ENOENT through the strict read-only API; the comment records it remains a best-effort path check, NOT an fd-relative capability. `b1fc3cc` touches ONLY this one file (9+/4-). Tests `e50ee9e` park the journal, then the whole fixture root, assert the EXACT sanitized message with `!err.message.includes(child)` (no private path), assert receipt bytes untouched, restore, assert strict accepts again and consumed ID not replayable; `9c341c3` fixes a test-only basename bug flagged by #454. Strict API otherwise unchanged (input guards, fixture-root safety, marker canonical+sanitized read, binding comparison, final root-identity re-check, read-only by construction).

## E. Adversarial harness (`~/.dsh-superagent-private/c6b2b6b/preflight_acceptance.mts`, fresh approval IDs, 0700 fixtures)
Carried B4C–B6A layers re-run at the pinned source (AA4 expectation updated for the audited sanitation): **ok=1359 fail=0, exit 0** (AA-groups 1335 intact + 24 new AB assertions).
- AB1 missing journal parked → EXACT `Unsafe synthetic fixture private directory`, no raw ENOENT, message carries NO private paths; inspector does NOT repair (child stays missing), parked child untouched; restore → strict accepted; refusal never consumed the approval; receipt bytes preserved.
- AB2 missing ledger (whole receipt dir parked) → same sanitized message; receipt bytes untouched inside the parked dir (zero mutation); restore → accepted; consumed ID still `already reserved` after the refusal (no repair-then-reuse, no replay).
- AB3 BOTH children missing → single sanitized refusal; fixture tree gains ZERO new entries after the refusal (no repair, no heartbeat files); full restore → accepted again.
- AB4 AUDITED blanket-catch breadth: a self-symlinked ledger child (realpath ELOOP — a NON-ENOENT fs error the blanket catch now swallows and sanitizes; pre-C6B2B6B this leaked raw ELOOP) → sanitized `Unsafe`; a dangling-symlink journal child (lstat succeeds on the link → isSymbolicLink check) → prior `Unsafe` taxonomy unchanged; receipt bytes preserved across all refusals; restores → accepted.
- AB5 private child REPLACED BY A REGULAR FILE (not missing) → inner `isDirectory` check throws the exact `Unsafe` message, re-thrown through the catch — same sanitized taxonomy; file kept as-is (no repair); restore → accepted.
- AB6 fresh OS child (no in-process memory): sees ONLY the sanitized message for a missing child (stdout `DENIED:Unsafe synthetic fixture private directory`, never raw ENOENT); restored-fixture positive control `ACCEPTED` (cross-process sanitation holds).
- AB7 macOS `/var`-spelled fixture ancestor (mirrors AA7): accepted by the strict API with sanitation in place; missing child under the `/var` spelling sanitized identically (ancestor spelling honored, leaf canonical facts returned).

## F. Open gates / residual limits (NOT claimed as solved; remote owns fixes)
- Same-user forgery: marker is unsigned integrity evidence; a real private non-overlapping forged directory still passes generic paths (carried Z7); strict catches only binding-level mismatch, not fixture authenticity.
- Fixture-root identity across calls and journal ABA/TOCTOU (AA9): no fd-relative capability; the blanket catch is best-effort path checking (source comment itself says so).
- Generic `reserveSyntheticApproval` cross-root re-reserve fencing still absent.
- Private transaction authority, backup/recovery, real Apply gates, live host: unresolved.

## G. Not tested / not touched
Real Weixin, OpenClaw, DSH GUI (3080), model proxy (8123), 3083 bridge services, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback, credentials. Zero product source edits locally; zero heartbeat/config changes. STOP after publication; awaiting remote ACK and the next dispatch.
