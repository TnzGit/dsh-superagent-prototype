# OL-20261118-041 — I1B/P3 consolidated Mac offline batch (sanitized)

Verdict: **ALL_OFFLINE_PASS** (Stages A/B/C fully pass; Stage D NOT_AUTHORIZED by design).

## 1. Exact source and CI

- Pinned immutable source SHA: `05937a3a8de5d020f55e6984bbd9660e03f4d3eb` (tested in a fresh detached disposable worktree at exactly this SHA, `git status --porcelain` empty before and after all runs).
- Dispatch SHA: `312faa936f4513e480adfd0f153360d5e6c23bb7`.
- Source CI #516 run 44254449518: 3/3 SUCCESS (local-first-core / macos-portability / dsh-typecheck-and-build) at exact head_sha; both OS jobs executed the 14 focused Vitest cases (I1A 2, I1B 7, P3 5) and full Vitest 1222/1222. Re-verified independently via gh before claim.
- Task uniqueness: no prior claimed/done receipt for OL-20261118-041 existed; claimed ONCE on the operator's manual handoff (no auto-dispatch from GitHub HEAD change or scheduler tick).

## 2. Stage-by-stage

| Stage | Result |
|---|---|
| A private read-only baseline | PASS |
| B maximal offline suite | PASS |
| B adversarial probes (private harness) | PASS (ok=28 fail=0) |
| C macOS P3 OS feasibility (synthetic temp roots only) | PASS |
| D I2 real Worker | NOT_AUTHORIZED (I2_BLOCKED_GATE_OR_GRANT) |
| D I3 real Weixin | NOT_AUTHORIZED (I3_NOT_AUTHORIZED) |
| E production pre/post invariants | PASS (zero drift) |

## 3. Commands, versions, named test counts (Stage B, on pinned source)

Host: macOS 26.3 arm64; Node v25.9.0; pnpm 11.7.0; git 2.50.1; DSH 0.2.2-rc.1.

- `pnpm install --frozen-lockfile` → exit 0 (11.6s)
- `pnpm check` → exit 0 (build complete ~1.2s, ESM d.ts emit)
- `pnpm exec vitest run tests/local-ticket-worker-preview.spec.ts tests/local-ticket-worker-session.spec.ts tests/real-apply-contract.spec.ts` → 14/14, exit 0 (named: I1A preview 2, I1B fake-host 7, P3 validator 5)
- Workflow-exact 24-file Node list (identical in both `local-first-core` and `macos-portability` jobs, incl. new `tests/handoff-convergence.node-test.mjs`) → **248/248**, exit 0 (~5.7s). Count grew from OL-040's 244 to 248 because the handoff-convergence suite adds 4 tests. No unreviewed glob used; no suite skipped.
- Proxy: `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` → 5/5, exit 0
- Full Vitest: 65 files / **1222 tests** all passed, exit 0 (~20s)
- `node --experimental-strip-types --test tests/handoff-convergence.node-test.mjs` standalone → 4 pass / 0 fail, exit 0

## 4. Repeated-run results

Isolated I1A/I1B/P3 targeted run repeated 3× sequentially on the same Mac: 14/14 each time, exit 0 each time (durations ~0.75s). No flakes.

## 5. I1A / I1B / P3 evidence (per-case, from named test bodies + audit)

- I1B non-Git: actual Engine receive→evaluateDue→decide→Ticket; DshExecutor queued effect; real disposable non-Git snapshot; fake Sessions ensure/prompt envelope; three-file preview (add/delete/modify); source bytes/modes unchanged for modify.txt, delete.txt, .env; add.txt absent in source; exactly ONE core Outbox reply; idempotent replay reused=true.
- I1B Git: real clean local offline clone, `git remote` empty, workspace HEAD == source HEAD; workspace dirty while source `status --porcelain` stays empty.
- I1B replay/stale effect: duplicate Trigger + re-start → 1 ticket / 1 ensured session / 1 prompt / 1 ack (no second Ticket or Worker).
- I1B stop-before-launch: stopped Ticket never starts the queued effect (ensured 0; execution dir absent; source unchanged).
- I1B unknown/missing project: fails closed with /not registered/, report state failed, no Session launch.
- I1B dirty Git source: fails closed BEFORE workspace creation; uncommitted file preserved.
- I1B counterfeit pre-existing workspace manifest (.dsh-project.json foreign project): fails closed before launch.
- I1A: actual Ticket selection → isolated snapshot 3-file preview sealed as evidence → no-write review checkpoint (audit status `awaiting-human`); invalid/missing selector fails before any source or workspace prep.
- P3: frozen deterministic digest; traversal/Unicode-alias/secret/absolute/cross-root refusal; case-alias, duplicate, parent/child, noncanonical ordering refusal; malformed fields/ops/modes/byte-budget refusal; digest never treated as authority (pure proposal validator, no fs/process/network).

## 6. Adversarial probe matrix (private harness, pinned-source import)

B1 digest stable across repeated inspect (structuredClone) — PASS
B2 SHA1 AND SHA256 sourceRevision both accepted; 7-hex refused — PASS
B3 traversal / absolute / `//` / NUL / backslash / leading+trailing space / empty refused — PASS
B4 `.env`, `ENV/.env`, `.git/x`, `SECRETS/k`, `id_RSA`, `x.pem`, `db.sqlite`, `.dsh`, `.DS_Store`, hidden segment refused (case-insensitive FORBIDDEN match) — PASS
B5 case-alias collision (`Foo.txt` vs `foo.txt`) refused — PASS
B6 parent/child collision refused — PASS
B7 non-canonical sort order refused — PASS
B8 group/world write, setuid, sticky modes refused; 0400–0755 no-write-bit modes accepted — PASS
B9 total byte budget (>256MiB) refused; per-file >64MiB refused via image guard — PASS
B10 add-with-before / delete-with-after / modify-with-missing image refused — PASS
B11 returned plan + changes frozen (mutation throws) — PASS
B12 **FINDING**: a non-enumerable own key on a change object slips past the `Object.keys`-based `keys()` guard and is invisible to both validation and the JSON digest (prototype-chain object IS refused via the `Invalid change object` prototype guard). Same class of blind spot as the ledger guard fixed at `6dff9f34`, here still open in `src/local-first/real-apply-contract.ts keys()` :48–51.
B13 macOS hardlink identity (same inode, nlink=2) and rename-over-destination inode replacement — PASS
C1 `O_NOFOLLOW` refuses symlink with ELOOP; numeric open flags work on macOS — PASS
C2 an open root-directory fd keeps the ORIGINAL inode across path-ABA (rename away + rename fake in): the fd is a viable race anchor, the path is not — PASS
C3 **FINDING/BLOCKER**: Node stdlib has NO `openat(dirfd,path)`; descriptor-relative no-follow walk is impossible in pure JS on macOS. A race-free helper requires native/C bindings (confirms the technical blocker recorded in docs/014). — PASS (as a measured finding)
C4 synthetic APFS root is case-INSENSITIVE (Foo.TXT == foo.txt, same inode): P3's lowercase collision check is load-bearing on macOS — PASS
C5 `uchg` immutable flag blocks same-user writes; invisible to `fs.stat` — helper must OS-inspect or reject — PASS
C6 xattr exists, invisible to `fs.stat` — helper must verify or reject — PASS
C7 same-user attacker freely rewrites owner-only 0600/0700 files: marker-forgeries remain integrity evidence, not signatures (carried limit) — PASS
C8 non-cooperating writer TOCTOU between lstat and open is real (bounded, reversible) — PASS
C9 bounded crash injection: child killed (SIGKILL) mid-append leaves partial durable bytes, detectable by size/digest mismatch — PASS
C10 file fsync and directory-O_RDONLY fsync succeed on APFS — PASS
C11 symlinked ancestor canonicalized THROUGH by realpath; later swap observable via remembered inode (audited behavior) — PASS
C12 rename atomic within one fs — PASS
C13 APFS FICLONE clone available (`cp -c`) — PASS
C14 process-kill alone does not establish power-cut durability (design statement) — PASS
C15 FIFO special file is not a regular file (helper must reject non-regular) — PASS

## 7. Git/non-Git unchanged-source proof

Every I1B case asserts original source bytes/modes unchanged (modify/delete/.env), no unexpected add/delete in source, Git fixture stays `status --porcelain` empty while the Worker copy changes. Stage worktree itself: clean before and after.

## 8. Real-host coverage gaps (explicitly NOT_TESTED)

- I1B uses a fake Sessions transport and fake SubprocessRuntime; it does NOT call actual DSH Sessions/AgentDelivery, Worker turn/model selection, or genuine Weixin. Historical 3080 project/Session selection against the real bridge is NOT_TESTED in this batch.
- The fake `git config -z` exit 1 emulates "no matching credential keys"; it does NOT prove the real credential guard or OS sandbox (spec comment says so; recorded explicitly per runbook).
- Real registered-source Apply: not exercised anywhere; P3 is proposal-only.

## 9. macOS P3 OS findings (Stage C)

1. Path-only checks are NOT race-free; an open root-directory fd is the only viable identity anchor on macOS, but Node lacks `openat` — native binding required (C2/C3).
2. Case-insensitive volumes make lowercase collision checking load-bearing (C4).
3. `uchg` flags and xattrs are invisible to `fs.stat`; ACLs too — the future helper must inspect or reject them (C5/C6).
4. Same-user marker forgery remains a documented limit (C7); consumed/crash-partial receipts must never be auto-repaired (carried ledger lesson).
5. TOCTOU with a non-cooperating writer is real (C8); kill-at-step shows partial durable writes (C9); power-cut durability needs a journal design (C14).
6. Conclusion: no OS isolation/writer-quiescence guarantee exists for a pure-JS apply path today → remains a BLOCKER for real Apply; gates NOT relaxed.

## 10. Stage D (separate)

I2: NOT_AUTHORIZED → `I2_BLOCKED_GATE_OR_GRANT` (Gate I1 independent acceptance not complete beyond the new fake-host 7/7, and no new private one-shot host grant exists; `host_live_grant: NOT_GRANTED` in STATE.json). I3: `I3_NOT_AUTHORIZED`. Neither was attempted; no inference of permission from this file or the batch pass.

## 11. Production pre/post invariants (Stage E)

- 3080/3083/8123 listeners: same three service identities before and after (unchanged PIDs and bind addresses); probe codes identical (200 / 401 expected client-key auth / 404-alive).
- 3083 relay default OFF assumption held (no relay env override observed).
- DSH catalog aggregate: 27 workspaces, identical count to baseline (no Session IDs enumerated or exposed).
- Model defaults, provider config, production SQLite, historical grants, real registered projects' Apply/Rollback: untouched.
- Zero drift; nothing was altered to make the comparison pass.

## 12. Cleanup / rollback

All synthetic fixtures were created under fresh OS-temp roots (0700) and are reclaimed by the OS; the disposable parent worktree and detached stage worktree remain isolated from production checkouts. This round changed NO local configuration: only private state files (`last_head`, `claim-OL-20261118-041` → done, mode 0600) and GitHub receipts/messages via normal fast-forward pushes. Rollback if needed = remove the OL-041 receipts/messages by a normal revert commit; services need no restoration because nothing was changed.

## 13. One-shot receipt graph

- claim: `agent-handoff/receipts/local/OL-20261118-041-claimed.md` @ commit 8e24f1b (pushed FF 312faa9..8e24f1b)
- done: `agent-handoff/receipts/local/OL-20261118-041-done.md` @ this report commit
- to-online: `agent-handoff/messages/to-online/2026-11-18-lo041-integrated-mac-batch-done.md` (message_id LO-20261118-041)
- private: `claim-OL-20261118-041` status done (0600); evidence harness + sanitized log in a NEW private 0700 directory outside the repo.

## 13a. Report-commit CI status and exact repro (known mid-sync mismatch, remote-owned)

Done-commit `4a0d166` CI runs #530 (44269422939) and #531 (44269427942): `dsh-typecheck-and-build` SUCCESS; `local-first-core` and `macos-portability` FAILED with exactly 2 assertions in `tests/handoff-convergence.node-test.mjs` — both caused by the handoff being mid-sync after publication (STATE.json is remote-owned product state; local publication is forbidden to edit it):

1. `last accepted result is acked and a newer OL is at most one and independently scoped` (:37): `Expected values to be strictly equal: 41 !== 40` — `largest(messages/to-online, /-lo(\d{3})-/)` now sees the new `LO-20261118-041` while `last_accepted_local` still names `OL-20261114-040`/`LO-20261114-040`.
2. `historical long documents remain losslessly archived and active state is short` (:52): `assert.ok(!existsSync(receipts/local/ + state.active_local_task + '-done.md'))` fails because STATE.json still has `active_local_task: "OL-20261118-041"` while the done receipt now exists.

At the exact pinned source (stage worktree, before publication) the same 4 tests pass 4/4; the red appears ONLY on the report HEAD tree containing the new LO-041 + done receipt + unchanged STATE.json. Same class as the OL-20261113-024 precedent: the guard needs the remote's ACK/state-sync commit (`last_accepted_local` → OL-041/LO-041, `active_local_task` → null, LOCAL_AGENT_TASK.md → NO ACTIVE TASK) before it goes green again. Minimal repro on any checkout containing the done receipt with unchanged STATE.json. No local action taken; product state not edited locally per protocol.

## 14. Sanitized security review

Report contains only: SHAs, CI run numbers, test counts, tool versions, synthetic fixture behavior, and generic service probe codes. No real file paths, session/workspace IDs, Weixin IDs, tokens, secrets, config JSON, or host identifiers exposed. Private evidence stayed outside the repository and real projects; nothing pushed is credential output. (Updated section 13a after observing the report-commit CI failure; the only added content is assertion text and line numbers.)

## 15. Exact next remote code tasks

1. Fix `keys()` in `src/local-first/real-apply-contract.ts` (:48–51) to use `Reflect.ownKeys` + `Object.getPrototypeOf === Object.prototype` + string-only-key guards (mirror the ledger fix at 6dff9f34); add a hidden-key + prototype-chain test.
2. Design and independently test the OS-isolated apply helper: native `openat`-equivalent (C binding) anchored to a root dir fd; inode identity revalidation; ACL/xattr/flags/hardlink/symlink reject-or-fully-preserve; bounded crash injection per journal/write/sync step with kill-after-each-step; exclusive writer/maintenance domain proof. Until then real Apply gates stay BLOCKED per REAL_APPLY_GATES.md and docs/014 (all 7-gate matrix rows PENDING).
3. Extend I1B toward real DSH Sessions/AgentDelivery + Worker model-route coverage beyond the fake envelope (keep fake-host tests as regression, not acceptance).
4. After 1–3 land with own CI 3/3, operator-granted one-shot I2 (isolated disposable project copy, STOP BEFORE SOURCE APPLY), then a separately granted I3 window — never inferred from this batch.
5. State-sync commit (remote-owned): after ACKing LO-041, update `agent-handoff/STATE.json` (`last_accepted_local` → OL-20261118-041/LO-20261118-041 with this report commit + report CI, `active_local_task` → null) and revert LOCAL_AGENT_TASK.md to NO ACTIVE TASK, so the two handoff-convergence guards pass again; then re-run CI to 3/3.
