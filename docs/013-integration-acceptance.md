# 013 — Integration convergence: Ticket → isolated Worker → preview → review

**CURRENT 2026-11-24:** OL-047 accepted I2_ISOLATED_STAGING_PASS for disposable synthetic COPY only; OL-048 accepted ALL_OFFLINE_PASS (NOT real I3), online ACK `agent-handoff/receipts/online/LO-20261121-048-done.md`. Latest REMOTE CODE+TEST source `df9757b3acd7ba2a5e234264a6c607c024858a79` [CI #780](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45217311065) and [#781](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45217328518) both **3/3 SUCCESS**, full Vitest 1266/1266, node 255, focus 44, proxy 5, macOS/build success. Real native poll→Engine→Ticket→fake DSH Worker→review-ready→app SQLite Outbox pending now verified in ONE offline fixture; 14 fake polling tests cover HTTP/backoff, token rotation and abort. NEW `OL-20261124-049` is PENDING MANUAL **OFFLINE ONLY** to verify this pinned source on Mac. No actual I3 iLink/network/model/Weixin send, no original 3080/3083/8123 changes, no real Apply. Public GitHub NOT host authority; remote scheduler PAUSED, no_auto_dispatch true. Runbook `agent-handoff/HANDOFF-2026-11-24-OL049-I3-UNIFIED-FAKE-VERTICAL-OFFLINE.md`. Older task-state sections below are historical.

**Acceptance boundary:** fake iLink `fetch` and simulated DSH Session do not establish true Tencent Weixin credential/peer/transport or model inference. The SQLite Outbox receipts remain pending with Source uninstalled; no real send is exercised. The real I3 gate remains CLOSED. The poll source now refuses a whole-page cursor commit after async abort, including the last received item. Original registered-source Apply remains separately gated by ACL-aware rooted fd+inode/dev identity, non-cooperating writers and durable authorization/journal/recovery.


**CURRENT MILESTONE 2026-11-21:** I2 accepted **only** for genuine model-driven native edit + `orchestrator_report` ready/review + pending UNSENT Outbox in a disposable macOS Seatbelt synthetic COPY; OL-047 [online ACK](https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-handoff/receipts/online/LO-20261120-047-done.md) `I2_ISOLATED_STAGING_PASS`, local report CI #753/#754 3/3. This is NOT real Weixin I3 nor original registered source Apply. Source `cf68140fdd506b05ca09e40a1b00d8cdea821694` CI #761/#762 3/3 adds five offline fake Weixin cursor/peer/relay tests; pending OL-048 only audits I3 simulated readiness with zero external calls. Earlier document history below predates this acceptance.


**Status: ARCHITECTURE/ACCEPTANCE PLAN, NOT AN E2E PASS OR HOST ACTION.** Frozen source SHA: `9adced9a40b5ef80c05d2d7916a54add65c6a8f0`; latest current task/owner is always in `agent-handoff/STATE.json`.

## Product acceptance goal

An explicitly chosen disposable registered project and one authorized incoming task should follow: **Weixin-native request or synthetic Trigger → valid project selector → Ticket → local model-routed Worker in an isolated workspace → file diff preview + review record → exactly one correlated reply**. Initially, the original source is NEVER modified. Keep the original 3080 authoritative Sessions and Workspaces intact; any existing-session continuation requires a separate explicit session identity and its own host gate. Full real project Apply is a different milestone.

## Current reusable pieces / known gaps

- Present: `src/local-first/weixin-native-protocol.ts`, `dsh-relay-coordinator.ts`, `dsh-3080-bridge.ts`, `existing-dsh-projects.ts`, `project-registry.ts`, `project-workspaces.ts`, `model-queue.ts`, `openai-queue-proxy.ts`, default-off non-Git stage/apply/audit/recovery/step coordinator. Inspect actual callers instead of assuming module existence means a mounted production route.
- C5.5B: one REAL native Weixin/3080/local-Qwen/Outbox response loop; this does NOT prove a project-bound Worker.
- `docs/011-local-project-workers.md` explicitly says Ticket→Worker real host E2E and workspace-write tool behavior are NOT yet accepted. The `non-git-batch-executor` is synthetic-only, not a production apply engine.

## Gate I1 — offline source-to-source, fully disposable, no model or live host

**Entry:** fixed source SHA, clean checkout, synthetic owner-private project registry, source fixtures with at least one Git and one non-Git project, isolated fake/model transport and authenticated-in-fixture Trigger envelope.

**Positive matrix:** (a) exact `/project <id>` and `项目：<id>` select the unique registered project; (b) Ticket identity and Worker directory are stable and outside the actual source; (c) Git offline clone has no `origin`, while non-Git snapshot has immutable baseline; (d) Worker edits only its isolated copy, then generates one bounded modify/add/delete diff with correct byte hashes and POSIX modes; (e) a preview and review-required record correlate to the originating request; (f) response is generated once, with no duplicate Ticket/Outbox side effect under replay/restart simulation; (g) local-only model route is selected, never cloud.

**Negative matrix:** missing/ambiguous project ID, historical 3080 Session confusion, unregistered/dirty Git project, symlink/hardlink/special file, cross-project paths, oversized snapshot, unknown transaction state, duplicate delivery, Worker failure, cancellation, stale file revision and source external drift MUST fail closed without modifying source. Include synthetic Worker subprocess attempting to leave the workspace; record **NOT_PROVEN** if the host lacks an OS sandbox rather than claiming tool permission means filesystem isolation.

**Exit evidence:** one automated cross-module integration test that calls actual Ticket/Executor and review code rather than independent helper-only tests, Linux and macOS CI runs with named tests in actual commands, snapshot before/after byte/mode equality, sanitized receipt graph and no real source writes. Do not claim this gate passed until such test exists and was run.

## Gate I2 — controlled Mac staging, NO real registered project Apply

**Entry:** I1 PASS, scoped NEW operator-approved host-only task, verified disposable project, private baseline/rollback plan, 3080/3083/8123 current snapshots and no unrelated workspace write. Preserve exact original DSH 3080 listener and access model; new staging must not override the running service or old sessions.

**Action:** on an opt-in disposable staging project, run one Ticket/Worker session with `workspace-write` confined to copied workspace, selected existing local Qwen proxy, produce a preview, then STOP before source Apply. Confirm original bytes/modes, service state, old Sessions and global model defaults are unchanged. One negative unapproved request must be refused; no uncontrolled Weixin send.

**Exit evidence:** private audit + a sanitized GitHub report with exact stage/CI SHA, coherent Ticket→Worker→preview lineage, no production file changes, rollback if a staging setup was changed. Host test is NOT authorized by this document alone.

## Gate I3 — real native Weixin project-task loop, NO project Apply

**Entry:** I2 PASS and independent new one-shot real-Weixin/Session/peer/context-token approval; C5.5B consumed grant cannot be reused. Pick ONE disposable project and explicit Session; normal chat remains unchanged for others.

**Action:** one real native message triggers project-aware Ticket and local-8123 Worker, an isolated diff/review result is returned once through native Outbox. The original project is byte-identical. Test duplicate/stale reply suppression and restore 3083 default OFF at end.

**Exit evidence:** six-layer chain plus Ticket ID/Worker workspace/preview/Outbox correlation and unchanged-source proof, zero cloud use, services restored and one-shot receipt consumed. A simulated/CI loop does NOT count as a real native Weixin pass.

## Gate I4 — source Apply is separate, AFTER OS helper design

No real registered source Apply until every `REAL_APPLY_GATES.md` item is independently met and gate I3 is complete or a separately scoped equivalent approved workflow. No automatic carry-forward of standing in-principle permission. `docs/014-real-apply-boundary.md` outlines design/testing prerequisites, not permission.

## Suggested remote implementation order

First add **one** actual cross-module Gate I1 harness and trace event contracts; avoid more ledger-only micro-commits. Then fix integration breakages and add replay/denial paths. Use the existing Node/Vitest CI infrastructure with Linux/macOS exact test execution. Only after I1 source CI is green formulate a NEW uniquely scoped local staging task, and only if the operator separately authorizes any real-host action. Do not resurrect paused hourly scheduling to trigger it.

## I1A verified cross-module partial result (2026-11-18)

- Added `tests/local-ticket-worker-preview.spec.ts` which exercises **actual** `DshExecutor.prepare()` selector/binding with a fixture-only host, calls the SAME `createProjectSnapshot` helper used during directory preparation, simulates only edits to an isolated Worker copy, validates add/delete/modify preview and stage seal, and issues one durable `awaiting-human` audit checkpoint that never writes registered source. Invalid/missing selectors fail closed.
- Exact test source `6e9cf91154d018e2f3a61f597cf2171e711c50df`; [Actions #498](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44248563551) completed 3/3 SUCCESS. Both Linux and hosted macOS logs actually run two new Vitest cases (2/2 per OS); Linux/macOS Node 248/248, proxy 5/5; check/build Vitest 1210/1210.
- **Not tested:** DshExecutor's private `prepareDirectory` and full Worker Session lifecycle, an actual DSH Session turn, local model queue or Outbox delivery, genuine Weixin, real registered project Apply, OS helper, or production host isolation. The 0600 test grant is an in-fixture simulated approval, not actual authenticated operator authorization. Gate I1A is PARTIAL PASS; I1B full fake-host Ticket/Worker integration remains PENDING.
- Preliminary CI #494/#495 failed because direct Node 22 TS strip-only cannot parse a DshExecutor dependency; using Vitest on BOTH OSes corrected that. #496/#497 reached the new test but `tests/docs.spec.ts` required the new test to be listed in `docs/007-architecture.md`; fixed and verified green by #498. Failed runs are not counted as acceptance.


## I1B fake-host vertical evidence — PARTIAL PASS (2026-11-18)

Exact source 05937a3a8de5d020f55e6984bbd9660e03f4d3eb, CI #516 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44254449518 3/3. tests/local-ticket-worker-session.spec.ts executes REAL Engine intake/decision/Ticket, real DshExecutor queued effect and prepareDirectory, real disposable Git/non-Git snapshot, fake DSH Sessions transport, preview and core idempotent result reply. Seven cases each OS cover duplicate Trigger, stale effect, cancel, unknown project, dirty Git and forged manifest. I1A 2 and P3 contract 5 also run: 14/14 on Linux and macOS, full 1222/1222 Vitest.

The Sessions/Agent/Subprocess transport is FAKE; this is NOT a genuine Worker turn, DSH Sessions.ensure/AgentDelivery test, local model inference, native Weixin project task, OS sandbox or source Apply. Gate I1 remains incomplete. Manual-only offline OL-20261118-041 handoff: agent-handoff/HANDOFF-2026-11-18-I1B-MAC-BATCH.md. Real I2/I3 require complete independent I1 evidence and fresh exact private per-stage grant; no real Apply authorization.


## I1C actual AgentDelivery with disposable DSH transport (2026-11-18)

Verified source `1b9fe55ce2e59d8e3a7e6c979101774bb9a72890`, [CI #539](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44289161705) 3/3 SUCCESS. `tests/local-agent-delivery-session.spec.ts` now calls the real production `AgentDelivery` class, with an injected, disposable test Context providing simulated Agent inbox, persisted `user/message` event history, and fake DSH sessionPersistence. Five named cases on both Linux/macOS cover queue replay/pending-inbox deduplication, Session replacement with durable message-history replay suppression, legacy plugin/user-RPC message recognition, abort/authorization/disposed-target/persistence error rejection, and notice injection without a worker turn. Combined with I1A 2 + I1B 7 + strengthened P3 9 gives 23/23 focused on each OS; full Vitest 1231/1231.

**Still NOT Gate I1 completed:** The actual DSH SessionController, `Sessions.ensure` decoration/preset/model selection, real Worker tool permissions and execution turns, genuine native Weixin ingress, human review authorization and real external Outbox delivery are NOT exercised here. The integration harness still injects a fake transport; it does not touch production hosts or registered project sources. Full Gate I1 and I2/I3 remain gated and separate.


## I1D/I1E actual Sessions source integration (2026-11-18, still NO genuine DSH turn)

Verified code SHA \`ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead\`, [CI #550](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819) 3/3 successful. On both Linux and hosted macOS: I1A 2, I1B 7, P3 pure proposed-plan contract 9, I1C AgentDelivery 5, NEW I1D Sessions.ensure 6, NEW I1E vertical 1 = **30/30 focused Vitest**. Node **253/253** (25 listed files incl. 5 native read-only path-inspector cases), proxy 5/5, full Vitest **1238/1238**, typecheck/build pass.

- I1D \`tests/local-sessions-worker-boundary.spec.ts\` executes real \`Sessions.ensure\`/\`AgentDelivery\`/\`initializeRoleModel\` while fake DSH SessionController/workspaceRegistry/Agent context supplies disposable records. New \`src/app/sessions.ts\` denies Worker Sessions for missing or ended Tickets, and denies registered-project Worker creation if requested directory mismatches the Ticket's isolated snapshot before any SessionController operation. Test verifies role model selection does not modify global default, worker permission \`workspace-write\`, work-tool restrictions, prompt dedup/restart and failing local-only routing. The fake scope-parent lookup does not exercise an actual installed Cordis profile.
- I1E \`tests/local-vertical-real-sessions.spec.ts\` follows real Engine intake/accept→Ticket→DshExecutor queued launch→real Sessions.ensure/AgentDelivery→disposable registered non-Git snapshot→simulated Worker-copy changes→actual preview→Engine report/core Outbox exactly once. No original project bytes were written. The DSH Controller/Agent and model response are **fake**, so actual WorkspaceRegistry permission/AgentTurn or native Weixin result is still NOT tested.
- **Risk:** an existing DSH Session resolved by the ID may have a pre-existing Workspace whose stored identity differs from the requested snapshot. Current \`Sessions.ensure\` validates the requested Ticket/cwd but DOES NOT independently attest recovered Session workspace provenance. Read-only operator Mac DSH API research is assigned in manual OFFLINE OL-042. This must be resolved before any real-host I2.
- New OL-20261118-042 manual-only offline Mac handoff: \`agent-handoff/HANDOFF-2026-11-18-I1F-MAC-BATCH.md\`. I2/I3 are NOT authorized; source Apply remains forbidden. Do not confuse CI pass with full Gate I1.


## F2 restored Worker Session Workspace-account attestation (2026-11-19; CI SOURCE PASS, NOT live DSH E2E)

The 2026-11-18 operator-Mac OL-042 report documented a real **foreign restored-session reuse omission** in `Sessions.ensure`, source-inspected against installed DSH 0.2.2-rc.1. Remote source now checks active project Ticket, expected exact isolated directory, recovered `agent.session.header.cwd`, DSH `workspaceRegistry.resolveByPath` canonical result and `workspace.sessionIds` membership before role model / prompt / permission / rename. It rechecks these in `Sessions.prompt` and `Sessions.holds`, defers `agent/created` project-worker decoration until after `ensure` attestation, and uses the registry's synchronous membership projection in the worker tool guard. Missing/foreign/misaccounted Session, failed workspace registration, premature decoration and post-attestation account loss all fail closed in simulated DSH Controller tests.

Immutable code SHA `6c75c43f43b9133f8796b628155cc278c2025838`, [CI #584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) **3/3 SUCCESS** on Linux/macOS/build: **11/11 I1D Session tests**, 35/35 focused Vitest including actual Engine→Executor→Sessions→AgentDelivery source integration, 254/254 Node, 5/5 proxy, full Vitest 1243/1243, TS/build success. The true original DSH SessionController, model Agent turn, workspace permission behavior and native Weixin remain untested; only synthetic DSH Controller and fake model routing were used. This is a **source-level reattachment-account gate**, NOT inode/device identity or a race-proof OS sandbox. Full real-host Gate I1/I2/I3 remains separately gated and original source Apply prohibited. Operator Mac version-specific offline validation assigned in OL-20261119-043 `agent-handoff/HANDOFF-2026-11-19-F1F2-MAC-VERIFY.md`; no live host authorization.


## 2026-11-19 I2 staging security prerequisite after LO-043

OL-043 operator-Mac F1/F2 targeted offline verification: `agent-reports/REPORT-ol043-f1f2-mac-verify.md`, accepted online at `agent-handoff/receipts/online/LO-20261119-043-done.md`. Report CI #597 (run 44476080849) 3/3 at SHA `0645388000bf9ec9938b970adbadbb3620264973`. Local Mac Node 254/254, native 6/6 x3, focused 35/35 x3, full Vitest 1243/1243 and zero original host/source drift per local report. DSH 0.2.2-rc.1 WorkspaceRegistry/Session API read-only compatible. The F1/F2 checks remain OFFLINE, not a true DSH Worker Agent turn.

**Gate I2 must not rely on `workspace-write`, cwd, prompts or software tool checks alone to confine subprocesses.** Worker file and shell tools may run under the original macOS user's privileges. A separate VM/container/OS restricted principal or equivalent demonstrably effective boundary must first block a compromised Worker from accessing original DSH state, original home secrets and source projects. Prove the child-process confinement with non-model synthetic probes in a disposable scratch root; only with a fresh separate PRIVATE one-shot human authorization may one new isolated DSH instance and local-only model turn be attempted. Original 3080/3083/8123 and native Weixin remain unchanged. See `agent-handoff/I2_STAGING_APPROVAL_PLAN.md`. A single conditional, manually handed-off OL-20261119-044 now exists following explicit operator agreement. The public message alone is not permission: verify OS and child-process isolation first, and receive the operator's direct Prompt before one bounded real Worker turn. See agent-handoff/HANDOFF-2026-11-19-OL044-I2-DISPOSABLE-DSH-ONE-SHOT.md. Real Apply remains gated.


## 2026-11-20 OL-044 real-host PARTIAL and remote fail-closed follow-up

The one-time I2 operator grant was exercised and CONSUMED. Sanitized report `agent-reports/REPORT-ol044-i2-isolated-worker.md`, report SHA `f2aca2c0ab6cdccde286ecae9853aaf16418879f`, online ACK `agent-handoff/receipts/online/LO-20261119-044-done.md`: verdict **I2_PARTIAL_NO_EDIT**. Outer Seatbelt and network synthetic probes passed per local report; a disposable DSH 0.2.2-rc.1 genuine Worker/model/tool turn occurred; inner bash sandbox could not nest under Seatbelt (`SANDBOX_UNAVAILABLE`), and `approval/asked` did not settle headlessly. No edit, diff or review record; only one unsent pending Outbox acknowledgement. Original source and 3080/3083/8123/Weixin unchanged per local report. The report HEAD CI #633 **1/3** due to one mistaken remote offline-only verdict assertion. Scoped hardening plus negative cases were repaired and independently passed CI #636/#637 3/3 and ACK HEAD CI #638/#639 3/3.

Remote follow-up: explicit `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` **subtracts** shell/jobs/web/subagents/skills from registered-project Worker, leaves only native file tools `read/write/edit/glob/grep`, and rejects any stale disallowed call at tool guard. Normal mode unchanged; does NOT grant higher permissions. Exact code SHA `e458afc2ee6261a1ba3106e2f1de1c4df9c97f86`, [CI #641](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44575812654) 3/3, Node 255/255, focus 37/37, full Vitest 1245/1245, proxy 5/5. A headless `@deepseek-ai/dsh-user-approval` `policy: never` and installed version's `dsh-fs-sandbox` effective backend require independent proof; upstream documentation is not installed-host proof. Full design/stop matrix `docs/015-i2-seatbelt-headless-remediation.md`. One NEW *manual-only OFFLINE* installed-DSH compatibility task OL-20261120-045 is now published, pinned to source 5578b19ae1a3326093884dc0324e1ebf1577dfaa (CI #648 3/3); it MUST NOT create a DSH instance, run a model/8123, replay OL-044, send Weixin or perform real Apply.


## 2026-11-20 OL-046 fresh one-shot I2 manual acceptance plan (NOT YET RUN)

A NEW distinct operator-consented, manual-only `OL-20261120-046` is prepared at `agent-handoff/HANDOFF-2026-11-20-OL046-I2-FS-ONLY-SEATBELT-ONE-SHOT.md` for one **disposable outer Seatbelt constrained** genuine DSH Worker model-driven native file edit of a synthetic COPY. OL-044's old real-model grant is exhausted and NOT reused, OL-045 static/API source verified DSH 0.2.2-rc.1 `policy:never` and in-process native fs. Source frozen at `ace9ea426d68675fb78edadb1810919f0c0b3f57`, CI #674 3/3. Both Router/Main and Worker must pass actual runtime tool/approval scope and kernel OS/child/network gate BEFORE a model call; Router read-only route/read only, Worker native fs only. Every failure/block/partial consumes this new one-shot and must be honestly recorded; **no OL-046 I2 success is claimed yet**. Real Weixin (I3), original DSH/3080/3083, global settings, original registered source Apply and real filesystem Apply OS gates remain NOT AUTHORIZED. No auto-dispatch.

## 2026-11-20 OL-046 BLOCKED, post-ACK remote Worker fix is OFFLINE ONLY

OL-046 result `I2_BLOCKED_TOOL_SCOPE` accepted online; genuine in-process native edit changed only a disposable COPY (one-line diff) but Worker first model request preceded scope attestation, and six own reporting tools were guard-denied. Review-ready/outbox-result contract NOT satisfied, even though source/edit succeeded. Two boots consumed inference, old human grant consumed. Outer Seatbelt canary readable but non-writable; don't overclaim confidentiality. Remote source `90d32d178fbaefc10cb7f80e260ea67f984ae279` [CI #697](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44710359723) 3/3: simulated pre-inference deny-all + native/owned-tool exact allowlist, Ticket/Workspace/ended/foreign checks, production unaffected. Still NO real Mac post-fix I2, no OL-047 or live grant. Future criteria `docs/016-i2-worker-scope-preflight-and-ticket-tool-contract.md`. I3/Weixin and original registered-source Apply remain forbidden.
