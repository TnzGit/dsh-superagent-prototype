# OL-20261120-047 — Trusted pre-inference I2 retest: disposable Seatbelt DSH native edit + review full acceptance (result)

- Scope: `CONDITIONAL_I2_OS_ISOLATED_DISPOSABLE_STAGING_ONE_SHOT`
- Verdict: **I2_ISOLATED_STAGING_PASS** (every Stage-0/1 gate held before inference; the single inference boot produced the native edit, the Worker's own `orchestrator_report` review record, and the correlated unsent Core Outbox result)
- Pinned source: `47b104e36f59b6623f139d8927bfa613bbcc777b` (source CI #737 SUCCESS 3/3 at exact `head_sha` verified before claim; handoff CI #748 3/3)
- Dispatch: operator-forwarded direct task Prompt under the standing I2-class scope; no repeated consent required (this is not a fresh one-shot permission; the attempt is single-run with no retry).

## A. Gate validation

- Dispatch validated before claim: unique task (`STATE.json`/`LOCAL_AGENT_TASK.md` list only OL-20261120-047; no prior claimed/done receipts), schema `from: online` / `to: local` / `type: task`, scope allowlisted, `code_sha` an exact 40-hex literal in the current task file, `requires_live_host_approval: false`, `public_github_not_execution_authority: true`.
- Source CI #737 (run 44724133545) cross-checked: 3/3 (`local-first-core`, `macos-portability`, `dsh-typecheck-and-build`) at the exact pinned head. Handoff CI #750 (run 44730802138) 3/3 at branch head `94772f0…` (an earlier run #749 was cancelled by the queue's cancel-in-progress; the green run at the branch head is #750).
- Pinned-source → branch-HEAD diff verified **docs/handoff only**: no `src/`, `tests/`, `package.json`/lockfile, `.github/`, manifest, binary, or executable change. Claim made once, before any work (commit `6979fc7`).
- The remote's ACK of LO-20261120-046 confirms the blockers this task retests: first Worker model request preceded the `workOnly` binding, and the FS_ONLY guard denied the six owned delivery/report tools. At the pinned source both are fixed in `src/app/sessions.ts` (deny-all hold installed on `agent/created` **before** decoration; the staged guard admits exactly the five native file tools **plus** the six owned report names; `Sessions.ensure` decorates and Workspace-attests the staged Worker **before** the role model is installed, and refuses any staged Worker whose snapshot already contains inference events; `prompt()` refuses until the Session is staged-ready).

## B. Installed-API match (OL-045 audit holds)

Re-confirmed read-only against installed DSH `0.2.2-rc.1` (node v25.9.0): `approval` policy `never` is a deterministic rejection before the answerer waterfall (installed `dsh-user-approval`: `effectivePolicy = overrideOf(session) ?? config.policy ?? 'ask'`; durable `approval/policy` session records act as overrides); in-process `ctx.fs` = `dsh-fs-sandbox` `SandboxedFileSystem` with async `checkedTarget`; `ctx.tools.restrict`/`guard` guard-exec semantics unchanged (`guard(exec)` returns a denial-reason string; `checkGuards` iterates global + chain guards). No nested Seatbelt is possible on this host (`sandbox_apply: Operation not permitted` under an outer profile; `launchctl submit` from inside the outer sandbox cannot escape), so the FS-only staged Worker — which removes shell entirely — is the only viable live route here; none was needed.

## C. OS isolation (all PASS before inference)

Boundary: fresh macOS Seatbelt profile (`sandbox-exec`, `allow default` + deny private/host dirs for **read and write** + deny all writes outside the disposable guest trees + deny egress except the single loopback model route). Fresh profile, not a reuse of the OL-046 one; the OL-046 read-leak quirk was corrected here by explicit deny-subpaths, proven with a symlink into the private directory:

- In-guest read/write PASS; `/tmp` outside scratch write DENIED; host home write DENIED; private host canary (private state dir) **read DENIED and write DENIED** (exit 1 / "Operation not permitted"); **symlink read escape into the private dir DENIED** (OL-046's read-only leak did not recur); symlink write escape DENIED; real workspace and harness-checkout read DENIED; stage-tree write DENIED; parent-of-guest write DENIED; second guest tree writable (COPY semantics); OS child chain inherited confinement (no escape file created); node runs inside the sandbox.
- Network: default-deny egress; only the loopback route to the existing single-concurrency model proxy (8123) allowed; 3080/3083/LAN model host/cloud/GitHub unreachable from the sandboxed guest (connect failures); an explicit DNS/UDP trap was denied (errno 1). Route/auth proof for the model came from the trusted **host** side with the proxy's own client key (authenticated `/v1/models` and `/health` queue snapshot), not from inside the guest and **without any inference request**; the guest's unauthenticated 401 alone was treated as a presence check only.
- `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` set **only** in the guest launch environment, never on the host or the original 3080/3083 services.
- Fixture and canary hashes/modes byte-identical after the whole probe matrix; no escape files created anywhere.

## D. Trusted host-side budget gate (outside the guest)

- Atomic latch file (private, mode 0600) counts model REQUEST lines across **all** boots in the claim window and refuses any further live boot once a request occurred (one inference boot only). Measured: the boot-A (preflight) counters contain zero REQUEST lines; the latch stayed at zero until the single live boot; the live boot then consumed it.
- Caps wired mechanically inside the in-guest harness over `session/event`: hard stop at >6 model requests, >10 tool actions, or a >15-minute live window; second-ticket guard; an early-request guard (`request/header` before the attested release aborts the whole attempt). Boot accounting for the whole claim window: preflight boot(s) with **zero** inference (one exercising the release-gate hard stop with zero model activity, plus harness-fix re-runs that also ended before any inference — the final preflight is the one reported in E), then exactly **one** live boot which ran the model turns (recorded: 2 model requests, 7 tool actions, live 25s). The hard-stop-with-zero-model path was exercised before the live boot, so enforcement is demonstrated, not assumed.

## E. Disposable instance + pre-inference attestation (the retest core)

Boot: fresh 0700 scratch tree; relocated `DSH_HOME`; fresh `stateDir`; fresh SQLite **seeded while stopped** (revision 1: github disabled → local-only deployment, weixin-native enabled with the synthetic allowlisted peer, `paused: true` so evaluation stays inert); synthetic two-file fixture registered via a 0600 synthetic registry file (one `local` project); profile patch: fresh loopback high port, `agent-default-model` = local proxy route only, web search provider none, `approval` policy `never`, all three permission presets `approval: never`; transport SEND off.

Order proved before release (trusted controller, in-guest, after the master Session exists):

1. Router attestation: main Session preset `read-only`, effective approval `never` + durable override `never`, visible tools exactly `orchestrator_read` + `orchestrator_route`, call-time guard denials (non-empty strings) for `bash`/`pwsh`/jobs/skill/subagent/web/settings/reply/ticket-retry and a name-less call; `ctx.fs` = `SandboxedFileSystem` in-process; **zero inference events** on the Session.
2. One synthetic explicit `/project i2-fixture` Weixin-shaped Trigger injected through the real Weixin-native Source context **while paused**: intake `stored`, queued for eval, zero assessment/model steps (evaluation is skipped while paused).
3. Trusted-controller gate-only decision (`engine.decide` with an explicitRouted reason): one Decision, strength `explicit` via the allowlisted addressed sender; one Ticket; the execution binding (project identity + snapshot directory) written synchronously by the `prepareTicket` hook; the correlated `acknowledgement` receipt created **pending** (transport off). The launch effect is enqueued but held while paused.
4. Trusted controller populates the isolated snapshot COPY itself, then calls `Sessions.ensure(workerId, snapshotDirectory, …, 'worker')` — the pre-inference ensure fence: hold (deny-all) → decorate (five native file tools + the six owned report names, `workOnly` installed first) → Workspace membership attestation → role model installed **after** decoration → staged-ready.
5. Worker attestation after ensure, before release: preset `workspace-write`, effective approval `never` + override `never`, visible tools exactly the five file + six owned names, call-time guard **permits** each owned/file name (null) and **denies** everything else (bash/pwsh/jobs/skill/subagent/web/settings/reply/ticket-retry/name-less), WorkspaceRegistry accounted membership + immutable header cwd = exact snapshot COPY directory, `parentSession` null, **zero inference events** (no `request/header`, no `turn/start`), fs backend in-process sandbox.
6. Pre-release ledger: exactly one Ticket, one Worker Session, two agents total, **zero** model requests, **zero** tool calls.

Boot A (preflight) exercised the release-gate hard stop at exactly this point with zero model activity and exited clean. The live boot then released.

## F. Single inference boot — real tool turn + review + unsent outbox

- Release: trusted controller unpauses (origin `tool`, notice-free). The launch drains, re-verifies the pre-created snapshot, and the pre-attested Session is reused idempotently (staged-ready early-return).
- **The proof**: the Worker's FIRST `request/header` carried exactly the attested bound tool set (provider `localqwen`, model `Qwen3.8-Flash-Next` via the loopback proxy only) — scope installed before inference, the OL-046 binding race is resolved at this pinned source.
- Genuine tool events in the one Worker turn: `glob` → `orchestrator_read` → `read` → `edit` (native in-process `ctx.fs` edit swapping the literal `I2_FIXTURE_BEFORE` → `I2_FIXTURE_AFTER`) → `read` (verify) → `orchestrator_ack` (accepted, reusing the existing pending acknowledgement receipt — no second receipt) → `orchestrator_report` state `ready` with a bounded one-line review diff (`-I2_FIXTURE_BEFORE` / `+I2_FIXTURE_AFTER`, 1 byte changed) and an explicit no-source-write/no-PR statement: the report is the human-review-pending record; the report landed before any ticket-end denial, and the ready-with-no-follows report ends the one ticket `completed` by the executor.
- Model accounting: 2 requests total (Worker 1 + Router 1 for the result-relay steer; cap 6); 7 tool actions (cap 10); live 25s (cap 15m); no `approval/asked`, no shell/job/subagent call, no egress, no second Ticket, no second boot, no file escape outside the guest trees.
- Correlated unsent result: after the ticket ended, the trusted controller issued `engine.reply(purpose 'result')` for the same trigger; the Core Outbox holds **two** receipts — the pending `acknowledgement` and a pending `reply` — both **pending, never sent** (Weixin transport off: the delivery attempt defers with the Source off/not-installed backpressure and never resolves), which is the runbook's "one correlated unsent Outbox result in addition to the prior pending acknowledgement".
- Fixture accounting: snapshot README after-image contains `I2_FIXTURE_AFTER` and no `I2_FIXTURE_BEFORE`; snapshot `notes` byte-identical to source; the original two-file fixture source remained byte/mode-identical (0600); bounded diff 1 byte, changed files = 1.

## G. Zero drift + cleanup

- Original listeners (3080/3083/8123) identical PIDs/start times to the private baseline; health classes unchanged (200/200/401); model defaults unchanged (the guest route was profile-local only); test-home production SQLite byte-identical to baseline (hash kept private); relay state remains OFF; real Weixin untouched; no original service restarted; nothing installed system-wide; the Session aggregate on 3080 moved 885→889 across the claim window, attributed to this host conversation's own Sessions and unrelated background work, not to OL-047 (the guest Sessions lived only in the disposable `stateDir`).
- Cleanup: the task-owned sandboxed DSH process exited on its own; scratch tree deleted after the evidence safety check; new private evidence frozen for this task (boot A/B counters and RESULT, injection record, Router/Worker attestations, release ledger, guest DB dump with the one ticket/trigger/decision/disposition/thread/outbox rows and the two pending receipts, snapshot/source bytes, guest SQLite with sidecars). OL-044/045/046 frozen private evidence untouched.

## H. Carried limits (unchanged, for the remote owner)

Canonical-path-string identity (no inode/dev/dirfd) and best-effort PATH ABA; external writers/OS TOCTOU; same-user marker forgery (integrity evidence, not a signature); cross-root fencing absent; no crash journal for one-shot/live consent; real source Apply gates remain CLOSED (this PASS is staging-copy evidence only: it is not authority for I3, real Weixin, or production apply). Seatbelt nesting remains impossible on this host, so the FS-only staged Worker remains the only viable live route here.

## I. Consent and follow-up accounting

Executed once under the standing I2-class scope; no retry occurred and none is owed (the one inference boot is consumed). No OL-048 auto-dispatch, no I3 native Weixin, no original Session/Workspace operation, no cloud model, no real source Apply, no production config change. PR #1 stays DRAFT/unmerged.
