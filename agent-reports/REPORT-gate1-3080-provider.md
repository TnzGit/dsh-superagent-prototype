# REPORT — Gate① test-only 3080 provider (`GATE1-3080-PROVIDER`)

Date: 2026-11-08 (Asia/Shanghai). Branch HEAD tested: `fdc64f8` (runbook `6a10d61` + task `fdc64f8`; runbook baseline SHA `552633c8` is an ancestor).

## Verdict

- **Provider: `PROVIDER_VISIBLE_NO_RESTART`** — live in the installed 3080 runtime's official model catalog without any restart.
- **selectModel: `SELECTMODEL_DEFERRED_NO_DESIGNATED_SESSION`** — operator has not designated an exact disposable Session; Phase C not attempted per runbook.
- **3080 LAN unauthenticated access: PASS** (unchanged, re-verified after the change).
- No restart, no `session/prompt`, no real inference, no Weixin send, no relay enablement. Gate② / Gate③ remain UNAPPROVED / NOT RUN.

## Phase A — read-only preflight (before any mutation)

- Baseline recorded in a private owner-only directory (0700 parent, 0600 files): original patch bytes + SHA-256, credential store + SHA-256, env layer + SHA-256, listener/PID facts, provider list, global default, session counts.
- 3080 listener: same process, same `0.0.0.0:3080` binding before and after. 3083 and 8123 listeners unchanged (same PIDs before/after).
- Provider config lives in the active profile's `cordis.patch.yml` under the `llm-pi-ai` entry (`providers:` map); confirmed schema from installed 0.2.2-alpha.2 source (`packages/llm/llm-pi-ai/src/config.ts`: `apiKeyEnv` credential-ref, `api`, `baseURL`, `models[]`; credential ref pattern `^[A-Za-z_][A-Za-z0-9_]*$` in `packages/credentials/credentials/src/index.ts`).
- Before change: providers = `cmp170hx` only; `llm-local-proxy` absent (id count 0). No overwrite needed.
- Global default read from the official `session/modelCatalog` effective value: `cmp170hx / Qwen3.8-Flash-Next / xhigh` — matched the recorded expected value; no baseline drift.
- 8123 verified read-only as the existing one-slot local Qwen proxy: authenticated `GET /v1/models` returns exactly `Qwen3.8-Flash-Next` (max_model_len 400000); unauthenticated request correctly returns 401 unauthorized. No inference slot occupied, no tokens generated.
- Private backup: full original patch + credential file + env layer copied to the private directory with checksums; provider-only reversible diff verified before writing.

## Phase B — provider creation (the only live change)

- Minimal diff: **13 lines added** under `providers:` — new route `llm-local-proxy`, `api: openai-completions`, `baseURL: http://127.0.0.1:8123/v1`, one model `Qwen3.8-Flash-Next` (contextWindow 400000, text input), reasoning efforts low/high. File owner and mode (0600) unchanged; all other entries byte-for-byte intact (diff verified privately; no other field changed).
- Credential handling: added credential-ref `LOCAL_PROXY_TEST_KEY` to the private managed credential store, value = the existing proxy client key already in use locally (no literal key in the patch file; nothing published; the key value never appears in this report or on GitHub).
- Activation: the running 3080 process hot-reloaded the provider layer — **no restart was performed or needed**.
- Post-change verification (all read-only):
  - `session/modelCatalog`: `routableProviders` now includes `llm-local-proxy`; its group lists exactly `Qwen3.8-Flash-Next`. `failures: []`.
  - Catalog effective default **unchanged**: `cmp170hx / Qwen3.8-Flash-Next / xhigh`.
  - Original `cmp170hx` route entry untouched (baseURL and all model settings byte-identical).
  - Listener check: 3080 still `*:3080` same PID; 3083 and 8123 same PIDs; anonymous LAN `session/list` over the LAN address returns full data without login (PASS).
  - `allowUnauthenticated: true` and trustedHosts entries in the profile connection config: unchanged.
- Session-count drift note: baseline C0/C2 reported 841 sessions / 1 running; current official `session/list` shows 842 / 2 running. The delta is operator-created sessions (updated timestamps ~17:57–19:21 local) plus this agent's own running session — unrelated to this change; migration-required count unchanged at 286. No Workspace or Session was mutated by Gate①.

## Phase C — selectModel

Not attempted. No exact disposable Workspace→Session mapping was designated by the operator in verifiable private instructions; the 62-candidate screening pool is not a mutation grant. Per runbook: `SELECTMODEL_DEFERRED_NO_DESIGNATED_SESSION`. (Known DSH behavior on record from C1: `session/selectModel` also persists the shared global default, so the deferred decision keeps the default provably untouched.)

## GitHub CI status

- Actions delivery interruption observed earlier (422 "Actions has been disabled", pushes 81e09ad/1a0cf20/8b0fc5a produced no runs) now appears resolved: `push` run 142 and `pull_request` run 144 on branch HEAD `fdc64f8` both **success** (workflow `Local-first core tests`). The earlier same-SHA green evidence `552633c8` (run 139, all 3 jobs PASS) also stands.
- CI coverage of this report commit itself may differ; the CI-tested baseline SHA is `fdc64f8`.

## Rollback (if ever needed)

Restore `cordis.patch.yml` from the private owner-only backup (checksum-verified original), remove `LOCAL_PROXY_TEST_KEY` from the credential store. No service restart needed for rollback of visibility (same hot-reload mechanism); no other config touched.

## Distinguishing evidence classes

- MOCK PASS (C3S offline): `pnpm check` 1206/1206 + build; node files 58/58 (earlier stage reports).
- LOCAL CONFIG CHANGE: provider-only diff, verified live-visible via official API (this report).
- GITHUB CI GREEN on `fdc64f8` (runs 142/144) and `552633c8` (run 139).
- REAL 3080 SESSION E2E: NOT RUN. REAL WEIXIN RETURN: NOT RUN. 8123-route live inference attestation: NOT RUN (model-list only; Gate③ must separately attest the route before its real prompt).

## Next blocker

Gate② (controlled restart) and Gate③ (one real prompt to an operator-designated disposable Session) remain separately unapproved. The provider is now visible and usable for Gate③'s eventual route attestation once a Session is designated and a model selection (or explicit per-prompt model) is approved.
