message_id: LO-20261114-036
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6708a1028012ff4492200d13acae5bba5ddf9255
in_reply_to: OL-20261114-036
task: C6B2B6C independent Mac missing fixture-root sanitation acceptance
status: done
verdict: ALL_OFFLINE_PASS
claim_sha: 447c47036beaa1af6e186c2a3e3699ffc1418310
pinned_source_ci_run: 43562807129
report_path: agent-reports/REPORT-c6b2b6c-offline-missing-fixture-root-sanitation.md
summary: |
  Mac acceptance of C6B2B6C missing fixture-root sanitation at pinned source 6708a10 (detached worktree, git status 0 lines).
  CI #461 run 43562807129 completed:success at exact pinned head_sha, 3/3, the new missing-root regression executed on BOTH legs
  (Linux ok 214, Node 238/238, proxy 5/5; macOS ✔ missing-root test 27.37ms, Node 238/238, proxy 5/5; Vitest 1208, typecheck/build
  pass; real runners 1000003400-3402 allocated). Dispatch-vs-pinned diff = 4 handoff/docs files only, zero src/test drift;
  6708a10 is the dispatch parent. Gate A.5: NO_PRODUCTION_CALLERS (grep over src/ excluding the definition returns 0).
  Local Mac parity at pinned source: frozen install 0, pnpm check 0 (no flake this round), CI-exact 23-file Node suite 238/238
  (new regression present locally, 16.96ms), proxy 5/5 (unbounded; no timeout binary on macOS), standalone ledger suite 56/56
  (+1 new C6B2B6C test), Vitest 62 files/1208.
  Source review: the fixture-root initial lstat+checks and realpath (ledger module :235-247) are wrapped in try/catch re-throwing
  the EXACT sanitized 'Unsafe synthetic fixture root' — a missing (or otherwise error-throwing) fixture root no longer leaks raw
  ENOENT/ENOTDIR through the strict read-only API; source comment records it stays a best-effort path check, NOT fd-relative/ABA-safe.
  One file 16+/4-; plus a no-repair regression test (+21). AUDITED residual documented: the SECOND lstat after the try/catch and the
  FINAL identity lstat remain OUTSIDE any catch — mid-call root deletion/swap can still surface raw errno (sanitation covers only the
  initial check; TOCTOU window persists by design; asserted structurally against the pinned source text in harness AC5).
  Adversarial harness at pinned source: carried B4C-B6B layers unchanged (1359) + new AC1-AC5: RESULT ok=1381 fail=0 exit 0. Proven:
  missing fixture root (rename-away) -> exact sanitized Unsafe with no raw ENOENT/ENOTDIR and no private paths; inspector NEVER repairs
  (root stays missing, no directory recreated at the old path, zero new tree entries); receipt bytes preserved inside the parked root
  (zero mutation); refusal NEVER consumes (restore -> strict accepted again; consumed ID still 'already reserved' after the refusal -
  no repair-then-reuse, no replay); root REPLACED BY A REGULAR FILE -> inner isDirectory throw re-thrown through the catch as the SAME
  sanitized message (identical taxonomy, no errno; file kept as-is); dangling-symlink root sanitized via BOTH the isSymbolicLink check
  AND realpath-ENOENT swallowed by the blanket catch (AUDITED breadth: non-lstat errors swallowed too); fresh OS child with no in-process
  memory sees ONLY the sanitized message (DENIED:Unsafe synthetic fixture root, never raw ENOENT) with restored-fixture ACCEPTED positive
  control (cross-process sanitation holds); /var-spelled missing root sanitized identically and /var-spelled restored root accepted with
  canonical facts (mirrors AB7). Residual limits carried: same-user unsigned marker authenticity (Z7), fixture-root identity across calls
  and ABA/TOCTOU including the uncaught second/final lstat window (AA9+AC5), generic reserveSyntheticApproval cross-root re-reserve
  fencing absent, private transaction authority, backup/recovery, real Apply gates unresolved.
  Services 3080/3083/8123, real Weixin, original Session Prompt, model defaults, production SQLite, historical grants and real registered
  projects' Apply/Rollback untouched. Zero product source edits locally. STOP after publication; awaiting remote ACK and the next dispatch.
