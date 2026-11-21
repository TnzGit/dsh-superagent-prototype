# Gate①.6 — Repair plan for test-provider reasoning metadata (approval-gated)

> Prepared remotely after read-only Gate①.5 report `agent-reports/REPORT-gate1-5-session-readiness.md` at `fc3784d`. **This runbook does not itself authorize another live host write, `selectModel`, new Session, real prompt, restart, or Weixin send.** Execute **Phase A only** without a new, explicit operator approval of Phase B. The original DSH 3080 is authoritative for its Workspaces and Sessions.

## Evidence and present state

- Gate① installed `llm-local-proxy` into the existing DSH 0.2.2-alpha.2 profile, pointing only to `http://127.0.0.1:8123/v1` for `Qwen3.8-Flash-Next`; `session/modelCatalog` observes it live without a restart.
- Original global default is still `cmp170hx / Qwen3.8-Flash-Next / xhigh`. Existing 3080 `0.0.0.0:3080`, `allowUnauthenticated: true`, trustedHosts and anonymous LAN clients remain operator-required and MUST remain unchanged. 3083 and 8123 continue running.
- Gate①.5 inspected installed DSH's `packages/llm/llm-pi-ai/src/config.ts` and `catalog.ts`. A `reasoningEfforts` field mistakenly placed at the `llm-local-proxy` **route level** does not supply model-level reasoning metadata. The catalog currently offers no effort levels for that provider. `reasoningEfforts` belongs in the corresponding entry of `models[]`; check installed schema and accepted wire spellings rather than assuming an `xhigh` level or silently replacing another field.
- `SessionPromptRequest` has no model override. The official `session/selectModel` updates the chosen Session's `next` and starts an asynchronous save of the shared default; its RPC receipt alone is NOT evidence that default persistence finished.
- Gate①.5 identified `settings/replace(ns='agent-default-model', section=<original full user section>, expectedRevision=<observed revision>)` with `settings/describe` durable readback as the supported *design* for independent restoration. **The switch-plus-restore procedure has not been exercised on a real Session.**
- Two existing Workspace-member Sessions were *screened*, but no Session was designated as disposable. Do not select either merely because they were idle or current format. Prefer a newly operator-approved disposable Workspace/Session for the first active test.

## Phase A — read-only proof and proposed diff (authorized without further runtime mutation)

1. Read the exact current `agent-reports/REPORT-gate1-5-session-readiness.md` and check branch SHA/CI. Inspect *installed 3080* DSH 0.2.2-alpha.2's exact `PiAiModelProfile`, `PiAiReasoningEfforts` and resolver, not just newer upstream/master source.
2. Read the 3080 **current live** `session/modelCatalog` and effective default. Confirm `llm-local-proxy` is visible, `Qwen3.8-Flash-Next` is the only test-route model, and no efforts are offered. Verify `cmp170hx` and the default remain unchanged.
3. Independently establish the exact `reasoningEfforts` map that the existing test profile intended (report says low/high were written at the wrong level); prove the wire spellings are supported by the installed DSH API schema. Treat compatibility with 8123 actual token generation as *unverified* until a separately authorized real prompt. Do not manufacture `xhigh`, other tiers or backend behavior.
4. Produce a **proposed** minimal diff which moves only that mis-nested `reasoningEfforts` map under the one `models[]` entry with `id: Qwen3.8-Flash-Next`. Do not change provider ID, `baseURL`, `api`, credential reference, model ID, context length, any `cmp170hx` field, or any global setting. Check YAML parsing and the installed schema offline.
5. Save the proposal and schema evidence privately (owner-only 0700 directory, 0600 files). Public report may contain only the shape rationale and count of moved fields, never the full profile, tokens, private paths or Session IDs.
6. Reconfirm 3080/3083/8123 PIDs, listener invariants, Workspace and Session inventory aggregates (accounting for ordinary operator activity), and CI SHA. **STOP here** unless the operator independently approved Phase B.

## Phase B — optional live shape correction: separate explicit operator approval REQUIRED

**Approval scope, if ever granted:** ONE provider-only metadata field relocation. **Not** authorization for `session/selectModel`, `session/create`, `session/prompt`, inference, Weixin delivery or restarts.

1. Check for baseline drift immediately before mutation. Take a checksum-verified backup of the **current post-Gate① profile**, including the *already functional* `llm-local-proxy`, plus its metadata/permissions and credential-reference integrity. **Never use the pre-Gate① backup as the ordinary rollback for this correction:** it would inadvertently delete the new provider.
2. Apply only the pre-reviewed, schema-valid field move under `models[]`. Preserve owner/mode and all unrelated bytes/semantics. Use the installed DSH-supported config update mechanism; no guessed API or plugin reload.
3. Read `session/modelCatalog` without inference. PASS only if the expected low/high efforts (and no invented `xhigh`) appear in the test model, `failures: []`, the exact original global default is unchanged, and 3080's listener/auth/trustedHosts/LAN clients, existing `cmp170hx` and other host PIDs are unchanged.
4. If not hot-visible, STOP as `CONFIG_STAGED_PENDING_REVIEW`; do not restart. If an unrelated field or default drifts, restore from the **post-Gate① baseline** using a supported atomic rollback and verify readback. If rollback cannot be proven, STOP `MANUAL_RECOVERY_REQUIRED`.
5. Report one sanitized file under `agent-reports/` with before/after model-catalog effort labels, SHA/CI, exact mutation scope, backup/rollback existence, and preservation checks. Do not publish raw config, credentials, IDs or paths.

## Future active Session test — NOT authorized by this runbook

1. Require an operator-designated **exact disposable Workspace→Session** with permission to run one test prompt, plus any separate authorization needed to create the disposable workspace/session. Never use an old historical Session from an automated candidate pool. Require zero unexpected queued/running input.
2. Before one approved `session/selectModel`, privately snapshot exact `session/projections.modelSelection.next`, event cursor, the complete `agent-default-model` settings **user section**, its effective value and `revision`; confirm no competing settings writer. Only select an effort offered by the corrected catalog or deliberately omit effort if allowed. Do not infer `xhigh`.
3. After `session/selectModel`, confirm the Session's sequenced `next`. Poll `settings/describe` until the background write to the shared default is observed; only after it settles use official `settings/replace` with the **current** `expectedRevision` and the exact pre-change user section. Verify the old effective default and user section with repeated readbacks. A revision mismatch, further write, unsettled async change or uncertain restoration means **STOP** (no blind retries; no real prompt).
4. The route's appearance in `session/modelCatalog` or `GET /v1/models` is **not** real 8123 queue inference attestation. Gate③ requires separately approved, one-shot actual prompt on that exact disposable Session, model route audit, output correlation, and separate authorization before any real Weixin relay.
5. Gate② deliberate restarts are unnecessary for the currently visible Provider and remain independently unapproved. Do not restart merely to exercise the gates.

## Report status vocabulary

`PHASE_A_READ_ONLY_READY` / `BLOCKED_SCHEMA` / `BLOCKED_BASELINE_DRIFT` /
`PHASE_B_NOT_APPROVED` / `PROVIDER_REASONING_VISIBLE_NO_RESTART` /
`CONFIG_STAGED_PENDING_REVIEW` / `MANUAL_RECOVERY_REQUIRED`.

Never claim **real Session E2E**, **real 8123 route inference** or **Weixin return E2E** from configuration visibility, local unit tests, or CI.

## GitHub-only report handoff — mandatory for Phase A/B

Follow `LOCAL_AGENT_PROTOCOL.md` as the standing handoff contract. Publish the complete **sanitized** report as a normal Git commit in `agent-reports/` on `feat/local-first-wechat-foundation`; verify the remote HEAD and the report URL. Final local-Agent chat output must be **one short status line only** with the GitHub URL, pushed SHA, CI status (if checked), and STOP verdict. **Never paste or attach the full report, and never ask the operator to carry, copy, upload or manually forward it to remote ChatGPT.** The remote ChatGPT fetches the report from GitHub when the conversation resumes. A zero-touch proactive notice requires a separate user-approved automation; do not claim otherwise. If the push fails, state `BLOCKED_PUSH` without claiming the report is published.
