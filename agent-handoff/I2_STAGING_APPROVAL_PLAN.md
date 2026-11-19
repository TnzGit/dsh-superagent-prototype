# I2 isolated DSH Worker staging — proposed human approval boundary (NON-EXECUTABLE)

**Status 2026-11-19: DRAFT PLAN / NO PRIVATE OPERATOR GRANT / NO OL-044 TASK.** This is a public-safe design and review artifact. It is NOT a command to a Mac agent, a SessionController instruction, permission to call 127.0.0.1:8123, or an Apply capability. It does not change original DSH services, Workspaces, Sessions, provider/model defaults, native Weixin/relay or registered source. Do not copy approval tokens or sensitive host identity into GitHub.

## Baseline: what is and is not accepted

- F1/F2 remote source SHA \`6c75c43f43b9133f8796b628155cc278c2025838\`; [CI #584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) 3/3, Linux/hosted macOS each Node 254/254 and focused 35/35, full Vitest 1243/1243. This source is **not deployed**.
- Local OL-043 \`agent-reports/REPORT-ol043-f1f2-mac-verify.md\` all offline pass at that same source, report SHA \`0645388000bf9ec9938b970adbadbb3620264973\`, [CI #597](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44476080849) 3/3. Operator macOS 26.3 Node 254/254, native test 6/6 x3, focused 35/35 x3, full Vitest 1243/1243, DSH 0.2.2-rc.1 source/API compatibility, original host zero drift per local report.
- I1 source-wide Engine→DshExecutor→real Sessions→real AgentDelivery→isolated change preview→core Outbox path is tested against **SIMULATED** DSH Controller, Agent events and model turns, not a genuine Worker. The project source selection/isolated copy and F2 recovered Session account checks are *necessary*, not sufficient, for a real-host test.
- Native \`research/os-path-inspector.c\` is **READ-ONLY** and accepts an ACL-bearing file on macOS; it does not check OS ACLs, directory xattrs, external writers, inode/dev identity, durability or private approval. There is **no** production source Apply helper. That gate stays CLOSED regardless of an I2 staging success.

## Risk decision before ANY live I2

The project Worker tools include shell/subprocess and file tools. DSH \`workspace-write\` permission and source-level Ticket/Session Workspace checks are **not independent OS filesystem confinement**. Running a real model-controlled Worker under the same effective user/privileges as valuable original projects may allow it to access arbitrary source paths via tools. A disposable *cwd* or copy alone does **not** prove isolation.

**Mandatory preflight:** verify an actual OS/process boundary that prevents the test Worker (including shell and child subprocesses) from reading or writing original DSH data, unrelated projects, local home secrets and any registered production source. Prefer a true disposable VM/container/separately restricted OS principal with an allowlisted scratch mount and no host home/project mounts. macOS sandbox/permission ACL claims must be empirically verified using non-model synthetic probes first. If no isolation is available/verified, label \`I2_BLOCKED_NO_OS_ISOLATION\`, STOP; never substitute \`workspace-write\`, prompt instructions, a system prompt, or Git clean status as security proof.

The model inference route is a separate live host use. If the isolation scheme cannot reach the operator's **existing** local-only one-slot Qwen queue without opening cloud/default route access, stop. Do not change/stop original 8123 or global model/provider defaults to make the test work. No fallback to cloud.

## Proposed stage plan — each stage independent and fail-closed

### I2-P0: no side effects except private read-only discovery

After a **fresh private, explicit** authorization, inspect only aggregate baseline state of original 3080/3083/8123 listeners/health/Workspaces/Session count/model route and currently paused automation state. Derive the scratch VM/container/user isolation constraints and capture *private* exact pre/post comparison anchors. Prepare an immutable detached worktree at approved source SHA, a NEW owner-only scratch project root, unique temporary DSH service state/port, synthetic provider route and a single synthetic Ticket. Never bind test data directories to original Host state or copy genuine project files. Do not mutate original 3080/3083/8123. A supported DSH CLI/service startup/teardown command must be verified from the **installed** version; do not guess.

### I2-P1: prove confinement before live model run

In that disposable sandbox, with a harmless program (NOT an LLM Agent), attempt read/write outside the scratch mount, hidden user home fixtures, other temp project and original host projections **without ever naming any real private paths in a public report**. The OS must block those attempts. Verify child process behavior, mount/volume escapes, symlink/hardlink traversal, and restrictions under the same effective credentials and process runner the test Agent would have. If any synthetic out-of-scope attempt succeeds, STOP, preserve PRIVATE evidence; do not initiate the Agent turn. Note that a test that only runs tool-call filters in JavaScript is NOT an OS isolation test.

### I2-P2: ONE bounded genuine Worker request, disposable data only

**Only once the operator separately authorizes exactly this staging invocation**, start ONE new disposable DSH SessionController/Worker in isolated sandbox using a NEW unique Session ID (no original Session/Workspace resume or migration), one synthetic registered local project (e.g. a disposable 2-file README fixture) and the already functioning loopback local-only Qwen queue route. This is an actual *model inference* and *Session mutation*, even though isolated; it requires private per-stage consent. Limit: one Ticket, one Worker, one simple text edit in the disposable *copy* only, a short bounded token/step/time budget, no remote shell/network/cloud, no prompts from Weixin, no any original source Apply.

Proof to collect privately: Trigger request identity→Ticket id→new Session id + attested Workspace id/canonical cwd→model route proof (local-only)→actual tool invocation/child process audit→copy-only changed bytes and generated diff→review-required record→one result/Outbox entry. No external native Weixin send, no Git push, no automatic model retry after ambiguity. If no actual tool invocation happened, label partial, not E2E. Reuse/correlation and Exit must be checked without issuing a second model turn on an ambiguous response.

### I2-P3: bounded refusal and teardown

Using disposable sandbox only, test ONE unregistered selector or foreign Workspace reattachment through a mocked/controlled request, with ZERO inference or out-of-scope write. If that would touch an original real Session, STOP instead. Verify saved original host baselines/probe codes/defaults unchanged. Stop only newly created isolated staging processes and clean only specific disposable roots after every model job and child process is confirmed quiescent. No original host restart or repair. On cancellation/crash/ambiguous provider response: freeze PRIVATE evidence and request operator reconciliation; never auto-retry or run a source Apply.

### I2 acceptance, evidence and separation of future gates

A passing local I2 must show: OS confinement against a hostile subprocess; one actual DSH Worker turn with local-only model route and tool-use record; unique new disposable Workspace; correct Ticket and Session ID ancestry; change only in copied fixture; bounded preview/review/reply; zero drift in original services, defaults, real project sources and historical Sessions; single claim/done and sanitized report; no cloud or Weixin send. Missing evidence is \`I2_PARTIAL\` or \`I2_BLOCKED\`, not success.

**I2 success does not authorize:** I3 genuine native Weixin project message, use of historical original DSH Session, or I4 real source Apply. I3 requires an independent private grant with exact peer/contextToken bound to one real message and one Outbox response. I4 remains completely BLOCKED by REAL_APPLY_GATES.

## PRIVATE operator approval information required (DO NOT commit values)

An explicit new user action outside GitHub task text is required for any live I2. The authorizing discussion must resolve together: (a) target **new isolated DSH instance only** and isolation mechanism; (b) verified OS confinement of scratch-only process and child subprocess; (c) exact allowed staging source SHA/fixture identity; (d) temporary service bind+port and local-only model route (original 8123 read/inference use only if explicitly permitted); (e) one test Ticket/Worker and inference budget/steps/time window; (f) whether an isolated staging service may be started/stopped (never original 3080/3083/8123); (g) private evidence/rollback, freeze and cleanup; (h) no Weixin, no cloud, no original Session, no registered source Apply; (i) strict expiry, at-most-once identity and no replay.

Suggested approval type to discuss privately: \`PRIVATE_I2_DISPOSABLE_DSH_WORKER_ONE_SHOT\`, with exact allowed executable entry point and command-line arguments derived from an installed API preflight, not from this public document. A simple "go ahead" without target/isolation/route information should prompt a bounded clarification rather than becoming a blanket live permission.

## What remote can do before approval

Read source/API contracts, improve synthetic integration tests, clarify acceptance criteria and review CI. Write a public-safe approval PLAN only. **Do not create a runnable \`OL-044\` or any operator Mac task by inspecting this plan or seeing a green GitHub CI.** Online automation stays PAUSED_BY_OPERATOR until the operator explicitly asks to change it.
