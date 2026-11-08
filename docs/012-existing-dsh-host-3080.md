# 012 — Reuse existing DSH host on Mac port 3080 (authoritative workspaces and sessions)

> Decision update: the operator already runs an ordinary DeepSeek Harness instance on 127.0.0.1:3080 with valuable existing work. **It is NOT part of the native Weixin 3083 runtime yet.** The system must preserve these Workspace IDs, original file trees, Session IDs and chat history rather than silently creating a parallel replacement.

## Two independently owned hosts

- **DSH 3080** remains the authoritative host for the operator's historical Workspaces, Sessions, model/tool settings, live turns and disk paths. Do not change its DSH_HOME, profile, port, persistence store, Session log, or filesystem without an explicit user-approved handoff.
- **DSH Superagent 3083** already owns the live native Weixin ingress, Policy and Outbox; its proven local Qwen path goes through 127.0.0.1:8123. It must not open 3080's session storage concurrently, copy logs into its own profile, call arbitrary Session tools, or imply a new Ticket worker has resumed a historical Session.
- **Actual continuation** should use the existing 3080 host's official Session API, respecting the **user-mandated anonymous LAN owner-access model** (`0.0.0.0`, `allowUnauthenticated: true`, current trustedHosts). The original host's exact access-control behavior has been verified on the operator's Mac; no token/cookie exchange is required by this installation. DSH publishes Workspace/Session controllers in `@deepseek-ai/dsh-api-workspace-controller` and `@deepseek-ai/dsh-api-session-controller`. Use supported methods, never guessed endpoints or forged cookies. Do not change 3080's listening interface, authentication setting, trustedHosts, or LAN access.
- **New projects** should be created under an operator-approved parent, registered in the owning DSH Workspace registry through the official API, and should begin in a fresh Session. Never reuse old Session history for a new project. Do not use the 3080 instance's directory as an implicit scratchpad.

## Workspace IDs and sessions are different identities

Each official `WorkspaceView` contains `workspaceId`, canonical `path`, `title`, `sessionIds`, and timestamps. A Workspace is a persistent record of a directory, while a Session holds a separate historical conversation/Agent state. Matching a Workspace does not identify which prior Session should continue if the Workspace holds multiple Sessions. Ask for the exact Session, or offer a new Session in the SAME existing Workspace with original files intact. Never let the model choose an old Session just because it was most recent.

## Read-only inventory (Stage C0, before changing any running host)

The local Agent has now verified the real **read-only** Workspace and Session APIs in installed DSH 0.2.2-alpha.2. WARNING: this host currently treats unauthenticated loopback requests as the owner; it is not the authenticated transport originally assumed. Do not install a second DSH, load a plugin into port 3080, stop it, restart it, or query its SQLite/JSON session history directly. If the Host API requires app login or has different method names, stop and report the exact public type signatures instead of inventing an endpoint.

Produce a private 0600 JSON file (outside repositories, never uploaded) with this shape, populated only from real Workspace projection fields:

```json
{
  "version": 1,
  "origin": "dsh-host",
  "hostId": "mac-dsh-3080",
  "collectedAt": "2026-11-08T00:00:00.000Z",
  "workspaces": [
    { "workspaceId": "EXACT_ID_FROM_DSH", "title": "EXACT_LOCAL_WORKSPACE_TITLE",
      "path": "/ABSOLUTE/LOCAL/PATH_FROM_DSH", "sessionIds": ["EXACT_SESSION_ID_FROM_DSH"] }
  ]
}
```

**The JSON above is a schema example, not actual data from 3080.** Never invent the project titles/paths/session IDs. Run the offline validator:

```sh
node --experimental-strip-types scripts/check-existing-dsh-catalog.mjs /PRIVATE/DSH-CATALOG.json
```

For a local private ID/title list, run with `--list`. Output must not be pasted into public issues unless redacted. To let 3083 display the project labels (but not paths/Session IDs), add **only to its isolated staging env**: `DSH_SUPERAGENT_DSH_CATALOG_FILE=/ABSOLUTE/PRIVATE/DSH-CATALOG.json` after user approval and a controlled restart. It is purely a cached inventory, not an active RPC link.

## Deterministic high-confidence selection

Implemented as a pure function in `src/local-first/existing-dsh-projects.ts`:

- Explicit `/project dsh-<alias>` or `项目：dsh-<alias>` uniquely references an inventoried existing Workspace.
- Exact *unique* quoted display title combined with a clear operation, e.g. `继续《Project Title》项目`, counts as high-confidence selection. Duplicate titles require disambiguation by stable alias.
- `继续之前项目` is acceptable **only when the user has previously confirmed a per-conversation binding**; this binding must be durable and verified against the 3080 inventory before being used. Current helper accepts such a binding, but 3083 is **not yet persisting it from chat**.
- Ordinary approximate language, a word in a large prompt, embedding similarity, directory basename, or mere recency NEVER grants an existing Workspace or Session. Ask a short clarifying question instead.
- `/new-project <id>` or `新建项目：<id>` signals a new-project **request**, not permission to create a directory or mutate the 3080 registry. The parent location, project name, initial setup and effects require explicit approval.

## Important current state

At the DshExecutor Ticket-preparation boundary, choosing an imported 3080 project **fails closed**, rather than starting a disconnected snapshot worker. This is intentional until a strictly authorized *client-side* 3083 → 3080 Session delegation implementation is verified. The underlying 3080 host intentionally continues to allow anonymous LAN access. The Git/non-Git snapshot Worker from `docs/011-local-project-workers.md` remains a **separate, opt-in path for explicitly registered staging project directories**. It cannot preserve historical DSH Session context and is not a replacement for original-host continuation.

Future delegate acceptance must prove: official DSH 3080 Workspace/Session listing under its existing anonymous-LAN trust model, exact Session chosen or newly created in existing Workspace; permissions maintained, model path policy confirmed, durable idempotent request IDs, clear delivery receipts, no double-writing into same Workspace, no accidental cloud API, no leakage of other Sessions, restart recovery, prompt-to-response correlation and a safe manual revoke/rollback. Do not switch live Weixin routing until real host checks pass.

## Verified Stage C0 results (2026-11-08, aggregate only)

The operator's private C0 report is not checked in; it includes private filesystem paths and host settings. Verified non-identifying facts:

- DSH CLI checkout version `0.2.2-alpha.2`, existing 3080 process bound to **0.0.0.0**, rather than loopback. `allowUnauthenticated: true` together with a trustedHosts fence means local `POST /api/...` clients are accepted as owner without a login token or cookie. An absent Origin header was accepted. **Origin checking is not authentication. The operator explicitly requires retaining this LAN-accessible anonymous owner model** and accepts its trust implications. Therefore do not propose or perform a loopback-only rebind, mandatory login, disabling `allowUnauthenticated`, trustedHosts changes, or LAN firewall/ACL restrictions in this workflow. Keep 3083's *own* bridge restricted to a literal loopback target and tightly gate which existing Sessions it can target; these client-side protections do not change the host-wide LAN trust model.
- The official WorkspaceController has **no unary list** operation. It enumerates using the `workspace/follow` baseline from the `/api/remote.mux` stream. DSH SessionController **does** expose `session/list`, `session/prompt`, `session/selectModel` and `session/wait`; `session/history` is not a valid endpoint.
- Inventory: **27 Workspaces / 841 Sessions**, of which 214 are Workspace members and 627 are standalone. 20/27 Workspaces contain multiple Sessions; there are 286 `migration-required` Sessions. These require the operator to choose a specific Session and forbid automatic migration/rebinding of histories.
- The existing DSH host's default Qwen provider goes **directly to vLLM**, bypassing the 8123 one-slot proxy used by 3083. Some saved Sessions select cloud providers, and some request `danger-full-access`. Never use a global default or a mere project title as approval. **Do not automatically call `session/selectModel`** to change old Sessions: in the verified SDK, that call also attempts to save a new default. Changing provider routes needs explicit user consent and a rollback plan.
- The C0 run never prompted an existing Session or restarted services. Its private, owner-only `DSH-CATALOG.json` is the source of Workspace/Session membership; never upload it.

## Guarded adapter (mock-tested source, not live integrated)

`src/local-first/dsh-3080-bridge.ts` now implements precisely the reported unary RPC wire: `POST http://127.0.0.1:3080/api/session/list` or `.../session/prompt`, with `{type:"client-request", rpcId, method, payload:{args:{_request:{...}}}}`, matching `server-response` and `rpcId` checks. It is a **library not mounted on the current live Weixin path**. It accepts *only* the exact 127.0.0.1:3080 origin, does not use cookies/launch tokens or imply the remote's owner trust is secure authentication, and exposes no general RPC passthrough.

Read-only preflight from a specific imported Workspace/Session must verify that the Session is still listed, is a member of the original Workspace, is not busy or a subagent, is of current persistence format (no implicit migration), has the `workspace-write` permission preset, and selects precisely the approved local Qwen provider/model. Any absent or uncertain projection blocks. Actual delivery requires independent manual approval, an **explicit allowed Session ID**, an enabled bridge, verified access through the **one-slot model queue proxy**, and a host-specific route audit callback. The current 3080 host's direct-to-vLLM route **fails this precondition**; no real prompt will be sent by default.

A stable `requestId` is derived from exact Session ID plus original Weixin message ID; retrying an ambiguous network request with the same ID relies on the SessionController's durable deduplication. `session/prompt` replies only `accepted:true` when the message enters the original Session's inbox; that **does not prove task completion or provide an assistant reply**. Correlating output via the original Session's state/wait or follow stream is still to be implemented and must not forward unrelated Session history.

**Read-only private host audit (does not send prompts):**

```bash
node --experimental-strip-types scripts/probe-dsh-3080.mjs \
  --catalog "$HOME/.dsh-superagent-private/DSH-CATALOG.json"
```

It can also inspect one **known** Workspace alias and Session ID with `--project` and `--session`; output only counts and refusal reasons, not original private paths or history.


## Stage C1 host acceptance and remote continuation-output safeguards (2026-11-08)

- C1 checked out the earlier tip `c406fce` and reported **21/21** standalone Node tests passing, while `pnpm check` had a single missing-JSDoc failure on `DshBridgeBlocked`. Remote code now contains the JSDoc; **do not claim the later head is CI-green until separately verified**. C1 also confirmed the macOS realpath and numbered-doc fixes.
- DSH 3080 remained at the operator-required `0.0.0.0:3080` with **unchanged LAN anonymous owner access**. This behavior MUST be preserved; client-side safety restrictions belong solely to the 3083 bridge. The historical 27 Workspaces / 841 Sessions were neither mutated nor prompted.
- C1 found that old `scripts/probe-dsh-3080.mjs` incorrectly looked for `modelSelection.provider`, but official DSH projections actually expose **`modelSelection.lastUsed` and `modelSelection.next`**. A Session's historical `lastUsed` is not proof of its next model. Remote code now reads `next` only for *authorization*, and the audit CLI reports separate counts. A fresh current-format `session/projections` baseline is required instead of relying on potentially stale `session/list` cached hints. Absent/unknown `next` blocks real prompts.
- The future approved **test-only** queue provider can be named `llm-local-proxy`, but must be separately configured and verified in the real DSH host; the adapter does not create it. User consent is required before any 3080 profile change, controlled restart or call to `session/selectModel`. The latter may also save a changed global DSH default. **No change to 3080's LAN listener, authentication or trustedHosts is requested or permitted.**
- `src/local-first/dsh-3080-bridge.ts` now offers only allowlisted, bounded `session/state`, `session/wait` and `session/page` readers in addition to guarded `session/list`, exact `session/projections` and `session/prompt`. Prompt submission requires a caller-provided **durable `persistBeforeSend` hook** to save the original Weixin Trigger, original DSH Workspace + Session, stable `requestId` and pre-prompt Session event cursor before any network send.
- `src/local-first/dsh-3080-output.ts` is a pure event correlator. It compares the post-prompt wait cursor with a same-cut `session/page`, finds the exact `user/message.source.rpcId`, refuses an intervening different user's prompt, and requires a successful `turn/end.reason.kind === "completed"` plus assistant message text. Timeout, human-input-needed, failed/aborted turns, missing/truncated history and unexpectedly large output produce **no reply**. Only visible `message.content` text is used, never reasoning blocks. `continuationWeixinReply` derives a stable Outbox reply ID and uses the peer, message ID and context token from the **original stored Weixin Trigger**, not LLM output. This code is **not live-wired** to 3083 or 3080: no cross-instance real prompt or Weixin reply has yet been accepted.
- A future live owner must first durably store and resume pending delivery records in 3083 SQLite, handle expiration of the native Weixin context token, avoid resending messages on ambiguous outcomes, and use DSH Outbox transactional receipts for idempotent delivery. Code-only correlation is not a substitute for that integration. No automatic forwarding of old Session history is permitted.


## Stage C2 acceptance and Stage C3 opt-in relay integration (2026-11-08)

The local Agent tested commit `d98da43` in a separate worktree: `pnpm check` **1205/1205 PASS**, five offline Node test files **35/35 PASS**. This confirms only mock behavior, not production 3080 continuation or real Weixin result delivery. Read-only 3080 inventory remained 27 Workspaces, 841 Sessions (286 migration-required). The corrected model projection audit reported 551 historical local-Qwen uses, 552 local-Qwen NEXT selections, 289 unknown/different NEXT selections and 76 historical cloud-provider selections. These overlap; do not sum them to infer the number of cloud-next Sessions.

**New code after C2 (Stage C3, NOT yet accepted or deployed):**

- `src/local-first/dsh-relay-store.ts` creates optional additive tables **in the 3083 Superagent SQLite only when explicitly instantiated**; it does not open the 3080 database. It keeps exact original Trigger/Workspace/Session/cursor/requestId, one-shot grant claims, idempotent admission status and human-confirmed per-Weixin-thread binding. It never copies existing 3080 Session history, stores no duplicate contextToken, and does not automatically resubmit uncertain prompt outcomes. On completed, exactly correlated output it commits an Outbox reply and the receipt status atomically. A missing original inbound token or token older than the local conservative five-minute reply ceiling stops automatic delivery.
- `src/local-first/dsh-relay-routing.ts` uses a private 0600 operator grant: exact peer, message content SHA256, project alias, real Session ID, time limit and approvalId. A multi-Session Workspace needs an exact `/session` selector or a durable prior confirmed binding; nothing infers Session identity from fuzzy wording. A fresh 0600, session-specific, manual 8123 route attestation is required for delivery, not merely an environment variable claiming success. The attestation is time-bound and should be re-verified against real queue logs by the eventual authorized host test.
- `src/local-first/dsh-relay-coordinator.ts` is instantiated by Runtime **only when** `DSH_SUPERAGENT_DSH_RELAY_APPROVAL_FILE` points to an owner-only operator grant. Otherwise `nativeWeixinKind` behaves as before. It independently rechecks the native Weixin Source allowlist and DSH Policy member list. For a matching approved Trigger, it persists the source and claims the grant in SQLite before the Weixin source advances its read cursor; this avoids sending the same message to both the usual Engine and original DSH. A durable `dsh-relay` effect performs an explicitly authorized one-shot `session/prompt` (after preflight, positive queue attestation and durable receipt), then read-only output correlation. After restart, a prepared or uncertain receipt is reconciled **read-only**, never automatically re-prompted.
- A new `expiresAt` field on these relay-specific Weixin Outbox Channel addresses causes an expired attempt to settle as `gone` without attempting a network send; the rest of the native Weixin Source is unchanged. Expired results require an explicit new human follow-up. **No silent token refresh or contextToken substitution** is implemented.
- Offline tests: `tests/local-dsh-relay-store.node-test.mjs`, `tests/local-dsh-relay-routing.node-test.mjs`, and `tests/local-dsh-relay-coordinator.node-test.mjs`, plus a Vitest regression for expired native Weixin tokens. GitHub macOS/Linux Node tests were extended; newer-head CI status is still unverified.

**Operational rule:** the operator has NOT supplied any relay approval grant or authorized the three production gates: test-only 8123 provider + Session model selection, controlled restart(s), and an actual one-message disposable original Session prompt. The current 3080 host still uses direct vLLM and must not be automatically retargeted. Only the local Agent's next `LOCAL_AGENT_STAGE_C3.md` offline pass may exercise the new code with fakes; no current running service is changed.

The original 3080 LAN anonymous owner access is **required and must remain intact**: `0.0.0.0` bind, `allowUnauthenticated:true`, trustedHosts and existing LAN clients. Client-side relay loopback limits do not change server accessibility.

## Stage C0 handoff

1. Keep 3080, 3083 and 8123 **running and untouched**. Use only read-only inspection of 3080 Workspace + Session controllers, plus the offline inventory validator.
2. Report how many Workspaces/Sessions exist, the supported API methods, current access-control policy, selected model/provider per Session if readable without mutation, and whether Sessions are busy. Redact identifiers and paths from the shared report; keep the detailed mapping only on the operator's Mac.
3. Treat 3080's **already tested** local anonymous-owner RPC transport as the contract. Verify the 3083 client adapter uses only the literal loopback target and requires user-selected Session allowlisting, without changing the 3080 server's LAN accessibility.
4. The remote ChatGPT implements and tests the **client-side controlled** adapter before any message is forwarded from Weixin to an existing 3080 Session; do not describe the 3080 host as cryptographically authenticated.
5. Only after that, request approval for a single disposable test Workspace/Session delegation. Never initiate the test by changing an existing valuable Session.


## Gate①.5 / Gate①.6 Phase A and C4 offline code (2026-11-08)

**Host evidence, without mutation:** Gate① introduced a *test-only* `llm-local-proxy` provider on the existing 3080 host, visible in official `session/modelCatalog` after normal hot reload, pointing to the existing single-slot 8123 local proxy. The original default `cmp170hx/Qwen3.8-Flash-Next/xhigh`, 3080 anonymous LAN access, original `cmp170hx` route, other services and all historical Workspaces/Sessions remained unchanged. No Session was selected, and no prompt or real model inference was made. Gate① report: `agent-reports/REPORT-gate1-3080-provider.md`.

**Settings restore contract verified, not actually exercised:** Gate①.5 inspected the installed 0.2.2-alpha.2 source and verified that `session/selectModel` changes the specific Session's `next` model and schedules a separate asynchronous global-default save. `SessionPromptRequest` has no per-request model override. Official `settings/describe` and `settings/replace('agent-default-model', fullUserSection, expectedRevision)` provide an independent revision-guarded default restoration mechanism, but the live switch+restore sequence has **not** been executed. No disposable original Session has been operator-designated. Report: `agent-reports/REPORT-gate1-5-session-readiness.md`.

**Reasoning metadata blocked until a separately approved tiny profile edit:** Installed DSH schema puts `reasoningEfforts` under `models[]`, not at the provider route level. Today's `llm-local-proxy` has no advertised reasoning effort. Gate①.6 Phase A proved a proposed *two-field* move of `low` and `high`, offline only, and preserved a post-Gate① rollback baseline that includes `llm-local-proxy`. No model reasoning metadata has been changed on the real host yet. `xhigh` is not offered for this route; even moving low/high does not prove the 8123 backend accepts them during real inference. Report: `agent-reports/REPORT-gate1-6-phase-a.md`.

**New remote implementation (source and mock tests, not installed in running services):**
- `src/local-first/dsh-3080-model-gate.ts` supplies a narrowly typed, injected-port-only state machine for an **operator-designated disposable Session**: durable private original-default snapshot, live sequenced Session and catalog rechecks, exactly one selectModel, observed asynchronous shared-default save, `settings/replace` with the current `expectedRevision`, and repeated readback. Default drift, an ambiguous RPC, competing settings revision or missing save is a hard manual-recovery stop; it never blind-retries selectModel or prompts. It has **no live RPC transport** and is **not wired into 3083**.
- `src/local-first/dsh-3080-new-workspace.ts` supplies an **operator-only new-project** pipeline. Its injected port must safely create a previously nonexistent directory under an approved canonical parent, call original DSH `workspace/create` and `session/create`, durably record each stage and verify the new Session is a member of the *new* original Workspace. It does not copy any old Session or workspace; uncertain writes require manual reconciliation instead of retries. It has **no host filesystem or RPC implementation** and is **not wired into Weixin**.
- `tests/local-dsh-3080-model-gate.node-test.mjs` and `tests/local-dsh-3080-new-workspace.node-test.mjs` exercise both modules with fakes and are included in Linux/macOS CI. First combined code result: `fda9b34`, GitHub Actions run 168, three jobs success. Later commits must be checked independently.
- The stable `LOCAL_AGENT_TASK.md` now points to **C4 OFFLINE code acceptance**, not the obsolete Gate① live-provider task. Full reports continue through `agent-reports/` GitHub pushes, never by operator copy/paste.

**Remaining real-world acceptance gates:** (1) explicitly approve Gate①.6 Phase B provider reasoning metadata fix; (2) explicitly approve a *new, disposable* original 3080 Workspace/Session and precise model switch/default restore; (3) only then separately authorize one actual 8123-routed prompt and verify event-to-Weixin output under the existing one-shot grant. No restart currently needed for provider visibility, and Gate② remains independently unapproved. No old historical Session may be used as a disposable test merely because it is idle.

**Status:** Weixin chat/reply through 3083 is previously verified; original 3080 historical-Session continuation and native new-project E2E remain **NOT RUN**. Do not promote C4 mocks to production claims.
