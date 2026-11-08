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

## Stage C0 handoff

1. Keep 3080, 3083 and 8123 **running and untouched**. Use only read-only inspection of 3080 Workspace + Session controllers, plus the offline inventory validator.
2. Report how many Workspaces/Sessions exist, the supported API methods, current access-control policy, selected model/provider per Session if readable without mutation, and whether Sessions are busy. Redact identifiers and paths from the shared report; keep the detailed mapping only on the operator's Mac.
3. Treat 3080's **already tested** local anonymous-owner RPC transport as the contract. Verify the 3083 client adapter uses only the literal loopback target and requires user-selected Session allowlisting, without changing the 3080 server's LAN accessibility.
4. The remote ChatGPT implements and tests the **client-side controlled** adapter before any message is forwarded from Weixin to an existing 3080 Session; do not describe the 3080 host as cryptographically authenticated.
5. Only after that, request approval for a single disposable test Workspace/Session delegation. Never initiate the test by changing an existing valuable Session.
