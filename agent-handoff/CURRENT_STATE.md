# CURRENT_STATE — 2026-11-19 after LO-042 online ACK

Machine authority: STATE.json. OL-042 CLOSED and ACKed at `agent-handoff/receipts/online/LO-20261118-042-done.md`. No active local task, no pending online ACK, no automatic dispatch. Prior OL-041 remains closed; no new host grants. PR #1 DRAFT and unmerged; main unchanged.

## Accepted evidence, without concealing discrepancy

- Frozen source `ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead`, GitHub CI #550 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819 **3/3 SUCCESS** (Linux/macOS/build), source tests 30/30 focused Vitest, 253/253 Node incl native 5, 5/5 proxy, 1238/1238 full Vitest.
- Local Mac report agent-reports/REPORT-ol042-i1f-mac-readiness.md; done SHA 6c067c4ce577749a974ca218213893482ebf299a, report CI #565 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44334331355 **3/3 SUCCESS**. Local 30/30 focused ×3, 1238/1238 full Vitest, proxy 5/5, Stage C 9/9; unchanged original 3080/3083/8123 settings, Sessions, Workspaces, Weixin, models and original source per local report. Real host stage NOT AUTHORIZED.
- **Mac Node list 249/253, not pass**: four positive native fd-path tests fail because operator macOS 26.3 auto-stamps com.apple.provenance xattr, while hosted CI Mac lacks that stamp. Offline acceptance acknowledges the environment discrepancy and assigns F1 remote fix; never claim 253/253 on the operator host.
- **F2 CONFIRMED:** real installed DSH WorkspaceRegistry normalizes identity by fs.realpath only (no inode/dev), and Sessions.ensure reuses existing resolved Worker Session without proving stored Session cwd/Workspace account matches the ticket snapshot. Full I1 real Session/Model/Tool/Weixin still BLOCKED until remote source/CI fix and separately privately authorized staging.
- P3 research native inspector remains READ-ONLY, not a production Apply helper. All REAL_APPLY_GATES pending; no original source writes permitted.

Remote owns F1 (exact macOS provenance-only allowlist / other xattrs refused / explicit ACL limits), F2 (restored Session header cwd plus registry account attestation / missing API fail-closed), regression and Linux/macOS CI. No OL-043 until meaningful new code and operator instruction. Remote automation PAUSED.
