message_id: LO-20261114-037
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 1c29fe823bff657f894845e660dad1f26261927e
in_reply_to: OL-20261114-037
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43571952765
report_path: agent-reports/REPORT-c6b2b6d-offline-midcall-root-sanitation.md
verdict: ALL_OFFLINE_PASS

# C6B2B6D mid-call fixture-root error sanitation — independent Mac acceptance complete

Independent verification at exact pinned source `1c29fe823bff657f894845e660dad1f26261927e` on macOS 26.3 arm64 / Node v25.9.0 / pnpm 11.7.0.

- Remote CI cross-checked: #468 run 43571952765 at docs HEAD 57ddda6 exact 3/3 SUCCESS (real runners); #467 at the source SHA CANCELLED (not pass evidence, as dispatch stated); job logs confirm the new regression executed on BOTH Linux and macOS legs (Node 239/239, proxy 5/5, Vitest 62/1208). Source-to-CI-HEAD diff = CURRENT_STATE/WORK_QUEUE only.
- Local parity: frozen install 0, pnpm check 0, workflow-exact Node 239/239 (new regression executed locally), proxy 5/5, standalone ledger 57/57 (+1 new test), Vitest 62/1208, Gate A.5 NO_PRODUCTION_CALLERS.
- Source audit: second observation wrapped (`try {initial=await lstat} catch -> Unsafe synthetic fixture root`), final observation wrapped (`-> Synthetic fixture root identity changed; manual review required`), both pre-fix bare lines gone, source comment self-records only-error-sanitation (ABA/TOCTOU unresolved).
- Adversarial matrix stable ok=1404 fail=0 across 6 consecutive runs (AD1-AD6 + carried B4C-B6C layers). Bounded mid-call deletion and swap races: strict second/final catches sanitize with no errno/path leak; cross-call path ABA still ACCEPTED (dev/ino not remembered; audited limit); consumed ID never replayed; receipt never repaired.
- AUDITED PRE-EXISTING LIMIT reproduced by the race (~1/20 trials): the generic delegate `inspectSyntheticApproval` call is OUTSIDE any strict catch; its own unwrapped `lstat(ledgerRoot)`/`realpath` can surface a raw `ENOENT ... realpath '<private>/ledger'` WITH the private path when a deletion lands in the delegate window. Race timing non-deterministic; recorded per dispatch. Candidate next milestone for remote: wrap/sanitize the delegate's ledger+journal observations (or descriptor-relative strict path).
- Residual gates unchanged: same-user forgery, generic cross-root re-reserve, cross-call path ABA, TOCTOU delegate window, Proxy traps, private transaction authority/backup/recovery, real Apply.
- No product source edits locally. No real Apply/Weixin/DSH/production/credentials/3080/3083/8123 touched. STOP after this report; OL-20261114-037 done, never replay.
