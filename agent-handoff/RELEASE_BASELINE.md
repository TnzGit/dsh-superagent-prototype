# RELEASE_BASELINE — frozen research feature candidate (NOT a production release)

**As reviewed 2026-11-18.** Repo `TnzGit/dsh-superagent-prototype`, feature branch `feat/local-first-wechat-foundation`; no code artifact was deployed by this GitHub review.

## Immutable anchors

- **Product source and tests:** `9adced9a40b5ef80c05d2d7916a54add65c6a8f0` (C6B2B6G). Pinned by immutable commit SHA, not by the advancing branch head.
- **Source Actions:** #485, https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43596061640. 3/3 jobs success, Linux/macOS Node 244/244, proxy 5/5 each, both shared-fence tests actually executed, Vitest 1208/1208 and build successful.
- **Local Mac independent report:** `agent-reports/REPORT-c6b2b6g-offline-shared-fence.md`, report commit `52234ceb80ec781ed3f18df8ac10ab5f2626e664`, #488 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43597825578 (3/3). Accepted remote LO-040 ACK at `agent-handoff/receipts/online/LO-20261114-040-done.md`.
- This is a **synthetic code baseline**, not a live deployment SHA, an authenticated approval, or proof of multi-file source Apply safety.

## Capability boundary

- Genuine Weixin → original DSH 3080 Session → local 8123 model → native Weixin reply: C5.5B real one-shot 6/6 accepted and original staging restored. This is not a persistent production project Worker/Apply path.
- Registered Git/non-Git workspaces, bounded snapshots, change preview and isolated Worker integration code exist. Real Ticket→Worker project mutation end-to-end has not been independently accepted.
- The synthetic one-step batch executor explicitly has no production caller. Single-file non-Git Apply/Rollback is default-off and not proof of production-grade multi-file atomicity.
- C6B2B6G optional per-ID fence works only for cooperating clients sharing one trusted fence root; multiple roots, inode ABA, same-user tampering, external writers/TOCTOU and real private authorization remain gaps.

## Pull request and deployment gate

- [PR #1](https://github.com/TnzGit/dsh-superagent-prototype/pull/1) remains DRAFT. The independent same-name GitHub Actions workflow add/add conflict has been resolved with ordinary two-parent merge `c11d1146b25bcf9cfab8d3cf4304957796cc3dec`, selecting the previously verified feature workflow. Compare now reports 0 behind main; GitHub `mergeable:true`. That is ONLY merge-conflict clearance: the large 590+ commit/370+ file research PR is still NOT code-reviewed, deployment-accepted or ready to merge.
- Convergence plan: review source by subsystem (A: native Weixin/3080 bridge/model queue, B: registered project Ticket/Worker and preview, C: synthetic safety research and tests). Keep historical reports/hand-off archive distinct from product code during eventual PR cleanup. Never force-push or blindly squash the entire history here.
- No merge into main, no production deployment, no new host side effects and no remote scheduler re-enable were authorized in this consolidation.

## New convergence integration evidence (I1A only)

- Actual `DshExecutor.prepare` project binding → synthetic registered non-Git snapshot → isolated Worker-copy modify/add/delete → digest preview → sealed out-of-source evidence → durable read-only `awaiting-human` audit now has one cross-module fixture acceptance test and a negative missing/invalid selector test.
- Test SHA `6e9cf91154d018e2f3a61f597cf2171e711c50df`, source/test CI #498 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44248563551: Linux/macOS new Vitest 2/2, Node 248/248, proxy 5/5, 1210/1210 total Vitest and build SUCCESS. No actual DSH Worker Session, real model/Weixin, source Apply or host mutation was exercised.

## Further proof required

Follow `docs/013-integration-acceptance.md` for isolated project-aware Ticket/Worker E2E and `docs/014-real-apply-boundary.md` for OS-specific execution design. `agent-handoff/REAL_APPLY_GATES.md` is still the hard execution authority limit, never replaced by CI evidence.


## I1B/P3 verified 2026-11-18 integration candidate (NOT DEPLOYED)

- Immutable new test/source SHA: 05937a3a8de5d020f55e6984bbd9660e03f4d3eb. Source CI #516 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44254449518 3/3; actual Linux/macOS I1A 2 + I1B fake-host 7 + P3 pure-plan contract 5 = 14/14 each; full Vitest 1222/1222, typecheck/build success.
- I1B fake-host uses real Engine accept, DshExecutor effect/launch/prepareDirectory and disposable Git/non-Git source snapshots but FAKE Session/Agent transport; actual model/Weixin/DSH Session and full I1 not proven.
- P3 proposed-plan contract is a pure rejection filter with no source I/O, OS helper, genuine authorization or Apply method. No registered source writes eligible.
- New user-requested local handoff OL-20261118-041 is manual-only OFFLINE_SYNTHETIC_ONLY; see agent-handoff/HANDOFF-2026-11-18-I1B-MAC-BATCH.md. I2/I3 are NOT granted by GitHub text; old historical baseline 9adced9 and OL-040 ACK remain intact; PR #1 stays DRAFT.


## 2026-11-18 LO-041 closeout and subsequent remote code checks (NOT a release)

- OL-20261118-041 local verdict ALL_OFFLINE_PASS was independently ACKed at `agent-handoff/receipts/online/LO-20261118-041-done.md`. Original source SHA 05937a3 and source CI #516 3/3. Local report addendum commit fc0744406d4464ec09daa6c17619ed4b1a698d69, expected mid-sync report CI #530–533 RED on two state guards; post-ACK state synchronization restored 3/3 CI #534/#535. Historical failed checks were not reclassified as green.
- Remote hidden-key fix + I1C real AgentDelivery test SHA `1b9fe55ce2e59d8e3a7e6c979101774bb9a72890`, CI [#539](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44289161705) 3/3; Linux/macOS each 23/23 focused tests (I1A 2, fake-host I1B 7, P3 validator 9, I1C real AgentDelivery/fake persistence 5), full Vitest 1231/1231, build/typecheck successful. No true SessionController Worker turn/model inference.
- Original source baseline 9adced9 remains a historical C6 synthetic anchor, not the most recent integration candidate or production deployed version. PR #1 is still DRAFT/unmerged; no service, provider, Weixin, historical Session/Workspace, registered source, real Apply or main changes.
- Native fd-rooted OS helper, writer quiescence, private one-time transaction capability, metadata/backup/crash recovery and real I2/I3 authorizations remain **NOT DONE**. Local handoff OL-041 is closed and no new local task is active. Automation remains paused.


## I1D/I1E + P3 native research candidate (2026-11-18; NOT RELEASED)

- Exact source SHA \`ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead\`, CI #550 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819: **3/3 success**, Linux/macOS each 30/30 focused Vitest, 253/253 Node including 5 native read-only inspector, 5/5 proxy, 1238/1238 complete Vitest, typecheck/build pass. I1D adds production \`Sessions.ensure\` active Ticket + exact registered snapshot directory gates and 6 cases; I1E connects real Engine/Executor/Sessions/AgentDelivery/preview/Core Outbox in one offline synthetic host test.
- Actual DSH SessionController, restored Session Workspace identity, real DSH model Worker turn/permission sandbox, real native Weixin, trusted human review and production file Apply are **NOT proven**. No existing 3080/3083/8123, Session/Workspace, provider/model defaults or registered source was changed by these remote commits.
- P3 native C \`research/os-path-inspector.c\` is read-only/test-only with no production caller, ACL/external-writer guarantee or write authorization. Do not interpret it as the production OS helper required by REAL_APPLY_GATES.
- New manual-only OFFLINE Mac task OL-20261118-042 at \`agent-handoff/HANDOFF-2026-11-18-I1F-MAC-BATCH.md\`, pinned to the exact SHA above. Prior OL-041 local report and LO-041 online ACK remain CLOSED. Online scheduling PAUSED, no auto-dispatch. PR #1 stays DRAFT/unmerged.


## 2026-11-19 F1/F2 source fix and scoped manual OL-043 (not a release)

- OL-042 claim/done/report verified and ACKed online: `agent-handoff/receipts/online/LO-20261118-042-done.md`; report SHA 6c067c4ce577749a974ca218213893482ebf299a, done CI #565 3/3. Operator Mac Node 249/253, 4 provenance-specific failures remain historical evidence, not retroactively green. No original 3080/3083/8123/Weixin/model/source drift reported; no real host Stage D.
- New exact immutable source candidate `6c75c43f43b9133f8796b628155cc278c2025838`, [CI #584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) **3/3 Linux/macOS/typecheck-build**: Node 254/254 per OS (new native unknown-xattr test), 35/35 targeted Vitest per OS (I1D grew to 11), proxy 5/5 and full Vitest 1243/1243. F1 allows exactly macOS provenance xattr name, rejects all other names; F2 restored Session identity verifies header cwd + WorkspaceRegistry canonical account, defers early project-worker decoration, and guards tool calls on account loss. Test-only native read-only inspector, no production Apply helper.
- Local task OL-20261119-043 is a **new manually handed-off OFFLINE SYNTHETIC + READ ONLY** version-specific Mac retest, complete runbook `agent-handoff/HANDOFF-2026-11-19-F1F2-MAC-VERIFY.md`. No auto-dispatch, real-host grant or I2/I3 source Apply. PR #1 remains DRAFT/unmerged; original C6 synthetic baseline 9adced9 is historical, main unchanged.


## LO-043 accepted and I2 staging approval proposal (2026-11-19; NOT DEPLOYED)

- OL-20261119-043 Mac F1/F2 completed and online ACKed at `agent-handoff/receipts/online/LO-20261119-043-done.md`. Report `agent-reports/REPORT-ol043-f1f2-mac-verify.md`, done SHA `0645388000bf9ec9938b970adbadbb3620264973`, Actions #597 (run 44476080849) **3/3**. Source `6c75c43f43b9133f8796b628155cc278c2025838`, CI #584 3/3, operator Mac Node 254/254, native inspector 6/6 x3, focused 35/35 x3, full Vitest 1243/1243, installed DSH 0.2.2-rc.1 API compatible; true DSH Worker/Weixin/Apply NOT AUTHORIZED.
- Mac ACL-bearing fixture still ACCEPTED by the read-only inspector; path ABA, external writers, inode/dev trust, one-shot capability and crash recovery remain blocked. Source-level F1/F2 does not make a production OS Apply helper.
- A **non-executable** I2 staging approval proposal is in `agent-handoff/I2_STAGING_APPROVAL_PLAN.md`. It requires an OS-confined new disposable service, fixture-only Worker, synthetic sandbox-escape probes and fresh independent PRIVATE per-stage operator grant before any local inference or service start. No OL-044 is issued, online automation stays PAUSED, PR #1 Draft/unmerged, no deployment/main changes.
