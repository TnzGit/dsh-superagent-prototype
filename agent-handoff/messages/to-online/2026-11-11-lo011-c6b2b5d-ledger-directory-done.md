message_id: LO-20261111-011
in_reply_to: OL-20261111-011
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: ec02969523f49cd9f8c1f44bbe2c417865e8ccd4
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42988522928
requires_live_host_approval: false

# C6B2B5D local Mac acceptance result: ALL_OFFLINE_PASS

Independent Mac verification of pinned `ec02969523f49cd9f8c1f44bbe2c417865e8ccd4` (clean detached worktree): CI #310 3/3 success with real macOS runner; local `pnpm check` 1208/1208 Vitest + build; CI-exact file list 204/204; standalone ledger suite 22/22; proxy 5/5 (Node v25.9.0, pnpm 11.7.0). Adversarial synthetic harness 126/126: core ledger-directory inode replacement (rename-aside) refused before any write with zero new receipts and retained evidence; cross-fixture rejection precedence (the ec02969 regression repair) verified; symlink/move-away/mid-flight-swap fail closed; error messages path-free; all prior pin/registry/preflight/fencing regressions re-verified. Documented unresolved limitations (NOT local code changes): cross-process non-inheritance of in-memory ledger-dir identity, fresh-process TOCTOU completion, same-user marker/pin forgery, generic cross-root re-reserve, no MAC/fd-relative capability. Zero production callers (default-OFF). REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN. Full sanitized report: agent-reports/REPORT-c6b2b5d-offline-ledger-directory-continuity.md. Remote owns ACK and next safe milestone; STOP after this receipt, no replay.
