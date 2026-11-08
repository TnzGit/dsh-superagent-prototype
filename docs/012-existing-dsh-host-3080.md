# 012 — Reuse existing DSH host on Mac port 3080 (authoritative workspaces and sessions)

> Decision update: the operator already runs an ordinary DeepSeek Harness instance on 127.0.0.1:3080 with valuable existing work. **It is NOT part of the native Weixin 3083 runtime yet.** The system must preserve these Workspace IDs, original file trees, Session IDs and chat history rather than silently creating a parallel replacement.

## Two independently owned hosts

- **DSH 3080** remains the authoritative host for the operator's historical Workspaces, Sessions, model/tool settings, live turns and disk paths. Do not change its DSH_HOME, profile, port, persistence store, Session log, or filesystem without an explicit user-approved handoff.
- **DSH Superagent 3083** already owns the live native Weixin ingress, Policy and Outbox; its proven local Qwen path goes through 127.0.0.1:8123. It must not open 3080's session storage concurrently, copy logs into its own profile, call arbitrary Session tools, or imply a new Ticket worker has resumed a historical Session.
- **Actual continuation** should use the existing 3080 host's supported, authenticated Session API, once its exact version, access-control transport, workspace/session enumeration and permission semantics have been verified on the operator's Mac. DSH publishes Workspace/Session controllers in `@deepseek-ai/dsh-api-workspace-controller` and `@deepseek-ai/dsh-api-session-controller`. Use official methods and existing access controls. Do not guess an HTTP endpoint, forge a UI Cookie, inject browser code, or bind an unauthenticated local TCP route.
- **New projects** should be created under an operator-approved parent, registered in the owning DSH Workspace registry through the official API, and should begin in a fresh Session. Never reuse old Session history for a new project. Do not use the 3080 instance's directory as an implicit scratchpad.

## Workspace IDs and sessions are different identities

Each official `WorkspaceView` contains `workspaceId`, canonical `path`, `title`, `sessionIds`, and timestamps. A Workspace is a persistent record of a directory, while a Session holds a separate historical conversation/Agent state. Matching a Workspace does not identify which prior Session should continue if the Workspace holds multiple Sessions. Ask for the exact Session, or offer a new Session in the SAME existing Workspace with original files intact. Never let the model choose an old Session just because it was most recent.

## Read-only inventory (Stage C0, before changing any running host)

Ask the local Agent to use the official authenticated **read-only** Workspace and Session APIs available in the already-installed DSH 0.2.2-alpha.2 and its legitimate user session. Do not install a second DSH, load a plugin into port 3080, stop it, restart it, or query its SQLite/JSON session history directly. If the Host API requires app login or has different method names, stop and report the exact public type signatures instead of inventing an endpoint.

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

At the DshExecutor Ticket-preparation boundary, choosing an imported 3080 project **fails closed**, rather than starting a disconnected snapshot worker. This is intentional until an authenticated 3080 Session delegation implementation is available. The Git/non-Git snapshot Worker from `docs/011-local-project-workers.md` remains a **separate, opt-in path for explicitly registered staging project directories**. It cannot preserve historical DSH Session context and is not a replacement for original-host continuation.

Future delegate acceptance must prove: DSH 3080 authenticated Workspace/Session listing, exact Session chosen or newly created in existing Workspace; permissions maintained, model path policy confirmed, durable idempotent request IDs, clear delivery receipts, no double-writing into same Workspace, no accidental cloud API, no leakage of other Sessions, restart recovery, prompt-to-response correlation and a safe manual revoke/rollback. Do not switch live Weixin routing until real host checks pass.

## Stage C0 handoff

1. Keep 3080, 3083 and 8123 **running and untouched**. Use only read-only inspection of 3080 Workspace + Session controllers, plus the offline inventory validator.
2. Report how many Workspaces/Sessions exist, the supported API methods, current access-control policy, selected model/provider per Session if readable without mutation, and whether Sessions are busy. Redact identifiers and paths from the shared report; keep the detailed mapping only on the operator's Mac.
3. Report whether the existing 3080 process may be reached through an authenticated local client transport by 3083, or whether it needs a separately authorized extension. Do not assert such a bridge exists until tested.
4. The remote ChatGPT implements the missing authenticated adapter and tests before any message is forwarded from Weixin to an existing 3080 Session.
5. Only after that, request approval for a single disposable test Workspace/Session delegation. Never initiate the test by changing an existing valuable Session.
