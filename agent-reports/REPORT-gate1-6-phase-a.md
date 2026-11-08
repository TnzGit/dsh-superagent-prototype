# REPORT — Gate①.6 Phase A (read-only reasoning-metadata readiness)

Date: 2026-11-08 (Asia/Shanghai). Runbook baseline SHA: `c72a0e2` (verified; branch HEAD at test time `c72a0e2`). Phase A only — no Phase B write, no `selectModel`, no Session create/select, no prompt, no restart, no Weixin relay. No Session event, model switch, restart, or inference request produced.

## Status vocabulary result

`PHASE_A_READ_ONLY_READY` — proposal validated offline; **Phase B NOT APPROVED** (awaiting explicit operator approval). No `BLOCKED_SCHEMA`, no `BLOCKED_BASELINE_DRIFT` observed.

## Phase A findings

1. **Schema proof (installed 0.2.2-alpha.2 source, not upstream master):** `packages/llm/llm-pi-ai/src/catalog.ts` — `PiAiModelProfile.reasoningEfforts?: false | PiAiReasoningEfforts` (model-level field; doc: "a non-empty dict declares the offered levels and their wire spellings"); `PiAiReasoningEfforts = Partial<Record<ModelThinkingLevel, string|null>>`; route level has only `defaultReasoningEfforts`. `THINKING_LEVELS` = `off, minimal, low, medium, high, xhigh, max` (drift-gate record). `resolveModelReasoning`: entry-level `reasoningEfforts` wins; when absent, falls back to installed catalog base or route default — which is exactly why today's route-level `reasoningEfforts:` key (not a route schema field) is ignored and no efforts are advertised. Validation rules confirmed: wire values must be non-empty strings; declaring only `off` is an error.
2. **Live catalog (read-only):** `session/modelCatalog` — `llm-local-proxy` visible with only `Qwen3.8-Flash-Next`; the model entry carries **no reasoning metadata** (no efforts offered); `failures: []`; effective default `cmp170hx / Qwen3.8-Flash-Next / xhigh` unchanged; `cmp170hx` route unchanged. The profile's mis-nested key was located in the current live profile file (route level under the test provider; the original provider keeps its efforts correctly under `models[]`), and the intended map is 2 fields (`low`, `high`) with wire spellings `low`/`high` — both supported by the installed schema's level list and the non-empty-string rule. The 8123 backend's actual acceptance of these wire values remains **unverified** until a separately authorized real prompt (Gate③). No `xhigh` invented.
3. **Proposed minimal diff (Phase B, NOT applied):** move only that 2-field `reasoningEfforts` map from the route level into the single `models[]` entry whose id is the test model; delete the route-level key. Provider id, `baseURL`, `api`, credential reference, model id, context length, every `cmp170hx` field, and every global setting untouched. YAML round-trip parse validated offline against the proposed profile shape. Proposal + schema evidence saved in the private owner-only directory (parent 0700, files 0600); full profile, tokens, paths, Session IDs not published here.
4. **Host invariants reconfirmed:** PIDs/listeners for 3080 (`0.0.0.0`, same PID as Gate① baseline), 3083, 8123 all unchanged; `allowUnauthenticated: true` and trustedHosts unchanged in the profile connection block. Session inventory aggregates 842 / 2 running / 286 migration-required — delta vs C0/C2 baseline (841/1) is ordinary operator activity plus this agent's own running session, not caused by Gate①.6; Workspaces remain 27 (unchanged count).
5. **CI:** Gate① report commit `2717644e` — push 145 + PR 146 **success**; runbook commit `c72a0e2` — push 149 + PR 150 **success** (`Local-first core tests`). This report's own commit may differ.

## Rollback design (Phase B, when approved)

- Backup immediately before mutation: **current post-Gate① profile** (includes the already-functional `llm-local-proxy`), checksum-verified, with metadata/permissions and credential-reference integrity. The pre-Gate① backup MUST NOT be used as the ordinary rollback for this correction — it would delete the new provider.
- Apply only the pre-reviewed field move via the installed DSH-supported config update mechanism; no guessed API/plugin reload.
- Read `session/modelCatalog` without inference; PASS requires `low`/`high` on the test model, `failures: []`, exact original default unchanged, and all invariants (§4) unchanged. If not hot-visible → `CONFIG_STAGED_PENDING_REVIEW`, no restart. On unrelated drift → atomic restore from the post-Gate① baseline with readback verification; unprovable rollback → `MANUAL_RECOVERY_REQUIRED`.

## What the operator still needs to approve (separate grants)

1. **Phase B:** the single provider-metadata field relocation described above (nothing else).
2. A **disposable Workspace→Session** designation (created if needed) for the first active test; never an old historical Session from the candidate pool.
3. **Gate③:** one approved `session/selectModel` (with the private default snapshot + settle-poll + `settings/replace` restore protocol from Gate①.5) and one real prompt with 8123 route attestation.

## Evidence classes

- LOCAL READ-ONLY FORENSICS: this report (official API + installed-source schema + offline YAML validation).
- GITHUB CI GREEN on `2717644e` and `c72a0e2`.
- REAL 3080 SESSION E2E: NOT RUN. REAL 8123 ROUTE INFERENCE: NOT RUN. REAL WEIXIN RETURN: NOT RUN.

STOP after this report; Phase B and all gates remain unapproved.
