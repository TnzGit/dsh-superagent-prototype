message_id: LO-20261120-045
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
verdict: ALL_OFFLINE_PASS
code_sha: 5578b19ae1a3326093884dc0324e1ebf1577dfaa
related_task: OL-20261120-045
report: agent-reports/REPORT-ol045-dsh-fs-approval-api-offline.md

# OL-045 offline installed-DSH fs/approval API audit result

ALL_OFFLINE_PASS means static/API compatibility only, NOT a real I2 edit attestation. Offline gate at the pinned SHA: install/check exit 0; workflow-exact Node 255/255; proxy 5/5; focused six-spec Vitest 37/37; full Vitest 1245/1245; convergence Node 5/5 including the new verdict-scope guards that accept OL-044's truthful I2_PARTIAL_NO_EDIT. FS_ONLY opt-in (DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1) restricts registered-project Workers to read/write/edit/glob/grep with a call-time guard covering stale/name-less invocations; preset/model route/global default unchanged; absent or non-1 preserves normal Worker tools. Flag never exported to the running host environment.

Installed DSH 0.2.2-rc.1 read-only audit: dsh-user-approval supports config policy never with a durable session-level override (setApprovalPolicy); decide() returns deterministic rejected for never BEFORE the answerer waterfall, so headless is safe; the ask path fails closed as unavailable. dsh-fs-sandbox is in-process (extends dsh-fs-local; no spawn/child_process anywhere), the base profile mounts fs-sandbox as ctx.fs, and dsh-tool-fs write/edit/patch route through ctx.fs with a per-call policy; the fence is documented containment, not a kernel boundary, so the outer OS boundary stays required. approveEscalation honors the same deterministic rejected under never. ctx.tools.restrict/guard semantics match the bundle implementation (scoped, name-validated, call-time guards, disposers).

Open blockers recorded for remote: (1) Router/main session retains the shell group (bash-sandbox + tool-bash), so the main session can still spawn the inner Seatbelt runner; FS_ONLY restricts the Worker only — the future live profile must restrict main-session shell or prove the nested runner under the chosen outer boundary. (2) Re-attest this static audit against any new DSH release before a new live consent. (3) Version drift: installed distribution may differ from upstream master; audit is against 0.2.2-rc.1 on-disk code/types only.

Host zero drift verified before/after (private anchors): listeners 3080/3083/8123 pids and start times identical; probes 200/200/401 unchanged; session/list items 885; settings/describe 28 namespaces writable/hasDocument unchanged; model defaults unchanged; 3083 test-home SQLite byte-identical; relay-OFF; no inference, no DSH instance start, no tool execution, no Weixin, no real Apply. OL-044 frozen evidence retained. This task authorizes no new live run and does not auto-dispatch OL-046.
