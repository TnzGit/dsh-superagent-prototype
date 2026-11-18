# PR #1 original description (historical; not current authorization)

Preserved verbatim from the public draft PR before the 2026-11-18 convergence rewrite. Historic operator grants and milestones described below are expired and DO NOT authorize any new host operation. Current truth lives in `agent-handoff/STATE.json` and `REAL_APPLY_GATES.md`.

---

## Operator-approved Gate ①: 3080 test-only provider preparation (2026-11-08)

- Explicit operator approval granted in chat for **Gate ① only**: add a dedicated `llm-local-proxy` route pointing at `127.0.0.1:8123/v1` and conditionally perform **official** `session/selectModel` on a **specifically operator-designated disposable Session** with independently verified durable restoration of the shared global default. No test Session identity has yet been designated; do not infer one from the 62 candidate pool.
- Remote ChatGPT committed the complete guardrail runbook `LOCAL_AGENT_GATE1_PROVIDER_RUNBOOK.md` and activated fixed task file `LOCAL_AGENT_TASK.md` in commit `fdc64f805ee7a957be5bd8010316268696becc1f`. Mac Agent owns host preflight, minimal provider-only config change if safe, backup, no-restart verification, and public sanitized report `agent-reports/REPORT-gate1-3080-provider.md`. Code remains remote-owned.
- **Strictly prohibited by Gate ①:** restarts/reloads (Gate ②), real `session/prompt`/Weixin send (Gate ③), choosing an unapproved historical Session, changing old `cmp170hx` routing or default model permanently, modifying 3083 active relay, or weakening the 3080 operator-required anonymous LAN service (`0.0.0.0`, `allowUnauthenticated:true`, original trustedHosts).
- GitHub same-SHA CI previously passed all three jobs for `552633c8` in workflow run `42473002786`. Gate-① task-document commits have newer SHAs and their new CI results must be independently checked, not copied from the old green SHA.

## Latest same-SHA CI acceptance: GREEN (2026-11-08)

- **GITHUB CI GREEN, exact feature HEAD:** `552633c8f54175ea2b70ba1b9b3845584b48e6b1`, workflow dispatch run [42473002786](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42473002786), final status `completed/success`.
- **All 3/3 jobs green**: `local-first-core` (Ubuntu Node mock/queue-proxy integration), `macos-portability` (macOS Node portability/queue proxy), `dsh-typecheck-and-build` (TypeScript, Vitest, build). No failed steps.
- Separate local C3S acceptance: TypeScript + Vitest **1206/1206** + tsdown build PASS and mock Node **58/58**, tested on earlier `d6e04a4`; CI now independently covers later current feature HEAD `552633c8`.
- Previous main-branch dispatch run `42471624456` was on `89607996` and is *not* relevant to this feature acceptance; its missing branch-specific files explain failures, not a regression on `552633c8`.
- **No service deployment or live prompt authorized/executed**. Original DSH 3080 anonymous LAN accessibility / historical Session data must remain unchanged. Future operator approval gates remain separate: (1) test-only 8123 provider + scoped selectModel including global-default rollback, (2) controlled restart/reload, (3) one user-selected real original DSH Session prompt.

## CI bootstrap authorized on 2026-11-08

- Operator explicitly approved adding the **existing identical** `.github/workflows/local-first-core.yml` to default `main` and **one** `workflow_dispatch` against `feat/local-first-wechat-foundation`. This is CI-only scope, not deployment authorization.
- Remote GitHub connector created the main-only workflow file in commit `89607996d3645ba766a84e59a8a94c700c353f3a` and verified **identical Git blob SHA** `303eddf97a0b83e250b93b28e4bee70a453c13fc` on both `main` and the feature branch. No feature code was merged and PR #1 remains draft.
- Connector has **no workflow-dispatch POST action**. Therefore the operator-approved one-time dispatch is handed to Mac Agent through `LOCAL_AGENT_TASK.md` (commit `4d8b3d33d6d230ac11fad9ec4a5a76a23564ba5a`), to run via authenticated local `gh workflow run` against the feature branch; verify all three jobs and upload a redacted report only. **No matching manual run confirmed yet**.

## C3S local green and permanent agent-report handoff (2026-11-08)

- Operator's C3S offline acceptance tested `d6e04a4821f7c04ca46ed9013f61dc739d6b722c`: `pnpm check` **exit 0**, TypeScript PASS, Vitest **1206/1206**, `tsdown` build PASS, and nine Node mock files **58/58 PASS**. Real original DSH 3080 Session E2E and Weixin return still **NOT RUN**. Existing 3080 LAN anonymous-owner mode, 27 Workspaces and 841 Sessions remained unchanged; 3083/8123 stayed online.
- GitHub CI remains **NOT COVERED** for the tested C3S SHA. The workflow only exists on this feature branch, absent on default `main`, so `workflow_dispatch` is unavailable; connector-origin commits/PR edits haven't produced a new run. Do not cite the old green `177bb997` as acceptance.
- **New standing workflow**: remote ChatGPT updates `LOCAL_AGENT_TASK.md` (current instructions), with durable safety and confidentiality policy in `LOCAL_AGENT_PROTOCOL.md`. Mac Agent will create **redacted public** reports in `agent-reports/` and push these via operator Git credentials to the feature branch, then send operator only one short completion line. Remote ChatGPT reads the report directly in GitHub. Source code remains remote ChatGPT's responsibility. Explicit grants for provider+selectModel, restart, real original-Session prompt are still required independently.
- Current task is **C3S-PUBLISH**, a report-only meaningful commit and CI check, not an empty commit and not a live service change.

## C3R local acceptance / docs inventory fix (2026-11-08)

- C3R host checked `62b5769b6033e8251442d623f1b0c049b264b940`: TypeScript PASS, **58/58** Node mock tests PASS; Vitest **1205/1206** because `src/app/later.ts` existed only in the Glue table of `docs/007-architecture.md`, not the `## Modules` inventory. Build NOT RUN due to Vitest exit 1. No 3080 prompt, 3083 deployment, Weixin return, provider change or service restart.
- Remote change `00f0620a6df67fa56947a01165f8488caa1829b3` registers `src/app/later.ts` immediately after `src/app/effects.ts` in the `## Modules` table. C3R 58/58 mock pass is a host result for the *previous* head; the new doc-only commit still requires check/build verification.
- **CI coverage gap:** latest commit has no GitHub Actions run. `Local-first core tests` is present on the feature branch but is absent on the repository default `main`; GitHub requires the workflow file on the default branch for manual `workflow_dispatch`. Current GitHub connector has no dispatch action, so a successful push/PR CI trigger is still required. Do not copy the old green `177bb997` result to the new head.
- The operator requires original 3080 LAN anonymous owner access to stay exactly intact (`0.0.0.0:3080`, `allowUnauthenticated: true`, trustedHosts). All 27 Workspaces and 841 Sessions remain unchanged in C3R, as do 3083 and 8123.

## Selected product design (2026-11-08)

**DSH Superagent is the sole WeChat Agent. No OpenClaw installation, plugin, Gateway, hook, transport, old profile, or credentials are used.** The operator retired OpenClaw and wants to repurpose their former Clawbot/Weixin entry. QR reauthorization or rebinding may be required; reuse of the exact bot identity is not guaranteed by code.

See `docs/010-direct-weixin-channel.md` for the chosen architecture and `LOCAL_AGENT_HANDOFF.md` for the two-stage pairing gate. `docs/009-local-first-wechat.md` is preserved only as a historical architecture/research record.

## Implemented on this feature branch

- **Direct DSH Weixin (new; no live account attached):** `src/local-first/weixin-native-protocol.ts` implements QR-independent Tencent iLink long polling and text replies, stable Trigger IDs and reply client IDs, and context-token propagation. `src/sources/weixin-native.ts` registers a disabled-by-default DSH SourceKind with private-chat allowlists, separately configured DSH Policy, opaque persisted poll cursor, and an operator-owned local credentials file.
- `scripts/weixin-native-pair.mjs`: `--check` only validates a local `qrencode` installation and makes **no login or network requests**. Actual pairing requires the explicit `--user-approved --output /absolute/private/file.json` flags and operator QR scan; secrets are written to a new owner-only file rather than stdout or the repository. Native QR/login mock tests included.
- **OpenClaw removed:** deleted the entire obsolete `integrations/openclaw-weixin-dsh/` adapter, `src/sources/openclaw-bridge.ts`, signed bridge endpoint, and their tests. Removed OpenClaw bundle export, plugin row and build entry. Tencent's public protocol documentation is only a reference, not a runtime dependency.
- **Local-first inference:** `src/local-first/model-queue.ts`, `model-routing.ts`, `openai-queue-proxy.ts`, and `scripts/run-local-model-proxy.mjs` provide queue/retry/priority-policy foundations plus an independently runnable localhost authenticated OpenAI-compatible queue proxy. All DSH model roles must actually point to the proxy for serialized inference to be enforced.
- **Local projects (Stage C prototype):** `src/local-first/project-registry.ts` handles root allowlists and preparation locks; `src/local-first/project-workspaces.ts` now loads an operator-owned registry via `DSH_SUPERAGENT_LOCAL_PROJECTS_FILE`, parses explicit first-line `/project <id>`, and prepares atomic isolated Git clones or non-Git snapshots for real Ticket workspaces. DshExecutor.prepare/launch now bind local-only Tickets to these snapshots, record a project fingerprint, verify resumed workspaces and reject missing/unknown project IDs. Worker sessions for these Tickets use `workspace-write`, not `danger-full-access`. There is **no automatic write-back to originals**; review staged `git diff` before any later opt-in apply.
- **GitHub optional startup:** explicit disabled GitHub Source no longer forces repository/CLI/credentials; a `gh` shim fails closed. Existing GitHub mode stays unchanged.
- `examples/litellm-local-first.yaml`, endpoint smoke probe, docs, Node test suite, complete DSH `pnpm check` and Linux/macOS CI.

## Tests and operational evidence

- Previous pre-pivot commit `6fb77803` passed DSH check, Linux tests and macOS Node 25 portability; see https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42396589677 .
- **Latest native Weixin HEAD `177bb997967f` passed 3/3 GitHub Actions jobs**: complete DSH `pnpm check` (TypeScript/Vitest/build), Linux protocol/QR/queue mocks, and macOS Node 25 portability. Evidence: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42404961189 .
- Sanitized local-Agent verification (2026-11-08): Qwen3.8-Flash-Next on a local vLLM dev build had working tool calls and streaming; 8K/32K/64K were exercised without OOM. Short-response decode was **~60–80 tok/s**, not the originally assumed 200. vLLM itself can batch short requests concurrently, so the proxy is necessary if strict one-slot operation is wanted. Real 400K remains untested.
- **Historical note:** mock CI alone did not establish Weixin E2E; the later user-authorized Stage B host report confirmed QR pairing, original conversation identity continuity and native Weixin in/out messages. Ticket/Worker execution and original 3080 Session delegation remain separate unverified acceptance targets.
- Source allowlist plus DSH Policy must both authorize private peers. Credentials remain on the operator host, outside the repository. Platform API behavior may change; long-term use requires error handling, revocation, idempotency and compliance review.

## Real host Stage B report (2026-11-08)

- User operator scanned and confirmed native Weixin QR, and the former Clawbot conversation was reused by the DSH-native Source without OpenClaw. The local staging host and single-slot Qwen proxy were left online.
- Real host evidence: Trigger ingestion with peer/message/context token, policy `not_a_member` rejection, SQLite cursor recovery, `localqwen` usage without cloud, three Outbox reply records that were received on Weixin, and successful text sends. 400K, token expiration and ambiguous network-send behavior were **not** exercised.
- **Stage B was chat/reply E2E, not Ticket/Worker E2E.** `localOnlyDeployment.repository === ''` and the previous registry's absence from DshExecutor were confirmed blockers. This PR now has a code-only Stage C candidate for that missing wiring, but the currently running staging instance is still the older proven version and must **not** be auto-upgraded.
- New `docs/011-local-project-workers.md` and `LOCAL_AGENT_STAGE_C.md` describe safe host-only preflight and a user-approved staging restart. No re-pairing is requested.

## Latest CI status for Stage C

The last confirmed full green Actions run before Stage C was SHA `177bb997` (https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42404961189). **New local Worker snapshot integration has NOT yet received a visible green CI run on its latest head.** Do not mark Stage C tests passed or deploy it until that result is actually available and any failures are fixed.

## Existing Mac DSH at 127.0.0.1:3080 — preservation is now a first-class requirement

The user has a separate DSH service with existing project directories, durable Workspace IDs and historical Session IDs. It is **not connected to Weixin/Superagent yet**. No existing 3080 Session was accessed, resumed, modified, migrated or deleted.

- Added `src/local-first/existing-dsh-projects.ts`: owner-only read-only host Workspace inventory with canonical DSH `workspaceId/title/path/sessionIds`, stable safe aliases, conservative project selection (explicit ID, unique quoted exact title, or a prior user-confirmed thread binding). Ambiguous/fuzzy selection never grants project access. `/new-project <id>` is only a proposal pending root and user approval.
- Added `scripts/check-existing-dsh-catalog.mjs`, `tests/local-existing-dsh-projects.node-test.mjs` and `docs/012-existing-dsh-host-3080.md`. The catalog is a private host export; only project labels/aliases, not paths or Session IDs, may be shown to the Superagent router.
- DshExecutor now **fails closed** when an existing 3080 Workspace or new-project request is selected; it will never silently replace an existing historical Session with a fresh disposable Worker. The previous isolated snapshot mode remains opt-in for disposable or explicitly staged projects; it does not recover historical Sessions.
- `LOCAL_AGENT_STAGE_C.md` now starts with **C0 read-only inventory** before staging restart, test project execution or any live 3080 delegation. Do not modify the 3080 running host or its profile to discover projects.
- The actual DSH 3080 version and official anonymous-owner RPC contract are verified. A guarded, idempotent **3083 → 3080 Session RPC library** is committed but not wired to live Weixin; controlled acceptance on one user-authorized disposable test Session remains pending. Retain the existing unauthenticated LAN owner-access behavior. New DSH Workspaces still require user approval.

**CI caveat:** earlier native-Weixin CI passed on SHA `177bb997`. Changes made after it (local project workers and existing-DSH catalog) have test code committed but have **not yet produced a new head-green GitHub Actions run**. Keep the PR draft and do not deploy on this evidence alone.

## Stage C0 remote follow-through (2026-11-08)

Local Agent C0 finished without mutating any of the three live services: DSH 3080, Weixin staging 3083 or the one-slot proxy 8123. The official 3080 host has 27 existing Workspaces, 841 Sessions, 286 `migration-required` Sessions, and its only live Workspace enumeration is the `workspace/follow` stream, not `workspace/list`. Its 3080 service listens on `0.0.0.0` and permits anonymous LAN access as owner; **the operator explicitly requires preserving this existing access mode**, with its trust implications. This is not a request to change bind, trustedHosts, login policy, firewall or LAN reachability. 3080's local Qwen provider bypasses 8123, and some Session model selections are cloud. No existing Session was prompted, migrated or overwritten.

Remote C0 fixes committed:
- Documentation invariant: removed the 011 → 012 numbered forward link and indexed new `existing-dsh-projects.ts` / `dsh-3080-bridge.ts` modules in 007.
- macOS /var ↔ /private/var portability test fixture now realpaths the temp root in `tests/local-project-workspaces.node-test.mjs`.
- Implemented **disabled-by-default / not live-wired** `src/local-first/dsh-3080-bridge.ts`: precise session/list and session/prompt RPC frames using only loopback origin, original Workspace/Session verification, refusal of busy/subagent/migration-required Sessions, refusal of non-local-Qwen models and non-`workspace-write` permissions, human approval plus exact Session allowlist and verified queue-route attestation. Idempotent requestId is derived from target Session + Weixin message ID. The endpoint's `{accepted:true}` is **only inbox admission**, not proof the DSH Worker finished.
- New pure Node test and read-only CLI: `tests/local-dsh-3080-bridge.node-test.mjs`, `tests/local-dsh-3080-probe.node-test.mjs`, `scripts/probe-dsh-3080.mjs`; tests are in Linux/macOS jobs. New `LOCAL_AGENT_STAGE_C1.md` scopes next host work to offline tests, read-only audit and a non-mutating compatibility check that preserves 3080 anonymous LAN access, plus a reversible plan for routing the approved test workload through the one-slot proxy; **no live prompt until explicit separate consent**.

**Status caveat:** GitHub Actions did not publish a new CI run on the current branch commits; previous green SHA 177bb997 predates this batch. Node tests are committed but not yet proven green on the latest head. Do not deploy this adapter or connect it to live Weixin until C1 and CI checks pass. The old running 3083 message pipeline remains unchanged.

## C1 host report → remote code follow-through (2026-11-08)

- C1 verified 21/21 offline Node tests at SHA `c406fce`, no changes to 3080/3083/8123, 3080's **operator-required LAN anonymous owner access preserved**. Its `pnpm check` had ONE missing JSDoc immediately before `DshBridgeBlocked`; JSDoc is now added remotely.
- The C1 probe misleadingly counted all 841 Session models as non-approved by reading nonexistent flat `modelSelection.provider`. Verified upstream DSH actually uses `modelSelection.lastUsed` (historical) and `modelSelection.next` (the route for the next step). The probe now reports them separately. **The bridge authorizes only the latter**, reads exact `session/projections` rather than stale list cache, and still blocks any unknown/possibly cloud next model.
- `dsh-3080-bridge.ts` has new allowlisted, bounded read-only `session/state` / `session/wait` / `session/page` methods. It requires a pre-prompt cursor and **caller-supplied durable persistence** of original Weixin Trigger + Workspace/Session + stable request ID BEFORE an admitted `session/prompt`. A test-only local queue provider may be explicitly approved via the bridge config; the bridge never edits 3080 providers or runs `session/selectModel` (which can update the global default).
- `dsh-3080-output.ts` now contains pure event correlation from `user/message.source.rpcId` through the same-cut page to a completed DSH turn, rejecting concurrent foreign user input, failed/interrupted turns, incomplete history and absent text. Only an exact result may produce an idempotent reply proposal built from the **original** Trigger's Weixin peer, messageId and contextToken. Mock Node tests cover these rules; the result is **not auto-sent**, and no live DSH Session was prompted.
- `LOCAL_AGENT_STAGE_C2.md` scopes the next Mac task to offline checks plus read-only 3080 probe, preserving unchanged `0.0.0.0` / `allowUnauthenticated:true` / trustedHosts / LAN access. The current 3080 provider STILL bypasses the 8123 slot; **real delivery stays blocked** until user separately authorizes a test provider, restart, and a disposable Session prompt.
- **Verification caveat:** newer commits beyond C1 do NOT have a visible latest-head green GitHub Actions run yet. The source fixes and mock tests are committed; do not claim CI or real E2E acceptance until independently verified.

## Stage C2 local acceptance → C3 remote implementation (2026-11-08)

**Confirmed by operator's C2 read-only host report:** tested SHA `d98da43`, `pnpm check` 1205/1205 PASS and five offline Node files 35/35 PASS. Original DSH 3080 remained untouched (27 Workspaces / 841 Sessions, 286 migration-required). Correct Session model projection counts were 551 historical local Qwen, 552 next-step local Qwen, 289 next unknown/other, 76 historical cloud. No real original-Session prompt, new provider, restart or Weixin relay result was tested. **3080 anonymous LAN owner access is a non-negotiable required deployment property and must remain unchanged.**

**Remote code after C2, still NOT deployed or CI-validated on the new head:**
- `src/local-first/dsh-relay-store.ts`: opt-in additional tables **inside staging 3083 SQLite only**, one-shot approval claims, confirmed Weixin thread → original Workspace+Session binding, durable exact request/cursor receipts, crash/HTTP ambiguity reconciliation without auto-reprompts, and atomic verified Outbox receipt handoff. No 3080 database access.
- `src/local-first/dsh-relay-routing.ts`: 0600 operator-provided approval file keyed by exact peer, message SHA256, project ID, Session ID, approval ID and expiration; multi-Session ambiguity fail closed, explicit `/bind-project` or prior confirmed binding; 0600 short-lived manual provider route attestation before any 3080 prompt.
- `src/local-first/dsh-relay-coordinator.ts` plus opt-in `Runtime`/native Weixin Source hook and durable `dsh-relay` effect. **Default OFF without an operator grant file.** Independently enforces existing Weixin Source allowlist and DSH Policy allowlist, consumes the approved Trigger once so the usual Engine cannot run a second copy, uses verified 3080 Session RPC and output correlation, then existing Outbox with a stable ID. No new OpenClaw dependency.
- Relay-only Weixin replies have an absolute, conservative 5-minute original-contextToken cutoff checked *again* immediately before send; late or invalid replies settle as `gone`. No silent borrowing of a later Weixin token or guessing of iLink's true TTL. Long-running results require explicit human follow-up / later recovery support, not auto-delivery.
- New isolated mock Node suites `local-dsh-relay-store`, `local-dsh-relay-routing` and `local-dsh-relay-coordinator`, and a Vitest expired-token regression. To keep Node's strip-only mock runner compatible, `Later` moved to `src/app/later.ts` and re-exported through `effects.ts`.
- `LOCAL_AGENT_STAGE_C3.md` is the **next offline-only host test handoff**. It explicitly forbids any 3080/3083/8123 restart, live prompt, provider or auth change. Approval gates remain separately required for test-only provider+selectModel (confirmed global-default persistence side effect), controlled restart, and the ONE disposable Session prompt.

**Do not claim C3 tests or current-head CI are green** until an independently recorded run exists. No original Session continuation E2E has happened.

## C3 local acceptance → targeted C3R fixes (2026-11-08)

- Mac Agent tested `153bb3c` offline: nine Node files **57/58 PASS**; `pnpm check` **FAIL** in `tests/locales.spec.ts` because `dsh-relay` was missing from the exhaustive EffectKind health-label list. The one Node failure was the mismatched-receipt Error string not matching test `/matching/`; the underlying reject behavior already worked.
- Remote commits now add Chinese and English `health.dsh-relay` labels in `src/client/locales.ts`, update `tests/locales.spec.ts`'s exhaustive EffectKind mapping, align the mismatch Error text in `src/local-first/dsh-relay-store.ts` and fix EffectKind comment alignment. No behavior bypass or original-Session write was introduced.
- `LOCAL_AGENT_STAGE_C3R.md` is the next task: a clean worktree with **`pnpm check` and all nine Node suites** plus read-only service compatibility confirmation. **No production deployment, restart, provider switch, real session prompt, or Weixin reply is permitted in C3R.**
- The operator requires **3080 LAN anonymous owner access to remain fully enabled** (`0.0.0.0`, `allowUnauthenticated:true`, original trustedHosts); do not propose restricting or reauthenticating it.
- GitHub Actions latest-head CI status is **not yet confirmed green**. Do not describe C3R tests as passed until actual independent results arrive.
## Remaining acceptance tasks

- [x] Decide DSH-native Weixin, remove OpenClaw runtime artifacts
- [x] Add native Source/QR CLI and mock testing skeleton
- [x] Pass latest Linux/macOS and DSH full CI on updated native branch
- [ ] Host **Phase A**: isolated DSH profile / version compatibility, `qrencode --check`, local queue proxy, offline native tests, test project sandbox; produce first report and **stop to request operator QR approval**
- [ ] Host **Phase B** (only after operator approval): QR scan, credential file, allowlist, real inbound/outbound, stale-token/rebind handling, restart/replay, end-to-end DSH Ticket / Qwen worker, second report
- [x] Stage C remote code: actual Ticket metadata → registered project selection → isolated Worker workspace preparation, with Git/non-Git snapshots and Node/Vitest tests; [ ] **real staging DSH Ticket → Worker → model → Weixin** acceptance, sandbox enforcement; [ ] approval/apply/rollback on originals.
- [ ] Complete model-role configuration and routing/audit/paid fallback UX; cloud disabled by default
- [ ] Production hardening, deployment and long-context benchmarks; no auto-merge or auto-deploy

**Ownership:** ChatGPT writes and tests everything doable remotely. Local Agent only performs host-specific preparation and human-authorized QR/real-service checks. Keep this PR draft. No secrets or internal network topology in the public repo.


## C5 live host execution — operator approved, remote code and safety gates prepared (2026-11-08)

- **Explicit operator authorization:** "我全都批准" applies only to the previously enumerated **one-shot** real E2E gates. Read `LOCAL_AGENT_PROTOCOL.md`, current `LOCAL_AGENT_TASK.md` and `LOCAL_AGENT_GATE3_LIVE_E2E_RUNBOOK.md`. Original 3080 anonymous LAN owner access and all pre-existing historical Workspace/Session identities must remain untouched.
- Gate① test-only Provider was already hot-visible; original global `cmp170hx/Qwen3.8-Flash-Next/xhigh` preserved. Gate①.5 determined that `settings/replace` with `expectedRevision` can independently restore shared default after `session/selectModel`'s asynchronous save. Gate①.6 Phase A identified the exact two-field low/high metadata relocation. **These were live read-only proofs, not a real original-Session prompt.**
- Remote source new since C4: `src/local-first/dsh-3080-operator-rpc.ts` uses official original-Host RPC method and named argument shapes (no fabricated endpoint), loopback-only, exact one-shot mutation grants for a specific newly created Session vs new Workspace; `src/local-first/dsh-3080-operator-provision.ts` provides canonical safe filesystem parent checks, owner-only durable/fsycned one-shot claim ledger, official Workspace/Session registration and an injected authoritative `workspace/follow` reader. Model switch/default restore continues to use `dsh-3080-model-gate.ts` with one-shot revision-CAS restoration. All are isolated from live 3083 routing until the controlled local acceptance; no historical Session write capability is granted.
- Regression suites `local-dsh-3080-operator-rpc.node-test.mjs` and `local-dsh-3080-operator-provision.node-test.mjs` run under Linux/macOS CI, alongside the C4 model and Workspace suites.
- **Operational next action:** Local Mac Agent follows the C5 runbook on exact current SHA; validates CI and installed host contracts; corrects only two test-provider reasoning metadata keys; provisions one truly new disposable original-3080 Workspace/Session; performs one scoped Session model switch and restores the original global default; then admits one authentic Weixin user message for exactly one local 8123 inference and one correlated reply. If actual input is unavailable, report `AWAITING_ONE_WEIXIN_TEST_MESSAGE` without pretending a real E2E occurred. Reports go directly to GitHub `agent-reports/REPORT-c5-real-dsh-3080-weixin-e2e.md`, not through the operator.
- **Do not claim:** The real 3080 Session E2E or Weixin return has passed until the **local host report** substantiates them. This is still a **Draft PR**, no merge, no auto-deployment, no OpenClaw/cloud fallback. Restart only under the narrow C5 safety conditions; original 3080 must preserve its existing LAN clients.
