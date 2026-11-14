message_id: LO-20261114-034
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 276f47ed25d78e52b51767bf1f566389933da61a
in_reply_to: OL-20261114-034
task: C6B2B6A independent Mac strict fixture-bound receipt inspection acceptance
status: done
verdict: ALL_OFFLINE_PASS
claim_sha: ebcdd2de67b040d578de9ef1675175b8bfc184de
pinned_source_ci_run: 43553179535
report_path: agent-reports/REPORT-c6b2b6a-offline-strict-fixture-binding.md
summary: |
  Mac acceptance of C6B2B6A strict fixture-bound inspection at pinned source 276f47e (detached worktree, git status 0 lines).
  CI #442 run 43553179535 completed:success at exact pinned head_sha, 3/3, both new strict regressions executed on BOTH legs
  (Linux 182/183 + strict-inspection subtests, Node 237/237, proxy 5/5; macOS ✔ strict-inspection tests, Node 237/237, proxy 5/5;
  Vitest 1208/1208). Dispatch-vs-pinned diff = 9 handoff/docs files only, zero src/test drift. Gate A.5: NO_PRODUCTION_CALLERS
  (grep over src/ excluding the definition is empty).
  Local Mac parity at pinned source: frozen install 0, pnpm check 0 (no flake this round), CI-exact 23-file Node suite 237/237,
  proxy 5/5 (unbounded; no timeout binary on macOS), standalone ledger suite 55/55 (the two new C6B2B6A tests), Vitest 62 files/1208.
  Adversarial harness at pinned source: carried B4C-B5Z layers unchanged ok=1263 fail=0; new AA0-AA10 groups ok=1335 fail=0 exit 0.
  Proven: strict inspection refuses a canonical receipt forged to a DIFFERENT EXISTING 0700 journal and a swapped projectFingerprint
  with the sanitized binding-mismatch message (no private paths in it), while generic inspectSyntheticApproval ACCEPTS the same forgery
  (AUDITED contrast — strict-only catch, not equivalent); hostile bytes preserved with zero writes anywhere (idempotent, never consumes);
  marker tamper matrix (trailing-newline/dup-key/reorder/extra-field/pretty) refused with sanitized corrupt message (raw Noncanonical
  never leaks from the strict API) and canonical-but-string-version refused with raw Untrusted semantic message (mirrors OL-029 taxonomy);
  private-child mode matrix (0755/0750/0711/0200/0100/0400/0600) and journal symlink alias refused raw Unsafe; missing child leaks RAW
  ENOENT (AUDITED: the child-loop lstat is not blanket-caught); fixture-root safety (0755 root, symlinked root alias, non-temp location,
  bad basename) and input guards (object/Tracked-string with zero traps, revoked Proxy, 42/empty/blank roots; numeric/uppercase/7-char IDs)
  fire BEFORE any fs read; AUDITED LIMIT: regex is schema-only, not a whitelist — a schema-legal 20-char ID reaches the fs and fails closed
  as sanitized Corrupt; /var-spelled ancestor ACCEPTED with canonical /private/var facts returned (mirrors C6B2B5Z ancestor lesson);
  fresh OS child with no in-process state: forged receipt DENIED differs, canonical OK, cross-process reserve of a consumed ID DENIED already
  reserved (one-use holds across processes); AUDITED LIMITS: same-path different-inode swap BEFORE a call PASSES (dev/ino not remembered
  across calls — best-effort evidence, not a race-free capability), mid-call swap caught by the final identity check only when the race loses
  (TOCTOU non-determinism). Strict does not replace generic inspection and never authorizes live Apply (no production callers).
  Residual limits carried: same-user unsigned marker (real private forgery passes generic paths, Z7 carried), fixture-root/journal ABA and
  TOCTOU, missing-child raw ENOENT, generic reserveSyntheticApproval cross-root re-reserve fencing absent, private transaction authority,
  backup/recovery, real Apply gates unresolved.
  Services 3080/3083/8123, real Weixin, original Session Prompt, model defaults, production SQLite, historical grants and real registered
  projects' Apply/Rollback untouched. Zero product source edits locally. STOP after publication; awaiting remote ACK and the next dispatch.
