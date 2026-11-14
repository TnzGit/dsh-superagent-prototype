message_id: LO-20261114-035
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 5a994bbb2f2258aff4a53a28ec88b1c6e02d800d
in_reply_to: OL-20261114-035
task: C6B2B6B independent Mac synthetic missing-child sanitation acceptance
status: done
verdict: ALL_OFFLINE_PASS
claim_sha: b549df72546f6958e9bd6e0b37ec55f56bc7420a
pinned_source_ci_run: 43558344499
report_path: agent-reports/REPORT-c6b2b6b-offline-missing-child-sanitation.md
summary: |
  Mac acceptance of C6B2B6B missing-child sanitation at pinned source 5a994bb (detached worktree, git status 0 lines).
  CI #456 run 43558344499 completed:success at exact pinned head_sha, 3/3, both strict regressions executed on BOTH legs
  (Linux ok 213/214, Node 237/237, proxy 5/5; macOS strict tests incl the new missing-child loop, Node 237/237, proxy 5/5;
  Vitest 62 files passed; typecheck/build pass). History recorded openly: #454 failed on a test-only basename reference,
  fixed by 9c341c3 (file.slice(root.length+1)) before #456; #455 cancelled/superseded. Dispatch-vs-pinned diff = handoff/docs
  only, zero src/test drift; 5a994bb verified as an ancestor of dispatch HEAD 0df6c1c. Gate A.5: NO_PRODUCTION_CALLERS
  (grep over src/ excluding the definition is empty).
  Local Mac parity at pinned source: frozen install 0, pnpm check 0 (no flake this round), CI-exact 23-file Node suite 237/237,
  proxy 5/5 (unbounded; no timeout binary on macOS), standalone ledger suite 55/55 (both strict-inspection tests incl the new
  missing-child loop), Vitest 62 files/1208.
  Source review: b1fc3cc wraps the strict child-loop lstat+checks (ledger/journal, ledger module :255-264) in try/catch re-throwing
  the EXACT sanitized 'Unsafe synthetic fixture private directory' — a missing (or otherwise error-throwing) private child no longer
  leaks raw ENOENT through the read-only API; source comment records it stays a best-effort path check, NOT an fd-relative capability.
  One file, 9+/4-; strict API otherwise unchanged. e50ee9e/9c341c3 tests park journal then whole fixture root, assert exact sanitized
  message with no private path, receipt bytes untouched, restore, strict accepted again, consumed ID not replayable.
  Adversarial harness at pinned source: carried B4C-B6A layers with AA4 updated to the audited sanitized behavior, new AB1-AB7:
  RESULT ok=1359 fail=0 exit 0. Proven: missing journal/ledger child (single and both) -> exact sanitized Unsafe with no raw ENOENT
  and no private paths; inspector NEVER repairs (child stays missing; parked dir and receipt bytes untouched; zero new tree entries
  after refusal; no heartbeat files); refusal NEVER consumes (restore -> strict accepted again; consumed ID still 'already reserved'
  after the refusal - no repair-then-reuse, no replay); AUDITED blanket-catch breadth: self-symlinked ledger child (realpath ELOOP,
  a NON-ENOENT fs error pre-fix leaked raw ELOOP) now sanitized identically; dangling-symlink journal child keeps the prior Unsafe
  taxonomy (lstat succeeds on the link); child REPLACED BY A REGULAR FILE throws the same exact sanitized message (isDirectory
  inner throw re-thrown through catch; file kept, no repair); fresh OS child with no in-process memory sees ONLY the sanitized
  message (DENIED:Unsafe, never raw ENOENT) with restored-fixture ACCEPTED positive control (cross-process sanitation holds);
  /var-spelled ancestor accepted with sanitation in place and missing child under the /var spelling sanitized identically
  (mirrors AA7). Residual limits carried: same-user unsigned marker authenticity (Z7), fixture-root/journal ABA and TOCTOU (AA9;
  blanket catch itself is best-effort path checking per the source comment), generic reserveSyntheticApproval cross-root
  re-reserve fencing absent, private transaction authority, backup/recovery, real Apply gates unresolved.
  Services 3080/3083/8123, real Weixin, original Session Prompt, model defaults, production SQLite, historical grants and real
  registered projects' Apply/Rollback untouched. Zero product source edits locally. STOP after publication; awaiting remote ACK
  and the next dispatch.
