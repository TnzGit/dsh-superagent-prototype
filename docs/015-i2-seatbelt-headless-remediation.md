# 015 — I2 Seatbelt nesting and headless approval remediation (OFFLINE DESIGN; no live grant)

**2026-11-20. Status: remote offline safety design + deny-only source option, NOT a genuine I2 success.** Read the truthful OL-044 report at `agent-reports/REPORT-ol044-i2-isolated-worker.md` and ACK `agent-handoff/receipts/online/LO-20261119-044-done.md`. One-shot OL-044 consent is **CONSUMED**. A separate strictly manual OFFLINE/READ_ONLY installed-DSH API audit OL-20261120-045 has now been published (runbook in agent-handoff/HANDOFF-2026-11-20-OL045-DSH-FS-APPROVAL-API-OFFLINE.md), but no model call, live DSH instance, original host mutation, automatic dispatch, Weixin or real Apply is authorized.

## Confirmed OL-044 failure and what we MUST NOT do

An outer macOS Seatbelt confinement was independently pretested for a new synthetic DSH process. During its genuine Worker turn, DSH `bash` invoked an inner `dsh-bash-sandbox` / `sandbox-exec`, which failed `sandbox_apply: Operation not permitted` (SANDBOX_UNAVAILABLE). A subsequent escalation entered `approval/asked`, but the detached headless instance had no answerer. No edit or review was produced. The local report observed one pending unsent Core Outbox acknowledgment, no Weixin send and original host zero drift.

**Do NOT** (a) disable outer Seatbelt; (b) change original 3080/3083/8123, model defaults or original SQLite; (c) globally set danger-full-access; (d) silently grant an `approval/asked`; (e) replay OL-044's consumed one-shot permission; (f) claim that an in-process path check is an OS boundary.

The DSH shell provider's danger-full-access mode bypasses its own `ctx.sandbox.confine` entirely; while a correctly functioning outer Seatbelt might still constrain it, there is no reproducible, installed-release-level proof tying its children to that verified boundary under arbitrary commands. For this first fixture-only milestone, eliminate the shell surface rather than trying to resolve nested Seatbelt by widening permissions.

## Remote deny-only staging tool profile

`src/app/sessions.ts` now provides **explicit opt-in** `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` for ***registered-project*** Worker Sessions ONLY. Default/unset/other values preserve every original Worker's tool allowlist. The staging flag **only subtracts** capabilities: permitted tool names are the installed `read`, `write`, `edit`, `glob`, `grep`. It excludes `bash`, `pwsh`, job tools, shell, web, `skill`, delegation/subagents and other tools. A second synchronous tool guard rejects all out-of-allowlist tool invocations, even if the model has stale tool listings. The normal F2 active Ticket/session WorkspaceRegistry attestation and unchanged `workspace-write` permission preset still apply.

This is a *logical tool-admission control*, not an OS sandbox: a separate guest Seatbelt policy must still guard all filesystem reads/writes and network. It also does not affect main/orchestrator Session tools; **the next fixture harness must independently verify main Session's effective tools have no way to invoke an inner Seatbelt runner or unapproved subprocess**, or fail preflight. No broader mode is approved merely because this flag is set.

## Official DSH approval behavior — headless default-deny rather than custom answerer

Upstream DSH package `@deepseek-ai/dsh-user-approval` exposes `policy: ask | never`; `never` deterministically returns `rejected` before any answerer waterfall, including headless. A request under `ask` may resolve `unavailable` (fail-closed) but an installed competing UI answerer can remain pending; a bare `approval/asked` event is an audit fact, not an instruction to answer it. The service's requests are scoped to open turns and produce `approval/asked` + `approval/decided` on settlement. See upstream:

- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/interaction/user-approval/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/approval.md

**Proposed next fixture-only DSH profile:** configure `@deepseek-ai/dsh-user-approval` with `config: { policy: never }` in the NEW isolated DSH instance (not the original), then independently inspect the *effective per-session approval policy* on both router and Worker before any model turn. If any restored/session-specific override says `ask` or the installed release cannot prove the policy, STOP. Never install an auto-allow headless answerer. In synthetic testing, approval requests must settle `rejected` with matching audit decision; no `allowed-once`, no unanswered wait.

## Native filesystem tools: compatibility must be verified for the installed DSH

Upstream `dsh-fs-sandbox` documents an in-process `ctx.fs` fence for file `write`/`edit`, unlike a shell subprocess. It is **NOT a kernel boundary**, and has path-canonicalization TOCTOU limits; it is necessary to verify the isolated installed DSH 0.2.2-rc.1 guest actually mounts the `fs-sandbox` backend, and that file tools do not spawn a nested Seatbelt runner. The outer OS Seatbelt deny-by-default confinement remains mandatory and must be tested with nested child subprocesses on synthetic canaries *without a model*.

- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/fs/fs-sandbox/README.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/sandbox.md

If the installed instance instead mounts `fs-local`, the test must STOP until its actual ACL/OS outer-boundary effects are verified. Never equate the upstream master documentation with proof of the operator's exact installed version.

## Strict next-stage acceptance, WITHOUT current execution authority

Remote-only: verify that with the environment flag OFF original Worker tools retain bash/subagent, and with it ON registered-project Worker sees exactly the native file subset with a second tool-use denial. Verify unknown/stale tools are denied, permission remains workspace-write and model default unchanged, and the handoff accepts live partial outcomes without relabeling them offline pass.

Future operator-local READ-ONLY/OFFLINE preflight, if newly authorized: inspect actual DSH approval-policy and filesystem provider types, verify a disposable profile can set `never` for both new sessions, check no shell tools can reach the model-controlled Worker and no untrusted subprocess actions can escape; don't run genuine inference. If a future live attempt is separately authorized, it must use one NEW task ID, one NEW disposable isolated DSH instance, fresh OS confinement checks, verified local-only 8123 route/budgets, a direct operator Prompt and unique one-shot receipt. Never reuse OL-044 or auto-retry after partial outcomes.

A **passing** future I2 would require one genuine native file `edit` tool invocation, actual snapshot bytes changed, diff/review record and correlated unsent Outbox result with original fixture source and production host unchanged. A failure or no edit is PARTIAL/BLOCKED, not a PASS. I3 native Weixin and I4 registered-source Apply remain entirely unauthorized. Real Apply still needs ACL/inode/dev/writer exclusion/journal/capability gates.


## 2026-11-20 offline Router/Main fail-closed staging patch (CI PASS, host UNTESTED)

The operator's OL-045 static installed-package API audit is **accepted/ACKed** at `agent-handoff/receipts/online/LO-20261120-045-done.md`; it is not an I2 model edit success. It confirms installed DSH 0.2.2-rc.1 `@deepseek-ai/dsh-user-approval` supports `policy: never` and `dsh-fs-sandbox` file edits are in-process; installed `ctx.tools.restrict/guard` signatures match. Exact consent is still consumed.

**New remote source** `f5f3fc025b6af88ae2c6b16ba828747cccbf9e92`, [CI #667](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44672019486) **3/3**: Linux/macOS Node 255/255, focused Vitest **39/39** each, full Vitest **1247/1247**, proxy 5/5, TypeScript/build PASS. When and ONLY when `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` is set in an **already OS-confined disposable stage instance**:
- Registered-project **Worker** retains only `read/write/edit/glob/grep` inherited tools, guarded at invocation time, with `workspace-write` still in DSH but inside the mandatory **outer** Seatbelt boundary and exact Ticket/Workspace identity.
- **Router/Main** now registers only its *own* `orchestrator_route` and `orchestrator_read` tool handlers; skips all other local maintenance/reply/retry/settings/prompt mutators. It inherits **zero** parent preset tool names (no shell/job/skill/read-image), has a synchronous deny-on-all-others guard including stale/name-less calls, and gets DSH `read-only` permission rather than normal `danger-full-access`.
- With the flag unset, or anything other than the literal `1`, **ALL original production tools, registration, guards, permission presets and model-default routing remain unchanged**. The new profile only subtracts authority. It does **not** modify the actual original 3080 runtime environment.
- Synthetic Router/Worker negative tests include stale shell, settings, job, approval-adjacent and missing-name calls. These mock DSH Controller and tools, and do NOT prove live installed release end-to-end execution.

**Future separately human-approved I2 stage preflight**: do not reuse OL-044; secure a NEW private one-shot grant. Verify exact installed DSH/preset/agent API/version; start a brand-new disposable OS-confined process ONLY after permitted; verify *effective Router and Worker tool inventories* and `dsh-user-approval policy: never` for both **with no Session overrides**; prove actual nested Seatbelt bash cannot be reached by either role (including raw/stale tool calls); prove original host isolation and local-only model route. If Router loses `orchestrator_route`, native Worker edit has hidden subprocess dependencies, policy remains `ask`, or any tool can escape confinement: **STOP BEFORE inference**. Only then use one model-driven native `edit` in a disposable copy, collect genuine diff/review and unsent Outbox result; do not alter original source or send Weixin. A remote CI pass grants NO live permission.

**Remaining I2 uncertainty:** DSH session-level `approval/policy` overrides are durable, and a preset's configured default does not prove two live Sessions are effectively `never`; no operator-Mac model turn with the Router deny-only profile has occurred. An in-process fs tool and Node call-time tool guard remain logical restraints, not a kernel trust boundary. Real source Apply's ACL/FD-root/inode/writer/journal gate stays CLOSED.


## 2026-11-20 NEW separately approved, manual-only I2 retest OL-046 (NO RESULT YET)

OL-044 live one-shot remains consumed; OL-045 static/API audit was ACKed. The operator subsequently consented **separately in their private ChatGPT conversation** to exactly ONE new Seatbelt-isolated disposable I2 native-file-edit attempt, OL-20261120-046. This source-level design document is NOT the human authorization itself. A matching operator-personally-forwarded Prompt and strict runbook `agent-handoff/HANDOFF-2026-11-20-OL046-I2-FS-ONLY-SEATBELT-ONE-SHOT.md` are required to initiate it; online automation remains PAUSED and never dispatches from GitHub.

Frozen product/test SHA `ace9ea426d68675fb78edadb1810919f0c0b3f57`, CI #674 3/3; only a scope-aware blocked verdict parser was added after the remote Router/Worker tool-limiting source. Before ANY model inference, the Mac Agent must independently enforce and verify kernel Seatbelt, OS subprocess inheritance and deny-all-but-local-model networking, Router/Main read-only and exactly route/read tools, registered Worker native files only, effective approval never for BOTH fresh Sessions (not merely profile default), actual installed DSH fs backend, and hard model/tool/time budgets. **Any mismatch STOP before inference** and publish honest I2_BLOCKED_*; never relax permissions or answer an escalation. Only then one genuine native edit of a disposable snapshot copy, reviewed diff and unsent Outbox record. No original project source Apply, original DSH/Weixin, provider defaults, model restart, cloud API or automatic retry. No I3 grant is implied.

## 2026-11-20 LO-046 truthful block and remote OFFLINE source remediation

LO-046 ACK = I2_BLOCKED_TOOL_SCOPE. A real native `edit` landed in synthetic COPY, but the Worker was unbound at first inference and six legitimate `orchestrator_*` ticket/report tools were guard-denied; no review/outbox result. Consent consumed; two inference-consuming boots in the window and one canary read permitted. Remote staged-only source `90d32d17` [CI #697](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44710359723) 3/3 adds temporary deny-all before scope verified, native scope before skills/model, and exact six owned ticket reporting tools. Normal production unchanged. No actual post-fix Mac Worker retest or new live grant. Full limits in `docs/016-i2-worker-scope-preflight-and-ticket-tool-contract.md`. No OL-047, original 3080/3083/8123/Weixin or real Apply authorization.
