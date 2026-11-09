# C6B2B1 — Non-Git Multi-File Recovery-State Read-Only Offline Acceptance Report

- Verdict: **ALL_OFFLINE_PASS**
- Repository: `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`
- Accepted baseline SHA: `2e1ee00c8ae0236ce75e11e633006ce758090e55` (clean detached worktree, `git status --porcelain` empty; HEAD verified)
- Scope: synthetic temporary projects only (private 0700 `mkdtemp` fixtures, cleaned after the run). No real project write, no DSH session prompt, no WeChat message, no service restart, no reuse of historical authorizations, no production database, no global model change. No product code was modified locally.

## 1. CI baseline (step 1)

CI run `42665477581` (run 223, push event) for the exact SHA `2e1ee00`:
- **attempt 1**: `local-first-core` = success, `dsh-typecheck-and-build` = success, `macos-portability` = **cancelled** (queued ~15 min on the `macos-latest` runner with no steps executed, then cancelled by the workflow's `cancel-in-progress` concurrency group — a platform/queue condition, not a code failure; run conclusion `failure`).
- **attempt 2** (targeted rerun of the failed job only, `gh run rerun --failed`): `completed` / `success` — all three jobs (`local-first-core`, `dsh-typecheck-and-build`, `macos-portability`) green.

So the accepted baseline ends at 3/3 green; the transient macOS cancellation is recorded as `BLOCKED_INFRA_MACOS` **only** for attempt 1 and does not block this task. Bounded polling only (20 × 30 s), no unbounded waiting.

## 2. Local toolchain verification (step 2)

At the exact SHA in a fresh worktree (all exit codes shown; zero failures). Node suites run individually at the exact SHA (counts re-measured just before publishing):

| Command | Exit code | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | PASS |
| `pnpm check` (includes `pnpm test:unit`) | 0 | Vitest: 62 files passed, 1208 tests passed, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-batch-recovery.node-test.mjs` | 0 | 7/7 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-batch-stage.node-test.mjs` | 0 | 12/12 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-nongit-apply.node-test.mjs` | 0 | 12/12 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-projects.node-test.mjs` | 0 | 3/3 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-project-workspaces.node-test.mjs` | 0 | 10/10 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-existing-dsh-projects.node-test.mjs` | 0 | 6/6 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-model-queue.node-test.mjs` | 0 | 6/6 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-weixin-native.node-test.mjs` | 0 | 6/6 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-weixin-qr.node-test.mjs` | 0 | 4/4 tests, 0 fail |
| `node --experimental-strip-types --test scripts/probe-local-llm.node-test.mjs` | 0 | 3/3 tests, 0 fail |
| `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` (standalone HTTP proxy suite) | 0 | 5/5 tests, 0 fail |
| all 20 `tests/*.node-test.mjs` (minus the proxy suite) + probe script in one run | 0 | 153 tests, 0 fail |
| merged batch-recovery + batch-stage + nongit-apply + proxy | 0 | 36 tests, 0 fail |
| merged batch-recovery + batch-stage + nongit-apply + projects + project-workspaces | 0 | 44 tests, 0 fail |

Note: `tests/local-weixin-bridge.node-test.mjs` and `tests/local-openclaw-plugin.node-test.mjs` do **not** exist at this SHA (the WeChat suites are `local-weixin-native` / `local-weixin-qr`); the task's suggested file names are stale and every actually-present suite was run instead. Failure log summary: none — no failed tests, no error output beyond notices.

## 3–4. Five recovery states on the sealed batch (steps 3–4)

Private 0700 synthetic fixtures: a registered non-Git project `notes`, snapshot taken, worker changes (add `new.txt`, modify `modify.txt`, delete `delete.txt`, plus a mode-only change to executable `run.sh`), previewed, and sealed via `stageNonGitChangeBatch` with a one-shot 0600 grant (4 sealed change rows). `inspectNonGitBatchRecovery` / `classifyNonGitBatchObservations` produced (final harness run exit 0, fail=0):

- `unchanged` — every observed row matches the sealed before-image (content OID + POSIX mode); 4 × `before` positions.
- `partially-applied` — a subset (1 of 4) matches the after-image while the rest match the before-image (positions: 1 × `after`, 3 × `before`).
- `fully-applied` — all rows match the after-image.
- `diverged` — foreign content on `modify.txt` (neither before nor after), and, separately, a foreign POSIX mode on `modify.txt` with identical bytes: the mode-only drift is detected and the file reports `diverged`; state `diverged`.
- `indeterminate` — a sealed row whose before-image and after-image are identical in OID **and** mode cannot be positioned; the row is `indeterminate`, state `indeterminate`.

Mode-only differentiation proven: `run.sh` has identical OIDs before and after with different modes; observing mode `0o600` classifies `before`, observing `0o644` classifies `after` (with the rest unchanged the batch state is `partially-applied`, never `fully-applied`).

A planned-add file (`new.txt`) absent in the source is observed as `{}` (absent) and correctly classifies as `before` — the missing-file case is a positive, not a rejection.

Read-only proof: after a full inspection the source file's bytes (SHA-256) and POSIX mode were re-measured and identical — the inspection wrote nothing. **Every** result carries `autoApplyAllowed: false` and `needsHumanReview: true` (verified across all five states, mode-only differentiation, absent-add case, and every positive run); there is no automatic Apply, Rollback, retry, or repair anywhere in the module.

## 5. Adversarial inputs (step 5)

All rejected fail-closed; error strings below are verbatim from the final harness log:

| Case | Outcome |
| --- | --- |
| Forged seal `digest` | REJECTED `Batch seal integrity mismatch` |
| Forged `action` inside a seal row (digest not recomputed) | REJECTED `Batch seal integrity mismatch` |
| Observation entry missing `mode` while `oid` present | REJECTED `Invalid batch recovery observation` |
| Observation subset (missing row) | REJECTED `Incomplete batch recovery observation` |
| Duplicate observation | REJECTED `Incomplete batch recovery observation` (length exceeds row count) |
| Out-of-order observation | REJECTED `Invalid batch recovery observation` |
| Observation mode `0o1777` | REJECTED `Invalid batch recovery observation` |
| Observation OID `zzzz` | REJECTED `Invalid batch recovery observation` |
| Wrong `projectId` (unregistered) | REJECTED `Unknown project ID` (registry fails closed before inspection) |
| Wrong `fingerprint` | REJECTED `Batch recovery project identity mismatch` |
| Symlink in the observed source tree | REJECTED `Symlink traversal denied` (never followed) |
| Source file > 64 MiB | REJECTED `Unsafe or oversized source file in recovery inspection` |
| Sealed path with `../` traversal segment | REJECTED `Invalid sealed recovery path/order` |
| Sealed rows out of sorted order | REJECTED `Invalid sealed recovery path/order` |
| Seal with >24 rows | REJECTED `Invalid sealed batch recovery input` |
| `beforeExecutable` inconsistent with `beforeMode` | REJECTED `Invalid sealed recovery before-image metadata` |
| Mixed object formats (40-hex + 64-hex) in one batch | REJECTED `Mixed object formats in sealed recovery` |

Crash/interleaving states (hand-crafted journals; separate harness, exit 0, fail=0; a third check confirms reconciliation):

- Batch folder with `intent.json` + crash residue and **no** `seal.json`, verified via `verifyNonGitStagedBatch`: raw `ENOENT: no such file or directory, lstat '…/seal.json'` (see §F — private path appears in this message).
- Batch folder removed entirely (missing batch): REJECTED `Batch directory is unsafe or unavailable` (masked, no private path).
- Orphan journal lock present, batch folder absent: REJECTED `Batch directory is unsafe or unavailable`.
- Stale unsealed batch (intent + residue, no seal) present when staging a **new** batch: REJECTED `Unsealed or corrupt batch requires manual reconciliation` — new staging is blocked fail-closed until a human reconciles; the source stays at the before-image and nothing is rewritten automatically.
- Foreign content after seal (`verifyNonGitStagedBatch`): REJECTED `Original project changed since worker snapshot`.
- Foreign POSIX mode after seal (same bytes): REJECTED `Original or Worker file content/mode drift since seal`.

## 7. C6B2A re-check (step 7)

Confirmed in the accepted baseline: file-image writes go through `writeDurable` — `writeFile` → `handle.sync()` → close → `syncDirectory` of the parent — i.e. fsync of the image **before** the directory-entry barrier (`src/local-first/non-git-batch-stage.ts:93-96`, `143-145`); private batch images are persisted **before** `seal.json` is ever created (`src/local-first/non-git-batch-stage.ts:263-265`), so a sync failure leaves an incomplete batch requiring manual reconciliation instead of a half-sealed one. Missing-batch errors are masked: `verifyNonGitStagedBatch` maps `ENOENT`/`ENOTDIR` to `Batch directory is unsafe or unavailable` without embedding private absolute paths (`src/local-first/non-git-batch-stage.ts:295-303`).

## 8. Production wiring audit (step 8)

Repo-wide grep for `inspectNonGitBatchRecovery` / `classifyNonGitBatchObservations` and for references to `non-git-batch-recovery` across `src/`, `scripts/`, `server/`, `tests/`: the only references outside the module are its own offline node test (`tests/local-nongit-batch-recovery.node-test.mjs`). The module is not exported through `src/index.ts`, not wired into any Runtime, Worker, WeChat bridge, or Outbox path. Default OFF confirmed; the module exposes inspection data only — no Apply interface.

## 9. Documented limitations (inherent, not defects)

- **Path races / external concurrent writes**: the inspector observes the live source tree file-by-file; a concurrent external writer can change a file between the read and the verdict. Per-file guards exist (`Source changed during recovery observation` via size/dev/ino/mtime/mode re-check around the stream read), but the multi-file batch verdict is a snapshot best-effort, not a transactional isolation.
- **Non-atomic multi-file writes**: a batch Apply (when implemented later) is a sequence of independent file writes; a crash between files leaves `partially-applied`, which the inspector reports but cannot make atomic.
- **Unplanned file changes cannot be detected**: the inspection validates only the sealed rows. A file added/removed/modified in the source that was not part of the batch is invisible to it (the journal-side guard `Unexpected file in private sealed batch` covers the journal, not the source). A human diff is still required before Apply.
- **Indeterminate before==after rows**: a sealed row identical in OID and mode can never be positioned; the batch verdict must be human-reviewed (`needsHumanReview` stays true).
- **Cross-store OID mixing rejected, not supported**: mixed 40-hex/64-hex object formats in one batch are fail-closed.

## F. Observations for remote ChatGPT (no local code change made)

1. `verifyNonGitStagedBatch` on a folder where `seal.json` is missing (crash residue) throws a raw `ENOENT` from `readPrivateJson`'s `lstat` whose message embeds the private absolute path (unlike the masked `Batch directory is unsafe or unavailable` for a missing folder). Suggested remote-side improvement: mask this like the folder-level case, or route through `Unsealed or corrupt batch requires manual reconciliation`.
2. Duplicate observations are rejected by the length check (`Incomplete batch recovery observation`) before the positional check; this is fail-closed and acceptable, but the message could be made more specific remotely.
3. Infra observation for remote: push-triggered CI runs of **report-only commits** (docs under `agent-reports/`) complete as `failure` with zero jobs and a "workflow file issue" banner (runs 221, 224, 225 — all three attempts), even though the workflow blob is identical to a run that passed 3/3 at the code baseline. Baseline code commits trigger the workflow normally. Likely a transient GitHub-side check-suite issue; if it persists across code pushes, the workflow file itself should be re-examined remotely (no local change made).

## 6. Publishing and post-publish CI

This report was committed to `agent-reports/REPORT-c6b2b1-offline-batch-recovery-inspection.md` on the branch (single file, no code change; pushed to `feat/local-first-wechat-foundation` as commit `8cc15ce`). The report commit's own CI runs — push run `42671697624` (224) and dispatch reruns `42672118636` (225, attempts 1–3) — completed as `failure` with **zero jobs created**: a workflow-level failure on the GitHub side ("This run likely failed because of a workflow file issue"; the check suite contains no check runs, and `gh run rerun` on run 224 reports the run cannot be retried). The workflow file blob is byte-identical to the accepted baseline's (verified with `git show` + `diff`: blob `17ee37577d9b20197975c74471f5bb7cd7d6366f`), and that file passed all three jobs at the baseline. The same zero-job pattern occurred for the earlier C6B2A report commit (push run 221). This is a platform/infra artifact affecting report-only commits, **not** a code failure, and no product code or workflow file was changed locally. Bounded polling only (no unbounded waiting). The accepted code baseline `2e1ee00` is the CI authority for this task and ended 3/3 green.

## G. Risk and rollback

Only local changes this round: new disposable fixtures (auto-cleaned) and a new worktree `.worktrees/stage-c6b2b1`. No service, provider, model, or production configuration was touched; nothing needs rollback beyond removing the worktree at a later cleanup step.
