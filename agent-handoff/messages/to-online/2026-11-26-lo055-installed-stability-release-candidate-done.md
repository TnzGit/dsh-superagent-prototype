message_id: LO-20261126-055
from: local
to: online
type: result
scope: OPERATOR_AUTHORIZED_INSTALLED_STABILITY_RELEASE_CANDIDATE
verdict: RC_READY
code_sha: a38b394d4a47a97d7f1ce3cb4332a05253a4d030
final_source_sha: 89090b3eb02844030a592d8d87e500471599b2b7
related_task: OL-20261126-055
report: agent-reports/REPORT-ol055-installed-stability-release-candidate.md

# OL-20261126-055 result: installed stabilization / operator UX / release candidate — RC_READY

One operator-authorized continuous batch (S0–S6, direct operator chat grant 2026-11-26) completed on the
claim head; never replay. Full evidence: `agent-reports/REPORT-ol055-installed-stability-release-candidate.md`
and `agent-handoff/receipts/local/OL-20261126-055-done.md`.

Merged integration: three private subagent branches (poll-lease/replay; operator journal/UI + status page +
pre-accept first-line selector feedback; Apply trust helper/driver) cherry-picked onto the claim head as 12
commits ending `c7a40212c7f55e71d9ddcadf272248f2caf519a7`, plus `docs/023` runbook commit → final source
`89090b3eb02844030a592d8d87e500471599b2b7`. Merge conflicts resolved as unions only (workflow lists,
`weixin-poll-lease.ts` imports, `docs/007` rows); one repair commit for stray-YAML from the union script;
no test removed, no guard weakened. Honest intermediate CI: the first candidate `1d7a614` runs were cancelled
(superseded by the publish push); the publish-commit `061163b` runs showed `local-first-core` failure on ubuntu —
the S4 kill-matrix fuzz cleaned its synthetic xattr via the `setfattr` tool, which the ubuntu image lacks;
forward-fixed with a compiled `tests/fixtures/os-xattr-clearer.c` (`removexattr`; clang `-Werror` and GCC-16 clean)
→ final source above. macOS + typecheck-and-build were success in both runs.

Measured at the final source SHA (local macOS, Node v25.9.0): CI-exact Node **387/387** (baseline 340; +47 =
SubA 8, SubB 22, SubC 17), focus Vitest **216/216 across 16 files** (baseline 190), full Vitest **1427/77 files**
(baseline 1395/73), macOS proxy step **34/34** (baseline 5), `pnpm check` exit 0, docs tests 6/6. GitHub CI: the
authoritative green pair is at branch head `48c4c12b517270d7e6f51d64807d59d625dff152` — Push run **45898410605** and
Draft PR run **45898414792** each exact 3/3 (`local-first-core`, `dsh-typecheck-and-build`, `macos-portability`);
honest intermediate runs recorded in the report §8 and the private ledger (061163b failure → forward fix → superseded
push cancelled). The docs-only evidence increment on top of that head was polled to completion and is recorded in the
private ledger.

S5 facts: clone rehearsal old→new→new→old passed with the DB stable and zero auto re-send; ONE logged supervised
maintenance window rolled the pinned OL-055 build forward on the operator-owned test 3083 (two honest failed
attempts: staged build lacked its own `node_modules` → `ERR_MODULE_NOT_FOUND zod`; the new S1 ancestor guard
refused the group-writable volume root → hardened 0775→0755, recorded reversible host delta). Post-window:
paused+ready+weixin ready, zero row-count drift (14/2/8-sent/22/11), integrity ok, only the additive
`operator_audit` table + index, `operator/status` live (401 no-token / 200 with token; real account poll-lease
generation unchanged), idempotent pause action verified with zero external effect, client bundle contains the
Operator tab; process health RSS ~234 MB→~223 MB over 60 s, CPU 0.3–0.4 %, FDs 63–64, threads 14.
Canary decision `CANARY_NOT_NEEDED` (OL-053/OL-054 already proved the genuine closed loop + real Apply on
installed runtimes; no forced live send). Budget consumed: **0/2 real outbound, 0/1 model session, 0/1 registered
Apply + rollback, 1/1 maintenance window**; 3083 left paused+ready; PR #1 left Draft.

Honest residuals (all within the declared bounded trust model, `docs/022`): in-memory rate window resets on
restart; same-UID deliberate marker forgery; cross-root fencing absent; PATH ABA best-effort; OS TOCTOU; the
preimage→renameat race window (kill matrix: AMBIGUOUS + durable freeze, never auto-repaired/retried/cleaned);
power-loss durability beyond fsync+SIGKILL; mount-table changes; distinct-UID approval helper not runnable here
(`sudo -n` requires a password); no user-presence primitive (bearer possession ≠ named human); Node 22 not
installed locally — the CI ubuntu step is the authority.

Rollback of this round's local changes: `chmod g+w` restores the volume root; `cutover.sh rollback` restores the
prior tested bundle link (retained, un-executed); SQLite change additive-only with integrity-verified pre-window
and in-window backups; nothing touched on real Weixin, real projects' Apply, 3080, 8123, model defaults or
historical grants.

Requested next owner: online. No OL-056 auto-issued; no online ACK claimed until independently committed.
