# REPORT — C5.2 offline acceptance + read-only wire-contract audit

SHA tested: `0901144db890ba989c9c35657cead94568640d1b` (branch `feat/local-first-wechat-foundation`; fresh worktree; previous worktrees preserved and untouched). Remote fix under test: `fa2ad48` ("real gateway envelopes, pre-prompt page gate, durable no-send terminal") — bridge now sends `payload.args.request` for every method except `session/list` (which keeps `_request`), adds a bounded read-only `session/page` preflight BEFORE `session/prompt`, and a durable `not-submitted` terminal for a consumed approval without a prompt.

## Stage A — exact-HEAD offline acceptance: PASS

- `pnpm install --frozen-lockfile` exit 0 (pnpm 11.7.0). `pnpm check` exit 0 (tsc clean, build ok; Vitest 62 files / **1206 tests passed**).
- All relevant standalone Node suites (isolated runs, each exit 0): `local-dsh-3080-bridge` 14/14 (method-specific envelopes now asserted per endpoint), `local-dsh-3080-operator-rpc` 10/10, `local-dsh-relay-store` 11/11 (incl. new "consumed approval without a prompt leaves durable idempotent no-send evidence" and "reserved pre-prompt receipt cannot be marked as not-submitted"), `local-dsh-relay-routing` 6/6, `local-dsh-relay-coordinator` 5/5 (incl. pre-prompt page gate and repeat-protection), `local-dsh-3080-output` 9/9, `local-dsh-3080-probe` 1/1, `local-dsh-3080-new-workspace` 6/6, `local-dsh-3080-model-gate` 9/9, `local-dsh-3080-operator-provision` 4/4, `local-projects` 3/3, `local-project-workspaces` 6/6, `local-weixin-native` 5/5. Combined run: **88/88, exit 0** (earlier C5 count was 87; +1 = new bridge envelope test).
- GitHub CI on the **exact SHA** 0901144: run 191 `Local-first core tests` — conclusion **success**, all three jobs green: `dsh-typecheck-and-build`, `macos-portability`, `local-first-core` (Linux + macOS + check, as required).
- No source repair attempted or needed; verdict BLOCKED_CODE did not trigger.

## Stage B — real installed DSH 0.2.2-alpha.2 read-only RPC contracts (no prompt, no inference)

All calls used the existing verified disposable Session only (private ID retained locally); no long-polling beyond a bounded 1.5 s `timeoutMs`.

1. **`session/state`** — envelope `args.request:{sessionId}`. Real `result.value` schema (sanitized): `{cursor:number, active:boolean, running:boolean, queue:null|array[{id,placement(queued|steering|context),rpcId,content[]}], pendingInput:array["approval"|"question"|"other"]}`. Live idle readback: `cursor=3, active=true, running=false, queue=[], pendingInput=[]`. NOT wrapped in `kind:'sequenced'` (that wrapper belongs to `session/projections`); the cursor is a top-level `cursor` number. Bridge `sessionCursor()` reads match this location. PASS.
2. **`session/wait`** — descriptor param `{sessionId (required), timeoutMs?, afterSeq? (exclusive output cursor), maxMessages?}`. Response: `{reason: "idle"|"input-required"|"timeout", state: {…same shape as session/state…}, output:{records[], truncated:boolean}}`. Live idle readback: `reason:"idle"`, state as above, `output.records=[]`, `truncated=false`. PASS.
3. **`session/page`** — resolved from installed source (`packages/api/session-controller/lib/typert.host.js`, descriptor at `src/index.ts:529`), not guessed. Request param `request:{address:{kind:'session',sessionId} | {kind:'subagent',parentSessionId,childSessionId,mode}, throughSeq? (INCLUSIVE log cut; omission selects observed log end), beforeSeq?, maxMessages?, turnWindow?:{minMessages,minTurns}}`; `address` required, strict codec. Response `SessionEventsPage`: `{cursor:number, records:array[{type:'event',event:{type,seq,time,data,ignorable?,sourceEventSeqs?,surfaceOp?}}], hasMore:boolean}`. ONE bounded read-only success demonstrated at a safe cursor: `throughSeq=3,maxMessages=64` → `cursor=3, hasMore=false, records=4` (event types: `permission/preset`, `sandbox/mode`, `approval/policy`, `model/selection`, seqs 0–3); second bounded probe `throughSeq=2,maxMessages=4` → `cursor=2, hasMore=false, records=3`. Pagination/seq semantics: cursor equals the inclusive cut actually covered; `hasMore` is boolean; a read-cut is guaranteed only when `throughSeq` is supplied (omission picks the live log end, which drifts). Verdict **RESOLVED** — the earlier `BLOCKED_PAGE_PROTOCOL_UNKNOWN` condition no longer applies; the bridge's new preflight (`cursor===afterSeq && hasMore===false && records.length≤2000`) matches the demonstrated live response shape exactly. My earlier failed `cursor:{position,limit}` guesses were wrong because `page` takes `address`+`throughSeq`, not a cursor object (recorded for the remote's test-assertion lane). PASS.
4. **`session/prompt` — STATIC ONLY (never called)**: descriptor param `request:{requestId (client-minted, persisted on the accepted user message), sessionId, mode:"queue"|"steer", content:[{type:'text',text}|{type:'image',mediaType,data,name}|{type:'file',receiptId}] (≥1 part), clientTimeZone?}` — strict codec; result `{accepted: true}` (`additionalProperties:true`). PASS (static).
5. **Host invariants (read-only)**: 3080 listener `*:3080` pid 1482 unchanged since Nov 6; 3083 `127.0.0.1:3083` pid 7098 (restored env from C5); 8123 `127.0.0.1:8123` pid 90215 unchanged since Nov 8; anonymous-LAN/allowUnauthenticated unchanged; global default model unchanged (`rev 17`, `cmp170hx/Qwen3.8-Flash-Next/xhigh`); disposable Workspace/Session still idle with `next=llm-local-proxy/Qwen3.8-Flash-Next/high`; read-only probe deltas versus the C5/C5.1 baseline: **all values identical** (Workspaces 27 catalog / 28 stream, Sessions 845, running 2, migration 286, local-Qwen last-used 554 / next 555 / unknown 290 / cloud 76, `readyForLivePrompt:false`) → zero drift. PASS.

## Zero-change rollback verification

No writes occurred this run: no product-code edits, no profile/default/SQLite mutation, no restart, no Workspace/Session creation, no Weixin message, no prompt, no cloud call. Only artifacts created are local-only private evidence files (owner-only dir) and this report's publishing worktree. Verified by the invariants above.

## Unknowns / remaining conditions for the next E2E (NOT started)

- `session/prompt` real behavior remains unproven (static-only by design; C5 blocked before any call).
- 8123 upstream acceptance of `low`/`high` reasoning effort values on the proxy route — untested.
- Next E2E requires ALL of: remote code changes if any + a NEW independent one-shot human authorization (the C5 grant is consumed), a fresh route attestation, and an explicit one-real-prompt + one-reply authorization. Do not reuse the old runbook stages.

## Evidence classes

GITHUB CI GREEN ON EXACT SHA (run 191). MOCK PASS (88/88 + Vitest 1206). REAL READ-ONLY RPC OBSERVATION PASS (state/wait/page on the existing disposable Session). REAL page PROTOCOL RESOLVED (descriptor + one bounded live success). REAL PROMPT: NOT RUN (static only). REAL WEIXIN RETURN: NOT RUN.

Sanitized: no real user messages, private paths, tokens, internal IPs, or raw Session content appear in this report; raw IDs/IPs/paths are retained only in the private owner-only evidence directory.
