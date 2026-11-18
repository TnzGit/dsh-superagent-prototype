# 013 — Integration convergence: Ticket → isolated Worker → preview → review

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
