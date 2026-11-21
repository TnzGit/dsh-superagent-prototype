# C6B2B3 — Non-Git Sealed-Worker After-Image Issue Guard (F1) + Audit Lock Redaction (F2) Offline Safety Report

- Verdict: **ALL_OFFLINE_PASS**
- Repository: `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`
- Tested code SHA: `5a4f560795d0a65cb947b78535bc6c3fee68029a` (fresh clean detached worktree, `git status --porcelain` empty). Fix commit under test: `fde77c7` (gate audit issue on sealed worker bytes; redact orphan lock paths) + docs commit `5a4f560`.
- Scope: synthetic disposable 0700 fixtures + code review + this report only. **REAL BATCH APPLY / REAL PROJECT WRITE / REAL WEIXIN E2E: NOT RUN.** No service (3080/3083/8123) touched, no 3083 restart, no real WeChat message, no original 3080 Session Prompt, no production database write, no model default change, no reuse of historical authorizations, no product-code edits locally.

## 1. CI baseline (step 1)

CI run `42754023369` (run #234) for the exact SHA `5a4f560` verified via the GitHub API: `completed` / `success`; jobs `local-first-core`, `macos-portability`, `dsh-typecheck-and-build` all `success` (三项全绿). Bounded polling only.

## 2. Local toolchain verification at the exact SHA (step 1)

All commands exit 0; zero failures:

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | PASS |
| `pnpm check` (includes `pnpm test:unit`) | 0 | Vitest: 62 files passed, 1208 tests passed, 0 fail |
| `tests/local-nongit-batch-audit.node-test.mjs` | 0 | 14/14 (was 9/9 at C6B2B2; 5 new F1/F2 tests added by `fde77c7`) |
| `tests/local-nongit-batch-recovery.node-test.mjs` | 0 | 7/7 |
| `tests/local-nongit-batch-stage.node-test.mjs` | 0 | 13/13 |
| `tests/local-nongit-apply.node-test.mjs` | 0 | 12/12 |
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
| `tests/local-openai-queue-proxy.node-test.mjs` (standalone HTTP proxy suite) | 0 | 5/5 |
| all 21 `tests/*.node-test.mjs` (minus the proxy suite) + probe script in one run | 0 | 168 tests, 0 fail |

`tests/local-weixin-bridge.node-test.mjs` and `tests/local-openclaw-plugin.node-test.mjs` still do not exist at this SHA (WeChat suites are `local-weixin-native` / `local-weixin-qr`); every actually-present suite was run.

## 3. Code review of the fixes (steps 2–3)

- **F1 fix** — new export `verifyNonGitStagedWorkerAfterImages` in `src/local-first/non-git-batch-stage.ts` (read-only attestation of an EXISTING sealed batch that does NOT require the original source to equal its starting snapshot, so previously confirmed manual steps do not cause false rejections). `issueNextNonGitBatchReviewStep` (`src/local-first/non-git-batch-audit.ts:292-312`) now takes a required `stageRoot` option and calls this verifier **before** persisting the `issued` event. The verifier checks, for EVERY sealed row: both evidence images when present (regular file, non-symlink, mode `0600`, OID recomputed with sha1 for 40-hex / sha256 for 64-hex formats per `hashedFile`), the worker after-image content hash AND full POSIX mode (`afterMode` + `afterExecutable` consistency), deleted paths still absent in the worker, worker path ancestors non-symlink directories, `intent.json`/`seal.json` cross-match plus seal integrity digest, and no unexpected private file in the batch folder (`readdir` allow-list). All Node path errors (`ENOENT`/`ENOTDIR`/`EACCES`/`EPERM`) are masked to `Staged worker evidence is missing or inaccessible` (no private path leak). Static review: the verifier uses only `lstat`/`readFile`/`hashedFile` reads — **zero writer calls** (verified: no `writeFile`/`chmod`/`rm`/`rename`/`mkdir` anywhere in the function).
- **F2 fix** — `locked()` (`src/local-first/non-git-batch-audit.ts:133-146`) catches the `EEXIST` from the `wx` lock open and throws the sanitized `Batch audit lock exists; human reconciliation required` (no raw Node error, no absolute path); non-`EEXIST` errors still propagate. Still no lock stealing and no retries; the lock is removed in the `finally` on success.
- `beginNonGitBatchAudit` validates the independent 0600 `plan-batch-steps` grant (`readGrant`: exact 11 keys, owner-only regular file, ID formats, `operatorApproved: true`, expiry in the future), scope match against the seal (`projectId`/`rootFingerprint`/`batchId`/`sealDigest`/`previewDigest`), re-validates the pristine batch via `verifyNonGitStagedBatch` at begin (C6B2A behavior unchanged, not substituted mid-batch), and double-reads the grant (`Batch audit grant changed during preflight`). `privateAuditRoot` now also rejects overlap with the sealed stage root.

## 4. Synthetic lifecycle with the guard active (steps 2–4 happy path)

0700 disposable fixture: independent, non-overlapping project/worker/stage/audit roots; non-Git project `notes` with `modify.txt` (modify), `delete.txt` (delete), `new.txt` (add, binary `01 ff 00 07`), nested `sub/inner.txt` (add), `run.sh` (mode-only 0700 → 0644) — sealed with an independent one-shot 0600 `stage-batch` grant into 5 sorted change rows (all 40-hex sha1 blob OIDs, confirmed by probe), then an **independent** 0600 `plan-batch-steps` grant (`sealDigest`/`previewDigest`/`rootFingerprint`/`batchId` all matched — step 2 full-digest match asserted).

Final harness run (`node --experimental-strip-types`, exit 0, fail=0): **53 positive checks + 29 fail-closed rejections.**

- Durable `ready` receipt (`autoApplyAllowed: false`, `events: []`); owner-only journal `0600` in `0700` dir; atomic temp+rename with no residue; no `audit.json` or lock artifact anywhere inside the source tree or the sealed stage root (logs outside source, step 8).
- Full per-file progression across all 5 rows: `issue` records `awaiting-human` **before** any simulated-human source write (worker images intact), `confirm` advances exactly one step each; event sequence `issued,confirmed` ×5 alternating and sorted; terminal `complete`, `pendingIndex: null`.
- Lock hygiene: `.batch-audit.lock` released after every successful operation — asserted absent between all 5 steps and at completion (step 6's "verify locks release after successful normal operations").
- The independent simulated human applies the sealed after-images (content + POSIX mode `0644` on `run.sh`) — the audit module itself never performs this.
- `verifyNonGitStagedWorkerAfterImages` on a clean sealed batch passes and is read-only: source and worker full-tree snapshots (bytes + modes + symlink flags) identical after a double invocation.
- Every returned ledger row kept `autoApplyAllowed: false`; seal SHA256 and ledger digests are state records, **not** authorization.

## 5. F1 direct tests (step 3) — tamper after `begin`, refusal BEFORE the checkpoint

For each variant, `issueNextNonGitBatchReviewStep` rejects, and afterwards the ledger is verified `status: ready`, `nextIndex: 0`, `pendingIndex: null`, **events array unchanged (length 0)**, source untouched:

| Worker tamper | Rejection (verbatim) |
| --- | --- |
| After-image bytes changed (`modify.txt`) | `Staged worker after-image content/mode drift before issue` |
| After-image full POSIX mode changed (`run.sh` 0644→0700) | `Staged worker after-image content/mode drift before issue` |
| Worker-deleted file reintroduced (`delete.txt`) | `Staged worker deleted path reappeared before issue` |

## 6. F1 on a LATER step after a confirmed synthetic file (step 4)

Issue row 0, simulated human edits that row in the synthetic source, confirm it, then drift a future worker after-image (`new.txt` bytes rewritten in the worker). The following `issue` rejects with `Staged worker after-image content/mode drift before issue` — **not** a per-file-boundary error, and the verifier does **not** demand the already-changed original source revert to its starting snapshot (asserted: error message contains no boundary complaint; confirmed source file stays at its after-image; ledger keeps `nextIndex: 1`, events `issued,confirmed`, no new event, no pending step created). This proves the source-independent design works exactly as intended.

## 7. Private sealed-evidence tamper matrix (step 5) — all fail-closed at issue

Each variant restores pristine evidence first (independent negations), then the next `issue` rejects with no source write and no issuance:

| Tamper | Rejection (verbatim) |
| --- | --- |
| Sealed after-image evidence bytes corrupted | `Staged worker evidence image changed since sealing` |
| Evidence image chmod to group-readable (mode anomaly) | `Unsafe staged worker evidence image` |
| Evidence image replaced by a symlink | `Unsafe staged worker evidence image` |
| Evidence image deleted (missing file) | `Staged worker evidence is missing or inaccessible` (masked, no path) |
| Extra unexpected file injected into the private batch folder | `Unexpected private file in staged worker evidence` |
| `seal.json` metadata edited without digest fix | `Staged worker seal no longer matches private evidence` |
| `seal.json` digest-valid forged truncation (changes sliced) | `Staged worker seal no longer matches private evidence` (JSON cross-match vs the in-memory seal defeats forged digests) |
| `intent.json` `approvalId` forged | `Staged worker seal no longer matches private evidence` |
| Worker path ancestor redirected to a symlink | `Unsafe staged worker path ancestor` |
| In-memory seal mismatched vs private mirror | `Batch audit metadata mismatch` |
| Whole batch folder removed | `Staged worker evidence is missing or inaccessible` |
| Stage root opened to group (0750) | `Batch journal root must be private non-symlink directory` |

OID format handling verified: the real stager produces 40-hex sha1 blob-prefixed OIDs for every row (probed: `delete.txt before=40`, `modify.txt before/after=40`, `new.txt after=40`, `run.sh before/after=40`, `sub/inner.txt after=40`); the verifier accepts either 40-hex (sha1) or 64-hex (sha256) and selects the hash via `oid.length` (`hashedFile(objectFormat)`). Full mode validation includes `afterMode` range/int + `afterExecutable` consistency.

## 8. F2 orphan-lock test (step 6)

Owner-only orphan `.batch-audit.lock` pre-created in the 0700 audit root:

- `beginNonGitBatchAudit` rejects with the exact message `Batch audit lock exists; human reconciliation required`; asserted the message contains **no** audit-root path, no source path, no stage path, no fixture path (no private path leak).
- `issue` and `confirm` reject with the same sanitized message (same guard).
- The lock is **not** deleted, **not** stolen across repeated attempts, and there are **no** retries; the previous journal is unchanged; the source stays untouched (`modify.txt` still before-image).
- The read-only query does not take the lock; with no journal yet it returns the masked `Missing or incomplete batch audit requires human review` (also no path leak).
- Normal-operation lock release proven in §4 (absent between every step).

## 9. Interruption / replay / concurrency re-tests (step 7)

- **Crash after durable `issued`, before the external manual write**: fresh-process read shows `awaiting-human`, one `issued` event, `autoApplyAllowed: false`; re-`issue` rejected (`Batch audit cannot issue another step`); no auto-repair, no auto-restore, source stays before-image.
- **Crash after the manual write, before `confirm`**: ledger readable without replay; the single `confirm` advances once; the `issued` event is not duplicated; a second `confirm` without a new issue is rejected (`No pending batch step eligible for observation`).
- **`review-required` terminal**: confirm with a missing manual after-image freezes the batch (`Batch source not at expected per-file boundary; human review required`) and durably records a `review-required` event; afterward `issue` is rejected; source untouched; no automatic retry/rollback/apply.
- **Duplicate approvalId re-arm**: rejected (`Batch audit approval was already consumed`).
- **Concurrent duplicate project ledger** while the first attempt is unfinished (even `ready` or `awaiting-human`): rejected (`Prior batch execution needs human reconciliation`).
- **Tampered event history with recomputed digest**: confirmed-without-issued and duplicated-issued sequences both rejected (`Impossible batch audit event sequence`); a digest-valid forged ledger (nextIndex 2, empty events) rejected by history replay (`Batch audit state does not match event history`).
- **Invalid/expired private grants**: expired `expiresAt` rejected at begin (`Invalid or expired batch audit grant`); grant mode 0644 rejected (`Batch audit grant must be owner-only normal file`).
- **External change to an already-confirmed source file** blocks the next issue (`Batch source no longer matches audited per-file boundary`).
- Audit-root overlap with the sealed stage root rejected at begin (owner-only dir requirement).

## 10. Source-invariance proof and caller audit (step 8)

Full source-tree snapshot (per-entry name + full POSIX mode + type + sha256 content) before and after `issue` + a failing `confirm` + `read`:

```
BEFORE: ["delete.txt:644:file:bb99758d9f4d","modify.txt:644:file:6db7d803e74f","run.sh:700:file:306c6ca74075"]
AFTER:  ["delete.txt:644:file:bb99758d9f4d","modify.txt:644:file:6db7d803e74f","run.sh:700:file:306c6ca74075"]
```

byte-for-byte and mode-for-mode identical; the audit ledger exists only under the audit root. Static writer audit: the audit module's only write is the journal persist (`file.writeFile` at `non-git-batch-audit.ts:126`, plus journal `rename`/`mkdir`/lock `unlink` in the audit root); the new F1 verifier has zero writer calls; imports are read primitives only. Repo-wide caller scan at the exact SHA for all audit entry points and `verifyNonGitStagedWorkerAfterImages` over `src/`, `scripts/` (excluding the three local-first modules themselves): **zero hits** — no Runtime, Worker, Weixin, or Outbox production caller; default OFF.

## 11. Remaining risks and limitations (must remain stated)

- Multi-file writes are **not atomic**; a crash mid-batch leaves a partially applied source (the per-file ledger is precisely the reconciliation evidence).
- A durable `issued` event remains a **write-ahead human-review checkpoint, not a write authorization**; `autoApplyAllowed: false` on every result. A real batch Apply (C6B2B4 source apply executor) is NOT authorized and needs its own explicit approval + OS-level project quiescence.
- External write races / path TOCTOU are **not eliminated**: the F1 verifier and the recovery inspector use ordinary path-based Node `lstat`/`readFile` APIs and do not guarantee quiescence against non-cooperating external writers; the double-`lstat` guard in the recovery inspector narrows but does not close the window (content can still change between observation and the persisted event; an attacker-observable race remains).
- The audit lock serializes only participating audit calls; it does not fence other writers of the same project.
- The F1 guard verifies the worker/staged evidence at issue time, but between `issue` and the human's manual write the worker after-images could theoretically drift again — the human applies bytes they verified, and `confirm` catches source-boundary divergence fail-closed.
- Existing C6B2A `verifyNonGitStagedBatch` validates the pristine project only at `begin` (unchanged by design); the new verifier is used mid-batch instead, per task instructions.

## 12. Environment and rollback

Nothing on the host was changed: no service (3080/3083/8123) touched, no WeChat action, no real project write, no provider/model default change, no production database. The only mutation is this single report-only commit pushed (normal non-force fast-forward) to `feat/local-first-wechat-foundation`. Synthetic fixtures were removed after the run; sanitized acceptance evidence (harness scripts + final redacted logs) kept in the private local directory only. Rollback: revert/delete the report commit.
