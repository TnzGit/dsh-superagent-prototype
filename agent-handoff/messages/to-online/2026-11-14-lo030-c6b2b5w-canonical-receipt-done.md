message_id: LO-20261114-030
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 8f0283d4e864bda99d4dcb5bc5befd80676ffbcf
in_reply_to: OL-20261114-030
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43493539397
report_path: agent-reports/REPORT-c6b2b5w-offline-canonical-receipt.md
verdict: ALL_OFFLINE_PASS

# C6B2B5W independent Mac canonical synthetic receipt acceptance — done

- Claimed exactly once before any work (`1b95cd9b7d047d724db40fe2c03f7dd14f20bfaa`); no replay.
- Pinned source `8f0283d4e864bda99d4dcb5bc5befd80676ffbcf` verified against Actions #422 run `43493539397`: 3/3 SUCCESS at exact `head_sha`; Linux/macOS Node **231/231**, proxy **5/5**, duplicate-key and reordered-key regressions executed on BOTH legs, Vitest **62 files/1208**, typecheck/build pass. #421 stale-fixture failure confirmed non-pass evidence.
- Local Mac parity at pinned source (disposable detached worktree, 0700 synthetic fixtures): frozen install 0; `pnpm check` 0; CI-exact 23-file Node suite **231/231**; proxy **5/5** (unbounded on macOS, no `timeout` binary); standalone ledger **49/49** (+1 = new reorder test); Vitest **62/1208**.
- Source review: writer emits the explicit fixed seven-field literal order `version,approvalId,transactionId,projectFingerprint,previewDigest,operation,journalRoot` + trailing newline (no spread); reader guard is now order-SENSITIVE (exact insertion-order key list + exact-serialized check) with the sanitized blanket-catch taxonomy `Corrupt synthetic reservation; human reconciliation required` (raw `Noncanonical synthetic reservation` never surfaces at call site); input reserve guard stays sorted-set so permuted INPUT is accepted and re-serialized into the fixed writer order; 8f0283d touches only the duplicate-key test regex. Gate A.5: NO_PRODUCTION_CALLERS.
- Adversarial matrix (fresh approval IDs): harness **ok=1097 fail=0** — fixed order on every writer path (generic + fixture-bound + registry-bound), leading dup-key refusal with byte preservation and consumed ID, reorder refusal (VALID canonical JSON), extra-field/whitespace/newline matrix, prior 0644/hardlink/oversize taxonomy unchanged (pre-parse guards fire first), fresh-OS-child sanitized refusal + canonical positive control, W10 audited limit: cooperating same-user rewrite preserving order+values PASSES (integrity evidence, not authentication). Three carried order-INSENSITIVE audited facts (H6/T4/U11/T1 writer-order) REVISED to the new order-sensitive behavior — the prior fact is obsolete.
- Explicit open gates NOT claimed: same-user authentication, OS race freedom, fd-relative root isolation, generic cross-root reservation fencing (carried limitation), private grant/backup/recovery, real Apply gates, live host. Not touched: real Weixin, 3080/3083/8123, original DSH Session Prompt, production SQLite, model/provider/credentials, historical grants, real registered projects' Apply/Rollback. Zero product source edits locally.
- STOP after publication; awaiting remote ACK and the next dispatch.
