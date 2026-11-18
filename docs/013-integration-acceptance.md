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
