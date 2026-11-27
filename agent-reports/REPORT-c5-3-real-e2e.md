# REPORT — C5.3 one-shot real native Weixin → original DSH 3080 → local Qwen 8123 → native Outbox

Code-under-test SHA: `97ed04452c959e6e82ccf689d15ebbc1808597ee` (fresh worktree; all prior worktrees preserved).
**Verdict: `NOT_SUBMITTED`** — exactly one real Weixin message arrived, the relay correctly fail-closed (exact-SHA256 mismatch caused by WeChat quote normalization), the prompt count remained 0, the message was handled by the ordinary Engine path, and the run was stopped and fully restored per the one-shot rule (no retry, no second prompt, no second message).

## Gate A — exact-SHA offline acceptance: PASS

- GitHub CI on the exact SHA: run **195** `Local-first core tests` conclusion **success** — jobs `dsh-typecheck-and-build`, `macos-portability`, `local-first-core` all green.
- `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (tsc clean, build ok, Vitest **62 files / 1208 tests passed**, incl. the new `tests/outbox.spec.ts` 4/4 covering the at-most-once claim).
- 13 relevant standalone Node suites combined run: **89/89 PASS, exit 0** (bridge 14, operator-rpc 10, relay-store 11, relay-routing 6, relay-coordinator 5, output 9, probe 1, new-workspace 6, model-gate 9, operator-provision 4, projects 3, project-workspaces 6, weixin-native 5). No failures; `BLOCKED_CODE` not triggered; no local source patches.
- Source review confirmed all Gate A.3 items: `Dsh3080Bridge.call` sends `args._request` ONLY for `session/list` and `args.request` for projections/state/wait/page/prompt; `session/page` request is `{address:{kind:'session',sessionId},throughSeq,maxMessages}` (inclusive cut); `session/state` response has top-level `cursor`; wait returns `{reason,state,output}`; prompt static descriptor `{requestId,sessionId,mode:'queue',content:[{type:'text',text}]}`; `inspect()` + bounded page preflight run BEFORE the durable receipt reservation and dispatch; a consumed approval can never re-arm; relay is default-OFF without the private 0600 grant env. Outbox: `store.receipts.claimOneShotSend(id)` persists `singleSendAttemptAt` in durable SQLite **before** `sources.send` for guarded `dsh-3080-reply-<40hex>` ids; a consumed claim returns silently (no re-send across retry/restart/ambiguity); pending attempted sends remain for manual review.

## Gate B — private baseline + read-only preflight: PASS

- Owner-only 0700 baseline (0600 files, checksums) before staging: 3080 pid 1482 listener `*:3080` (unchanged start time), 3083 pid 7098 + full launch env snapshot, 8123 pid 90215 + upstream env (sanitized), profile checksum, pre-staging bundle symlink target, `.backup` of orchestrator SQLite, row counts (outbox 3 / trigger 8 / effect 0 / relay-approval 1 consumed old-C5 row / relay-receipt 0 / relay-terminal table absent pre-migration), cursor + credential state, disposable five-step ledger + exact Session ID, original shared default `rev 17 = cmp170hx/Qwen3.8-Flash-Next/xhigh`. No drift found.
- Disposable Workspace→Session verified via the private ledger + official `workspace/follow` stream: exact membership (1 Workspace → 1 Session), canonical cwd, no historical Session ID collision, `formatStatus:current`, not a subagent, `blank:true`, `running:false`, queue empty, pendingInput empty; validated the actual `session/projections.values.permissions.currentValue = "workspace-write"` and exact sequenced `modelSelection.next = {llm-local-proxy, Qwen3.8-Flash-Next, high}` (asOfSeq 3). No `BLOCKED_PREFLIGHT_PERMISSION_OR_MODEL`.
- Independent read-only `session/state`: cursor 3 (safe integer), idle, queue `[]`, pendingInput `[]`; bounded inclusive-cut `session/page` at the same cut: `cursor===throughSeq=3, hasMore:false, records=4` — matches C5.2-verified shapes; installed descriptors re-checked. No `session/prompt` called in this gate.
- Live catalog: `llm-local-proxy/Qwen3.8-Flash-Next` advertises `reasoning.efforts` `[low, high]`, `failures: []`; 8123 `GET /v1/models` → exactly one model (200 with client key, 401 unauthenticated); single-slot queue provenance (pid + upstream env) matches the `llm-local-proxy` baseURL `http://127.0.0.1:8123/v1`; no cloud fallback; global default unchanged. Route attestation possible → no `BLOCKED_ROUTE_ATTESTATION`.
- Paired native Weixin bot/account + allowed peer confirmed; BOTH allowlists verified from durable state (native `source:weixin` block `allowedPeers` row + DSH policy/`channelAllowed`); no QR re-pairing, no simulator; relay route OFF with no grant loaded (3083 original env has no `DSH_SUPERAGENT_DSH_*` vars).
- Replay-safety: old C5 `approvalId` row still present and consumed, prior `dsh_relay_approval` record intact, effect queue empty, no pending Outbox duplicate (all 3 replies `sent`). Nothing could cause a second prompt.

## Gate C — NEW one-shot grant + controlled staging: PASS

- Full existing-Dsh catalog regenerated read-only from the official `workspace/follow` stream (29 Workspace rows observed at that moment, including the disposable one; a pre-existing 0700 catalog was stale — its alias was recomputed from the current projection so the alias check passed: `projectId` matches the deterministic `dsh-`+sha256(hostId:workspaceId) 16-hex formula).
- NEW private `approvalId` unique to C5.3 (`c53-relay-…`), bound to the exact disposable Workspace+Session, the operator's allowed peer, `operation:'prompt'`, `operatorApproved:true`, NEW two-line test text UTF-8 SHA256, 6-hour expiry; text handed to the operator privately (never published). Both files persisted 0600/fsync.
- Fresh private route attestation (5-minute freshness honored by a continuous refresher during the live window). Guarded real `Dsh3080Bridge` instantiated with exactly the approved Session ID + verified route file; **read-only `inspect()` ONLY: `allowed:true, reasons:[]`, exact next/permissions/workspace-membership verified** — no prompt during the check.
- Controlled staging: no active 3083 conflict (effect 0, outbox pending 0); bundle symlink swapped to the exact tested-SHA worktree; single controlled restart with the private grant/attestation env. New pid 32467, loopback 127.0.0.1:3083 listener, native pairing + allowlist state preserved, cursor continuity (WAL intact), Outbox unchanged (3), no duplicate inbox polling; 3080 pid 1482 and 8123 pid 90215 listeners UNCHANGED throughout.

## Gate D — one real inbound: FAIL-CLOSED at exact hash; prompt count 0

- Exactly ONE genuine native Weixin Trigger arrived (fresh original `messageId`, fresh `contextToken`, addressed=direct, human=true, correct peer, correct `/project <alias>` line): relay `receipts=0`, no terminal row, `dsh_relay_binding` 0, approval NOT consumed.
- Root cause: **WeChat normalized the ASCII straight quotes in the prepared second line into full-width curly quotes during sending/receive.** Grant hash `e5c145a1…9036f9` (computed over the prepared two-line bytes) vs received-text hash `0c97e8c7…baae65b` → exact-SHA256 match failed → the relay's fail-closed gate rejected routing, so the message continued through the UNCHANGED Engine path. Disposition `fanout:[]`, decision `ignore`, ONE ordinary Outbox reply (a short acknowledgement matching the expected verification sentence) with status `sent` — the operator received it. This is exactly the documented non-relay behavior; no duplicate Ticket/decision, no double dispatch, no relay grant consumption.
- Real `session/prompt` count this run: **0** (only `inspect()` and read-only observation were invoked; the prompt was never manually invoked outside the relay, and dispatch was never reached).
- No inference was attributed to this run on 8123 relay path (0 relays dispatched); the Engine's own eval/reply used local Qwen through the existing shared queue (unrelated counters moved, recorded below). `singleSendAttemptAt` guard was NOT exercised this run (only guarded relay replies claim it; the Engine reply has a different id form).

## Gate E — restore + invariants: PASS

- Grant revoked by simply leaving 3083 restored to its exact pre-C5.3 bundle/env (single controlled restoration restart, pid 34295 now LISTENing 127.0.0.1:3083; bundle symlink verified back at the native checkout target). No old database snapshot restored over newly-consumed rows.
- Invariants asserted: 3080 pid/listener/`allowUnauthenticated`/trustedHosts/anonymous LAN behavior unchanged since before the run; 8123 pid/listener/proxy route intact; full global default section unchanged (`rev 17`, `cmp170hx/Qwen3.8-Flash-Next/xhigh`); historical Workspace/Session inventory untouched (only disposable Session may have gained the approved turn — it gained NOTHING this run: cursor still 3, idle); no new Workspace/Session from this agent; no provider/profile change. 3083 source cursor advanced only by the one real operator message (expected). Relay tables persist only the old consumed C5 approval row; effect queue empty; outbox 4 rows (the 3 historical `sent` + the 1 new Engine reply `sent`).
- Read-only probe deltas vs Gate B baseline: catalog workspaces 27 (unchanged), Sessions 845→847 (+2 — one new Workspace appeared on the host from unrelated operator activity during the window; no ID matches this agent's work), running 2→2, migration-required 286→286, `lastUsedLocalQwen` 554→556 / `nextSelectedLocalQwen` 555→557 (+1/+1 attributable to the Engine's own eval+reply of the one real message via the shared queue), `historicalCloudSelections` 76 unchanged, `readyForLivePrompt:false` unchanged. Attributed, no unexplained drift.

## Finding for remote ChatGPT (the fix that would have made C5.3 pass)

One-shot hash-exact grants written for human-typed Weixin text must anticipate the platform's punctuation normalization. Minimal reproduction: prepared line 2 contains ASCII `"…"`; the message that arrives contains full-width curly `“…”`; SHA256 over UTF-8 bytes then differs. Options (remote decides): compute the expected hash from a normalization-tolerant canonical form (e.g. normalize quote variants before hashing), instruct the operator to pre-type the curly form, or bind line 1 only + a text-contains check. Do NOT relax hash matching (task forbids it); fix in code.

## What was NOT RUN

- The one real `session/prompt` (count 0 → NOT_SUBMITTED; per the one-shot rule, NO retry was made despite the fixable cause).
- 8123 single-slot inference attributed to a relay request; original-Session completion correlation; guarded relay Outbox reply; `singleSendAttemptAt` claim path.
- No cloud call, no second message, no QR re-pairing.

## Evidence classes

GITHUB CI GREEN ON EXACT SHA (run 195) · MOCK PASS (89/89 node + 1208 vitest) · REAL READ-ONLY PREFLIGHT PASS (incl. guarded `inspect()` allowed:true) · REAL 3083 STAGING+RESTORE PASS · REAL WEIXIN INBOUND PASS (one message) · REAL RELAY SELECTION: FAIL-CLOSED CORRECT (hash mismatch) · REAL PROMPT: NOT RUN (0) · REAL RELAY INFERENCE/OUTBOX: NOT RUN.

Sanitized: no raw user content, IDs, credentials, private paths, or IPs; all raw values live only in the owner-only private evidence directory. Rollback status: fully restored, zero residual local changes (bundle/env/restart returned to pre-C5.3 state; grant unreusable; nothing re-armed).
