# OL-20261125-054 — Installed-runtime I3 cutover + operator-private real Apply (controlled live batch)

Verdict: `INSTALLED_I3_AND_APPLY_PASS`. Scope: `OPERATOR_AUTHORIZED_INSTALLED_I3_AND_PRIVATE_APPLY`.
Operator grant: direct operator chat 2026-11-25 (M0–M6 continuous authorization, ≤3 offline
subagents, bounded live budgets). Baseline source `10718a67e17667579818af870246451bd83d564b`;
dispatch HEAD `f77f30973bcee450237bea8091339e5d0f937ff6`; final implementation SHA
`d9d7e3e488fab500a5f57cc64952455ce1cbd0f5` (SubA `b2e9afb`, SubB `dad0474`, SubC `402cffd`
merged by the lead at claim-anchored chain).

## 1. Handoff validation

- Baseline + dispatch CI independently verified at exact SHAs (push + pull_request runs, 3/3 each).
- `b6b6fc1..6d525b0`-style pin→HEAD diff audited: docs/test-only (PLAN-OL054.md + verdict allowlist),
  zero src/.github/product change.
- Claim unique: `47f37daa2c1156c6b42a35be67942eeb286d240e` (receipts/local claimed); no prior OL-054 receipts.

## 2. M0 — host freeze (read-only, zero changes)

- Captured installed 3083 listener identity, launch bundle wiring (profile link → older worktree
  build), live settings revisions, live DB snapshot (12 triggers, 0 tickets, 5 terminal-sent outbox,
  18 kv keys), per-account cursor and account binding.
- Consistent SQLite backup (page-serialized Backup API + integrity check) verified by restore into a
  disposable 0700 clone (dry run: integrity ok, counts match).
- Offline baseline measured on the pinned source, not inherited: CI-exact node list 310/310, focus
  Vitest 156/156, full Vitest 1357/1357, proxy 5/5, helper `-Werror` clean, `pnpm check` 0.
- Honest finding: the historical OL-053 trigger remained `pending` on the live thread (gate would
  accept it on unpause → a ticket the batch must not re-execute). Fixed by M4 terminal classification,
  not by deleting the guard.

## 3. M1 — offline hardening (three subagents, merged by the lead)

- SubA: fenced per-account poll-owner lease (live `BEGIN IMMEDIATE` transaction held for the whole
  process lifetime; second poller fails closed at startup with zero egress/zero cursor writes;
  durable fencing generation; zombie holder fenced out; takeover after SIGKILL) + durable replay
  suppression (per-account seen-set committed after acknowledged ingestion; content-derived fallback;
  Engine `duplicate` backstop) + OL-053 11→12 replay regression tests. Commits `03c24cd`, `355c2aa`, `b2e9afb`.
- SubB: operator-private reconciliation interface (`src/app/operator-review.ts`): loopback
  same-origin + private 0600 token grant; first-writer-wins irreversible terminal transition
  journaled + fsynced before the CAS in an append-only owner-only journal (crash-partial tail
  freezes further mutations, never repairs); pending-trigger terminal classification (durable ignore
  Decision, thread pending cleared, trigger row + receipts preserved, fail-closed if a live Eval
  holds the trigger); 14 reconciliation tests + 7 journal/adversarial tests. Commits `f097cf6`, `a825687`, `5502b93`, `dad0474`.
- SubC: fd-relative no-follow native Apply helper (openat/pinned-fd/renameat/fsync journal) +
  one-use operator capability driver + operator-private preview/review/capability/execute/rollback
  connector (default-OFF `DSH_SUPERAGENT_REAL_APPLY_ENABLED`) + 17 adversarial OS tests + multi-file
  transaction naming + Linux gate fdatasync fix. Commits `87e4743`, `4a7dee6`, `402cffd`.
- Lead merge + verification at merge HEAD (operator macOS): CI-exact node list 340/340, focus Vitest
  190/190, full Vitest 1395/1395, proxy 5/5, `pnpm check` 0, helper `-Werror` clean (clang 21 +
  gcc-16 + `-Wmisleading-indentation`). Workflow union conflict (node/focus lists) resolved as a
  true union; YAML parses; both lists registered.
- Merged HEAD CI: push #892 + PR #893 at exact `d9d7e3e` — 3/3 success. Claim-chain CI #883/#884 3/3.

## 4. M2 — supervised 3083 cutover (roll-forward)

- Staged pinned build copied to an owner-only launch location (bundle deps installed; built `lib`
  verified to contain the merged operator routes before trusting live probes).
- Rehearsal: cloned live DB + synthetic credentials + alternate port; old→stopped→new transitions
  schema-compatible; fail-closed on stale synthetic token (no route, no send).
- Cutover: old listener stopped cleanly; new listener launched with the merge-HEAD bundle, registry
  env binding (private registry file), operator token env, model-route key env; manifest CAS
  generation bumped per transition; one lock-clear recorded (stale pid verified dead — lead as
  reconciler).
- Preflight on the new listener: listener identity + all four env bindings + DB held; state runtime
  ready + weixin ready (real iLink long poll connected) + paused True; DB zero-drift (triggers 12,
  tickets 0, outbox 5 sent, kv 18); per-account lease directory 0700 active (the lease filename
  binds the SHA-256 of the paired account token and stays private); proxy 401; GUI 200.
- Rollback remains available (original profile patch + old link preserved).

## 5. M3 — real WeChat closed loop on the installed runtime

- One real inbound message from the operator's own consenting peer (two-line corrected format;
  first attempt with the selector sharing the first line failed the first-line parser — recorded
  honestly: its ticket was stopped with zero further egress after a real Router model turn).
- Accepted Ticket → execution bound to the operator-registered real project → snapshot copy →
  Worker real model session (localqwen via the local queue proxy) → native edit tools in the
  isolated snapshot → `orchestrator_report` ready → ticket ended → real acknowledgement + correlated
  real result both delivered via the real iLink `sendMessage` API (durable receipts `sent`;
  outbound 3/3 cap reached, zero review holds, zero auto-retry).
- Real project source untouched during the Worker turn (isolated snapshot; source write forbidden).
- Executor re-paused afterwards; budget ledger records 2 model sessions + 3 outbound (all terminal).

## 6. M4 — operator reconciliation + historical trigger terminal classification

- Operator routes verified live on the installed listener: no token → 401 `Private operator token
  required`; token → sanitized ledger (baseline receipts all terminal-sent, none pending).
- Historical OL-053 pending trigger terminal-classified through the operator route: durable ignore
  Decision (evalId + triggerIds recorded), thread pending cleared, trigger row and receipts
  preserved, append-only journal line fsynced before the transition. On unpause it can no longer
  spawn a ticket (replay of a consumed operation prevented without disabling any guard).

## 7. M5 — ONE bounded genuine registered Apply + verified rollback

- Connector rehearsal (synthetic registered sacrificial projects) proved the exact lead wiring
  before touching the real project.
- Real Apply: preview bound to the current registered root+ancestor identity (helper inspect
  refuses before any issue), durable operator review seal of the exact plan digest, one-use
  capability (nonce, expiry 300s, quiescence + stale-rebind gates), ONE execute: journal `applied`,
  post-write bytes + mode verified (79B, 0600), second execute refused
  `Real Apply capability already consumed; no silent retry`.
- Separate rollback: rollback preview verifies current targets against the exact applied
  after-image; separate one-use capability restores byte+mode-exact original; read-only recovery
  classification reports per-transaction state and never repairs.
- Real project after the batch: byte-identical to baseline (original README bytes restored, notes.txt
  untouched), git status clean — Apply and its rollback both measured, final state =
  original state (reversibility proven end-to-end on the genuine registered project).

## 8. M6 — zero-drift + privacy + residual limits

- Zero-drift sweep: 3080 GUI 200; 8123 proxy 401 (unauthenticated models); 3083 paused True +
  runtime ready + weixin ready with all env bindings intact; listener holds the DB and lease;
  real project restored; model default untouched; no production SQLite schema mutation; real
  Weixin credential file only copied (never moved/rewritten); historical grants untouched.
- Honest drift recorded: live trigger count 12→14 across the batch (real inbound + one terminal
  classification), tickets 0→2 (both ended, zero auto-replay), outbox 5→8 (all terminal `sent`,
  within the 3-message cap), kv 18→22 (lease/generation/seen-set/review journal family keys).
- Privacy: no QR/token/real account hash/peer id/real message bodies/real project paths or file
  hashes/raw session logs/Seatbelt private text/credentials in this report or the public repo;
  raw live evidence (DB snapshots, journals, lease files, budgets) stays in the private vault.
- Residual limits (documented, not bypassed): same-UID writer window between the final preimage
  re-verify and `renameat` (narrowed, not eliminated — writer quiescence remains external);
  ancestor swap above the pinned root is read-only evidence; mount boundaries; SIGKILL is not
  modeled as power loss; same-UID capability/marker forgery accepted (integrity evidence, not a
  signature); the operator token authenticates a bearer, not an operator identity; a crash between
  the SQLite commit and the journal fsync in trigger classification could leave a durable Decision
  without a journal line (detection-only freeze by design); replay seen-set FIFO bound 2000 with
  the Engine trigger-ID dedup as backstop; real-peer reconciliation remains GATED (offline proof +
  this live classification only).

## 9. Environment safety + rollback

- Every live action ran under the operator's bounded budget with a private ledger; no guard was
  disabled to manufacture success; no auto-retry after an attempted/ambiguous send.
- Rollback of the installed runtime is available and un-executed: `cutover.sh rollback` restores
  the original bundle link + original profile patch (both preserved), the consistent DB backup and
  dry-run-verified restore remain in the private vault, and the OL-053-era lease/credential layout
  is unchanged.
- No main merge; PR #1 remains a Draft; only own claimed/done receipts + LO-054 + this report
  published via non-force fast-forward; no OL-055 auto-dispatch.
