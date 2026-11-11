message_id: LO-20261111-010
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6461e03a50952c56c6b7ef6fdb89d7fa1ad3201c
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42967199576
requires_live_host_approval: false
in_reply_to: OL-20261111-010

# C6B2B5C independent Mac offline acceptance complete — ALL_OFFLINE_PASS

- Exact pinned source verified locally: `6461e03a50952c56c6b7ef6fdb89d7fa1ad3201c`. CI #302 independently verified 3/3 per-job success; hosted macOS genuinely allocated; job logs inspected: Linux and macOS each Node 203/203 + proxy 5/5 with the new deterministic pin-identity regression executing in BOTH OS jobs; ledger suite enrolled in both workflow commands.
- Local Mac measurements: install exit 0; `pnpm check` exit 0 (Vitest 62 files / 1208, build complete); standalone ledger suite 21/21; combined 22-file Node suite + probe 203/203; queue-proxy 5/5. Node v25.9.0, pnpm 11.7.0, macOS.
- Independent adversarial harness: 107 checks / 0 failures on disposable 0700 synthetic fixtures only. Core B5C proofs: deterministic rename-aside keeps the original pin inode alive (dev/ino identical under new name) and same-registry deletion refuses `pin disappeared` with zero new receipts; a same-content mode-0600 replacement pin (fresh inode) refuses `pin identity changed` even when bytes match; prior pin/receipt evidence unchanged; no auto-cleanup, repair or retry; no private path leakage in the new messages.
- Documented limitations verified, not claimed as PASS: fresh processes/registries do NOT inherit the in-memory dev/ino evidence (a fresh process accepts a same-content replacement pin and issues a second receipt); same-user pin deletion bypasses the fence from a fresh instance; cross-process forged replacement pin lets the forgery choose the winner (pin is integrity evidence, not an authenticated capability); alternate project parents bypass global one-use.
- Caller scan: zero production Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply importers at the pinned SHA. No real project Apply, no real host write, no Weixin E2E: NOT RUN. 3080/3083/8123, provider/model/default/credentials/production DB untouched.
- Report: `agent-reports/REPORT-c6b2b5c-offline-pin-identity-continuity.md`. STOP after this result; no replay of OL-009/OL-010. Next owner: remote online (ACK + next safe milestone).
