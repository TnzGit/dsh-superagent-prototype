> **Public-report privacy correction (2026-11-20, remote online):** This branch copy redacts host-specific identity and file fingerprint fields that were included in an earlier published revision. Aggregate evidence and the original local verdict remain unchanged. Git commits are immutable; previous commit objects may still contain the former fields until the repository owner explicitly manages history and access.

# OL-20261120-045 — Installed DSH native-fs / headless-approval offline compatibility report

Verdict: `ALL_OFFLINE_PASS` — static/API compatibility only; this does NOT attest a real I2 edit success.

## A. Handoff validation

- Task `OL-20261120-045`, expected result `LO-20261120-045`, scope `OFFLINE_SYNTHETIC_ONLY`, pinned source `5578b19ae1a3326093884dc0324e1ebf1577dfaa`, dispatch HEAD `c21a5d60b06f13aa326605d3a694401be7cb5e2e`.
- Schema gate PASS: `from: online`, `to: local`, `type: task`, scope allowlisted, 40-hex `code_sha` present verbatim in the current `LOCAL_AGENT_TASK.md`; task unique (no prior receipts).
- CI cross-check: source CI #648 (run 44577086561) `completed success` 3/3 at exact pinned SHA; dispatch CI #658 3/3.
- OL-20261119-044 previously ACKed by remote (`agent-handoff/receipts/online/LO-20261119-044-done.md`, verdict `I2_PARTIAL_NO_EDIT`, not replayed; its live consent is consumed).
- Pinned→dispatch diff = docs/handoff files only (zero src/test change), so CI evidence remains valid for the pinned source.
- Claimed once: claim commit `84c798fc1c053341305831b23a4197828eb67e00` (normal non-force fast-forward push).

## B. Offline regression at the pinned SHA (disposable detached worktree)

All commands exit 0:

- `pnpm install --frozen-lockfile` — exit 0.
- `pnpm check` (typecheck + full build) — exit 0 (build 1326 ms).
- Workflow-exact 25-file Node list (as in `.github/workflows/local-first-core.yml`): **255 pass / 0 fail** (matches CI #648 job log: Node 255/0, proxy 5/5 on Linux).
- Proxy suite standalone: **5/5**.
- Focused six-spec Vitest (`local-ticket-worker-preview`, `local-ticket-worker-session`, `real-apply-contract`, `local-agent-delivery-session`, `local-sessions-worker-boundary`, `local-vertical-real-sessions`): **37/37** (788 ms).
- Full Vitest: **1245/1245** (18.5 s, 68 files).
- `handoff-convergence.node-test.mjs` standalone: 5/5 — includes the new verdict-scope guards: `ALL_OFFLINE_PASS` legal only under `OFFLINE_SYNTHETIC_ONLY`; `I2_PARTIAL_NO_EDIT` and the `I2_BLOCKED_*` class legal only under the I2 live scope; unknown/forged verdicts denied; prose-marker spoofing rejected. So OL-044's truthful `I2_PARTIAL_NO_EDIT` receipt is structurally accepted without the earlier assertion mismatch (remote fixed the convergence test at the pinned source).
- Stage worktree stayed clean at `5578b19` throughout (`git status --porcelain` empty at close).

### FS_ONLY opt-in gate (verified against source at the pinned SHA)

`src/app/sessions.ts`:

- `:70` `I2_STAGING_FS_ONLY_ENV = 'DSH_SUPERAGENT_I2_STAGING_FS_ONLY'`; `:71-72` allowlist `['read','write','edit','glob','grep']`.
- `workOnly()` `:352-381`: `stagedFileToolsOnly = registeredProject && process.env[ENV] === '1'` — applies to registered-project Workers only; `names = staged ? FILE_TOOLS : WORK_TOOLS`; `ctx.tools.restrict({ allow })` `:361` plus `ctx.tools.guard(execution)` `:362-366` refusing anything outside the file set with reason `I2 isolated fixture Worker allows native file tools only; shell, jobs, network and subagents are denied` (covers stale/name-less direct invocations).
- `tests/local-sessions-worker-boundary.spec.ts:275-295` (flag `1`): allow == exactly the five file tools; guard denies `bash/pwsh/job_output/job_kill/web_search/subagent/skill/list_agents` and name-less calls; permission preset stays `workspace-write`; model route local-only; **global default model unchanged**. `:297-309` (flag `false`): normal Worker tools retained (bash/subagent in allow, guard undefined) — absent/non-`1` preserves production behavior.
- The flag was only ever set inside the disposable test process; it was never exported to the running 3080/3083/8123 environment.

## C. Installed-DSH read-only API audit (0.2.2-rc.1; no live DSH call)

Inventory: every component below is version `0.2.2-rc.1` (installed distribution, which may differ from upstream master).

### C1. `@deepseek-ai/dsh-user-approval` — policy `never` headless semantics

- `APPROVAL_POLICIES = ['ask','never']` (lib/index.js `:37`); `static Config = z.object({ policy: z.union(['ask','never']).default('ask') })` (`:94`).
- `effectivePolicy(session) = overrideOf(session) ?? config.policy ?? 'ask'` (`:177-178`): **session-level override exists**, durable via `session.append('approval/policy', {policy})` through the exported `setApprovalPolicy(session, policy)` (`:82-85`; invalid string throws `TypeError`).
- `decide(req, session)` (`:197-200`): aborted signal → `cancelled`; **when effective policy is `never` it returns `rejected` immediately, BEFORE the answerer waterfall** — deterministic and headless-safe: no unattended approval wait, no answerer required. The `ask` path waterfall defaults `unavailable` (fail-closed) raced with abort.
- Model-facing prompt row `approval:policy` (`:104-113`) renders the deterministic NEVER sentence (“Approval prompts are disabled in this session… do not set `sandbox_permissions`”) when never.
- Composition fact: `dsh-base/cordis.patch.yml` `:259-262` mounts the plugin with `policy: !!js "(process.env.DSH_PERMISSION_MODE ?? 'workspace-write') === 'danger-full-access' ? 'never' : 'ask'"`; permission presets (`:265-276`) map `danger-full-access → approval: never`, `workspace-write/read-only → approval: ask`. So in a fresh disposable configuration the `never` policy is settable per-plugin (profile patch config) AND per-session (`setApprovalPolicy`) — both Router and Worker can be attested without touching original sessions. A hypothetical disposable I2 patch snippet (private scratch file, mode 0600, never applied to the original host) was drafted.
- Not executed: no real `approval.request`, no policy written to any existing session, no allow-once minted.

### C2. `@deepseek-ai/dsh-fs-sandbox` + `@deepseek-ai/dsh-tool-fs` — in-process native file tools

- `dsh-fs-sandbox` exists in the installed tree. `SandboxedFileSystem extends LocalFileSystem` (lib/index.js `:104`): resolve/stat/read/stream/atomic write/read-match-write edit are the LOCAL implementation verbatim; the package adds only a per-call POLICY fence on the five mutations (`writeText/editText/patchText/deleteFile/moveFile` each delegate via `super.*` after `checkedTarget`). Reads pass through in every mode.
- **No subprocess anywhere in this package**: grep for `exec|spawn|fork|child_process|sandbox-exec` in `dsh-fs-sandbox/lib/index.js` returns nothing — edits/writes are in-process `ctx.fs` seam operations. `dsh-tool-fs` calls `ctx.fs.writeText`/`ctx.fs.editText` directly (`:610`, `:820`, patch path `:1105-1110`) with a per-call `sandboxPolicy` from `sandbox.resolvePolicy(...)`.
- Profile composition: `dsh-base/cordis.patch.yml` selects `fs-sandbox` (`:524-525`) as the `ctx.fs` implementation (the doc-comment in the package itself: loading it INSTEAD OF `dsh-fs-local` together with `ctx.sandboxPolicy` is the whole swap; the model-facing tools are untouched).
- `checkedTarget` re-canonicalizes immediately before delegating and returns the checked target, so the mutated identity is the checked one (no check-here-write-there TOCTOU); `workspace-write` containment derives from the shared `writableRoots` policy (`dsh-sandbox/roots`) — the same allow-list home used by the Seatbelt profile, so write-tool/bash asymmetry cannot arise by construction.
- The package’s own documentation is explicit that this fence is a policy check in trusted code over a model-controlled path — containment, NOT a kernel boundary; kernel-grade isolation of untrusted code stays `ctx.shell`'s job (`dsh-bash-sandbox`). That is exactly the OL-044 lesson: the bash tool spawns a runner (`sandbox-exec` on macOS, see `dsh-bash-sandbox` spawn/classify-failure flow and `SandboxUnavailableError` text at `dsh-sandbox/lib/index.js:345`), and nested Seatbelt inside an outer Seatbelt fails (`sandbox_apply: Operation not permitted`, OL-044 direct proof). The FS-only staging profile removes shell/jobs from the Worker, so the Worker's file mutations stay in-process behind the OUTER OS boundary — compatible path confirmed at the installed version.
- Escalation: `approveEscalation` (`dsh-sandbox/lib/index.js:137-166`) routes through `approval.approver.request` and honors the same deterministic `rejected` when policy is `never`; escalation targets `['workspace-write','danger-full-access']`.

### C3. `ctx.tools.restrict` / `ctx.tools.guard` / presets

- Installed `@deepseek-ai/dsh-tools`: `restrict({allow,deny})` requires a scoped context (agent.ctx), validates names against `view(scope).restrictableNames` (throws on unknown names; refuses reserved `run_code`), returns an effect disposer (`lib/index.js:453-467`); `guard(guard)` appends a scoped guard invoked as `guard(exec)` returning a denial-reason string (`:649-659`); restrictions compose across layers; stale/hidden listings are decided at call time, so the bundle's guard (`name-less` and stale invocations covered) matches the installed semantics.
- `@deepseek-ai/dsh-agent-preset` (default export `AgentPreset`) + registry: preset selection is driven by the durable `agent-preset/selected` session event (`dsh-agent-preset-registry/lib/index.js:52`, `:467`); the bundle's sessions.ts re-selects its own presets if the UI picks a default (`:143-151`); `select(agent, preset)` present (`:766`). Preset rows in the bundle patch define `dsh-superagent-worker` / `dsh-superagent-router` with `@deepseek-ai/dsh-agent-preset` mounts — compatible with the installed preset registry (all 0.2.2-rc.1).
- Router/main bash entry: the router preset (bundle `cordis.patch.yml`) mounts the shell group with `@deepseek-ai/dsh-bash-sandbox` + `@deepseek-ai/dsh-tool-bash` (5-second foreground caps) and `tool-fs` with `write: false, edit: false`. So the MAIN session retains a shell tool that can spawn the inner Seatbelt runner. The FS_ONLY env flag restricts the WORKER only; the Router can still invoke a nested shell. Recorded as an open blocker (not proof I2 is ready): any future live I2 must keep main-session shell behavior inside the outer OS boundary or restrict it in the disposable profile.
- Worker `tool-fs` row carries no `write/edit: false` config → full write/edit tools available, and under FS_ONLY restricted to the five in-process file tools.

### C4. Fresh-profile `never` attestability

Yes — statically: plugin-level `config.policy: never` in a disposable profile patch (private scratch YAML drafted this round; never loaded/applied), and per-session `setApprovalPolicy` for both Router and Worker. No live profile loaded, no settings written to any original/persistent state.

### API gaps / not-attested items (sanitized)

- Installed distribution ≠ upstream master guarantee: audit was against 0.2.2-rc.1 on-disk code/types only; any later DSH version may change `effectivePolicy` composition — re-attest per version.
- `dsh-fs-sandbox` fence is explicitly documented as containment, not a kernel boundary — residual ancestor-symlink TOCTOU accepted by its threat model; outer OS isolation remains the security boundary.
- Router shell entry unresolved (C3). No attestation that an actual future I2 run edits successfully — this report attests static/API compatibility only.
- Same-user approval/policy event replay is durable but same-user forgeable (carried limit from the synthetic-ledger line).

## D. Host zero-drift (read-only before/after)

Private before/after baseline evidence remains in an owner-only local location (mode 0600), **not reproduced here**. Exact host paths, process IDs/start times, database hashes and file-specific metadata have been redacted from this public report; only aggregate comparisons are given:

- Existing 3080/3083/8123 listener/process identities and start times: IDENTICAL before/after; binding classes unchanged.
- Probe response classes: existing DSH and orchestrator endpoints 200, local model unauthenticated probe 401; all unchanged.
- Read-only Session/Workspace aggregates and settings namespace count: IDENTICAL before/after; model-default namespace values unchanged.
- Existing local SQLite identity: byte-identical before/after, including hash/size/mtime; exact fingerprint retained only privately.
- Native relay approval: absent in both (relay-OFF). Real Weixin, registered projects' Apply/Rollback and historical grants untouched. No inference, DSH instance start or tool execution on original host.

## E. Cleanup

- Disposable stage worktree under a new owner-only scratch directory (detached at pinned SHA), retained only until publication; original private evidence from OL-044 remains untouched. Exact local scratch path is withheld.
- No service/config/port/model-default/SQLite changes made this round; nothing to roll back.

## F. Residual risks + next-task recommendation

1. Router shell entry (C3): future live I2 profile should restrict main-session bash (or prove the nested runner survives under the chosen outer boundary) — remote-side design item.
2. Headless approval: with `policy: never` both escalation and approval return deterministic `rejected`; a live I2 must therefore plan for no-escalation (FS-only Worker + workspace-write containment), which the pinned source already implements via the FS_ONLY opt-in.
3. Version drift: re-run this static audit against any new DSH release before granting a new live I2 consent.
4. The operator must grant a SEPARATE new live-I2 consent; OL-044's is consumed. This task authorizes no new live run and does not auto-dispatch OL-046.

## G. Done-commit CI note

Publication is report-only (docs + receipts + one to-online message). Expect the standard three-job CI on the done commit.
