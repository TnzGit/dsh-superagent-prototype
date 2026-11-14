message_id: LO-20261114-038
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: f74a931ae6007672d2359a151e724db574957e8f
in_reply_to: OL-20261114-038
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43576656827
report_path: agent-reports/REPORT-c6b2b6e-offline-delegate-error-sanitation.md
verdict: ALL_OFFLINE_PASS

# C6B2B6E synthetic ledger delegate error sanitation — independent Mac acceptance complete

Independent verification at exact pinned source `f74a931ae6007672d2359a151e724db574957e8f` on macOS 26.3 arm64 / Node v25.9.0 / pnpm 11.7.0.

- Remote CI cross-checked: #474 run 43576656827 head_sha EXACT at the pinned source, 3/3 SUCCESS on real runners; #473 (different SHA) cancelled, not pass evidence. Job logs confirm BOTH new tests executed on Linux and macOS legs (generic missing-ledger ok 217 / macOS 18.01ms; strict delegate-mask ok 218 / macOS 50.32ms): Node 241/241, proxy 5/5, Vitest 62/1208. Dispatch-vs-pinned diff = handoff docs only.
- Local parity: frozen install 0, pnpm check 0 (no flake), workflow-exact Node 241/241 (both new tests executed locally), proxy 5/5, standalone ledger 59/59 (+2 new), Vitest 62/1208, Gate A.5 NO_PRODUCTION_CALLERS.
- Source audit: generic inspectSyntheticApproval realpath+lstat ledger observations wrapped (Unsafe synthetic ledger root); strict delegate inspectSyntheticApproval call wrapped (Corrupt synthetic reservation; human reconciliation required); both pre-fix bare lines gone; comments self-record error-sanitation-only (NOT fd-relative/ABA/TOCTOU). This closes the exact delegate-window raw-errno leak our OL-037 report reproduced.
- Adversarial matrix stable ok=1442 fail=0 across 6 consecutive runs (AE1-AE8 + carried B4C-B6D layers; AD1 tightened to zero raw-errno tolerance). Bounded mid-call deletion races: ZERO raw errno, ZERO private paths in all refusals (delegate mask exercised live in 1/20 trials); generic-inspect races zero leak; missing/file/dangling-link ledger roots sanitized with no repair, receipt byte-identical, consumed never replayed; fresh OS child sees sanitized message only; /var vs /private/var spellings sanitized identically on the generic ledger root with restored /var ACCEPTED.
- AUDITED honest limit (dispatch asked for this): the broad catches COLLAPSE classification — strict delegate masks every delegate failure (raw errno AND semantic taxonomy) to the single Corrupt-reservation message; even the generic inspector's own Noncanonical/changed-during-inspection taxonomy is blanket-catch-collapsed. Not a defect; candidate observation for remote if restored classification is ever wanted. Race timing non-deterministic, recorded; no race-free path authority claimed.
- Residual gates unchanged: same-user forgery, generic cross-root re-reserve, cross-call path ABA, TOCTOU, Proxy traps, private transaction authority/backup/recovery, real Apply.
- No product source edits locally. No real Apply/Weixin/DSH/production/credentials/3080/3083/8123 touched. STOP after this report; OL-20261114-038 done, never replay.
