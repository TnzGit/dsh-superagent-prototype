# REPORT — C5 real end-to-end (Weixin → original DSH 3080 → 8123 → native Outbox)

Date: 2026-11-08/09 (Asia/Shanghai). Starting SHA: `5ec2888f024713e7ac13114f35db88033a865913` (fresh worktree `.worktrees/stage-c5`; no prior worktree was reset or overwritten).

## Overall verdict

`REAL_E2E_BLOCKED_AT_BRIDGE_PREFLIGHT` — every offline gate, every mutation gate, and the real Weixin inbound + one-shot relay selection succeeded; the real prompt to 3080 was refused by the bridge's RPC envelope (`payload.args._request` vs the live gateway descriptor, which requires `args.request` on `session/projections`/`session/prompt`/`session/wait`/`session/page`). Zero prompts were submitted to the real Session, zero replies sent; the one-shot approval was consumed by the failed attempt chain and the five-minute fresh-reply-context window elapsed, so no second live attempt is possible without a new operator grant and a remote fix. **Product code was NOT edited locally** (per protocol); the defect is handed back below with a minimal reproduction.

## A. Code acceptance on the exact SHA (MOCK PASS)

- CI same-SHA: push run **188 success** (`Local-first core tests`); `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (tsc clean, Vitest 62 files/1207 tests, build ok).
- 13 standalone Node suites (operator-rpc 11, operator-provision 13, model-gate 9, new-workspace 7, relay-store 10, relay-routing 7, relay-coordinator 8, 3080-bridge 13, 3080-output 10, 3080-probe 1, projects 6, workspaces 5, weixin-native 8): **87/87 PASS, exit 0**.
- NOTE the gap: the bridge mock asserts `payload.args._request` (e.g. `tests/local-dsh-3080-bridge.node-test.mjs:22,54`), so the mock lane is green while the live gateway rejects exactly that shape — see F.

## B. Private baseline and backups (Stage 0)

Owner-only dir `~/.dsh-superagent-private/c5/` (0700): `patch.postgate1.bak` (post-Gate① profile, sha256 `14d90ecf…`, 45845 B), `settings_describe_before.json` (agent-default-model rev 15, user `cmp170hx/Qwen3.8-Flash-Next/xhigh`), `sqlite_pre_vacuum.sql` (VACUUM before/after), `staging3083-before-restart.json` (full `ps eww` env snapshot), `disposable.json`, `rollback-stage3.json`, `relay-approval.json`, `route-attestation.json` (all 0600, fsynced). PIDs/ports recorded: 3080 pid 1482 (`0.0.0.0`, allowUnauthenticated), 3083 pid 11594, 8123 pid 90215. All unchanged until the authorized 3083 restart.

## C. Gate①.6 Phase B — metadata relocation (REAL CONFIG, hot-applied)

Moved the two-key `reasoningEfforts` map (`low: low`, `high: high`) from the route level into the single `models[]` entry of provider `llm-local-proxy` (byte-exact patch, verified 1 occurrence). No restart (3080 pid unchanged). Readback `session/modelCatalog`: `llm-local-proxy/Qwen3.8-Flash-Next` now advertises efforts `[low, high]`, `failures: []`, global default remains `cmp170hx/Qwen3.8-Flash-Next/xhigh` (rev 15→…→17 consistent). 8123 wire acceptance of `low`/`high` remains unverified (no inference was performed before the relay blocked).

## D. Disposable Workspace/Session (REAL 3080, official APIs)

Canonical 0700 parent outside every Workspace; slug `dsh-e2e-<date>-<rand>` (private). One-shot order followed: durable claim → fsynced `planned` → exclusive `mkdir` → `workspace/create` (`created:true`) → `session/create` (exactly ONE new ID) → official `workspace/follow` stream shows exactly the new Session in the new Workspace (28 workspaces total, +1). Workspace/Session IDs private. Ledger: planned, directory-created, workspace-created, session-created, session-verified.

## E. Model switch + default restore (REAL 3080)

Exactly ONE `session/selectModel` (`llm-local-proxy/Qwen3.8-Flash-Next/high`) on the disposable Session: rollback record fsynced BEFORE mutation (rev 15, session `next`/seq, catalog snapshot). Sequenced `next` verified committed (asOfSeq 3). Async background default-save observed: `agent-default-model` rev 15→16 with the local-proxy user, then confirmed stable by a second read 400 ms later. Exactly ONE `settings/replace('agent-default-model', original user, expectedRevision 16)` → rev 17. Five repeated readbacks: effective default `cmp170hx/Qwen3.8-Flash-Next/xhigh`, unchanged providers/route, no unrelated settings drift. Session `next` still on the test route after restore (as intended).

## F. The blocking defect (for remote ChatGPT) — minimal reproduction

Live gateway envelope contract (probed against the running 3080, no mutation):

- `session/list` descriptor accepts `payload:{args:{_request:{}}}` and REJECTS `args:{request:{}}`.
- `session/projections`, `session/prompt`, `session/state`, `session/wait`, `session/page` require `payload:{args:{request:{…}}}` and REJECT `args:{_request:…}` with `gateway/arguments-invalid` (message: `typert gateway: session/projections: args fields do not match the descriptor: missing "request"; unexpected "_request"`).

`src/local-first/dsh-3080-operator-rpc.ts:62` correctly sends `{args}` with `request:{…}` (all real reads/switches succeeded). `src/local-first/dsh-3080-bridge.ts:102` always wraps as `payload:{args:{_request:request}}` → every relay call into `session/projections` (preflight cursor/model read) fails with `DshBridgeBlocked: DSH refused gateway/arguments-invalid`. Repro (sanitized, loopback):

```
curl -X POST http://127.0.0.1:3080/api/session/projections \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3080' \
  -d '{"type":"client-request","rpcId":"x","method":"session/projections","payload":{"args":{"_request":{"sessionId":"…"}}}}'
# → gateway/arguments-invalid (missing "request") ; same payload with "request" → ok:true kind:sequenced
```

Requested fix: align the bridge to the live per-endpoint descriptors (and tighten the mock test to assert the gateway-verified shape, not merely `'_request' in args`). Also recommend the relay effect lane handle the "no durable receipt + repeated preflight failure crossing the fresh-context window" case explicitly: the `dsh-relay` effect row was silently deleted (attempts 4, error `DshBridgeBlocked…`, due 16:31:44Z ≈ trigger.at 16:26:49Z + 5 min), leaving no terminal receipt status for operator review.

## G. Real Weixin inbound evidence (REAL, one message consumed)

Two live messages were sent by the operator to the paired bot: `测试` (16:20:46Z) — hash mismatch → correctly NOT relayed, ordinary Engine path (eval `ignore`, outbox reply; no ticket), and the exact two-line message (16:26:49Z, `/project <private alias>` + task sentence) — exact UTF-8 SHA256 match, allowed peer match, BOTH allowlists pass (native source `allowedPeers` + DSH policy), addressed=direct, human=true, fresh contextToken present. `dsh_relay_approval` row shows the one-shot approval consumed for that trigger; the Engine made NO decision for it (no `decision` row; disposition `fanout:[]`) → single-path routing confirmed, no double dispatch. Then the bridge preflight failed (F) and the 5-minute reply-context window elapsed; `dsh_relay_receipt` rows: zero; outbox rows: unchanged (3). One-shot grant expiry 01:30Z untouched otherwise. No duplicate prompt, no duplicate reply, no cloud call, no re-scan.

## H. Invariants after the run (READ-ONLY verified)

- 3080: pid 1482 unchanged since before the run; listener `*:3080`; `allowUnauthenticated` + trustedHosts unchanged (profile patch touched only the `llm-pi-ai` provider block); anonymous LAN session-list works (HTTP 200 with same-origin header, probe `ownerAuthRisk` unchanged).
- 8123: pid 90215 unchanged; upstream 192.168.10.206:8002 reachable (`/v1/models` HTTP 200), upstream `prompt_tokens_total` counter shows real inference happened elsewhere (operator traffic).
- 3083: rolled back — bundle symlink restored to the native-weixin checkout (`.bak-pre-c5` moved back), restarted with the ORIGINAL env (no `DSH_SUPERAGENT_DSH_*` vars), listener 127.0.0.1:3083 back on pid 7098; weixin cursor/account preserved (WAL intact; cursor advanced only by the two real operator messages). Relay SQLite tables persist but hold only the consumed approval row.
- Read-only probe vs C2 baseline: Workspaces 27 (catalog) / 28 via official stream (+1 = disposable); Sessions 841→845 (+1 disposable +3 ordinary operator activity while the run proceeded — 3 other sessions actually used local Qwen in that period, not caused by this agent); running 1→2; migration-required 286 unchanged; `lastUsedLocalQwen` 551→554 / `nextSelectedLocalQwen` 552→555 (+1 = disposable session). `readyForLivePrompt:false` unchanged (owner-anonymous). No original Workspace/Session was migrated, overwritten, or prompted.

## I. Evidence classes (strict)

- GITHUB CI GREEN on exact SHA 5ec2888 (run 188). MOCK PASS (87/87). REAL CONFIG HOT-RELOAD PASS. REAL 3080 WORKSPACE/SESSION CREATION PASS. REAL SELECTMODEL + DEFAULT RESTORE PASS. REAL WEIXIN INBOUND + RELAY SELECTION PASS. **REAL 3080 SESSION PROMPT: NOT RUN (blocked at bridge preflight).** REAL WEIXIN RETURN FROM RELAY: NOT RUN. REAL 8123 RELAY INFERENCE: NOT RUN.

## J. Local changes made this run + rollback status

1. Profile provider-metadata move (C) — rollback available via `patch.postgate1.bak` (checksummed).
2. 3083 restart (twice: relay env, then restore) — original env snapshot preserved; current state = original launch env restored.
3. Bundle symlink repoint + restore — symlink back to native-weixin checkout.
4. Disposable Workspace/Session created — disposable by design (never chosen from history); removal requires a separately authorized operation (not performed).
5. Two real Weixin messages consumed (operator-sent; one-shot grant spent).
No changes to 3080 listener/auth/db/model-route (beyond C's provider metadata, hot-applied and backed up), 8123, or historical data.

## K. Remaining independent authorizations (NOT requested this turn; run is STOPPED)

1. Remote fix of the bridge envelope (F) + a fresh code SHA acceptance lane.
2. A new one-shot Weixin grant (new approvalId + exact text hash + fresh route attestation) for the next live attempt — the old grant is consumed.
3. Explicit authorization to run one real prompt + one reply on the disposable Session after the fix.

Logs (private): `staging3083.log`, `staging3083-restored.log`. No real peer IDs, tokens, paths, prompts, or credentials published here.
