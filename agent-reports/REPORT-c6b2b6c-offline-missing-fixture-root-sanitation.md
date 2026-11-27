# REPORT-c6b2b6c — C6B2B6C independent Mac missing fixture-root sanitation acceptance

**Verdict: ALL_OFFLINE_PASS** (OFFLINE_SYNTHETIC_ONLY; synthetic 0700 fixtures only; zero product source edits locally; no live host, no real Apply, no Weixin, no DSH services touched)

- Task: OL-20261114-036, dispatched at HEAD `3603247eee88be56509aab2545c2a80590e7b62e`, claimed exactly once at `447c47036beaa1af6e186c2a3e3699ffc1418310` (non-force fast-forward onto dispatch HEAD, `ls-remote` verified). The claimed receipt's `claim_sha` metadata corrected by ancestry-complete follow-up commit `066edd55609c9e6d84a4cab45125661747f50116` (same class as OL-032/033/034/035 audit caveats, recorded openly).
- Pinned source: `6708a1028012ff4492200d13acae5bba5ddf9255` ("C6B2B6C: sanitize missing strict synthetic fixture root and test no repair"), detached worktree, `git status` 0 lines.

## A. Environment
- macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (identical to prior OL reports).

## B. Source CI verification (exact pinned head_sha)
- Actions #461 run `43562807129`: `completed` / `success`, `head_sha === 6708a10…` exact, **3/3** jobs success (`macos-portability`, `dsh-typecheck-and-build`, `local-first-core`; real runners 1000003400/3401/3402 allocated).
- Actual job logs: the new missing-root regression executed on BOTH legs — Linux `ok 214 - strict synthetic fixture inspection sanitizes a missing fixture root without repairing or replaying`, `# pass 238 / # fail 0`, proxy `# pass 5 / # fail 0`; macOS `✔ strict synthetic fixture inspection sanitizes a missing fixture root without repairing or replaying (27.37ms)`, `ℹ pass 238 / fail 0`, proxy `ℹ pass 5`. Vitest 1208, typecheck/build pass.
- Dispatch-vs-pinned diff (`6708a10..3603247`): 4 handoff/docs files (LOCAL_AGENT_TASK, CURRENT_STATE, WORK_QUEUE, the OL-036 message) — zero src/test drift; `6708a10` is the dispatch parent; CI evidence valid for the pinned source.
- Gate A.5: `grep -rn inspectFixtureBoundSyntheticApproval src/` excluding the definition → 0 = **NO_PRODUCTION_CALLERS**.

## C. Local Mac parity at pinned source (disposable detached worktree)
| step | result | exit |
|---|---|---|
| `pnpm install --frozen-lockfile` | Done in 1.2s | 0 |
| `pnpm check` | build complete 1307ms, no flake this round | 0 |
| CI-exact 23-file Node suite (workflow list) | **238/238** (incl. the new missing-root regression ✔ 16.96ms locally) | 0 |
| proxy suite | **5/5** (unbounded — macOS has no `timeout` binary) | 0 |
| standalone ledger suite | **56/56** (+1 = the new C6B2B6C test) | 0 |
| Vitest | **62 files / 1208 tests** | 0 |

## D. Source review of the C6B2B6C sanitation
`src/local-first/non-git-synthetic-approval-ledger.ts` `inspectFixtureBoundSyntheticApproval` fixture-root check (`:235-247`): the initial `lstat` + checks (isDirectory / isSymbolicLink / `(mode&0o077)!==0`) and the `realpath` are now wrapped in `try { … } catch { throw Error('Unsafe synthetic fixture root') }` — a MISSING (or otherwise error-throwing) fixture root no longer leaks raw ENOENT/ENOTDIR through the strict read-only API; the source comment records it stays a best-effort path check, NOT fd-relative/ABA-safe. One file, 16+/4-; plus the new no-repair regression test (+21 lines).
- AUDITED residual (documented, not a defect introduced by this fix): the SECOND `const initial=await lstat(fixtureRoot)` after the try/catch and the FINAL identity `lstat` remain OUTSIDE any catch — a mid-call root deletion/swap can still surface raw errno from those checks (the TOCTOU window sanitation only covers the initial check). Harness AC5 asserts this structurally against the pinned source text.

## E. Adversarial harness (`~/.dsh-superagent-private/c6b2b6c/preflight_acceptance.mts`, fresh approval IDs, 0700 fixtures)
Carried B4C–B6B layers re-run at the pinned source unchanged: **ok=1381 fail=0, exit 0** (carried 1359 intact + 22 new AC assertions).
- AC1 missing fixture root (rename-away) → EXACT `Unsafe synthetic fixture root`, no raw ENOENT/ENOTDIR, message carries NO private paths; inspector does NOT repair (root stays missing, no new directory at the old path, zero new tree entries); receipt bytes preserved inside the parked root (zero mutation); restore → strict accepted again (refusal never consumed); consumed ID still `already reserved` after the refusal (no repair-then-reuse, no replay).
- AC2 fixture root REPLACED BY A REGULAR FILE (not missing) → inner isDirectory throw inside the try re-thrown through the catch as the SAME sanitized message (identical taxonomy, no errno); replacing file kept as-is (no repair); restore → accepted; receipt bytes preserved.
- AC3 dangling-symlink root: lstat succeeds on the link (isSymbolicLink check inside try) AND realpath of a dangling link throws ENOENT inside the try — both paths sanitized by the blanket catch (AUDITED breadth: non-lstat errors swallowed too); restore → accepted; bytes preserved.
- AC4 fresh OS child (no in-process memory): sees ONLY `DENIED:Unsafe synthetic fixture root` for a missing root, never raw ENOENT; restored positive control `ACCEPTED` (cross-process sanitation holds).
- AC5 macOS `/var`-spelled missing root sanitized IDENTICALLY (mirrors AB7); `/var`-spelled restored root accepted with canonical facts; plus structural audit against the pinned source: second lstat and final identity lstat remain outside the catch (TOCTOU raw-leak window persists by design — best-effort evidence, not a capability).

## F. Open gates / residual limits (NOT claimed as solved; remote owns fixes)
- Same-user forgery: marker is unsigned integrity evidence; a real private non-overlapping forged directory still passes generic paths (carried Z7); strict catches only binding-level mismatch, not fixture authenticity.
- Fixture-root identity across calls and journal/root ABA/TOCTOU (AA9 + AC5): no fd-relative capability; the initial-check sanitation does NOT cover the second/final lstat — mid-call raw errno leak window persists.
- Generic `reserveSyntheticApproval` cross-root re-reserve fencing still absent.
- Private transaction authority, backup/recovery, real Apply gates, live host: unresolved.

## G. Not tested / not touched
Real Weixin, OpenClaw, DSH GUI (3080), model proxy (8123), 3083 bridge services, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback, credentials. Zero product source edits locally; zero heartbeat/config changes. STOP after publication; awaiting remote ACK and the next dispatch.
