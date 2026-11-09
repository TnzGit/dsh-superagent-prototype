# REPORT — C5.5B one-shot real native Weixin → original DSH 3080 → local Qwen 8123 → native Outbox (fixed correlator)

Code-under-test SHA: `32040040e210f1d076b6543e0b6bdc75e38e5440` (the context-snapshot correlator fix `305a910`; fresh clean worktree, built `lib/` for staging). Report-tip branch at publication: `fd57681`.
**Verdict: `REAL_E2E_PASS_6_OF_6_LEGS`** — exactly ONE real Weixin message, ONE real original-session prompt, ONE local 8123 inference, ONE correlated native reply delivered. One-shot rule honored; grant consumed; environment fully restored; zero residual.

## Legs

1. REAL WEIXIN INBOUND: **PASS** — one genuine two-line message (quote-free line 2, alphanumeric marker `C55B-OK`); received bytes SHA256 = fresh V1 grant SHA256 (`1fb88b66…b36105`) **exact match** at 10:02:23Z (trigger `12bba7e1…`, addressed=direct, human=true).
2. REAL ORIGINAL-SESSION PROMPT: **PASS** — exactly one `session/prompt` via guarded bridge: receipt `admitted`, `requestId=dsh-bridge-01dcd62f…`, `afterSeq=20` (continues from C5.4B's completed cursor); fresh grant consumed (new `dsh_relay_approval` row bound to this trigger); no re-arm, no retry.
3. REAL 8123 LOCAL INFERENCE: **PASS** — session events (seq 22–29) prove the turn ran through the local route (provider selection + `request/header`; title turn also local); upstream vLLM `prompt_tokens_total` advanced; single-slot proxy queue (max concurrent inference = 1); no cloud fallback.
4. REAL CORRELATED ASSISTANT COMPLETION: **PASS** — page shows the matching `user/message` at seq 25 (`source.rpcId` = requestId), DSH-injected `time-context` snapshot at seq 26 now correctly IGNORED by the fixed correlator (this is exactly the event class that caused C5.4B's `review-required`), `assistant/message` (visible text `C55B-OK`) at seq 27, `step/end` seq 28, `turn/end reason.kind=completed` seq 29. Receipt transitioned `admitted` → `completed` (+6.2s).
5. REAL NATIVE OUTBOX REPLY: **PASS** — Outbox row `dsh-3080-reply-8137bdd7a…` kind:reply status:**sent** (guarded `singleSendAttemptAt` recorded; channel source weixin; operator confirmed receipt in WeChat — reply text `C55B-OK`). Exactly one reply row created; repeat-effect cannot resend.
6. NORMAL 3083 RESTORE: **PASS** — bundle symlink restored to pre-C5.5B target, controlled relaunch with ORIGINAL env (zero `DSH_SUPERAGENT_*`), pid 68379 LISTENing 127.0.0.1:3083; 3080 pid 1482 and 8123 pid 90215 untouched throughout (never restarted per prohibition).

## Staging note (environment lesson, not a defect)

First controlled restart of 3083 logged `ERR_MODULE_NOT_FOUND` for the staged worktree because the fresh worktree had no built `lib/`; ran `pnpm install --frozen-lockfile` (exit 0) + `pnpm check` (exit 0, Vitest 62/1208) in the worktree, then the second controlled restart imported cleanly (zero `failed to import` lines). No product code involved.

## Gate A — offline acceptance on the code SHA: PASS

CI on exact `3204004`: run 42595855746 all three jobs success. Local: `pnpm check` exit 0 1208 tests; node suites 75/75 exit 0 (bridge 14/14, output 12/12 incl. the 3 new correlator tests, relay-coordinator 7/7 with snapshot-aware mock, projects 2 pre-existing macOS `/var`-symlink env failures documented, proxy suite 5/5); synthetic replay of the sanitized C5.4B live sequence → `completed`; 19-counterexample fail-closed matrix — all published green in C5.5A (commit `35784d8`, CI 42596688674).

## Gate B/C — baseline, grant, preflight: PASS

Owner-only 0700 baseline before staging: pids 1482/56849/90215; zero `DSH_SUPERAGENT` env on 3083; bundle `../../../..`; profile sha `6a1fd290…`; SQLite `.backup` snapshot; counts outbox 4, trigger 10, effect 0, receipt `review-required` (C5.4B), approvals 2 (old C5.3 + C5.4B consumed), terminals 0, bindings 0. Zero drift. Catalog regenerated read-only from official `workspace/follow` (29 workspaces incl. disposable; alias `dsh-eb0061f2a70f7406` re-proven). NEW V1 grant (quote-free two-line text, 125 bytes, marker `C55B-OK`, 6-hour expiry, peer+session bound, 0600+fsync) — C5.4B's consumed grant NOT reused, no old-reply recovery attempted. Fresh route attestation (provider/model/baseURL/operatorObserved) refreshed continuously by the private monitor during the live window. Read-only preflight: disposable Session idle (cursor 20, queue/pendingInput empty), effect queue empty, global default unchanged. Real guarded `Dsh3080Bridge.inspect()` (read-only, AFTER fresh attestation): `allowed:true reasons:[] provider:llm-local-proxy permission:workspace-write originalSessionVerified:true`.

## Gate D — live window: see legs above.

Monitor caught the trigger at 10:02:23Z (hash exact match), receipt `admitted` 10:02:23.5Z, `completed` 10:02:29.5Z, Outbox reply `sent` 10:02:29.5Z; effect drained to 0; terminals 0; grant consumed once; session cursor 20→29 (ONLY this run's approved turn 2).

## Gate E — invariants: PASS

Global default unchanged (`rev 17 cmp170hx/Qwen3.8-Flash-Next/xhigh`); disposable Session cursor 29, idle, queue/pendingInput empty, no pending input; no new Workspace/Session (probe counts 27 ws / 847 sessions, `lastUsedLocalQwen 556`, `nextSelectedLocalQwen 557`, `unknown 290`, `cloud 76` — identical to baseline, zero unexplained drift); triggers 11 (the one real message), outbox 5 (one new `sent` reply), effects 0, terminals 0; relay approvals = old C5.3-consumed + C5.4B-consumed + this run's consumed; receipts = C5.4B `review-required` preserved untouched + this run `completed`; 3083 restored normal with relay OFF; zero residual changes.

## Not run / not claimed

No second message/prompt/retry; no QR re-pairing; no cloud model call; C5.4B's `review-required` record kept as historical evidence and its old reply NOT re-sent; not claimed as full Superagent project-execution integration (ticket path still needs a repository — remote's remaining scope).

## Rollback

Fully restored, zero residual: bundle symlink + env back to pre-C5.5B state via the controlled restart; grant permanently consumed and replay-blocked; DB live (only pre-staging `.backup` taken; no rollback performed); nothing re-armed; private evidence (trigger JSON, hashes, receipts, monitor output, session page dump) stays owner-only 0700, never uploaded; this report is sanitized (truncated hashes, no credentials, no raw chat beyond the acceptance marker).

## Next step

The real E2E closed loop is now proven end-to-end against the fixed correlator. Remaining remote-side scope (per LOCAL_AGENT_TASK): DSH Ticket/Worker integration with LocalProjectRegistry, non-Git isolation/snapshot/apply/rollback, task-level model priority on the native call chain. A new one-shot live stage needs fresh human authorization (this grant is consumed).
