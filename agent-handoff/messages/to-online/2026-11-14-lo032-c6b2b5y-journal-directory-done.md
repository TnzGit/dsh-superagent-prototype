message_id: LO-20261114-032
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: a02217720c38bb41de85f7098a1e217d1718fc2a
in_reply_to: OL-20261114-032
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43528035756
report_path: agent-reports/REPORT-c6b2b5y-offline-journal-directory-refusal.md
verdict: ALL_OFFLINE_PASS

# C6B2B5Y independent Mac synthetic journal-directory refusal acceptance — done

- Claimed exactly once before any work (`2d4388a0ed0bf66ebb92547bf6dc7e7d35ff182f`); no replay.
- Pinned source `a02217720c38bb41de85f7098a1e217d1718fc2a` verified against Actions #433 run `43528035756`: 3/3 SUCCESS at exact `head_sha`; Linux/macOS Node **233/233**, proxy **5/5**, new forged-missing/unsafe/alias/equality journal-directory regression executed on BOTH legs (Linux `ok 164`, macOS `✔ …38.49ms`), Vitest **62 files/1208**, typecheck/build pass. Dispatch-vs-pinned diff = 4 handoff/docs files only, zero src/test drift. Gate A.5: NO_PRODUCTION_CALLERS.
- Local Mac parity at pinned source (disposable detached worktree, 0700 synthetic fixtures): frozen install 0; `pnpm check` 0; CI-exact 23-file Node suite **233/233**; proxy **5/5** (unbounded on macOS, no `timeout` binary); standalone ledger **51/51** (+1 = new C6B2B5Y journal-directory test); Vitest **62/1208**.
- Source review: `inspectSyntheticApproval` adds a read-only journal existence/identity preflight at `:187-204` — `lstat`+`realpath`, refusing non-directory / symlink / `(mode&0o077)!==0` / `realpath(x)!==x` as `Unsafe synthetic journal`, and bidirectional `contained()` overlap as `Synthetic journal overlaps ledger`; the whole block is blanket-caught to the sanitized `Corrupt synthetic reservation; human reconciliation required` (raw strings never leak — Y10 exact-message proof). Reserve-side pre-existing raw taxonomy untouched (Y10 contrast). Guard order unchanged: unsafe-lstat → size>4096 → canonical reader → semantic shape/path → new preflight (Y11).
- Adversarial matrix (fresh approval IDs): carried B4C–B5X layers re-run at pinned source **ok=1143 fail=0** after three audited-delta patches; with new Y-groups **ok=1214 fail=0 exit 0**. Y1 pinned-regression mirror (missing/0755/alias/equality refused, bytes preserved, ID consumed, SAME-id restore accepted); Y2 journal path itself swapped to a symlink in place (refused; canonical bytes never rewritten; restored real dir accepted again); Y4 overlap refused in BOTH directions (equality/descendant/ancestor) with sibling non-overlap accepted; Y5 real 0700 non-overlapping journal positive control — preflight makes ZERO writes; Y6 fresh-OS-child sanitized refusal + canonical accept; Y7 metadata invariance (bytes+size+mode+nlink+ino+mtimeMs) across all refusal kinds; Y8 mode matrix (0755/0750/0711 refused; owner-only 0700/0600 accepted; regular file refused; independent-tree journal accepted); Y9 AUDITED path-ABA on the journal (different inode at identical path still passes — journal dev/ino never pinned, not fd-relative); Y10 taxonomy (inspect message exactly sanitized for all 7 forged kinds; reserve-side raw preserved); Y11 guard order (size gate precedes preflight; relative form refused by semantic guard pre-lstat).
- Audited deltas making OL-031 facts obsolete: trailing-slash and uppercased absolute `journalRoot` now REFUSED (`realpath(x)===x` identity check); forged NON-EXISTENT absolute normalized path now REFUSED (same-user forgery residual narrowed to a REAL private non-overlapping directory); exactly-4096 padded ACCEPT boundary not re-testable on macOS (PATH_MAX lstat ENAMETOOLONG → sanitized refusal; 4097 REFUSED boundary still enforced).
- Explicit open gates NOT claimed: same-user authenticity, OS race freedom / journal path ABA (Y9), fd-relative isolation, generic cross-root reservation fencing, private grant/backup/recovery, real Apply gates, live host. Not touched: real Weixin, 3080/3083/8123, original DSH Session Prompt, production SQLite, model/provider/credentials, historical grants, real registered projects' Apply/Rollback. Zero product source edits locally.
- STOP after publication; awaiting remote ACK and the next dispatch.
