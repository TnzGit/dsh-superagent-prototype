# 016 — Worker pre-inference scope and exact ticket report tools

**2026-11-20 — REMOTE OFFLINE SOURCE ONLY. NO ACTIVE LOCAL TASK OR NEW LIVE GRANT.** OL-046 is CLOSED/ACKed `I2_BLOCKED_TOOL_SCOPE`, not I2 PASS. The human one-shot grant is CONSUMED and cannot be replayed; no OL-047 exists. Evidence: `agent-reports/REPORT-ol046-i2-seatbelt-native-edit.md`, `agent-handoff/receipts/online/LO-20261120-046-done.md`.

## What OL-046 actually showed

In a fresh macOS Seatbelt-contained DSH 0.2.2-rc.1, a true model-driven in-process native `edit` changed only a new synthetic README COPY (`I2_FIXTURE_BEFORE` → `I2_FIXTURE_AFTER`) with a bounded one-line diff; original fixture source/second file unchanged. But the first Worker session event/model request preceded `workOnly` binding, exposing inherited bash/subagent at preflight; and the staged Worker guard denied six owned `orchestrator_*` ticket/report tools, including a genuinely attempted `orchestrator_ack`. No review-required report record or final outbox result landed. Per-report §E, TWO boots consumed inference within the operator's one-shot window; final boot's 2 requests/7 actions are NOT complete-window accounting. An out-of-root synthetic canary was readable but not writable, and original Session aggregate contained one unrelated new Session. Do not claim OS complete read confidentiality or literally zero aggregate drift.

## Remote-only corrective patch

Exact source SHA `90d32d178fbaefc10cb7f80e260ea67f984ae279`, [CI #697](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44710359723) **3/3 SUCCESS**: Linux/macOS Node 255/255, six-spec focused Vitest 43/43 each, full Vitest 1251/1251, proxy 5/5, TypeScript/build pass.

ONLY with `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` on a future wholly disposable OS-confined DSH stage with a *registered-project* Ticket:

1. Project `agent/created` synchronously installs provisional `tools.restrict({allow:[]})` and deny-all tool guard, without decorating or granting any unauthenticated/restored Worker Session. Both are removed only after complete verified preparation.
2. `Sessions.ensure` checks live Ticket, exact snapshot directory, DSH Session header cwd, and accounted WorkspaceRegistry membership. Any prior `request/header` or `turn/start` history is refused as already started, not silently accepted as a pristine pre-inference scope.
3. Under the provisional deny-all, real `workOnly` inherited native-file allowlist/guard is installed BEFORE asynchronous skills injection and BEFORE role model resolution. The bundle registers exact six allowed ticket tools, checks scope completion, then assigns workspace-write and renames, marks this specific Agent ready and removes the provisional denial. Concurrent/unfinished bindings remain denied; `Sessions.prompt` blocks delivery unless staged-ready.
4. Inherited native tools are exactly `read`, `write`, `edit`, `glob`, `grep`. The only allowed *bundle-owned* tools are exactly `orchestrator_read`, `orchestrator_ack`, `orchestrator_thread_unrelated`, `orchestrator_thread_follow`, `orchestrator_trigger_handback`, `orchestrator_report`. The guard checks active Ticket, header cwd and WorkspaceRegistry on **every invocation** for both native and owned tools. Unknown names, no-name calls, ended Ticket, lost Workspace, and detached subagent using owned ticket tools are denied.
5. Staging-disabled/non-`1` **production Router and Worker stay unchanged**. Staged Router remains read-only, owns only `orchestrator_route` and `orchestrator_read`, and denies shell/jobs/settings by call-time guard.

This is a DSH-controller/Agent/Scope **simulation tested in CI**, not proof of actual installed operator-Mac startup order, correct kernel enforcement, true review/report, or all-boots inference accounting. An Agent whose first inference precedes actual scoped binding MUST fail closed and terminate its proposed live run; never treat an interrupted attempt as free retry.

## Required future live preflight — NOT AUTHORIZED HERE

A future human may separately consent to a NEW one-shot. A trusted controller would first create/prep exactly one disposable Ticket/Worker with NO model request, await `Sessions.ensure`, verify effective Router+Worker scopes/inventories and both new Sessions' `approval:never` including durable overrides. Any request before attestation, hidden bash, unexpected owned tool, failed report guard, installed DSH mismatch or policy `ask` MUST BLOCK before live inference. Prove macOS Seatbelt sensitive **read AND write denials**, child confinement, deny-external network, model-only 8123 route, mechanical model/tool/time caps ACROSS ALL BOOTS in the authorization window. Only then one genuine snapshot-only native edit plus review-required record and correlated unsent Core Outbox result. Abort/partial consumes the grant.

**No new local task is issued by this document.** OL-044/046 historical consents are consumed. No auto-dispatch, original 3080/3083/8123 operations, real Weixin/I3, cloud provider or registered-source Apply. Real Apply still lacks ACL-aware rooted fd/inode identity, non-cooperating-writer exclusion, private one-use capability and crash journal/recovery. PR #1 remains Draft/unmerged.
