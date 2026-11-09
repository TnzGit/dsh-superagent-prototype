# REPORT — C5.5A original-DSH context-snapshot correlator offline acceptance

Code-under-test SHA: `32040040e210f1d076b6543e0b6bdc75e38e5440` (fresh clean worktree; all prior worktrees preserved).
Fix under test: `305a910` in `src/local-first/dsh-3080-output.ts` — `INTERNAL_CONTEXT_SOURCES = {runtime-context, skill-catalog, time-context}`; snapshot `user/message` events (known kind, no own `rpcId`, `surfaceOp:"append"`) are ignored ONLY inside the proven matching turn (`context_snapshot_outside_matching_turn` otherwise); human/unknown/forged-rpcId sources remain ambiguous-fatal.

## Verdict: `ALL_OFFLINE_PASS` (zero host writes)

### Step 1 — CI on exact SHA: PASS
GitHub Actions run 42595855746 (push, exact `3204004`): all three jobs success — `local-first-core`, `dsh-typecheck-and-build`, `macos-portability`. (Fix commit `305a910` run 42595564005 also green.)

### Step 2 — local build + tests: PASS
`pnpm install --frozen-lockfile` exit 0. `pnpm check` exit 0 — Vitest 62 files / 1208 tests, 0 failures. Node suites (13 files, exit 0): 75 pass / 0 fail; per-suite: bridge 14/14, output 12/12 (incl. the 3 new correlator tests), relay-coordinator 7/7, relay-bridge, probe, new-workspace, model-gate, operator-rpc, operator-provision, weixin-bridge, projects (2 pre-existing macOS `/var`-symlink failures unchanged — environment, not product), model-queue, probe-local-llm; combined count 75 includes only passing runs in this invocation (local-projects failures reproduced identically on prior tips; documented). Proxy suite `tests/local-openai-queue-proxy.node-test.mjs`: 5/5 PASS.

### Step 3 — sanitized replay of the real C5.4B sequence: PASS
Synthetic fixture reproducing the LIVE page shape and real seq numbering (matching `user/message` with `source.rpcId = requestId` at seq 9; the three DSH-internal snapshots `runtime-context`/`skill-catalog`/`time-context` (no rpcId, `append`) at seqs 10–12; `request/header`/`request/context`/`session/title` passthrough; assistant text at seq 18; `step/end` seq 19; `turn/end reason.kind=completed` seq 20) → correlator returns `completed`, reply text `C54B-OK`; private reasoning never serialized; `trackDshContinuation` completes via read-only wait/page at identical cursors; `continuationWeixinReply` produces the deterministic single Outbox reply id with the original contextToken/messageId/peer bound and no credential leak in the result JSON.

### Step 4 — counterexample matrix: PASS (every case safely rejected, none yields `completed`)
foreign human input (other rpcId) → `ambiguous duplicate_history_event_seq`; unknown `source.kind` → `ambiguous unrelated_user_message_in_continuation_window`; snapshot with empty/absent `source` → ambiguous; forged `rpcId` on a snapshot → ambiguous unrelated; our-rpcId user message a second time → ambiguous duplicate; snapshot before the matching prompt → `context_snapshot_outside_matching_turn`; snapshot after the completion/new turn → `history_event_after_read_cut`; non-append (replace) snapshot → `non_append_user_surface_event`; extra turn after completion → `another_turn_after_our_completion`/read-cut; seq beyond read cut → read-cut; wait/page cursor mismatch → `invalid_or_mismatched_session_cursor`; `hasMore` with coverage gap → `history_page_does_not_cover_original_request`; missing matching prompt under `hasMore` → same; incomplete output (no turn/end) → `pending`; assistant before matching prompt → `unrelated_assistant_turn_before_matching_request`; error `turn/end` → `failed target_turn_error`; timeout wait → `pending session_not_idle`; pendingInput → `blocked target_session_requires_human_input`; oversized assistant text → `blocked assistant_text_exceeds_channel_budget`. Snapshot carrying OUR rpcId → still ambiguous (treated as a second human input). 19 counterexamples, all fail-closed.

### Step 5 — coordinator mock chain + regressions: PASS
`tests/local-dsh-relay-coordinator.node-test.mjs` (updated by the fix): mock chain with the live snapshot events produces EXACTLY ONE Outbox reply bound to the original Trigger/contextToken; repeat effect cannot resend (outbound length stays 1); deterministic preflight rejection → terminal without prompt or reply. V1/V2 literal-hash grant (dual-hash loader rejections + exact full-message SHA256, no normalization), near-miss quarantine (pre-existing `/project` selector + peer + fresh grant), single-send guarantee, and read-only 3080 preflight behavior all preserved — relay/bridge/node suites green on this SHA (step 2).

### Step 6 — read-only session/host checks (only where needed): PASS, no writes
Original disposable Session (via read-only state read): cursor 20, idle, queue/pendingInput empty — completed state preserved from C5.4B; the C5.4B context-snapshot event structure is already fully documented in the C5.4B report (seqs 10–12 live shapes). The C5.4B `review-required` receipt is untouched (still `review-required`; 0 terminal rows; effect 0); the old reply was NOT re-sent (Outbox still 4 rows, all pre-existing `sent`, no new row, no `singleSendAttemptAt` activity).

### Step 7 — host invariants: PASS
3080 pid 1482 (LISTEN, untouched all along), 3083 pid 56849 LISTEN 127.0.0.1:3083 with the ORIGINAL bundle symlink (`../../../..`) and zero `DSH_SUPERAGENT_*` env vars, 8123 pid 90215 single-slot proxy untouched. Global default model unchanged (`rev 17 cmp170hx/Qwen3.8-Flash-Next/xhigh`). Disposable Workspace/Session identity unchanged (`session-ddfe4d2b…` still in workspace `900bdbd1…`); trigger count 10 (one real C5.4B message, no new triggers), outbox 4, effects 0, relay approvals = old C5.3-consumed row + C5.4B-consumed row only. No other-operator drift observed; nothing repaired or modified.

### Forbidden actions honored
No re-delivery of the C5.4B prompt; no real Weixin message/reply; no new grant; no service restart; no changes to historical Session, SQLite terminal state, model selection, global default, or 3080 LAN config.

### Zero-change verification (rollback N/A for offline)
Host state read-backs identical to the C5.4B Gate E snapshot above; worktree-only artifacts; all private scripts kept owner-only 0700 (never uploaded); report contains no private logs, hashes are truncated, no credentials.

### Next step
Remote ChatGPT may now schedule a NEW one-shot live E2E (fresh grant, quote-free two-line marker message, same safety gates) to complete legs 5+6 (correlated reply + Outbox send) against this fixed correlator. C5.4B's consumed grant/review-required record stays as historical evidence.
