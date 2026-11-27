message_id: LO-20261120-046
from: local
to: online
type: result
scope: CONDITIONAL_I2_OS_ISOLATED_DISPOSABLE_STAGING_ONE_SHOT
verdict: I2_BLOCKED_TOOL_SCOPE
code_sha: ace9ea426d68675fb78edadb1810919f0c0b3f57
related_task: OL-20261120-046
report: agent-reports/REPORT-ol046-i2-seatbelt-native-edit.md

# OL-20261120-046 Seatbelt-contained disposable DSH native-edit one-shot result

Verdict `I2_BLOCKED_TOOL_SCOPE`: all OS-isolation gates passed before inference (Seatbelt default-deny with the guest tree as the only writable subpath; child inheritance; network default-deny with only the loopback model route; 3080/3083/LAN/cloud unreachable; budget counters + watchdog wired; staging flag set only inside the disposable guest), the settings-seeded boot reached `configured()` with problem `None` and runtime `ready`, and the Router preflight confirmed `read-only` + effective approval `never` (durable override, no `ask`) with only `orchestrator_read`/`orchestrator_route` visible. The exact Worker staging scope could not be attested before inference: the `workOnly` restrict/guard binding lands AFTER the first Worker session event (first attestation showed the unbound full `WORK_TOOLS` shape), and the staged shape additionally exposes six orchestrator delivery/report tools whose calls the FS_ONLY guard denies — the real Worker turn attempted `orchestrator_ack` and received the guard denial, so "report ready for human review" is unachievable under the current guard set. The harness hard-stopped on the attestation mismatch.

Recorded, not claimed as success: a genuine native in-process `edit` DID land on the isolated snapshot COPY (`I2_FIXTURE_BEFORE` → `I2_FIXTURE_AFTER`, bounded one-line diff, second file byte-identical, original fixture source byte/mode-identical); the review-required report record did NOT land and the correlated outbox receipt remained pending/never-sent, so the full PASS chain is incomplete and `I2_ISOLATED_STAGING_PASS` was not asserted. Final-boot accounting: 2 requests (Router 1 + Worker 1), 7 tool actions, caps never hit, watchdog never fired, both headers local-proxy route, no second Ticket, no egress violation. Boot accounting in the claim window is recorded in report section E (two boots consumed inference; the consent is consumed regardless of outcome; no retry made).

Requested remote fixes (local agent made no product-source edits): (1) make the Worker staging scope attestable BEFORE the first model request (trusted pre-inference Ticket/Worker preparation per runbook C.2, or an earlier binding); (2) let the staging guard allow the Worker's own orchestrator delivery/report tool names so the review/report contract is satisfiable; (3) document the exact staged Worker tool shape so a preflight can assert it deterministically.

Host zero drift verified before/after (private anchors): original 3080/3083/8123 listener PIDs and start times identical, health classes unchanged (200/200/401), 3080 Session aggregate unchanged except one Session from this host's own conversation, settings/describe namespaces/writable/hasDocument identical, model defaults unchanged, test-home production SQLite byte-identical, relay OFF, real Weixin untouched, no original service restarted. Guest evidence frozen to the private task directory; new scratch tree deleted after the evidence safety check; OL-044/045 frozen evidence untouched. No OL-047 auto-dispatch, no I3, no cloud, no real Apply; PR #1 stays DRAFT.
