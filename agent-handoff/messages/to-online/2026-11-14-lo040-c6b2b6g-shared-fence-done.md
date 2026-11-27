message_id: LO-20261114-040
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 9adced9a40b5ef80c05d2d7916a54add65c6a8f0
in_reply_to: OL-20261114-040
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43596061640
report_path: agent-reports/REPORT-c6b2b6g-offline-shared-fence.md
verdict: ALL_OFFLINE_PASS

# C6B2B6G shared synthetic reservation fence — independent Mac acceptance complete

Independent verification at exact pinned source `9adced9a40b5ef80c05d2d7916a54add65c6a8f0` on macOS 26.3 arm64 / Node v25.9.0 / pnpm 11.7.0.

- Remote CI cross-checked: #485 run 43596061640 head_sha EXACT at the pinned source, 3/3 SUCCESS on real runners (1000003472-1000003474); #486 at dispatch HEAD also success. Job logs confirm BOTH new fence tests executed on Linux and macOS legs; Node 244/244, proxy 5/5, Vitest 62/1208. Dispatch-vs-pinned diff = handoff docs only; ancestry verified; code_sha literal exactly once in CURRENT LOCAL_AGENT_TASK.md at dispatch HEAD.
- Local parity: frozen install 0, pnpm check 0 (no flake), workflow-exact Node 244/244 (both fence tests executed locally), proxy 5/5, standalone ledger 62/62 (+2 new), Vitest 62/1208, Gate A.5 NO_PRODUCTION_CALLERS for the new API.
- Source audit: opt-in `reserveSharedFenceSyntheticApproval` validates the fence root shape-guarded BEFORE fs observation (Invalid class), lstat+realpath 0700/real-dir/non-symlink/normalized/realpath-stable with overlap checks wrapped to the Unsafe class, per-approval durable fence `<sha256(approvalId)>.fence` via atomic wx 0600 create + fsync; EEXIST -> exact `Synthetic approval already fenced; human reconciliation required`; the durable fence is consumed even when the downstream reserve fails (terminal, never auto-delete/retry/repair — source comments self-record it).
- Adversarial matrix stable ok=1541 fail=0 across 4 consecutive runs (AG1-AG12 + carried B4C-B6F layers): cross-ledger coordination proven (second ledger refused with zero consumption, receipt bytes unchanged, fence listing unchanged); same-root replay refuses; downstream-failure fence stays CONSUMED and later attempts are fence-refused; symlink/0644/ordinary-file/non-normalized roots and null/42/whitespace/empty inputs classified exactly; all three overlap classes refuse; 25-byte crash-partial fence blocks with no repair and no downstream call; fresh OS children denied cross-process and never consume (AG6) while a different approval ID wins (AG6b, fence is per-approval); concurrent two-child race -> exactly 1 WIN 1 DENIED (atomic wx); macOS /var vs /private/var spelling identical, no path/errno leak; forged same-user fence blocks like a real one (payload = integrity evidence, not signature).
- RECORDED LIMITS per dispatch requirement: alternate independent fence root BYPASSES the opt-in (AG8: both ledgers reserve); fence PATH inode is NOT remembered across calls — directory replacement (same path, new inode, empty) makes the same approval re-reservable (AG10). Same-user tampering, ABA/TOCTOU and non-cooperating callers remain unresolved; no global security claimed.
- Residual gates unchanged: same-user forgery, generic cross-root re-reserve, cross-call path ABA, TOCTOU, Proxy traps, private transaction authority/backup/recovery, real Apply.
- No product source edits locally. No real Apply/Weixin/DSH/production/credentials/3080/3083/8123 touched. STOP after this report; OL-20261114-040 done, never replay.
