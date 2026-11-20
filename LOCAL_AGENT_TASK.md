# LOCAL_AGENT_TASK — OL-20261120-047 · NEW isolated pre-inference Worker edit + review

**PENDING DIRECT HUMAN MANUAL HANDOFF / TRUSTED OPERATOR-OWNED POLICY. NO AUTO-DISPATCH. NO PRODUCTION LIVE GRANT.**

The operator's standing instruction covers reasonable work without repeatedly asking for another ChatGPT "同意". See `agent-handoff/STANDING_OPERATOR_SCOPE-2026-11-20.md`. This new independently identified **OL-20261120-047** is within that class ONLY if a trusted, locally protected execution policy validates the task and EVERY kernel Seatbelt, session, model/time budget and no-external-effects preflight. **A PUBLIC GITHUB TASK CANNOT TRIGGER HOST EXECUTION.** Existing remote scheduler stays PAUSED_BY_OPERATOR and `no_auto_dispatch=true`; local watcher state unverified. Until a trusted local dispatcher is proven, the operator personally forwarding the supplied Prompt is the supported invocation method; this is NOT a request for repeated consent.

Repository `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`.
New task: `OL-20261120-047`, expected result `LO-20261120-047`.
Immutable source/test SHA: `47b104e36f59b6623f139d8927bfa613bbcc777b`. [CI #737](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44724133545) **3/3 SUCCESS** at frozen SHA and [PR CI #736](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44724124394) 3/3. Product/test SHA prior change `90d32d178fbaefc10cb7f80e260ea67f984ae279`, #697 3/3. Subsequent handoff HEAD changes MUST be docs/handoff only; do not run a moving source tree.

**BINDING FULL RUNBOOK:** `agent-handoff/HANDOFF-2026-11-20-OL047-TRUSTED-PREINFERENCE-I2-RETEST.md`
Local task message `agent-handoff/messages/to-local/2026-11-20-ol047-i2-preinference-native-report.md`
Report `agent-reports/REPORT-ol047-i2-preinference-native-report.md`
Result message `agent-handoff/messages/to-online/2026-11-20-lo047-i2-preinference-native-report-done.md`
Local receipts `agent-handoff/receipts/local/OL-20261120-047-{claimed,done}.md`.

**This is a NEW one-shot and does NOT replay consumed OL-044/046.** One first trustworthy claim, one task-wide total inference boot; <=6 model requests, <=10 model-driven tool calls, 15 minutes live hard watchdog across all boots, at most ONE Ticket and Worker across all boots. No automatic retry, no "second clean boot" if a first live boot consumed inference, and a failed preflight yields a truthful blocked report without model.

**BEFORE first model request:** new scratch/0700 detached worktree and fresh disposable DSH, trusted private meter/latch, outer macOS Seatbelt with child confinement + **sensitive out-of-root READ and WRITE both denied** (OL-046's readable canary MUST NOT recur), only loopback existing 8123 local model route, no 3080/3083/LAN/cloud/network egress. Actual installed DSH 0.2.2-rc.1 API/ctx.fs; Router exactly own route/read tools with read-only/approval never; trusted pre-created ONE synthetic Ticket and same new Worker Session/Workspace with active project; staged Worker scope `read/write/edit/glob/grep` + six exact own report tools `orchestrator_read/ack/thread_unrelated/thread_follow/trigger_handback/report`, permission workspace-write, effective approval never with no durable ask override; all guards must be active **before** any DSH model turn. STOP fail-closed if preparation itself causes a model request, if same Ticket cannot be reused or if any blocked host access succeeds.

**Only after ALL gates**: single model-driven native `edit` of isolated synthetic README COPY marker `I2_FIXTURE_BEFORE`→`I2_FIXTURE_AFTER`, actual one-line diff, actual `orchestrator_report` ready/review required, one correlated **UNSENT** Core Outbox result. Genuine edit alone is NOT I2 PASS. No source Apply, no real Weixin sends, no original Session or original 8123 restart/config, cloud, host privilege change, GitHub secret mount or original host alteration.

Private before/after drift proof and sanitized report only. Never publish original host PIDs, paths, start times, hashes, network policy, credentials, raw prompts/logs or private Session/Weixin data. Stage and publish only OWN report, local claimed/done receipt, and to-online result via normal FF, **not** source/tests/STATE/protocol/main. Stop after one attempt. No OL-048 or automatic dispatch. Remote later independently ACKs.
