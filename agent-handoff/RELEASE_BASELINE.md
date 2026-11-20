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
- A **non-executable** I2 staging approval proposal is in `agent-handoff/I2_STAGING_APPROVAL_PLAN.md`. It requires an OS-confined new disposable service, fixture-only Worker, synthetic sandbox-escape probes and fresh independent PRIVATE per-stage operator grant before any local inference or service start. After this historic proposal, the operator explicitly consented in private ChatGPT to one OS-isolated disposable Worker/8123 inference test: OL-20261119-044 is now a conditional MANUAL-ONLY task with detailed hard gates in agent-handoff/HANDOFF-2026-11-19-OL044-I2-DISPOSABLE-DSH-ONE-SHOT.md. No original host/Weixin/Apply grant, no auto-dispatch, no deployment/main changes; PR #1 Draft/unmerged.

## OL-044 manual one-shot authorization boundary (2026-11-19)

Only new isolated staging DSH + existing local 8123 inference is conditionally authorized by current direct user consent, one Ticket/Worker and scratch copied-file diff, after mandatory OS/child-process confinement, model-only networking and budget checks. Source SHA c0da76b14f4893397428c025670f731e0629555d, CI #618 3/3. No GitHub file constitutes human authority; direct personal prompt to the Mac Agent is required. No original 3080/3083 interaction, original 8123 configuration change, Weixin, historical Session/Workspace, cloud model or source Apply; staged failure reports BLOCKED and consumes the one-shot task. Online scheduler remains PAUSED, no auto-dispatch, no OL-045.


## 2026-11-20 OL-044 live I2 partial, ACK and new offline staging-only tool denial

- OL-044 one-shot local run is **I2_PARTIAL_NO_EDIT**, not a full I2 pass: real DSH Worker model/tool calls observed, but nested Seatbelt shell SANDBOX_UNAVAILABLE and unanswered approval blocked edit; no diff/review, one unsent Outbox ACK. Report `agent-reports/REPORT-ol044-i2-isolated-worker.md`, SHA `f2aca2c0ab6cdccde286ecae9853aaf16418879f`, online ACK `agent-handoff/receipts/online/LO-20261119-044-done.md`. Human one-shot CONSENT CONSUMED. No original host drift per local report.
- Report HEAD CI #633 **1/3** due remote test hardcoded ALL_OFFLINE_PASS; remote fixed strict scope-aware partial/live verdict and checked report/receipt correspondence. Code #636/#637 and ACK HEAD #638/#639 **3/3 SUCCESS**. No report verdict falsified.
- Explicit deny-only registered-project Worker opt-in `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1`: native file tools only; blocks shell/job/network/subagent and does not widen DSH workspace-write permission. Source SHA `e458afc2ee6261a1ba3106e2f1de1c4df9c97f86`, CI #641 **3/3**, Node 255, focus 37, full Vitest 1245, proxy 5. This feature has **not** been exercised on the real host; neither DSH native file editor nor `approval.policy=never` has been host verified in this staging context. See `docs/015-i2-seatbelt-headless-remediation.md`. No new live OL, Weixin, original Session/Workspace, registered source Apply, main merge or production deployment.


## OL-045 manual-only OFFLINE installed-DSH API readiness, not a live I2 grant (2026-11-20)

The online owner has issued **one unique manual-only OFFLINE_SYNTHETIC + READ_ONLY** task OL-20261120-045 at `agent-handoff/HANDOFF-2026-11-20-OL045-DSH-FS-APPROVAL-API-OFFLINE.md`, after receiving/ACKing the truthful OL-044 I2_PARTIAL_NO_EDIT result. The OL-044 live one-shot is **CONSUMED**. No new original host or model grant exists.

Freeze product source/test SHA `5578b19ae1a3326093884dc0324e1ebf1577dfaa`, source CI #648 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44577086561 **3/3 successful** at exact SHA: Linux/macOS Node 255, focused 37, proxy 5, full Vitest 1245, TS/build. Core changes are strict scope-aware handoff verdict parser (including truthful blocked offline) and deny-only `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` for registered Worker (native file tools only; default production unchanged). Stage fs/approval APIs are NOT YET VERIFIED against actual installed operator DSH; the task may inspect package sources/types read-only, run offline CI in a new disposable worktree and return PASS/BLOCKED/FAIL. It may NOT start even a separate DSH instance, call original/new SessionController, invoke 8123 inference, answer approvals, run native Weixin, change original 3080/3083/8123 or Apply source. The offline task itself is not proof that a real edit or diff works. PR #1 stays Draft/unmerged; remote automation PAUSED and no automatic local dispatch.


## 2026-11-20 OL-045 acceptance and Router-only source-level mitigation, NOT live staging

- OL-045 `ALL_OFFLINE_PASS` accepted/ACKed at `agent-handoff/receipts/online/LO-20261120-045-done.md`: installed DSH 0.2.2-rc.1 static API read confirms headless approval never and in-process native fs tools; local offline Node 255, focus 37, Vitest 1245. Corrected local done receipt commit `ae818ef7cc2a215afa2e7515100e3f6b7bd75e7c`, CI #664 3/3 (earlier #662 1/3 due missing status field, not silently waived). No real edit or model call in OL-045, local host zero drift reported.
- Remote source `f5f3fc025b6af88ae2c6b16ba828747cccbf9e92` [CI #667](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44672019486) **3/3** with Linux/macOS focus **39/39**, Node 255, full Vitest **1247**, proxy 5. Opt-in `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` now strips Router inherited shell/jobs/skill and all own tools except orchestrator_route/read, adds direct deny guard and read-only Router permission; Worker continues native file-only. No change to normal production when flag absent.
- The new opt-in source has **NOT** been exercised inside a real installed DSH session, effective approval never has NOT been attested in a live temporary Session, and OL-044 one-shot remains consumed with I2_PARTIAL_NO_EDIT; no new live grant, I3 or source Apply. PR #1 remains Draft/unmerged.


## OL-046 new ONE-SHOT conditional I2 dispatch, operator approved only in private chat (2026-11-20)

- A *NEW* direct human consent, entirely separate from consumed OL-044, was granted for ONE disposable OS-isolated DSH Worker/8123 local-model native edit test. The task `OL-20261120-046` exists only for manual operator-forwarded Prompt, **no automatic local dispatch**. Public docs/GitHub CI are NOT execution authority. Scope/acceptance/abort/cleanup are in `agent-handoff/HANDOFF-2026-11-20-OL046-I2-FS-ONLY-SEATBELT-ONE-SHOT.md`.
- Immutable source `ace9ea426d68675fb78edadb1810919f0c0b3f57`, CI #674 3/3 Linux/macOS/build. Router staging-only deny-all-except route/read and read-only preset, Worker native file tools only, both Sessions approval `never` and outer macOS Seatbelt required. Hard max six 8123 model calls total, ten model-controlled tool actions, fifteen minutes live; one Ticket/Worker; synthetic snapshot-only edit/diff/review/unsent Outbox. Any failed preflight STOP before inference. Default production mode unchanged.
- This is a handoff, NOT a local test result. No original 3080/3083/8123 service/config rewrite or original Session/Workspace/SQLite, native Weixin/I3, cloud fallback, original registered source Apply, main merge or deployment authorized. PR #1 DRAFT/unmerged. Publication privacy caution: no local paths, PIDs, file fingerprints, raw Seatbelt policy or private logs.

## 2026-11-20 LO-046 ACK and source-level staged Worker remedial CI

OL-046 is CLOSED `I2_BLOCKED_TOOL_SCOPE` (not PASS): genuine native edit of synthetic COPY, but scope bound too late and owned ticket report tools denied; no review/Outbox result; two inference-consuming boots; consent consumed. [Online ACK](https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-handoff/receipts/online/LO-20261120-046-done.md), local done SHA `3c95c5cdef9c5d4448a6fe8d509bb8304a197a28`, CI #685/#686 3/3. Remote source `90d32d178fbaefc10cb7f80e260ea67f984ae279`, [CI #697](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44710359723) **3/3**, Node 255, focused 43, Vitest 1251, proxy 5; only staged Worker adds deny-all before F2 attestation and scope before async skills/model, owns exact six scoped report tools; normal production unchanged. Actual installed Mac runtime and review chain have NOT been re-tested. No OL-047, live grant, I3 or real source Apply. PR #1 still Draft/unmerged. Details: `docs/016-i2-worker-scope-preflight-and-ticket-tool-contract.md`.

## NEW pending, standing-approved class: OL-20261120-047 (2026-11-20, not run)

The operator asked to continue and previously granted project-reasonable standing consent, so **do not request a fresh “同意”** for safe isolated synthetic-copy I2. OL-20261120-047 is a NEW, separate one-shot, distinct from consumed OL-044/046, frozen at `47b104e36f59b6623f139d8927bfa613bbcc777b` (CI #737/#736 both 3/3). Its [full runbook](https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-handoff/HANDOFF-2026-11-20-OL047-TRUSTED-PREINFERENCE-I2-RETEST.md) demands verified sensitive-read AND write OS denials, child/network confinement, hard *single inference BOOT* latch and all-window counters, Router and an already prepared Ticket/Worker with effective scope and `approval: never` **before first model request**, then native COPY edit + actual `orchestrator_report` review and unsent Outbox. No unverified release path, second inference boot, auto-retry or next OL. `active_local_task=OL-20261120-047` is PENDING MANUAL handoff; GitHub cannot authenticate operator host execution. **Remote automation PAUSED_BY_OPERATOR, no_auto_dispatch=true, local trusted dispatcher NOT VERIFIED.** No original 3080/3083/8123 change, real Weixin send or real Apply. Prior real I2 verdict remains `I2_BLOCKED_TOOL_SCOPE` until independently accepted after a new actual run.
