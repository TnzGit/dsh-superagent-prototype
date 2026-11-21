# OL-20261118-042 — I1F consolidated Mac readiness acceptance (sanitized)

Verdict: **ALL_OFFLINE_PASS** (with two recorded BLOCKED items that are known, remote-acknowledged gates — no new blockers).

## 1. Handoff validation

- Claimed ONCE on the operator's manual handoff (never auto-dispatched): private claim file + GitHub claimed receipt `agent-handoff/receipts/local/OL-20261118-042-claimed.md`, commit `2d1475352632b760b82e1b40b1c6c2f033a2a847`, FF push `fba2821..2d14753` (ls-remote verified).
- Task uniqueness: no prior claimed/done receipt existed; dispatch HEAD `fba2821d3debbd292cc4c7353a5882c8f474aa37`; pinned source `ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead` IS an ancestor of dispatch; pinned→dispatch diff = 13 files, handoff/docs/protocol + one convergence-guard test change only, **zero src/test-of-product changes**.
- Message schema valid: `message_id: OL-20261118-042`, from online, to local, type task, scope `OFFLINE_SYNTHETIC_ONLY`, exact 40-hex `code_sha` present verbatim in current `LOCAL_AGENT_TASK.md` and in the to-local message; single matching to-local file.
- Source CI #550 run 44325865819 independently re-verified via gh API: 3/3 SUCCESS at exact `head_sha ad61a3c` (local-first-core, macos-portability, dsh-typecheck-and-build; real macOS runners allocated).

## 2. Stage A — read-only baseline + isolated worktree (PASS)

Host baseline (sanitized): macOS 26.3 arm64; node v25.9.0; pnpm 11.7.0; git 2.50.1; clang 21; installed `dsh 0.2.2-rc.1`. Listeners at start: node PID 1482 `*:3080`, PID 68379 `127.0.0.1:3083`, PID 90215 `127.0.0.1:8123`. Probes: 3080 `/`→200, 8123 `/v1/models`→401 (client-key auth), 3083 `/health`→404-alive. launchd jobs `ai.dsh.bc-pilot.web`/`ai.dsh.bc-pilot.proxy` registered. Catalog aggregate: 27 workspaces (unchanged private snapshot, collectedAt 2026-11-08). Relay env names absent → relay-OFF assumption holds.

Stage worktree: parent `0700` under OS temp, detached worktree at exact `ad61a3c`, `git status` clean before and after. No product-source edits.

## 3. Stage B — CI-equivalent offline regression (PASS)

On the detached worktree at the pinned SHA:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 (752ms) |
| `pnpm check` (typecheck+test+build) | exit 0 (build 1191ms) |
| Workflow-exact 25-file Node list (as in `local-first-core`/`macos-portability`) | **249 pass / 4 fail, exit 1** — all 4 failures in the NEW `tests/os-path-inspector.node-test.mjs`, see §5 finding F1; the other 249 pass (handoff-convergence 4/4 included) |
| Focused 6-spec Vitest (preview/session/real-apply-contract/delivery/vertical/sessions-boundary, the CI #550 30/30 command) | run1 30/30 exit 0, run2 30/30, run3 30/30 — three consecutive repeats green |
| Proxy suite | 5/5 exit 0 |
| FULL Vitest (68 files) | 1238/1238 exit 0 (21.6s) |

Replay/cancel/error-path/isolation checks (via the three focused repeats + spec assertions): unique Outbox reply, replayed trigger/stale effect → no second Ticket/Session, stopped Ticket never launches stale Worker, dirty Git + counterfeit manifest + unknown project fail closed, source bytes unchanged; all confirmed.

Global default model invariance: focused fixtures freeze `{provider:'existing-production-default',model:'unchanged'}` and every role-model resolution went through `llm.resolveCallConfig` with the fixture local route only — no change to the host's defaults observed (Stage E listener/probe parity).

## 4. Stage C — operator-Mac OS + installed-API evidence (PASS, one env finding, one gap confirmed)

Native prototype (`research/os-path-inspector.c`, compiled fresh per fixture under 0700 temp roots, private specs `tests/ol042-stagec-native.node-test.mjs`): **9/9 pass**. Coverage: fresh-file provenance REJECT (F1), escape/traversal/absolute/hidden/double-slash/root-symlink REJECT, ancestor+final symlink REJECT (ELOOP class), hardlink/world-writable/dir-as-final/FIFO REJECT, `uchg` flag REJECT path, ACL-blindness demonstration, case-insensitive APFS alias walk, root path ABA race demo, read-only invariant (bytes+mode unchanged after probes).

Installed DSH read-only investigation (checkout + installed `node_modules` types; no Session/Workspace history touched):

- `WorkspaceRegistry` identity = **string equality of `fs.realpath`-canonicalized paths** (`packages/workspace/workspace/src/paths.ts` `realpathNormalize`, documented as the package's ONE uniqueness canon). Workspace records store the canonical path; sessions attach via `entity.ts:attachSession` which re-resolves the stored header `cwd` through the same canon and refuses on mismatch, missing cwd, or non-directory; membership is filtered in the write chain via `candidateMatches` (`reportFilteredCandidates` logs canonical-cwd-vs-workspace-path drift). **No inode/dev identity is stored anywhere in the Workspace domain** — path-symlink-to-existing-workspace collides by design, but a same-path directory swap (inode change) is invisible to the registry until the next realpath pass, and the canonical path is re-observed live (path ABA applies).
- Prototype `Sessions.ensure` (`src/app/sessions.ts:138-168`): validates (a) active Ticket exists, (b) caller-supplied `cwd === ticket.execution.directory`, then calls `sessionController.resolveAgent(id)`; **on a restored (pre-existing) Session it trusts the resolved agent as-is** — it never asks `WorkspaceRegistry` whether the Session's own recorded workspace matches the expected snapshot. The create path does register `workspaceRegistry.create(cwd)` for new Sessions only. This matches the risk note the remote already wrote in `docs/013-integration-acceptance.md:77` (restored Session may point at a pre-existing Workspace whose identity differs from the requested snapshot; must be resolved before real-host I2).
- Fake-SessionController fail-closed negatives (private spec `tests/ol042-stagec-fakecontroller.spec.ts`, 4/4 pass): CF1 foreign restored Session (header cwd = other project) is reused with zero re-validation — gap demonstrated; CF2 no active Ticket → refuses before any create; CF3 mismatched cwd → refuses before any create/workspace; CF4 workspace registration failure → propagates, no agent, no permission set. The remote suite currently has CF2/CF3 classes but **lacks the CF1 restored-foreign-Session and CF4 registration-failure cases** (recorded as a test-coverage gap).

Classification: restored-Workspace identity attestation = **BLOCKED (known gate; docs/013 already assigns it)**. Remote patch idea (source-backed): in `ensure()`, after a successful `resolveAgent`, look up the resolved Session's workspace via `ctx.workspaceRegistry.resolveByPath(ticket.execution.directory)` (canonical) and refuse if the resolved agent's session is accounted to a different workspace id/path (or add a `WorkspaceRegistry` API `validateSessionWorkspace(sessionId, canonicalPath)` used before the role model is initialized); plus add the two missing fail-closed tests to the I1D spec. Not a guessed bypass — no permission relaxation applied.

Prototype verdict stays RESEARCH_ONLY: no exclusive writer domain, no ACL guarantee, no one-shot source-write capability, no journal/crash recovery (docs/014 matrix still PENDING).

## 5. Finding F1 — `com.apple.provenance` breaks the native test on the operator macOS 26.3 (env-specific; CI runner unaffected)

On this host, every newly created file carries xattr `com.apple.provenance` (11 bytes; `xattr -l` lists it; it is not removable by `xattr -d`). `no_extended_attributes()` uses `flistxattr(fd,NULL,0,0)` which on macOS returns the byte-size of the list (measured 21) — `n==0` only when the list is EMPTY, so any fresh file is REJECTed. Measured with a small C probe and reproduced by all 4 `tests/os-path-inspector.node-test.mjs` OK-expecting cases (:34, :52, :61, :79 — escape-only :41 passes). CI cross-check: `macos-portability` job (runner 1000003650, macos-15-intel) shows all 5 P3-native tests PASS (3878/285/231/259/225ms) — the hosted runner filesystem does not stamp provenance; the operator Mac does. Consequence for the future apply helper: a "no xattrs" policy is **unsatisfiable on operator macOS 26 unless `com.apple.provenance` is explicitly allowlisted** (it is a system-managed integrity stamp, not user data). Suggested remote fix direction: treat allowlisted system xattrs separately (or gate the helper's xattr policy per-OS), keeping the REJECT for nontrivial user xattrs. This is not a service or source-drift issue; local 249/4-fail is environmental, CI stays 3/3.

## 6. Stage D — real host

NOT AUTHORIZED per runbook + operator grant (OFFLINE_SYNTHETIC_ONLY + READ_ONLY). Real DSH Agent turn on 3080/3083, new isolated DSH instance, live inference, real registered project, I2/I3: `HOST_STAGE_NOT_AUTHORIZED`. If a future I2 one-shot (isolated disposable copy, STOP BEFORE source Apply) or a restored-Session identity probe on the live 3083 host is desired, a separate private one-shot grant (exact target/profile/port/model/time/rollback) is required; nothing carries over from OL-041/C5.5B.

## 7. Stage E — invariant comparison (PASS, zero drift)

Post-run: listener PIDs 1482/68379/90215 unchanged on 3080/3083/8123; probes 200/401/404-alive identical; catalog aggregate 27 unchanged; model defaults, provider config, production SQLite, historical Sessions/Workspaces, native Weixin, relay-OFF — all untouched. Only cleanup: disposable stage worktree parent removed; private specs existed only inside it (never pushed); harness temp roots self-removed by fixtures. Unknown drift: none.

## 8. Sanitized security review

Report contains only SHAs, CI run numbers, test counts, tool versions, synthetic fixture behavior, generic probe codes. No host user paths, Session/Workspace IDs, Weixin IDs, tokens, secrets, or raw logs exposed. Private evidence stayed in `~/.dsh-superagent-private/ol042` (0700) and OS temp fixtures.

## 9. Exact next remote code tasks

1. Add restored-Session workspace-identity attestation to `Sessions.ensure` (or a `WorkspaceRegistry.validateSessionWorkspace` API) + the CF1/CF4 fail-closed tests; resolves the docs/013:77 gate before I2.
2. Address F1: OS-specific xattr policy for the native helper and its tests (allowlist `com.apple.provenance` on macOS 26, keep REJECT for user xattrs; note ACLs are invisible to `flistxattr` on macOS — a real helper needs an ACL inspection path, e.g. `fgetxattr`/`facl`-equivalent or `stat` extended check).
3. Continue the OS-isolated apply helper per docs/014 (trusted root fd, exclusive writer domain, crash journal, one-shot private capability) — matrix still all PENDING.
4. After 1–2 land with own CI 3/3, propose operator-granted I2 (disposable copy, STOP BEFORE Apply) as a separate manual handoff.
5. State-sync commit after ACKing LO-042 (STATE.json `last_accepted_local` → OL-042/LO-042, `active_local_task` → null, LOCAL_AGENT_TASK.md → NO ACTIVE TASK) so the convergence guards pass on the report HEAD, per the OL-041 precedent (expected mid-sync RED class).
