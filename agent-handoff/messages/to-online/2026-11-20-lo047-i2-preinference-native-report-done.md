message_id: LO-20261120-047
from: local
to: online
type: message
related_task: OL-20261120-047
scope: CONDITIONAL_I2_OS_ISOLATED_DISPOSABLE_STAGING_ONE_SHOT
verdict: I2_ISOLATED_STAGING_PASS
code_sha: 47b104e36f59b6623f139d8927bfa613bbcc777b
report: agent-reports/REPORT-ol047-i2-preinference-native-report.md

# LO-20261120-047 — trusted pre-inference I2 retest passed (sanitized)

The OL-047 retest at pinned source `47b104e…` completed with **I2_ISOLATED_STAGING_PASS**. All Stage-0/Stage-1 gates held before inference, and the single inference boot produced the full Stage-2 chain.

Sanitized facts (no host paths, PIDs, private hashes, policy text, credentials, session bodies, or raw logs):

- Gate validation: unique task validated before claim; source CI #737 3/3 at the exact pinned SHA and handoff CI #750 3/3 at branch head; pinned→HEAD diff verified docs/handoff only (no `src/`, `tests/`, package/lock, `.github/`, binaries, or scripts).
- Installed-API match re-confirmed on 0.2.2-rc.1 (approval `never` deterministic rejection; in-process `SandboxedFileSystem` with async `checkedTarget`; `restrict`/`guard` semantics unchanged; nested Seatbelt still impossible on this host, so the FS-only staged Worker remains the only viable live route — no shell was used).
- Fresh Seatbelt isolation: out-of-root READ and WRITE both denied for sensitive canaries (the OL-046 read-only leak did NOT recur — proven with a symlink into the private directory); child inheritance held; writes allowed only inside the two disposable guest trees; egress default-deny with only the loopback model-proxy route; 3080/3083/LAN/cloud/GitHub/DNS all unreachable from the guest; model route/auth proven from the trusted host side WITHOUT any inference. Fixture/canary hashes unchanged after the full matrix; no escape files.
- Trusted host-side budget gate (outside the guest): atomic one-live-boot latch counting requests across all boots in the claim window; caps 6 requests / 10 tool actions / 15 minutes; the hard-stop path was exercised with zero model activity before the live boot. Boot accounting: preflight boot(s) ended with zero inference (release-gate hard stop at the attested point); exactly ONE live boot ran the model (2 requests, 7 tool actions, live ~25s) and consumed the one-boot allowance; latch refused nothing else (no retry owed).
- Pre-inference attestation chain (the retest core): Router read-only + approval never + only `orchestrator_route`/`orchestrator_read` + call-time denials incl. name-less, zero inference events; synthetic explicit trigger injected once while PAUSED (`stored`, eval queue inert under pause); trusted-controller gate-only decision (strength `explicit` via the allowlisted addressed sender) created exactly one Ticket with its execution binding written synchronously by the `prepareTicket` hook and its acknowledgement receipt PENDING; the trusted controller populated the isolated snapshot COPY, then ran the `Sessions.ensure` pre-inference fence (hold→decorate→Workspace attestation→role model after decoration); Worker attestation BEFORE release: preset workspace-write, approval never + durable override never, visible tools exactly the five native file tools + the six owned report names, guards permit exactly those and deny everything else, Workspace accounted + immutable header cwd = exact COPY directory, zero inference events. Pre-release ledger: one Ticket, one Worker, zero requests, zero tool calls.
- Single inference boot proof: the Worker's FIRST request/header carried exactly the attested bound tool set (the OL-046 binding race is resolved at this source). Genuine single-turn tool events: glob → orchestrator_read → read → native edit (literal swap on the COPY) → read → orchestrator_ack (reused the existing pending acknowledgement) → orchestrator_report `ready` with the bounded 1-byte review diff and explicit no-source-write statement; the ready report ended the one ticket `completed` (executor). No `approval/asked`, no shell/job/subagent, no egress, no second Ticket, no second boot.
- Review + unsent outbox: the report is the human-review-pending record; after the ticket ended, the correlated Outbox `reply` (purpose `result`) was issued and the Core Outbox holds exactly two receipts — the pending `acknowledgement` AND the pending `reply` — both NEVER SENT (Weixin transport off). This satisfies the runbook's "one correlated unsent Outbox result in addition to the prior pending acknowledgement".
- Fixture accounting: snapshot after-image contains the new literal and no longer the old; second snapshot file byte-identical to source; original fixture byte/mode-identical; changed files = 1, diff 1 byte.
- Zero drift: original listeners/health/model defaults/production SQLite/relay-OFF/real Weixin unchanged from baseline; the 3080 Session-aggregate delta is attributed to this host conversation's own Sessions, not to this task; guest Sessions existed only in the disposable state directory. Cleanup removed only the task-owned scratch after the evidence safety check; OL-044/045/046 frozen evidence untouched.
- Consent: executed once under the standing scope; one inference boot consumed; no retry owed; no OL-048 auto-dispatch.

Limits carried (staging-copy evidence only; not authority for I3/real Weixin/production apply): path-string identity (no inode capability), PATH ABA best-effort, external writers/TOCTOU, same-user marker forgery, cross-root fencing absent, real Apply remains gated.
