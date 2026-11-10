message_id: LO-20261110-004
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
in_reply_to: OL-20261110-004
code_sha: c955892055b916f2d37edf4d8f8f2d06e21fafb5
verdict: ALL_OFFLINE_PASS
annotation: GH_MACOS_CI_INFRA_NOT_COVERED (hosted macOS job cancelled without runner in code run #250 and docs-only run #251; independent local macOS acceptance used; no 3/3 claim)
report: agent-reports/REPORT-c6b2b4c-offline-file-adversarial-hardening.md

# C6B2B4C synthetic adversarial hardening accepted — all offline checks green on real Mac

Independent macOS Gate A (exact SHA worktree, all exit 0): install frozen-lockfile; pnpm check Vitest 62 files/1208 tests; every Node suite re-run in fresh disposable fixtures — apply 18/18 (incl. new hardening + orphan-lock tests), batch-audit 14/14, batch-executor 8/8, batch-recovery 7/7, batch-stage 13/13, workspaces 10/10, projects 3/3, existing-dsh 6/6, model-queue 6/6, weixin-native 6/6, weixin-qr 4/4, probe 3/3, standalone proxy 5/5; combined Node suites 187/187, 0 failures. Linux+build CI at the exact SHA confirmed success (both runs); macOS runner never allocated → independent local gate per updated task policy, BLOCKED_CODE not applicable (no real test failed).

Independent Gate B harness (0700 fixtures, 35 checks / 0 failures): orphan apply+rollback lock → exact stable path-free message "Single-file apply lock exists; human reconciliation required", orphan retained verbatim, never stolen/retried, source bytes AND full POSIX mode unchanged, no journal created, rollback approval not consumed (journal stays applied). Hardlink aliases: refusal before apply AND after apply blocks rollback; both alias paths unchanged; inode alias/nlink preserved; applied journal intact. Special POSIX bits (sticky 0o1644, setuid 0o4644) supported on this APFS volume → real PASS refusals before apply and before rollback, full mode&0o7777 preserved, no metadata loss; not SKIPPED. Regression sanity: normal add/modify/delete/mode-only one-shot + no-replay semantics re-verified; rollback restores content and original mode.

Gate C distinction recorded: this is conservative preflight hardening (known nlink/special-bit states + sanitized lock errors), NOT race-free OS path safety; TOCTOU alias window, ancestor symlink races, non-cooperating writers, ACL/xattr, APFS normalization, authenticated one-use approvals, power-loss durability and non-atomic batches remain UNPROVEN (carried from C6B2B4B). Zero production callers re-confirmed (no Runtime/Weixin/Outbox/DSH/Worker import). No local product-code changes; still-open residuals: approval file not consumed after success (C6B2B4B §5.2), alias-creation-in-window not caught, ACL/xattr decision remote-owned. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN; no service/model/credential/DB/Prompt change.
