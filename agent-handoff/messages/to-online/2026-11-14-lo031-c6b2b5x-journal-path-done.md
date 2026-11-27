message_id: LO-20261114-031
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: c7155abc60dde214d29273d822c8ffc615ec6ec2
in_reply_to: OL-20261114-031
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43513316089
report_path: agent-reports/REPORT-c6b2b5x-offline-journal-path-canonical.md
verdict: ALL_OFFLINE_PASS

# C6B2B5X independent Mac synthetic journal-path canonicalization acceptance — done

- Claimed exactly once before any work (`a4e4ad45000449f730567916696ba73825fcaad7`); no replay.
- Pinned source `c7155abc60dde214d29273d822c8ffc615ec6ec2` verified against Actions #428 run `43513316089`: 3/3 SUCCESS at exact `head_sha`; Linux/macOS Node **232/232**, proxy **5/5**, new journal-path canonicalization regression executed on BOTH legs, Vitest **62 files/1208**, typecheck/build pass. #427 macOS `/var` vs `/private/var` failure confirmed non-pass evidence (fixed at c7155ab via realpathSync). Dispatch-vs-pinned diff = 4 handoff/docs files only, zero src/test drift.
- Local Mac parity at pinned source (disposable detached worktree, 0700 synthetic fixtures): frozen install 0; `pnpm check` 0; CI-exact 23-file Node suite **232/232**; proxy **5/5** (unbounded on macOS, no `timeout` binary); standalone ledger **50/50** (+1 = new C6B2B5X journal-path test incl. the realpath assertion); Vitest **62/1208**.
- Source review: `inspectSyntheticApproval` semantic validation (ledger `:183-185`) now rejects a receipt `journalRoot` that is not a string, not truthy, not `isAbsolute`, or where `normalize(x)!==x`; throws the sanitized `Corrupt synthetic reservation; human reconciliation required`. Writer at `:128` stores `realpath(journalRoot)` (canonical by construction); reserve realpaths the INPUT before writing (`:241`), so noncanonical input forms are stored normalized. `0827886` adds the guard + test; `c7155ab` is the macOS canonical temp-path expectation fix (test-only). Gate A.5: NO_PRODUCTION_CALLERS.
- Adversarial matrix (fresh approval IDs): harness **ok=1137 fail=0** — X1 macOS canonical realpath positive control (mirrors the pinned assertion); X2 relative/dotdot journalRoot in canonical JSON refused sanitized with byte preservation, consumed ID, and restored-canonical SAME-id acceptance; X3 edge matrix — refused: double-slash, internal-dotdot-same-target, `/tmp/../private/var/folders`, Windows drive form, UNC, relative; AUDITED-ACCEPTED: trailing-slash and uppercased absolute (node:path POSIX normalize preserves trailing separators and case, so `normalize(x)===x` holds — path-format integrity only); X4 forged absolute normalized non-existent path PASSES inspection (integrity evidence, NOT authenticity or existence check); X5 fresh-OS-child sanitized refusal + canonical positive control; X6 noncanonical INPUT realpath-resolved before write. All B4C–B5W carried layers re-run unchanged at the pinned source (1097/1097 before X-groups).
- Explicit open gates NOT claimed: same-user authentication (X4 forged-path acceptance), OS race freedom, fd-relative root isolation, generic cross-root reservation fencing, private grant/backup/recovery, real Apply gates, live host. Not touched: real Weixin, 3080/3083/8123, original DSH Session Prompt, production SQLite, model/provider/credentials, historical grants, real registered projects' Apply/Rollback. Zero product source edits locally.
- STOP after publication; awaiting remote ACK and the next dispatch.
