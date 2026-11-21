# REPORT — Gate①.5 Session readiness forensics (read-only)

Date: 2026-11-08 (Asia/Shanghai). Branch HEAD at test time: `2717644e` (Gate① report commit). All work read-only: no `selectModel`, no `prompt`, no `create`, no restart, no inference, no Weixin send, no Session event produced.

## Verdicts

| Check | Result |
| --- | --- |
| `PROVIDER_VISIBLE` | PASS |
| `SESSION_DESIGNATED` | NO → status `SESSION_NOT_DESIGNATED` |
| `DEFAULT_RESTORE_PROVEN` | YES |
| `PER_PROMPT_MODEL_OVERRIDE` | UNSUPPORTED |
| `RESTART_REQUIRED` | NO |
| 3080 original default model & LAN behavior | UNCHANGED |

## 1. Re-verification (read-only)

- Branch HEAD `2717644e`; CI on the Gate① report commit: `push` run 145 and `pull_request` run 146 — both **success** (workflow `Local-first core tests`). Earlier green on `fdc64f8` (142/144) and `552633c8` (139) also stand.
- Official `session/modelCatalog` on 3080: `routableProviders` includes `llm-local-proxy`; its group lists exactly `Qwen3.8-Flash-Next`; effective default still `cmp170hx / Qwen3.8-Flash-Next / xhigh`; `failures: []`.
- 8123 authenticated `GET /v1/models`: exactly `Qwen3.8-Flash-Next` (read-only, no slot occupied).
- Listeners/PIDs: 3080 `0.0.0.0:3080`, 3083 and 8123 loopback — all three same PIDs as Gate① baseline; anonymous LAN API call succeeds without login.
- Settings readback: namespace `agent-default-model` user section = `cmp170hx / Qwen3.8-Flash-Next / xhigh`, revision 15, `provider writable: true`.

## 2. `session/selectModel` flow (installed 0.2.2-alpha.2 source)

`packages/api/session-controller/src/commands.ts` — `selectModel(request)`:
1. `requireModel` availability check, then `llm.resolveCallConfig(selected)` validation (reasoning effort accepted only if the route resolves it).
2. `agent.model.select(selected)` — the Session's `next` changes synchronously.
3. **Background default save:** `void this.ctx.agentDefaultModel.saveSelection(selected)` — fire-and-forget; the RPC responds **before** the default is durably saved; a save failure is only logged as a warning. Completion signal: the save goes through `configEditor.edit(entry, …)` (`packages/boot/config-editor/src/index.ts:87`), which awaits Loader reconciliation and bumps the `agent-default-model` settings namespace revision — observable via `settings/describe` (revision change / user-section rewrite). Do not rely on the RPC response alone.

## 3. Official global-default restore (independent of selectModel)

`packages/api/settings-controller/src/index.ts` exposes official `@Remote` operations on the settings namespace surface: `describe` (redacted layered value + revision), `update` (merge patch), `replace` (whole user section), `mutate` (path ops) — each with `expectedRevision` optimistic-concurrency guard. Namespace `agent-default-model` carries `{provider, model, reasoningEffort}` and is writable by the mounted settings provider. **Proven restore procedure:** snapshot revision + user section via `settings/describe`; after any async default save has settled (readback shows the new selection), restore via `settings/replace(ns='agent-default-model', section=<snapshotted value>, expectedRevision=<post-save revision>)`; then repeat `settings/describe` until the user section matches the original and revision is stable (durable readback). Leaves all other Sessions untouched.

## 4. `session/prompt` per-request model override

**UNSUPPORTED.** `SessionPromptRequest` (`packages/api/session-controller/src/types.ts`) has exactly: `requestId`, `sessionId`, `mode: 'queue'|'steer'`, `content`, optional `clientTimeZone`. No model/provider field — a prompt always uses the Session's selected `next` model. No undocumented parameter used.

## 5. Candidate sessions (screened, not chosen)

Filter applied via official `session/list` projections only: `formatStatus=current`, not running, no active subagent, `permissions.currentValue=workspace-write`, within workspaces `task01`/`task02`. Result: **2 candidates** (full Session/Workspace IDs kept only in the private 0600 file, not published). Both show `next = cmp170hx / Qwen3.8-Flash-Next / xhigh`. The candidate pool is **not** a mutation grant: operator designated no exact disposable Session, so Gate①.5 = `SESSION_NOT_DESIGNATED`; nothing was created/forked/migrated/modified.

## 6. `llm-local-proxy` reasoning effort — evidence

- Catalog model entry for `llm-local-proxy` carries **no `reasoning` metadata** (unlike `cmp170hx`, which advertises `xhigh` only).
- Cause (source): `packages/llm/llm-pi-ai/src/config.ts` route schema has `defaultReasoningEfforts` (route level) and per-model `reasoningEfforts` inside the `models[]` entry. The Gate① provider diff placed `reasoningEfforts:` at the **route** level, which is not a route field — it is ignored, so resolution falls back to `base?.reasoning ?? false` (`packages/llm/llm-pi-ai/src/catalog.ts` `resolveModelReasoning`): the installed pi-ai catalog's capability for the id, or reasoning disabled.
- Consequence: **never assume `xhigh` is accepted on this provider**; `selectModel` with an effort would be judged by `resolveCallConfig`. Suggested remote-side fix (config shape, not product code): move the efforts into the model entry (`models[].reasoningEfforts`) or use route-level `defaultReasoningEfforts`, then re-verify the catalog advertises them.
- Not modified in this round (read-only task).

## 7. Real switch runbook (for the future approved Gate③-adjacent mutation)

1. Capture Session `next` + baseline cursor via official `session/projections` and full private backup of Session selection + settings namespace snapshot (value, user, revision).
2. Single `session/selectModel` to `{llm-local-proxy, Qwen3.8-Flash-Next}` with an effort **advertised by the catalog** for that provider (none advertised today — see §6; omit effort unless efforts are re-declared and verified).
3. Verify Session `next` via `session/projections`; confirm no new turn started.
4. Wait for the background default save to settle: poll `settings/describe` for `agent-default-model` until user section == the new selection (save landed) and revision stable; only then restore the default via `settings/replace` with `expectedRevision` and re-describe until the original `cmp170hx / Qwen3.8-Flash-Next / xhigh` reads back (repeated durable readback).
5. Stop conditions: any drift of unrelated namespaces/providers, revision churn from a competing write, restore readback failure → STOP (`MANUAL_RECOVERY_REQUIRED`), do not retry blindly; rollback = `settings/replace` from the snapshot + restore patch file from the private checksum-verified backup.

## 8. Operator approvals needed next

1. Designate an exact disposable Workspace→Session (from the 2-candidate pool or elsewhere) for a model selection — and, if the provider's reasoning efforts matter, approve the config-shape fix (§6) first.
2. Gate② controlled restart (only if ever needed; provider visibility today requires none).
3. Gate③ one real prompt to the designated Session, with 8123 route attestation before it.

## Evidence classes

- GITHUB CI GREEN on `2717644e` (runs 145/146) — this report's own commit may differ.
- LOCAL READ-ONLY FORENSICS: official API + installed-source contract checks (this report).
- REAL 3080 SESSION E2E: NOT RUN. REAL WEIXIN RETURN: NOT RUN. Live 8123 inference attestation: NOT RUN (model-list only).

## Private storage note

Baseline backups (original patch/credentials/env, checksummed) and the candidate-session detail file are kept in the operator's private owner-only directory under the Superagent private home (parent 0700, files 0600). Actual paths and Session IDs are not published here or on GitHub.
