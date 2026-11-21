# C6B2B4A — Synthetic-Only One-Step Batch Actor Coordinator: Offline Acceptance Report (+ first hourly handoff watcher)

- Verdict: **ALL_OFFLINE_PASS**
- Watcher status: **WATCHER_ACTIVE_DISPATCH_UNAVAILABLE** (hourly read-only check installed and confirmed active; dispatch is notification-only — see §1)
- Repository: `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`
- Message processed: `OL-20261110-001` (claimed before any substantive work; see `agent-handoff/receipts/local/OL-20261110-001-claimed.md`)
- Code-under-test SHA: `a63f6a266256b624a0922fa71d354ca3719b0591` — fresh clean detached worktree (`git status --porcelain` empty)
- Scope: synthetic disposable 0700 fixtures + code review + this report + watcher install only. **REAL PROJECT APPLY / REAL HOST SOURCE WRITE / REAL WEIXIN E2E: NOT RUN.** No 3080/3083/8123 service touched, no original DSH Session Prompt, no production SQLite/journal, no model/provider/default change, no historical one-shot live authorization reused.

## 1. Hourly GitHub watcher — actual installation state (Part A)

Installed per `agent-handoff/LOCAL_WATCHER_SPEC.md`, user-level only, no root, no `sudo`:

- Owner-only private directory `0700` inside the current user's normal configuration area holding `poll.sh` (`0700`), private state (`0700` dir), per-message claim/pending files (`0600`), lock directory (`0700`), and log (`0600`). No project/service subdirectory; no world-readable credentials.
- LaunchAgent label `local.dsh-superagent.handoff-watch`, `StartInterval=3600`, `RunAtLoad=true`; plist mode `0600`, `plutil -lint` OK, no secret in the plist.
- `launchctl bootstrap gui/<uid> <plist>` exit 0. `launchctl print gui/<uid>/local.dsh-superagent.handoff-watch` confirms: `type = LaunchAgent`, `state = running`, `active count = 1`, program `/bin/bash` + the absolute owner-only `poll.sh`, `last exit code = 0`, spawn type daemon. No unrelated service touched.
- **Non-reentrancy proven:** with the private `.lock` directory pre-created, a manual poll exits 0 immediately without doing any GitHub work (mkdir-based exclusive lock, safe no-steal; the trap removes it only when the holder exits). No duplicate process observed (`pgrep` for the poller: 0 transient).
- **Quiet-on-unchanged proven:** after the first successful run recorded the inspected head (`state/last_head`), a second run with the same branch HEAD exits 0 with an **empty log and no GitHub commit** — no heartbeat file.
- Read-only GitHub surface only: branch HEAD, `agent-handoff/messages/to-local/`, `agent-handoff/receipts/local/`, `LOCAL_AGENT_TASK.md`. Message schema validated literally (`from`, `to`, `type`, `scope` in the offline allowlist, exact 40-hex `code_sha`, `requires_live_host_approval` boolean, and the code SHA must appear in the active `LOCAL_AGENT_TASK.md`); malformed/out-of-scope/uncovered messages are logged and **not executed**. Message bodies are never executed as shell (fields parsed as data only).
- Persisted claim state: the bootstrap message `OL-20261110-001` is recorded as claimed in private state **and** on GitHub (claim commit pushed before substantive work), so neither the hourly tick nor a reboot can start it twice. Claimed-but-not-done is never auto-retried; reconciliation is manual.
- Dispatch capability check (spec step 4): the installed `dsh` CLI does expose a documented headless entry (`dsh --profile headless "<job>"` in the CLI command grammar, and a `headless` profile directory exists), but a direct noninteractive test on this host failed before any inference with `MISSING_CREDENTIAL: llm-deepseek: no API key for provider route "deepseek-official"` (plus a preset activation warning), and the CLI is not on the default `launchd` PATH. A credential-less, PATH-less automatic dispatch from the watcher is therefore **not a verified safe noninteractive entry point**. The watcher is configured **notification-only** (macOS user notification + private `pending-<id>` file) and reports `WATCHER_ACTIVE_DISPATCH_UNAVAILABLE`. No CLI was invented; no raw message content is ever run as a command.
- **Log sanitization check:** watcher log contains zero credential/token strings (grep for token patterns → 0 hits), no home paths of other users, no Weixin content; only timestamps, branch-level outcomes and message IDs.
- **Disable/rollback (one line):** `launchctl bootout gui/<uid>/local.dsh-superagent.handoff-watch`; then remove only this watcher's private directory on request. Nothing else (3080/3083/8123, DSH, model defaults) is affected.

## 2. Local toolchain verification at the exact SHA (Gate A step 1)

All commands exit 0; zero failures (suite names as actually present at this SHA):

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | PASS |
| `pnpm check` (incl. `pnpm test:unit`) | 0 | Vitest: 62 files passed, 1208 tests passed, 0 fail |
| `tests/local-nongit-batch-executor.node-test.mjs` | 0 | 8/8 (C6B2B4A suite) |
| `tests/local-nongit-batch-audit.node-test.mjs` | 0 | 14/14 |
| `tests/local-nongit-batch-recovery.node-test.mts`/`.mjs` | 0 | 7/7 |
| `tests/local-nongit-batch-stage.node-test.mjs` | 0 | 13/13 |
| `tests/local-nongit-apply.node-test.mjs` | 0 | 12/12 (C6B1 regression) |
| `tests/local-projects.node-test.mjs` | 0 | 3/3 |
| `tests/local-project-workspaces.node-test.mjs` | 0 | 10/10 |
| `tests/local-existing-dsh-projects.node-test.mjs` | 0 | 6/6 |
| `tests/local-model-queue.node-test.mjs` | 0 | 6/6 |
| `tests/local-weixin-native.node-test.mjs` | 0 | 6/6 |
| `tests/local-weixin-qr.node-test.mjs` | 0 | 4/4 |
| `tests/local-dsh-relay-coordinator.node-test.mjs` | 0 | 7/7 |
| `tests/local-dsh-relay-routing.node-test.mjs` | 0 | 9/9 |
| `tests/local-dsh-relay-store.node-test.mjs` | 0 | 12/12 |
| `tests/local-dsh-3080-bridge.node-test.mjs` | 0 | 14/14 |
| `tests/local-dsh-3080-model-gate.node-test.mjs` | 0 | 9/9 |
| `tests/local-dsh-3080-new-workspace.node-test.mjs` | 0 | 6/6 |
| `tests/local-dsh-3080-operator-provision.node-test.mjs` | 0 | 4/4 |
| `tests/local-dsh-3080-operator-rpc.node-test.mjs` | 0 | 10/10 |
| `tests/local-dsh-3080-output.node-test.mjs` | 0 | 12/12 |
| `tests/local-dsh-3080-probe.node-test.mjs` | 0 | 1/1 |
| `scripts/probe-local-llm.node-test.mjs` | 0 | 3/3 |
| `tests/local-openai-queue-proxy.node-test.mjs` (standalone HTTP proxy) | 0 | 5/5 |
| all 22 `tests/*.node-test.mjs` + probe script in one combined run | 0 | **181 tests, 0 fail** (176 Node + 5 proxy; matches CI #238 reported 176 Node + 5 proxy) |

`tests/local-weixin-bridge.node-test.mjs` and `tests/local-openclaw-plugin.node-test.mjs` still do not exist at this SHA (the WeChat suites are `local-weixin-native` / `local-weixin-qr`); every actually-present suite was run.

CI for the exact code SHA: run `42784807127` (#238) `completed`/`success`, jobs `local-first-core`, `macos-portability`, `dsh-typecheck-and-build` all `success` (verified via the GitHub API, bounded polling).

## 3. Code review (Gate A step 2/3 context)

`src/local-first/non-git-batch-executor.ts` (new in `02ff4cf`, hardened through `3315e4c`/`a771397`/`a63f6a2`):

- **Fixture-only guard** (`fixtureOnly`): the registered project root must sit inside an OS-temp subtree whose basename matches `dsh-c6b2b4-synthetic-*`, the owner-only marker file `.dsh-c6b2b4-synthetic-only` must exist as a regular, non-symlink, mode-`0700`-masked (owner-only) file with exact text `C6B2B4_SYNTHETIC_ONLY\n`, the fingerprint must match the registry, the project must be `kind: local` and not read-only, and the Worker directory must be inside the same fixture. Any failure → no actor call, no source write.
- **Receipt root isolation** (`privateRoot`): receipt/stage/audit roots must be private non-symlink `0700` directories and must not overlap the source, the Worker, or each other.
- **Third independent grant** (`readGrant`): exact 13 keys (`version`, `operation: synthetic-batch-step`, `grantId`, `transactionId`, `executionId`, `batchId`, `projectId`, `rootFingerprint`, `sealDigest`, `previewDigest`, `stepIndex`, `expiresAt`, `operatorApproved`), owner-only regular file (`0600`-masked), ID format checks, SHA256 hex digests, `stepIndex` in `0..23`, future expiry; re-read before reservation (`Synthetic step grant changed before reservation`).
- **Durable one-shot ordering**: `mkdir step-<transactionId>` (mode 0700) is the reservation — `EEXIST` → `Synthetic step already reserved; human review required`, never retried. Receipt `reserved` is fsync-persisted (atomic `wx` temp + rename + directory fsync) **before** the audit `issue`; audit issue re-checks the source boundary and all sealed Worker images (C6B2B3 guard) before any callback; receipt transitions to `issued` (persisted) **before** the actor callback; after the callback the read-only audit `confirm` verifies the after-image content+mode, then the receipt becomes `observed`. `existing()` scans historical journals first: consumed grant/step → `Synthetic execution grant/step has already been consumed`; a same-project non-`observed` receipt → `Pending synthetic execution needs manual review`.
- **Actor failure semantics**: any throw inside the callback is swallowed into `Synthetic step outcome requires manual inspection; no retry` — no second callback, no rollback, no auto-repair; a crash between actor and confirm leaves the receipt at `issued`.
- **Writers**: the only file writes owned by this module are the step folder + `receipt.json` inside the private receipt root (`mkdir`, `open wx`, `rename`, `rm` cleanup, directory `fsync`). The module has **no source-write primitive**; source mutations are performed solely by the test-supplied actor.
- Receipt `digest` is a sha256 over the row JSON — integrity/corruption evidence only, explicitly **not** a signature and **not** a host authorization.

## 4. Synthetic lifecycle (positive paths)

0700 disposable `mkdtemp` fixture (`dsh-c6b2b4-synthetic-*` under the OS temp dir) with the owner-only exact marker, isolated registered project root, Worker snapshot directory, independent stage/audit/receipt roots (no overlap), and three distinct owner-only `0600` grants — `stage-batch`, `plan-batch-steps`, and a per-step `synthetic-batch-step` (independent, one-use, full-digest match: `sealDigest`, `previewDigest`, `rootFingerprint`, `batchId`, `executionId`, `stepIndex` all validated). Five sorted sealed rows exercised: `delete.txt` (delete), `modify.txt` (modify), `new.txt` (add, binary), `run.sh` (mode-only 0700→0644), `sub/inner.txt` (nested add).

Final harness run (exit 0): **24 scenario-level positive checks + 42 fail-closed rejections + 0 unexpected crashes.**

- All 5 rows executed in sorted order via one independent grant each; every receipt transitioned `reserved → issued → observed` with a persisted file at each phase; step folder `0700`, `receipt.json` `0600`; `autoRetryAllowed: false`; read-back via `readSyntheticBatchStepReceipt` equals the returned row.
- Audit advanced exactly one step per execution (`nextIndex` i+1); final audit status `complete` after the last row; repeated same-grant execution rejected each time (`fresh ready audit boundary` / already consumed).
- Final source state equals the sealed after-images: `delete.txt` gone, `modify.txt` bytes = worker after-image, `new.txt` = exact binary, `run.sh` mode `0644`, nested `sub/inner.txt` present — each actor invoked exactly once per step (callback count 5).
- Receipt digest self-consistency verified by recomputation (integrity, not signature).
- Per-step invariance proof: executing only step 0 (delete) changes exactly the single sealed target; every other file's byte-hash + mode snapshot is identical before/after (full-tree snapshot diff = the one delete row).

## 5. Crash / failure matrix (Gate A step 4)

| Scenario | Observed (harness-verified) |
| --- | --- |
| Actor throws after durable `issued` | Receipt stays `issued`; audit `awaiting-human` with 1 event; actor count stays 1 (no replay, no second callback); same-grant repeat rejected (`fresh ready audit boundary`); source unchanged (`delete.txt` still before-image). No rollback, no auto-repair. |
| Actor writes wrong bytes (tampered instead of deleted) | Execution throws `outcome requires manual inspection`; receipt stays `issued`; audit terminal `review-required` with a `review-required` event; tampered bytes remain for manual inspection. Never silently `observed`. |
| Worker after-image drift before issue | Issue fails inside the coordinator (`Staged worker after-image content/mode drift before issue`); receipt stays `reserved`; audit stays `ready` with 0 events; actor count 0; source unchanged; a **separate** fresh grant for the same step is blocked (`already been consumed` / `Pending synthetic execution needs manual review`) — cannot silently pass the incomplete durable receipt. |
| Sealed evidence image tampered after begin | Issue fails (`Staged worker evidence image changed since sealing`); receipt stays `reserved`; actor count 0. Manual reconciliation required. |
| Foreign `awaiting-human` checkpoint (direct audit `issue` by another caller) | Coordinator rejects (`fresh ready audit boundary`); actor count 0; audit stays `awaiting-human` — no adoption, no replay. |
| Crash between persist and issue (hand-crafted persisted `reserved` journal) | Durable, readable; a brand-new grant is blocked; read-only inspection returns `reserved`; source unchanged. |
| Crash between actor and confirm (hand-crafted persisted `issued` journal) | Durable, readable; new execution blocked; inspection returns `issued`; source unchanged. |
| Competing/rival grant for the same pending step | Rejected before any actor call (`already been consumed`). |

## 6. Negative matrix (Gate A step 5) — all fail closed with actor 0 calls and source byte/mode unchanged

Independent grants: expired, `sealDigest` wrong, weak mode (0644), extra key (exact-13-keys check), missing file, malformed JSON, symlinked file, `executionId` scope mismatch, `stepIndex` beyond the seal — 9 rejections.

Fixture guard: marker removed, marker wrong text, marker weak mode — 3 rejections (`marker missing` / `marker invalid`).

Roots: receipt root inside/overlapping source, receipt root = stage root, symlinked receipt root, weak-mode (0755) receipt root, group-opened (0750) stage root — 5 rejections (`must not overlap` / `root must be private non-symlink directory`). Worker outside the fixture and a non-fixture project root — 2 rejections (fixture guard active).

Historical journals/receipts: empty `step-*` folder, corrupt digest, forged phase (`done`), forged fields with stale digest, weak receipt mode, stepIndex tamper with recomputed digest — 6 rejections (`Unreconciled/Invalid/Untrusted/… integrity mismatch`).

## 7. Design-boundary review (Gate A step 6) and remaining risks

- The test-supplied `actor` is **arbitrary injected code**, not an OS sandbox; only test-controlled callbacks are in scope. The synthetic `mkdtemp` marker guard is a limited extra guard, **not** OS-level quiescence or path-safe `dirfd` APIs; symlink/external-writer/TOCTOU exposure remains.
- sha256 receipt digests are corruption evidence, **not** authenticated signatures, and never a real-host write authorization.
- Multi-file operations remain **NON-ATOMIC**; no general transactional rollback; a crash mid-batch leaves a partially applied source and requires manual reconciliation of BOTH the receipt and the audit ledger.
- The coordinator has no source-write primitive by design; production application would need a real, separately authorized source-apply executor (C6B2B4B — NOT authorized here).
- Callbacks are fundamentally not crash-atomic with the filesystem: a throw after `issued` can leave either no change or a partial change; the harness proved the ledger/receipt stay honest, but the source state itself must be inspected manually.
- The watcher cannot grant new host authority; any live action still needs a fresh human approval outside GitHub content.

## 8. Zero production callers and zero real writes (Gate A step 7, Gate B)

- Repo-wide caller scan at the exact SHA for `non-git-batch-executor`, `executeOneSyntheticBatchStep`, `readSyntheticBatchStepReceipt` over `src/` and `scripts/` (excluding the module itself and the node tests): **zero hits** — no Runtime, Worker, native Weixin, Outbox, DSH Session Prompt or server-configuration caller. Default OFF.
- Zero real project writes: every test ran inside a freshly created `mkdtemp` fixture removed afterwards; the registered project root was always the fixture's own directory. Real operator project roots, the `WeChat-SuperAgent` workspace sources, and all product code remained untouched (only report/handoff documentation commits pushed).
- Gate B honored: no 3080/3083/8123 interaction (the single noninteractive CLI capability probe was a local process boot that died on a missing credential before any inference or session prompt; it did not touch the live services), no real Weixin message, no original Session Prompt, no production SQLite/journal, no model/provider/default change, no historical authorization reuse, no 3083 staging. The only host mutation this round is the new user-level LaunchAgent (§1) plus GitHub documentation commits.

## 9. Rollback

- Watcher: `launchctl bootout gui/<uid>/local.dsh-superagent.handoff-watch` (unloads only this user-level agent; other services unaffected); then remove only the watcher's private directory if instructed.
- GitHub: revert/delete this report commit and the handoff message/receipt commits (normal history, no force-push).
- No service, provider, model, Weixin or project configuration was changed, so nothing else requires restoration.
