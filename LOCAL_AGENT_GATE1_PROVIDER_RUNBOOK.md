# LOCAL_AGENT_GATE1_PROVIDER_RUNBOOK — operator-approved, conditional live 3080 provider setup

**Approved by operator:** 2026-11-08, after same-SHA GitHub CI success on `552633c8f54175ea2b70ba1b9b3845584b48e6b1`.  
**Read alongside:** `LOCAL_AGENT_PROTOCOL.md` and the current `LOCAL_AGENT_TASK.md`.  
**Authority scope (Gate ① only):** create/configure a **test-only** `llm-local-proxy` model provider for the existing DSH 3080, and — **only if every safety prerequisite below is met** — use the **official** `session/selectModel` on a **specifically approved disposable test Session**, restoring the shared global model default afterward. This authorization is real and explicit, but it is **not** permission for arbitrary historical-Session selection or a blind attempt.

## Unbreakable constraints

1. The existing original 3080 host **must keep listening `0.0.0.0:3080`, `allowUnauthenticated: true`, the exact original trustedHosts, and current unrestricted anonymous LAN access.** The user requires this. Do not "fix" security by rebinding to loopback, changing auth, introducing firewall/ACL restrictions, or limiting other LAN clients.
2. **No controlled restart, manual reload, stop/start, package upgrade, service replacement or process kill** for DSH 3080/3083/8123. Gate ② for any deliberate restart is still unapproved. Config may become visible through the *existing installed runtime's normal hot settings mechanism*; verify rather than assuming restart is required or not required.
3. **No real `session/prompt`, completion call, model inference, Tencent/Weixin send, QR scan or cloud-model call.** Gate ③ remains unapproved. Do not enable `DSH_SUPERAGENT_DSH_RELAY_APPROVAL_FILE`, change 3083 relay admission, create route-attestation/Weixin grants for live sending, or alter 3083 SQLite.
4. Preserve all 27 original Workspaces, 841 historical Sessions, all logs, Session IDs, file trees, permissions, model settings and migrations. **No session/create, fork, migrate, rename, delete or bulk selection.** Original 3080's `cmp170hx` route must remain exactly as it was; never redirect it to 8123.
5. The only allowed live provider entry is **`llm-local-proxy`** configured for **`http://127.0.0.1:8123/v1`**, **OpenAI Chat Completions** (`openai-completions`) **if and only if installed 8123 and installed DSH 0.2.2-alpha.2 are verified compatible**, and the **exact** model ID `Qwen3.8-Flash-Next`. Never add a cloud fallback, additional provider/model, insecure credential exposure, or change the global default as part of provider creation.
6. Keep all baseline/rollback material in a **private local owner-only directory** (0600 files / 0700 parent), not GitHub or shared logs. This includes the full original config, model default, selected Session model, checksum, service environment and local IDs. Public report must be scrubbed to aggregates and coarse outcomes. The repository is PUBLIC.

## Background facts and source check

- Earlier local Agent accepted 3080 DSH `0.2.2-alpha.2`, 27 Workspaces, 841 Sessions, 286 migration-required, and one running; accepted provider `cmp170hx/Qwen3.8-Flash-Next` currently bypasses 8123 directly to vLLM. Original global default was reported as `cmp170hx/Qwen3.8-Flash-Next/xhigh`; **read the current effective value, do not trust historical text when mutating**.
- Verified Session projection is `modelSelection: {lastUsed, next}`. **Only `next` authorizes a future model; `lastUsed` is historical**. Use current official `session/projections` sequenced response and official `session/list`, not stale cached projection hints or direct SQLite/Session log reads.
- DSH official provider documentation: https://deepseek-harness.github.io/deepseek-harness/en/guide/providers ; pi-ai user profiles may hot-update without restart. **Verify the installed exact version** and whether the active 3080 profile stores provider routes in user settings or the Cordis patch. Avoid replacing whole Cordis plugin config arrays. If the version, schema, or hot-update behavior cannot be demonstrated non-destructively, STOP as `BLOCKED_SCHEMA_OR_RELOAD` before any write.
- DSH `session/selectModel` **also saves the new global default, possibly asynchronously**. Its RPC success may occur before that shared setting is durably saved. The Task may not assume an immediate restore will win the race. **Confirm a separate, supported method for restoring the global default without changing unrelated Sessions, and verify durable readback before considering a Session model switch.** Do not write directly into Session persistence or the settings database.

## Phase A — private, read-only preflight (mandatory before any mutation)

1. Identify the **actual** process/profile for current 3080 via local read-only commands and installed package source. Record immutable baseline privately: PID; listening address/port; effective `allowUnauthenticated` and trustedHosts; checksum, permissions, owner and exact bytes of any profile/settings that may be edited; model provider catalog; current global default including reasoning effort; existing provider list; current Session count / running count; 3083 and 8123 PIDs. Do **not** dump any secret/config file in public.
2. Verify 8123 is the existing one-slot local Qwen proxy; use **read-only** endpoint inspection / existing health evidence, e.g. a bounded `GET /v1/models` if supported, without generating tokens or occupying the inference slot. Confirm the served model ID exactly; a missing model-list endpoint must not be substituted with guessed identity.
3. Inspect **installed DSH 0.2.2-alpha.2** code/config schema for a supported custom provider definition and a safe way to edit only that one provider; check whether setting a provider auto-changes a global model default. Verify exact credential reference behavior and existing local proxy auth requirements, never log a credential or send credentials to GitHub.
4. Confirm `llm-local-proxy` is **absent** before creation. If the ID already exists, STOP: no overwrite or rename.
5. Verify current global model default reads as the recorded expected local Qwen; if it has drifted, STOP `BLOCKED_BASELINE_DRIFT` and report privately. Never "fix" a drift by changing default during preflight.
6. Create an owner-only complete backup of the exact config/settings to be touched; calculate a checksum of each original file, record backup restore instructions, and verify a reversible, *minimal* provider-only diff can be applied **without editing listener/auth/trustedHosts or unrelated providers**.
7. **Before Session selection**, independently prove a supported, readback-verifiable restore of the global default that leaves the test Session's `next` as `llm-local-proxy`. If impossible, postpone `session/selectModel` and report `SELECTMODEL_DEFERRED_DEFAULT_ROLLBACK_UNPROVEN`. Merely planning to call selectModel a second time on the same Session is not sufficient: it also reverts the Session selection and may asynchronously overwrite the global default.

## Phase B — test-only provider creation (one narrowly scoped live change)

1. If all baseline/schema/backup checks passed, create **only** the `llm-local-proxy` provider using the **installed DSH-supported route** (existing settings UI/official API or the verified active profile file). Correct target: loopback `http://127.0.0.1:8123/v1`, `api: openai-completions`, one model `Qwen3.8-Flash-Next`. Reuse the **existing safe credential reference** or supported local auth method; do not create or publish a literal API key in the profile or report. No fallback.
2. Prefer an atomic, minimal, syntactically validated change respecting the actual config owner and mode. Keep plugin registration, all old providers, 3080 listener, `allowUnauthenticated` and trustedHosts byte-for-byte semantically intact. Preserve all unchanged settings; capture a diff **only privately** and verify no unexpected field changes.
3. Read-only confirm the provider becomes visible in the **existing** 3080 model catalog / picker and targets 8123 (verify route from exact local config or installed provider introspection, NOT merely by assuming the display name). No real inference. Check effective global default, original cmp170hx route, host PIDs/listeners, 3083 and 8123 listeners, anonymous LAN settings/clients after change.
4. If provider fails to load **without a deliberate restart**, do not restart/reload. Stop with `PROVIDER_CONFIGURED_PENDING_GATE2` if it is safely staged and no live configuration has unexpectedly drifted. Otherwise undo the single provider change from private backup using the supported method and report `ROLLBACK_REQUIRED`. Do not force a restart as rollback.
5. If default model, old providers or listener/auth configuration change unexpectedly: **stop immediately** and restore provider-only change safely, recheck baselines, classify the result accurately. If rollback cannot be verified, report `MANUAL_RECOVERY_REQUIRED` and perform no other actions.

## Phase C — `session/selectModel`: allowed ONLY with a uniquely designated disposable Session

The user approved Gate ① in general, but **has not provided an exact throwaway Session ID in this chat**. The 62 idle/current-format/workspace-write/Qwen candidates in task01/task02 are a **screening pool**, *not* a grant to mutate an arbitrary historical Session. You must NOT choose the oldest, newest, first, most idle or "seems disposable" Session from that pool as a substitute for human confirmation.

Proceed to Phase C **only if** an exact Session has already been separately designated by the operator **in verifiable private instructions** as disposable *for this Gate ① model selection*, with an unambiguous exact original Workspace→Session mapping. Otherwise, report **`SELECTMODEL_DEFERRED_NO_DESIGNATED_SESSION`** and STOP after Phase B. Gate ③'s future real-prompt selection remains separately required even if Gate ①'s Session gets configured.

Additional mandatory Phase C conditions, all on the *real* current host:
- Provider is visible and resolves to the verified local 8123 route; no schema fallback or cloud route.
- Session exists in the exact approved Workspace, current format, idle with no queued/pending input and no subagent, original permission `workspace-write`; no migration or other Agent run; `session/projections` current sequenced model `next` and baseline cursor captured.
- Full private backup of Session selection and shared default; supported exact `session/selectModel` request/payload is confirmed from **installed DSH 0.2.2-alpha.2**, not invented; a separately verified official default restoration procedure exists.
- No other input or model writes competing for the default while rollback is in flight. If this cannot be assured, STOP; do not rely on eventual asynchronous save ordering.

Then perform **at most one** `session/selectModel` for the designated disposable Session, to `{provider:'llm-local-proxy', model:'Qwen3.8-Flash-Next'}` with the installed supported reasoning effort (do not infer that `xhigh` is accepted on the new provider). **Never call `session/prompt`.** Verify the Session's exact sequenced `modelSelection.next` and no new turn. Complete the independent shared-default restoration **after any asynchronous default save has settled**, confirm from effective settings through repeated durable readback that original provider/model/effort remains `cmp170hx/Qwen3.8-Flash-Next/xhigh` (or the true snapshotted value), and verify host invariants again. Any ambiguity is `MANUAL_RECOVERY_REQUIRED`; do not claim success.

**No live 8123 inference attestation is produced by selecting a model; Gate ③ must separately verify the route before its real prompt.**

## Phase D — reporting and STOP

Publish **one sanitized report only** to `agent-reports/REPORT-gate1-3080-provider.md` on feature branch using the dedicated report-only worktree and normal human-credential, non-force push per `LOCAL_AGENT_PROTOCOL.md`. **Never upload** config backups, Session IDs, file paths, private catalog, API tokens, auth headers or raw logs.

Report at minimum:
- Exact baseline feature SHA and current run PIDs *only as same/changed, not raw process details*; status of 3080 required LAN access (PASS/FAIL); original Workspaces/Sessions preserved.
- Exact installed DSH schema/protocol evidence source file names (no private absolute paths); route protocol, model name, 8123 read-only availability, provider-only config diff **summary**, and evidence that original `cmp170hx` route and global default are unchanged.
- Before/after and rollback outcome: `PROVIDER_VISIBLE_NO_RESTART` / `PROVIDER_CONFIGURED_PENDING_GATE2` / `BLOCKED_*` / `MANUAL_RECOVERY_REQUIRED`; `SELECTMODEL_DONE_AND_DEFAULT_RESTORED` or `SELECTMODEL_DEFERRED_*`, with explicit reason.
- Counts/bounded checks of sessions; no private identities; whether profile/provider backup exists in owner-only private storage.
- Clear separation of **GitHub CI GREEN on SHA `552633c8`** (workflow run `42473002786`, all 3 jobs PASS), local C3S PASS (`1206/1206`, mock `58/58`) and **no real DSH Prompt, no real Weixin return**. Task/report commits themselves may have different SHAs.
- Gate ② restarts and Gate ③ real prompt remain **UNAPPROVED** and **NOT RUN**.

STOP after reporting. In case of any unverifiable state or un-recoverable default change, prioritize stopping and preserving private rollback evidence, not repeated mutations.

**One-line reply to the operator**:  
`GATE1 完成：Provider=<VISIBLE/PENDING/ROLLBACK/BLOCKED>，selectModel=<RESTORED/DEFERRED>，3080 LAN=PASS；脱敏报告 agent-reports/REPORT-gate1-3080-provider.md（SHA <sha>）；未重启、未投递 Prompt。`
