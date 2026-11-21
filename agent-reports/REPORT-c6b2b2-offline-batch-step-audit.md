# C6B2B2 — Non-Git Multi-File Transactional Step-Audit State Machine Offline Acceptance Report

- Verdict: **ALL_OFFLINE_PASS**
- Repository: `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`
- Accepted baseline SHA: `77a8152c524b6ad72a8e7e5ab2eee61a5fa8d94b` (clean detached worktree, `git status --porcelain` empty; HEAD verified)
- Scope: synthetic temporary projects only (private 0700 `mkdtemp` fixtures, cleaned after the run). No real project write, no DSH session prompt, no WeChat message, no service restart (3080/3083/8123 untouched), no reuse of historical authorizations, no production database, no global model change. No product code was modified locally.

## 1. CI baseline (step 1)

CI run `42745463820` for the exact SHA `77a8152` verified via the GitHub API: `completed` / `success`, all three jobs green (`local-first-core`, `macos-portability`, `dsh-typecheck-and-build`) — 三项全绿 confirmed, no queue cancellation this time. Bounded polling only.

## 2. Local toolchain verification (step 2)

At the exact SHA in a fresh worktree (all exit codes shown; zero failures). Node suites run individually at the exact SHA:

| Command | Exit code | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | PASS |
| `pnpm check` (includes `pnpm test:unit`) | 0 | Vitest: 62 files passed, 1208 tests passed, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-batch-audit.node-test.mjs` | 0 | 9/9 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-batch-recovery.node-test.mjs` | 0 | 7/7 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-batch-stage.node-test.mjs` | 0 | 13/13 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-apply.node-test.mjs` | 0 | 12/12 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-projects.node-test.mjs` | 0 | 3/3 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-project-workspaces.node-test.mjs` | 0 | 10/10 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-existing-dsh-projects.node-test.mjs` | 0 | 6/6 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-model-queue.node-test.mjs` | 0 | 6/6 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-weixin-native.node-test.mjs` | 0 | 6/6 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-weixin-qr.node-test.mjs` | 0 | 4/4 tests, 0 fail |
| `node --experimental-strip-types --test scripts/probe-local-llm.node-test.mjs` | 0 | 3/3 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` (standalone HTTP proxy suite) | 0 | 5/5 tests, 0 fail |
| all 21 `tests/*.node-test.mjs` (minus the proxy suite) + probe script in one run | 0 | 168 tests, 0 fail |

Note: `tests/local-weixin-bridge.node-test.mjs` and `tests/local-openclaw-plugin.node-test.mjs` still do **not** exist at this SHA (the WeChat suites are `local-weixin-native` / `local-weixin-qr`); every actually-present suite was run. Failure log summary: none.

## 3. Durable per-file step progression and persisted event order (steps 2–3)

Private 0700 synthetic fixture: registered non-Git project `notes` with `modify.txt`, `delete.txt`, executable `run.sh` (mode `0700`); snapshot taken; worker changes (add `new.txt` with binary bytes, modify `modify.txt`, delete `delete.txt`, mode-only change `run.sh` → `0644`); previewed and sealed with a one-shot 0600 stage grant → 4 sealed change rows. A **separate** independent 0600 audit grant (`operation: plan-batch-steps`, its own `approvalId` + `executionId`, distinct from the stage approval) drove `beginNonGitBatchAudit` → `issueNextNonGitBatchReviewStep` → `confirmNonGitBatchReviewStep` through all 4 rows.

Final harness run: exit 0, fail=0, 54 positive checks + 23 adversarial rejections (log excerpt preserved in the private harness dir, redacted here):

- `beginNonGitBatchAudit` returns a durable `ready` receipt: `status: ready`, `autoApplyAllowed: false`, `nextIndex: 0`, `pendingIndex: null`, `events: []`; journal written under `<audit-root>/execution-<id>/audit.json` — owner-only file (`0600`) inside an owner-only directory (`0700`).
- Persistence is atomic: temp `.audit-<uuid>` (`wx`, 0600) → write → `handle.sync()` → close → `rename` → `syncDirectory`; verified **no temp residue** after every step.
- **All audit logs live outside the project source directory**: a full recursive tree snapshot of the source (paths + modes + content hashes) and of the sealed stage root contains no `audit.json`, no lock file, at any point of the lifecycle (during the run and after completion). The audit journal directory is validated to be 0700, non-symlink, and disjoint from source/worker/stage roots.
- Per-file advancement: for each of the 4 rows, `issue` records `awaiting-human` with `pendingIndex = i` **before** any human action occurs, and `autoApplyAllowed` stays `false`. A second `issue` while a step is pending is rejected (`Batch audit cannot issue another step`) — exactly one open step at a time.
- `confirm` (after the simulated human action) advances `nextIndex` by exactly one, appends exactly one `confirmed` event, and the event count is `2*(i+1)`; after the final row the status is terminal `complete` with `pendingIndex: null`.
- Persisted event order in the durable ledger: `issued,confirmed,issued,confirmed,issued,confirmed,issued,confirmed` — strictly alternating, index-sorted, verified by reading the final `audit.json` from disk.

## 4. Independent simulated human writes; auditor is read-only (step 4)

The only source mutation in the harness is the simulated human step (`simulateHuman`): it copies the worker after-image bytes into the source and `chmod`s to the sealed `afterMode`; for a `delete` row it removes the file. The audit module never performs this action itself.

- After the full lifecycle, the source shows exactly the sealed after-images: `modify.txt` content `after`, `delete.txt` absent, `new.txt` binary bytes `01 ff 00 07`, `run.sh` mode `0644` — content **and** full POSIX mode confirmed via the read-only recovery inspector embedded in `issue`/`confirm`.
- Read-only proof: a full-tree snapshot (bytes + modes + symlink checks) taken before and after `issue` + a failing `confirm` is byte-for-byte identical — the auditor wrote nothing to the source. Static audit of the module confirms this: the only `writeFile` call site is `src/local-first/non-git-batch-audit.ts:126` (the journal temp file), and the module imports only read primitives (`lstat`/`readFile`/`realpath`) — no source writers.

## 5. Crash-window simulations (step 5)

Two harnesses: the in-flow crash windows inside the acceptance harness (fresh-process read of the persisted ledger) and `crashstates.mts`, which hand-writes persisted ledger rows simulating a process that died mid-step (real blob-style before/after OIDs so the recovery inspector classifies correctly). Final run of both: exit 0, fail=0.

- **Crash after the durable `issued` checkpoint, before the human action**: a fresh process reads the pending ledger (`status: awaiting-human`, `pendingIndex: 0`, one `issued` event, `autoApplyAllowed: false`) and must not replay it — re-`issue` is rejected (`cannot issue another step`), no duplicate `issued` event is ever appended, and a failed `confirm` leaves the source at the before-image (no automatic restore, apply, or repair).
- **Crash after the human action, before confirmation**: the ledger is readable without replay; the single `confirm` observation advances `nextIndex` to 1 and appends one `confirmed` event; the `issued` event is **not** duplicated (verified `events.filter(action==='issued').length === 1`); terminal state advances once only; a second `confirm` without a new `issue` is rejected (`No pending batch step eligible for observation`).
- **Orphaned lock**: a `.batch-audit.lock` left by a crashed holder makes every mutating operation fail closed (`EEXIST` on the `wx` open) with **no lock stealing and no retries**; the read-only query still works (it does not take the lock), the lock is never auto-removed (human intervention required), and the source stays untouched.
- No auto-recovery anywhere: `readNonGitBatchAudit` is documented and proven to "never resume or retry a previous step" (`src/local-first/non-git-batch-audit.ts:327-337`).

## 6. Adversarial rejections (step 6)

All 23 negatives rejected fail-closed; error strings verbatim from the final harness log (fixture temp paths redacted):

| Scenario | Rejection |
| --- | --- |
| External change to an already-confirmed earlier file blocks next `issue` | `Batch source no longer matches audited per-file boundary` |
| Human applies wrong POSIX mode (not the sealed after-mode) | `Batch source not at expected per-file boundary; human review required` (ledger terminalized `review-required`) |
| Misordered human action (a future row applied first) | same boundary error, terminalized `review-required` |
| `issue` attempt after `complete` | `Batch audit cannot issue another step` |
| `issue` attempt after `review-required` | `Batch audit cannot issue another step` |
| Duplicate `approvalId` re-arm of a consumed audit | `Batch audit approval was already consumed` |
| Parallel second ledger for the same project while the first is unfinished (even a `ready` one) | `Prior batch execution needs human reconciliation` (serialization fix from `77a8152` confirmed working) |
| Tampered ledger fields without fixing the digest | `Batch audit integrity check failed` |
| Digest recomputed but impossible event sequence (confirmed without issued) | `Impossible batch audit event sequence` |
| Duplicated `issued` events (skipped/double step) | `Impossible batch audit event sequence` |
| Orphaned legacy lock, no stealing | raw `EEXIST` on `.batch-audit.lock` (see finding F2 — path leak) |
| Wrong project fingerprint in the grant scope | `Batch audit project/seal scope mismatch` |
| Seal manifest with >24 changes | `Batch audit project/seal scope mismatch` |
| Seal status not `sealed` (e.g. `intent`) | `Batch audit project/seal scope mismatch` |
| Empty sealed changes list | `Batch audit project/seal scope mismatch` |
| Symlinked audit grant file | `Batch audit grant must be owner-only normal file` |
| Audit root with group bits (0750) | `Audit root must be an owner-only normal directory` |
| Audit root a symlink | `Audit root must be an owner-only normal directory` |
| Missing `audit.json` | `Missing or incomplete batch audit requires human review` (fail-closed, masked) |
| Garbled `audit.json` | `Corrupt batch audit requires human review` (masked) |
| Forged digest-valid ledger (own digest, `nextIndex: 2`, no events) | `Batch audit state does not match event history` (history replay defeats forgery) |
| Journal directory opened to group (0750) | `Untrusted batch audit journal` |
| Journal `audit.json` replaced by a symlink | `Untrusted batch audit journal` |

The task's "invalid sealed manifest" case is also proven end-to-end: the audit re-validates the seal via `verifyNonGitStagedBatch` before any step (digest, scope, sealed status, change count, per-row object-format consistency), so a tampered or out-of-range manifest never reaches the state machine.

## 7. Production caller audit (step 7)

Repo-wide `grep` at the exact SHA over `src/`, `scripts/`, `tests/` for `non-git-batch-audit`, `beginNonGitBatchAudit`, `issueNextNonGitBatchReviewStep`, `confirmNonGitBatchReviewStep`, `readNonGitBatchAudit` — excluding the module itself and its own node test — returns **zero hits**; `src/index.ts` and `src/app/*.ts` contain zero `BatchAudit`/`batch-audit` mentions. The module has no Runtime, Worker, WeChat, Outbox, or Prompt production caller: default OFF, wired only for offline/synthetic use so far.

## 8. C6B2A missing-`seal.json` masking re-check (step 8)

Re-verified at this SHA: `readPrivateJson` (`src/local-first/non-git-batch-stage.ts:151-164`) masks `ENOENT`/`ENOTDIR`/`SyntaxError` to `Unsealed or corrupt batch requires manual reconciliation` and never leaks the private journal path; `verifyNonGitStagedBatch` masks a missing batch directory to `Batch directory is unsafe or unavailable` (`:305-311`). The regression test `tests/local-nongit-batch-stage.node-test.mjs:192-205` (missing seal in an existing incomplete batch is sanitized and fails closed) asserts the exact message and that `journalRoot` does not appear in it; the batch-stage suite is now **13/13** (up from 12/12 at C6B2B1 — the masking regression test was added by `8ae54c9`). Durable ordering re-confirmed: images fsynced before `seal.json` (`writeDurable` = `wx` 0600 → write → `sync` → close → parent `syncDirectory`, `:93-96`; `seal.json` written last, `:285-286`).

## 9. Findings for remote ChatGPT

- **F1 — worker-side staged after-image drift does not block `issue`.** `issueNextNonGitBatchReviewStep` re-checks only the *source* per-file boundary (`src/local-first/non-git-batch-audit.ts:293-295`) and never re-verifies the staged after-images in the worker snapshot. If the worker directory drifts after `beginNonGitBatchAudit`, the drift is detected only at `confirm` time (terminalized `review-required`). Proven in the harness: `issue` succeeds after worker drift, the human copies the drifted bytes, `confirm` freezes with the boundary error and the ledger terminalizes `review-required`. Acceptable fail-closed behavior, but remote may want the drift checked at issue time so a human is never asked to apply bytes that no longer match the seal.
- **F2 — the orphaned-lock error is the module's only unmasked throw.** `locked()` (`src/local-first/non-git-batch-audit.ts:133-139`) lets the raw `EEXIST` propagate, and Node's message embeds the **absolute audit-root path** (`EEXIST: file already exists, open '<audit-root>/.batch-audit.lock'`). Every other ledger error is deliberately masked to a human-review string precisely to avoid leaking private paths; this one breaks that pattern. Remote should sanitize the lock error message (e.g. `Batch audit lock exists; human reconciliation required`).
- No defect prevented acceptance; both findings are informational and the state machine passed every required check.

## 10. Mandatory limitations (must remain stated)

- Multi-file writes are **not atomic**: the human applies the sealed batch row-by-row over time; a crash mid-batch leaves a partially-applied source, which is exactly why the state machine records per-file `issued`/`confirmed` evidence instead of promising a transaction. The ledger digest is a **state record, not a write authorization** — `issued` means only that a human-review checkpoint was durably recorded (`autoApplyAllowed: false` everywhere; a separately approved executor is still required for any production Apply).
- External write races and path TOCTOU risks are **not eliminated**: the auditor observes content + mode via `lstat`/read, but an external process may modify a file between observation and the next persisted event; the recovery inspector's own `Source changed during recovery observation` double-`lstat` guard narrows the window but does not close it, and the audit does not scan unplanned files or prove quiescence.

## 11. Environment and rollback

- Nothing was changed on the host: no service (3080/3083/8123) touched, no WeChat action, no real project write, no provider change, no production data. Only GitHub: one report-only commit pushed (non-force) to `feat/local-first-wechat-foundation`.
- Rollback: revert/delete the report commit; the local worktree and temp fixtures are disposable and were removed after the run.
