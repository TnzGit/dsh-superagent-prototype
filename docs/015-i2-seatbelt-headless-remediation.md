# 015 — I2 Seatbelt nesting and headless approval remediation (OFFLINE DESIGN; no live grant)

**2026-11-20. Status: remote offline safety design + deny-only source option, NOT a genuine I2 success.** Read the truthful OL-044 report at `agent-reports/REPORT-ol044-i2-isolated-worker.md` and ACK `agent-handoff/receipts/online/LO-20261119-044-done.md`. One-shot OL-044 consent is **CONSUMED**. No executable OL-045; no automatic dispatch, model call, new DSH Instance, Weixin or real Apply is authorized by this document.

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
