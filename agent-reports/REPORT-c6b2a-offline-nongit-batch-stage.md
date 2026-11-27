# C6B2A — Non-Git multi-file sealed staging: offline acceptance

Verdict: **ALL_OFFLINE_PASS** (zero real-host writes; synthetic `0700` fixtures only).

- Repository: `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`
- Exact baseline SHA tested: `fbf0a8f0ef097b71c9608c95f62f549dd8656b37` (`fix(local-first): verify sealed batch modes and refuse corrupt prior batch manifests`)
- Worktree: `.worktrees/stage-c6b2a` (detached at the exact SHA, `git status` clean, **no product code modified by the local Agent**)
- CI run `42629967414` on the exact SHA: **3/3 jobs success** — `local-first-core`, `macos-portability`, `dsh-typecheck-and-build`

## A. Offline test evidence

| Item | Command | Exit | Result |
| --- | --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | 0 | Done (pnpm 11.7.0 via `packageManager` pin) |
| Check | `pnpm check` | 0 | tsdown build OK; Vitest **62 files / 1208 tests** passed |
| New module suite | `node --experimental-strip-types --test tests/local-nongit-batch-stage.node-test.mjs` | 0 | **10/10** |
| C6B1 single-file suite | `tests/local-nongit-apply.node-test.mjs` | 0 | **12/12** (module byte-identical between `8723187` and `fbf0a8f`: `git diff` empty) |
| Combined run | all 18 local-first Node suites (excluding the HTTP proxy lane) + `scripts/probe-local-llm.node-test.mjs` in one process | 0 | **144/144** |
| Independent proxy lane | `tests/local-openai-queue-proxy.node-test.mjs` | 0 | **5/5** |

Platform note: no macOS-specific divergence in this stage; the historical `/var` → `private/var` symlink issue in `tests/local-projects.node-test.mjs` was already fixed upstream (`c509a6a`) and the fixture canonicalizes `realpathSync(mkdtempSync(...))`.

## B. Contract reviewed (`src/local-first/non-git-batch-stage.ts`, 343 lines)

- Exports `stageNonGitChangeBatch(input: SnapshotRequest, opts: { journalRoot, approvalFile })` and read-only `verifyNonGitStagedBatch(input, opts: { journalRoot, batchId, expectedPreviewDigest })`. **There is no apply or rollback API** — the words appear only in three documentation comments ("does not grant apply authority", "never calls a mutating source method").
- `NonGitBatchStageGrant`: `version: 1`, `operation: 'stage-batch'`, `approvalId`, `batchId`, `projectId`, `rootFingerprint`, `previewDigest`, `expiresAt`, `operatorApproved: true` — validated with an **exact-key** check (`exactly()` rejects any extra/missing field), IDs `/^[a-z0-9][a-z0-9-]{7,79}$/`, digests `/^[0-9a-f]{64}$/`, expiry must parse and be in the future.
- Grant file must be absolute, a regular **non-symlink** file with `mode & 0o077 === 0` (0600).
- Journal root: absolute, owner-only, non-symlink directory that must **not overlap** either the source project or the worker workspace (both containment directions checked).
- Limits: `MAX_FILES = 24`, `MAX_COPY_BYTES = 64 MiB` (cumulative across the batch).
- Flow: read grant → project/fingerprint scope → private root → outer `.batch-stage.lock` opened `wx` (never broken automatically) → `syncDirectory` → `existingBatches()` audit of **every** prior `batch-*` directory (unsafe dir/mode, unreadable `intent.json`/`seal.json`, seal/intent mismatch, recomputable-digest check, consumed-approval check) → `verifyProjectSnapshot` → project must be registered, `kind: 'local'`, not `readOnly`, fingerprint matching → `mkdir batch-<id>` (mode 0700) **reserving the batch id permanently, before any other work**, and `syncDirectory(root)` → durable `intent.json` (`open('wx', 0600)` + `writeFile` + `sync` + parent-dir `sync`) → preview (digest mismatch / empty / >24 → `Stage digest mismatch, empty batch or too many files`) → per-file capture → re-preview → pre-seal content+mode re-check of every image against both source and worker → grant re-read (must be byte-identical JSON) → durable `seal.json` → `syncDirectory(folder)`.
- `capture()` streams and hashes the file, re-`lstat`s it afterwards and compares `size`, `ino`, `dev`, `mode`, `mtimeMs` (`File changed while staging`), then `copyFile(..., COPYFILE_EXCL)` into `before-NNN.bin`/`after-NNN.bin`, forces `0600` + `fsync`, then **re-hashes both the image and the source** against the expected OID.
- `hashedFile()` supports both git (SHA-1, 40-hex) and the module's SHA-256 (64-hex) blob object formats, so preview OIDs are verifiable.
- `verifyNonGitStagedBatch` re-checks seal status/scope, recomputes the manifest digest, re-previews the project and compares plan ↔ manifest element-by-element, verifies every image's OID **and mode 0600**, verifies current source/worker OID **and exact recorded mode** (`Original or Worker file content/mode drift since seal` — mode-only drift is caught even though git blob OIDs are identical), and rejects any file in the folder outside the `intent.json`/`seal.json`/image allowlist.

## C. Synthetic positive acceptance (`~/.dsh-superagent-private/c6b2a/adversarial.mts`, final exit 0, `fail=0`)

1. **Multi-file add/modify/delete + binary**: sorted plan `[binary.bin add, change.txt modify, sub/delete.txt delete]`; batch dir `0700`; `intent.json`, `seal.json`, `before-001.bin`, `after-001.bin`, `after-000.bin` all `0600`; binary image byte-exact `[0,255,1,2]`; `intent.json` persists the grant; **source bytes untouched** (`change.txt` still `old content`, `sub/delete.txt` still `gone`, `binary.bin` absent, `.env` kept private); `verifyNonGitStagedBatch` returns a manifest identical to the seal and is **deterministic across repeated runs with no hidden writes**; journal root contains only the batch dir (lock removed at end of run).
2. **Mode-only change** (worker `chmod 0700 → 0600`, identical content): recorded as one `modify` change with `before === after` OID, `beforeMode: 0o700`, `afterMode: 0o600`; verification passes and the source mode is untouched.
3. **Boundary 24 files / 64 MiB** (`boundary_crash.mts`, final exit 0, `fail=0`): a 24-file plan seals successfully within limits and leaves the source untouched; **25 files refused** (`Stage digest mismatch, empty batch or too many files`); a 65 MiB worker file refused (`Unsafe or oversized source/worker file in batch`); an **empty** plan refused.
4. **Grant tampered mid-staging** (60 MiB worker file to slow the preview, grant rewritten concurrently): `Batch stage grant changed before sealing`; source untouched.
5. **External source write during staging** (same slow-preview trick, source rewritten concurrently): `Original project changed since worker snapshot`.

## D. Negative / adversarial matrix (all fail-closed, exact messages)

| Scenario | Result |
| --- | --- |
| Expired grant | `Invalid or expired multi-file stage grant` |
| Grant `chmod 0644` | `Stage approval must be owner-only regular file` |
| Grant replaced by symlink | same |
| Extra untrusted field in grant JSON | `Invalid or expired multi-file stage grant` |
| Wrong `projectId` scope | `Batch stage grant does not match registered project` |
| Wrong `rootFingerprint` scope | `Batch stage grant does not match registered project` |
| Wrong preview digest | `Stage digest mismatch, empty batch or too many files` |
| Reused `approvalId` after a successful seal | `Batch stage approval was already consumed` |
| Reused `batchId` | `EEXIST` on `mkdir` (reserved id never overwritten) |
| External write to source before staging | `Original project changed since worker snapshot` |
| Worker drift after preview (extra file) | `Stage digest mismatch, empty batch or too many files` |
| Journal root symlink | `Batch journal root must be private non-symlink directory` |
| Journal root group-readable (`0750`) | same |
| Journal root inside the source project | `Batch journal root must not overlap source or worker` |
| Worker file replaced by a symlink | `Unsafe symlink or special file in project change preview` |
| Corrupt prior `intent.json` blocks any later stage | `Unsealed or corrupt batch requires manual reconciliation` |
| Forged prior seal whose digest is not recomputable | `Corrupt sealed batch requires manual reconciliation` |
| Verify: unknown extra private file in batch dir | `Unexpected file in private sealed batch` |
| Verify: corrupted sealed image | `Corrupted sealed batch image` |
| Verify: image made group-readable | `Unsafe private batch image` |
| Verify: tampered seal content | `Batch seal digest mismatch` |
| Verify: source `chmod` drift after seal (identical OIDs) | `Original or Worker file content/mode drift since seal` |
| Verify: worker `chmod` drift after seal | same |
| Verify: empty `changes` array | `Batch seal metadata mismatch` |
| Verify: batch directory absent | raw `ENOENT` from `lstat` (fail-closed, but see G.1) |

## E. Crash / incomplete-seal evidence

- **Crash left by the oversized-file rejection**: the batch directory persists with `intent.json` and **no `seal.json`**, no images completed, source untouched; **every subsequent stage is blocked** with `Unsealed or corrupt batch requires manual reconciliation` until a human removes or reconciles it. No automatic cleanup, no automatic retry.
- **Orphan `.batch-stage.lock`** (simulated crash): a new stage fails with `EEXIST` on `open(lock,'wx')`; the module **does not remove the orphan lock**, source untouched; after the operator removes it manually, a new stage succeeds.
- Batch id is reserved by `mkdir` before any evidence is written, so a crash permanently consumes the id (a re-run with the same id hits `EEXIST`), which is the intended "never overwrite completed private evidence" behaviour.

## F. Default-OFF / integration audit

- Repo-wide search for `stageNonGitChangeBatch` / `verifyNonGitStagedBatch` outside the module: **zero call sites**. The module is not re-exported from `src/index.ts` or `src/app/`. No Runtime, DshExecutor/Worker, Weixin or Ticket reference exists.
- The module contains **no source-mutating primitive**: the only write calls are `open(...,'wx')` for the journal and `copyFile(..., COPYFILE_EXCL)` into the private journal folder; no `rename`, `unlink` on source, `truncate`, `chmodSync`, or `writeFile` targeting the registered project.
- **No batch Apply interface exists** — sealed evidence ≠ applied change, and a sealed multi-file plan is explicitly **not** an atomic multi-file apply.
- The C6B1 one-file module (`src/local-first/non-git-apply.ts`) is **unchanged** between `87231872` and `fbf0a8f` (empty diff).

## G. Remaining risks / blockers for remote follow-up

1. **Interface nit (candidate `BLOCKED_DESIGN` follow-up, non-fatal)**: `verifyNonGitStagedBatch` on a *missing* batch directory throws a raw `ENOENT` from `lstat` (`non-git-batch-stage.ts:287`) instead of the designed `Batch directory is unsafe`. Fail-closed, but the error is generic and would leak a private absolute path into a caller's log. A `try`/`catch` around the `lstat` (or an `existsSync` guard) would make the contract explicit.
2. **Image durability ordering**: each captured image is `fsync`ed via `open(to,'r+')` + `h.sync()`, but the containing batch directory is not synced after each image write — only `syncDirectory(root)` after the `mkdir` and after `seal.json`. After a crash, image *contents* are durable while directory entries may not be, so `intent.json` can exist without the images it references.
3. **TOCTOU with ordinary Node path APIs**: hashing, `copyFile`, and re-hashing are path-based (not `openat`/dirfd-relative), so an external process that swaps a symlinked ancestor or replaces a file between checks and the operation is not fully excluded. The module mitigates this with post-operation re-hash and `ino`/`dev`/`mtime` comparison, which catches content drift but not every ancestor-swap race.
4. **External concurrent writers**: the `.batch-stage.lock` serializes only module users. A third-party writer can still change the source between the final drift check and the seal (mitigated by the pre-seal re-hash, not eliminated).
5. **Multi-file atomicity**: staging is evidence-only and bounded to 24 files / 64 MiB. A future apply must be journaled and explicitly **non-atomic** across files (no cross-file rollback), with strengthened OS-level quiescence before any real host write.
6. **Canonical-mode semantics carry over**: sealed manifest records exact `beforeMode`/`afterMode`, but nothing yet restores the original mode on a real apply — that remains C6B1's rollback-only behaviour.
7. **No permission token performs a source write** in this module; a real batch apply would need a **new independent human live-host authorization** (C6B2B, not authorized in this stage).

## H. Explicit NOT RUN

**REAL BATCH APPLY: NOT RUN. REAL HOST SOURCE WRITE: NOT RUN. REAL WEIXIN E2E: NOT RUN.**

## I. Zero-real-write declaration

No real registered project source directory, no `3080`/`3083`/`8123` service, no production SQLite, no original Session, no historical approval (C5.5B Weixin grant remains consumed and untouched), no WeChat message, no DSH prompt, no service restart, no default-model/profile edit, and no real apply/rollback was performed. All harness files live in disposable `0700` temporary directories and were removed at the end. The only host-side change from this stage is this report and its commit on the feature branch. No rollback of real services is required.
