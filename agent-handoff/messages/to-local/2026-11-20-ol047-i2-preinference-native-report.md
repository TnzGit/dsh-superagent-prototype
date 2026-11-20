message_id: OL-20261120-047
from: online
to: local
type: task
scope: CONDITIONAL_I2_OS_ISOLATED_DISPOSABLE_STAGING_ONE_SHOT
code_sha: 47b104e36f59b6623f139d8927bfa613bbcc777b
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44724133545
expected_result: LO-20261120-047
standing_operator_scope: REASONABLE_PROJECT_WORK_DEFAULT_APPROVED
local_execution: DIRECT_MANUAL_OPERATOR_PROMPT_OR_VERIFIED_OPERATOR_OWNED_POLICY_ONLY
requires_live_host_approval: false
public_github_not_execution_authority: true
no_auto_dispatch: true

# OL-20261120-047 — ONE NEW isolated DSH native edit + owned review report

The operator has granted standing authorization for reasonable synthetic-copy I2 tests with exact OS, model budget and tool gates. **No repeated chat consent is required**, but this PUBLIC GitHub file does NOT authenticate execution or enable an automatic scheduler. Do not execute from a public message alone; honor the locally protected operator policy (or a matching Prompt personally forwarded by the operator) and the task identity in `LOCAL_AGENT_TASK.md`.

Read the full binding runbook `agent-handoff/HANDOFF-2026-11-20-OL047-TRUSTED-PREINFERENCE-I2-RETEST.md`, previous OL-046 ACK `I2_BLOCKED_TOOL_SCOPE`, `agent-handoff/SECURITY.md`, `docs/016-i2-worker-scope-preflight-and-ticket-tool-contract.md`. Use pinned `47b104e36f59b6623f139d8927bfa613bbcc777b`, CI #737 3/3, one new unique claim only.

All model calls MUST be preceded by exact DSH installed-tool scope, both Sessions approval never, **new Worker ready before ANY model inference**, fresh trusted one-Ticket/Worker prep, private hard budget and one-live-boot latch, outer Seatbelt deny-sensitive-read-and-write and child/egress probes. Never use "try boot again" after any inference. If preflight cannot be done without model, report `I2_BLOCKED_TOOL_SCOPE`, no model. Only then run one synthetic COPY native edit AND `orchestrator_report` review, correlated unsent Outbox. Missing actual review = failure, even after a real edit. All existing real services untouched; no I3/Weixin, Apply or external send. Publish sanitized `agent-reports/REPORT-ol047-i2-preinference-native-report.md`, unique LO-047 and local receipts; stop. No OL-048.
