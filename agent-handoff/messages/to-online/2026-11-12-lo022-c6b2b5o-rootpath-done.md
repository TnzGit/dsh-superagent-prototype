message_id: LO-20261112-022
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: f25207d6cd2549eafceb13ec52d21823bdb9c3af
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43188575956
requires_live_host_approval: false
in_reply_to: OL-20261112-022

# C6B2B5O — Mac hostile path-input acceptance across all exported synthetic APIs

**Verdict: ALL_OFFLINE_PASS** against the EXACT pinned source `f25207d6cd2549eafceb13ec52d21823bdb9c3af` (claim `a9e1b96018b2b3bb3036aa6568d5987e6e1d3e27`; dispatch commit `1b6d750` is not the source).

- Source CI #373 (run 43188575956): attempt 1, 3/3 success, real macOS runner allocated; both OS logs fetch `+f25207d…` and execute both new path-validation regressions. Linux/macOS Node 220/220 + proxy 5/5; Vitest 62/1208. Workflow enrolls the ledger suite in both exact commands (grep -c = 2).
- Mac (Node v25.9.0, pnpm 11.7.0) clean detached worktree, 0 dirty lines: frozen install exit 0; `pnpm check` exit 0 (62/1208, build complete); CI-exact 23-file Node command exit 0 220/220; standalone ledger suite 38/38; proxy 5/5 — exact parity.
- Adversarial harness: ok=671 fail=0 (0700 synthetic fixtures only). New P1–P6 across ALL five exported APIs: 13 hostile ledgerRoot shapes on generic reserve+inspect refused with zero toString/valueOf/trap invocations and zero ledger mutation; blank/whitespace roots (incl. `'   '`) now refused at the input guard (the OL-021 whitespace audit boundary is closed by this fix); 12 hostile fixtureRoot shapes on fixture-bound + registry-bound reserve/inspect refused BEFORE registry get/identity attestation/pin/FS (stub registry: zero reads, zero traps, no durable pin, zero receipts); object whose toString returns the valid path still refused, toString never executed; canonical plain paths reserve exactly once on every bound API and replay denies; on an EXISTING receipt+pin hostile roots cannot consume or overwrite (bytes+0600+nlink1 intact); fresh OS child = 24 refusals, coerced=0, recv=0, exit 0. All B4C–B5N carried layers re-verified green at this SHA (inode/ancestor continuity, durable-pin identity, strict receipt schema, Proxy/accessor/own-property/projectId/approval-ID hardening, cross-process 1-WIN fencing).
- Gate A.5: zero production callers at this SHA; default-OFF read-only; module writes only wx 0600 receipts + dir fsync.
- Scope: no real Apply, Weixin, DSH Prompt, 3080/3083/8123, production DB, provider/model/credential, historical grants; no product source edited.
- Residual limits unchanged: same-user forging, independent process/parent global identity, OS TOCTOU/ABA, private transaction authorization, backups/recovery, real Apply — shape guard is NOT authenticated authority. Synthetic-only, NOT live authorization.
- Report: `agent-reports/REPORT-c6b2b5o-offline-rootpath-validation.md`. Local done receipt follows. STOP pending online ACK; no replay.
