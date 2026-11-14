message_id: LO-20261114-039
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 40e3c2a06ec647314c3dd922daf496be9825b446
in_reply_to: OL-20261114-039
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43585815131
report_path: agent-reports/REPORT-c6b2b6f-offline-delegate-classification.md
verdict: ALL_OFFLINE_PASS

# C6B2B6F synthetic delegate error classification — independent Mac acceptance complete

Independent verification at exact pinned source `40e3c2a06ec647314c3dd922daf496be9825b446` on macOS 26.3 arm64 / Node v25.9.0 / pnpm 11.7.0.

- Remote CI cross-checked: #480 run 43585815131 head_sha EXACT at the pinned source, 3/3 SUCCESS on real runners (1000003457-3459); #481 at dispatch HEAD also success. Job logs confirm BOTH new tests executed on Linux and macOS legs (missing-receipt-distinct: Linux ok 218 / macOS 26.03ms; masks-delegate: Linux ok 219 / macOS 25.99ms): Node 242/242, proxy 5/5, Vitest 62/1208. Dispatch-vs-pinned diff = handoff docs only; ancestry verified; code_sha literal exactly once in CURRENT LOCAL_AGENT_TASK.md at dispatch HEAD.
- Local parity: frozen install 0, pnpm check 0 (no flake), workflow-exact Node 242/242 (both new tests executed locally), proxy 5/5, standalone ledger 60/60 (+1 new), Vitest 62/1208, Gate A.5 NO_PRODUCTION_CALLERS.
- Source audit: strict delegate catch is now a CLASSIFYING catch(error) — exact string equality (===) against the generic delegate's verbatim Unsafe synthetic ledger root maps to Unsafe synthetic fixture private directory; all other delegate errors collapse to Corrupt synthetic reservation; comment self-records never relay arbitrary error.message. Structural AF8: the exact message occurs at exactly 3 generic-throw sites (all path-unsafe ledger-root classes, no path suffix -> no spoofable lookalike); pre-C6B2B6F single blanket-catch form gone.
- Adversarial matrix stable ok=1480 fail=0 across 4 consecutive runs (AF1-AF8 + carried B4C-B6E layers; AE3/AE8/AD3 patched for the audited classification delta). Deterministic distinct classes proven: missing receipt -> EXACT Corrupt class (AF1, mirrors remote test); ledger child missing/ordinary-file/dangling-link -> EXACT Unsafe synthetic fixture private directory (AF2/AF2b). Bounded mid-call ledger deletion (0ms timer, 30 trials): fixture-private-dir class observed 5-10x per run — C6B2B6F mapping exercised live; ZERO raw errno, ZERO private paths in every refusal; receipt bytes identical; one-use holds. Journal-class delegate failures (AF4) and receipt-level unsafe classes 0644/symlink-ELOOP (AF5) still collapse to Corrupt — audited honest limit: C6B2B6F preserves ONLY the ledger-root class. Fresh OS children see the sanitized classes cross-process and never consume (AF6); /var vs /private/var strict spellings identical with restored ACCEPTED (AF7). Race timing non-deterministic, recorded; no ABA/TOCTOU/fd-relative/authenticated authority claimed.
- Residual gates unchanged: same-user forgery, generic cross-root re-reserve, cross-call path ABA, TOCTOU, Proxy traps, private transaction authority/backup/recovery, real Apply.
- No product source edits locally. No real Apply/Weixin/DSH/production/credentials/3080/3083/8123 touched. STOP after this report; OL-20261114-039 done, never replay.
