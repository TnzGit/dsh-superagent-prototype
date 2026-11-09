# REPORT — C5.4B one-shot real native Weixin → original DSH 3080 → local Qwen 8123 → native Outbox

Code-under-test SHA: `180eb3dc80c5af80f5ea12594081ee8987b2ae30` (report-tip; product code identical to `4eb8b43`/`86edb85` dual-hash fix). Fresh worktree; all prior worktrees preserved.
**Verdict: `PARTIAL_5_OF_6_LEGS`** — the full relay chain ran exactly once and every leg passed EXCEPT the final native Outbox reply, which was blocked by a **product-code correlation bug** (found live, reported below, not repaired locally per protocol). One-shot rule honored: NO retry, NO second message, grant consumed, environment fully restored.

## Legs (acceptance criteria)

1. REAL WEIXIN INBOUND: **PASS** — exactly one genuine two-line message, quote-free line 2 with alphanumeric marker; received bytes SHA256 = grant SHA256 (`0da44504…9dc1`) **exact match** (V1 grant).
2. REAL ORIGINAL-SESSION PROMPT: **PASS** — ONE real `session/prompt` via guarded bridge: receipt `admitted`, `requestId=dsh-bridge-5e6a9b50…`, `afterSeq=3`; one-shot grant consumed (new `dsh_relay_approval` row bound to this trigger); no re-arm.
3. REAL 8123 LOCAL INFERENCE: **PASS** — session events prove provider `llm-local-proxy` → `http://127.0.0.1:8123/v1` single-slot queue → upstream vLLM; both the main turn and the title turn used the local route; no cloud fallback.
4. REAL CORRELATED ASSISTANT COMPLETION: **PASS (at the Session level)** — original Session page through cursor 20 shows the matching `user/message` with `source.rpcId = requestId`, `turn/start`, `step/start`, `assistant/message` (visible text `C54B-OK`), `step/end`, `turn/end reason.kind=completed`. Session cursor 3→20, idle, queue/pendingInput empty.
5. REAL NATIVE OUTBOX REPLY: **FAIL — `review-required`** — relay correlation rejected the page, so no `dsh-3080-reply-<40hex>` Outbox message was ever created and nothing was sent to Weixin. The operator received NO reply (message stays terminal; not retried).
6. NORMAL 3083 RESTORE: **PASS** — bundle symlink restored to pre-C5.4B target, controlled relaunch with ORIGINAL env (zero `DSH_SUPERAGENT_*` vars), new pid LISTENing 127.0.0.1:3083; 3080 pid 1482 and 8123 pid 90215 untouched all along.

## Root cause — product bug for remote ChatGPT (minimal, sanitized)

`correlateDshCompletion` (src/local-first/dsh-3080-output.ts, ~L84-L96): for every `user/message` event in the continuation window it requires `data.source.rpcId === receipt.requestId`, otherwise `fail('ambiguous','unrelated_user_message_in_continuation_window')`. But DSH 3080 legitimately injects per-turn context snapshots as `user/message` events with `surfaceOp:"append"` and `data.source.kind` ∈ {`runtime-context`, `skill-catalog`, `time-context`} and NO `rpcId` (observed live at seqs 10–12 between our prompt at seq 9 and the assistant reply). The correlator counts them as unrelated human input → `review-required` → no reply. Verified page shape via read-only `session/page` (records carry `type/event{type,seq,time,data}`); no local code change made.
Suggested fix direction (remote's call): treat context-snapshot user messages (`source.kind` not `user`, e.g. `runtime-context`/`skill-catalog`/`time-context`) as ignorable within the window while keeping genuine human `user`-source inputs ambiguous-fatal; or use `ignorable`/`sourceEventSeqs` metadata if the gateway provides it. Existing mock tests pass because their fixtures omit these injected events — the bug only manifests against the real 3080.

## Gate A — offline acceptance on the run tip: PASS

GitHub CI on exact SHA `180eb3d`: run 42589202191 success (all three jobs). `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/1208); relay/bridge/native node suites on the run worktree: 48/48 PASS. Offline C5.4A audit (dual-hash V1/V2, quarantine, loader rejections) already published green.

## Gate B/C — baseline, grant, staging: PASS

- Owner-only 0700 baseline before staging (pids/listeners/env/bundle/profile checksum/SQLite `.backup`/rowcounts outbox 4, trigger 9, effect 0, relay rows old-C5-consumed-only, receipts 0, terminals 0, bindings 0). Zero drift.
- Catalog regenerated read-only from the official `workspace/follow` stream (29 workspaces incl. the disposable one; alias check `dsh-eb0061f2a70f7406` re-proven). NEW V1 grant: unique `approvalId c54b-relay-…`, quote-free two-line text (125 bytes, marker `C54B-OK`, no quotes → immune to WeChat glyph normalization), 6-hour expiry, peer-bound to the allowlisted account, session-bound; 0600+fsync. Fresh route attestation (provider/model/baseURL/operatorObserved, 5-min freshness) kept continuously refreshed by the private monitor during the live window.
- Real guarded `Dsh3080Bridge.inspect()` (read-only, AFTER fresh attestation per task): `allowed:true reasons:[] provider:llm-local-proxy permission:workspace-write originalSessionVerified:true` — no prompt during the check; disposable Session verified idle (cursor 3, queue/pendingInput empty) before admission.
- Controlled 3083 staging: bundle swap to run worktree, single restart with grant+catalog env; loopback listener OK, pairing/cursor/Outbox preserved; 3080/8123 untouched; effect queue empty before staging (no conflict).

## Gate D — live window: see legs above.

Monitor caught the trigger at 09:29:32Z (one message, hash match), receipt `admitted` 09:29:32.5Z, `review-required` at 09:29:43.7Z (correlation failure, ~11s after admission; the turn itself completed later — Session cursor 20). `dsh_relay_terminal` 0 rows, effect drained to 0, Outbox unchanged at 4 (3 historical `sent` + the C5.3 Engine reply `sent`); the `singleSendAttemptAt` guard never exercised (no guarded relay send). Grant permanently consumed; replay-protected (terminal review-required on the receipt row blocks reserve/retry).

## Gate E — invariants: PASS

Global default unchanged (`rev 17 cmp170hx/Qwen3.8-Flash-Next/xhigh`); disposable Session gained ONLY this run's approved turn (cursor 20, idle, no pendingInput); no new Workspace/Session; relay tables hold ONLY the old consumed C5.3 row + this run's consumed row; triggers 10 (the one real message), outbox 4, effects 0; probe counters identical to baseline (no unexplained drift); 3083 restored normal with relay OFF; 0 residual changes.

## Not run / not claimed

No second message, no second prompt, no retry of the uncertain leg; Weixin reply NOT delivered (leg 5 FAIL, terminal recorded, manual-review-only recovery per design); no cloud model call; no QR re-pairing; not claimed as "双向通信完成".

## Rollback

Fully restored, zero residual: bundle symlink/env/restart back to pre-C5.4B state; grant unreusable; no database rollback performed (live DB preserved, only `.backup` copy taken beforehand); nothing re-armed. Raw evidence (trigger JSON, hashes, receipt rows, monitor output, page dumps) stays owner-only in the private 0700 directory; nothing sensitive published.

## Next step (requires NEW human authorization)

C5.4B-real-retry is NOT authorized by this run: the grant is consumed. Remote ChatGPT should fix `correlateDshCompletion` for DSH-injected context-snapshot user messages; after that fix lands green, a new one-shot live E2E (fresh grant, quote-free marker message, same safety gates) can complete leg 5 + 6 (reply + correlation).
