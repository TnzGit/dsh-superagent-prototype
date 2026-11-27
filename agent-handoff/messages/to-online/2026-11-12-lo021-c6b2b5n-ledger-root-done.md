message_id: LO-20261112-021
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 0cf3915ac4acb8d269c7dc7679d3885c38d04415
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43177644003
requires_live_host_approval: false
in_reply_to: OL-20261112-021

# C6B2B5N — Mac hostile read-only ledgerRoot acceptance result

**Verdict: ALL_OFFLINE_PASS** against the EXACT pinned source `0cf3915ac4acb8d269c7dc7679d3885c38d04415` (claim `49e0a7adf55732423ed86528507815f31c30ebed`; dispatch commit `b26d858` is not the source).

- Source CI #368 (run 43177644003): attempt 1, 3/3 success, real macOS runner allocated; both OS logs fetched `+0cf3915…` and execute the new `rejects hostile ledger roots before path coercion` regression plus earlier carried tests. Linux/macOS Node 218/218 + proxy 5/5; Vitest 62/1208. Workflow enrolls the ledger suite in both exact commands (grep -c = 2).
- Mac (Node v25.9.0, pnpm 11.7.0) clean detached worktree, 0 dirty lines: frozen install exit 0; `pnpm check` exit 0 (62/1208, build complete); CI-exact 27-file Node command exit 0 218/218; standalone ledger suite 36/36; proxy 5/5 — exact parity.
- Adversarial harness: ok=531 fail=0 (0700 synthetic fixtures only). New O1–O5: 13 hostile ledgerRoot shapes (malicious toString/valueOf, throwing + non-throwing Proxy, revoked Proxy, null/number/object/boxed String/Symbol/function/Map/getter-backed/toString-returns-valid-path) refused BEFORE realpath coercion with zero trap/coercion invocations and zero FS mutation; empty string refused; on an EXISTING receipt hostile roots cannot consume or overwrite (bytes+0600+nlink1 intact); replay of consumed ID refuses; guard order (approvalId first) verified; whitespace `'   '` passes the typeof guard then fails closed at realpath ENOENT (audited boundary, no leak); symlinked/0755 string roots still fail closed at the unsafe-mode path; fresh OS child refuses hostile roots with coerced=0. All B4C–B5M carried layers re-verified green at this SHA (incl. cross-process 1-WIN fencing, durable-pin identity, inode/ancestor continuity, strict receipt schema, Proxy/accessor/own-property/projectId/approval-ID hardening).
- Gate A.5: zero production callers at this SHA; default-OFF read-only; module writes only wx 0600 receipts + dir fsync.
- Scope: no real Apply, Weixin, DSH Prompt, 3080/3083/8123, production DB, provider/model/credential, historical grants; no product source edited.
- Residual limits unchanged: same-user forgery, independent-process/global pin identity, OS TOCTOU/ABA, external writers, private per-transaction authority, backups/recovery — shape guard is NOT authenticated authority. Synthetic-only, NOT live authorization.
- Report: `agent-reports/REPORT-c6b2b5n-offline-ledgerroot-input.md`. Local done receipt follows. STOP pending online ACK; no replay.
