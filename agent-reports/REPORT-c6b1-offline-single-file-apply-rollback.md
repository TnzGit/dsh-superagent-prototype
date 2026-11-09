# C6B1 — Non-Git single-file Apply/Rollback offline safety acceptance

Verdict: **ALL_OFFLINE_PASS** (zero real-host writes; synthetic fixtures only).

- Repository: `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`
- Exact SHA accepted: `87231872afe647b5506930a2d7ea127046e82692` (`test: assert explicit fail-closed content-or-mode drift`)
- Worktree: `.worktrees/stage-c6b1` (detached at the exact SHA, `git status` clean, no product code modified locally)

## A. CI and offline test evidence

| Item | Command | Exit | Result |
| --- | --- | --- | --- |
| CI #216 | run `42619521864` on the exact SHA | — | 3/3 jobs success: `local-first-core`, `dsh-typecheck-and-build`, `macos-portability` |
| Install | `pnpm install --frozen-lockfile` | 0 | Done (pnpm 11.7.0 via `packageManager` pin) |
| Check | `pnpm check` | 0 | tsdown build OK; Vitest **62 files / 1208 tests** passed |
| Product suite | `node --experimental-strip-types --test tests/local-nongit-apply.node-test.mjs` | 0 | **12/12** |
| Related suites | `tests/local-project-workspaces.node-test.mjs`, `tests/local-projects.node-test.mjs` | 0 | 10/10, 3/3 (macOS `/var`-symlink fixture issue fixed upstream in `c509a6a`) |
| Combined run | 18 local-first suites in one process | 0 | **134/134** |
| Independent HTTP proxy suite | `tests/local-openai-queue-proxy.node-test.mjs` | 0 | 5/5 |

Platform note: the only macOS-specific divergence was the historical `/var` → `private/var` symlink assertion in `tests/local-projects.node-test.mjs`, already fixed upstream by canonicalizing `realpathSync(mkdtempSync(...))` in the fixture. No other platform differences observed.

## B. Contract reviewed (`src/local-first/non-git-apply.ts`, 310 lines)

- `applyOneNonGitFile(input: SnapshotRequest, opts: { journalDirectory, approvalFile })` and `rollbackOneNonGitFile(same shape)` are the only exports; `NonGitFileApproval` is `version: 1` with `operation: 'apply' | 'rollback'`, `approvalId`, `transactionId`, `projectId`, `rootFingerprint`, `previewDigest`, `expiresAt`, `operatorApproved: true`, plus `rollbackOfTransactionId` (rollback-only, must differ from its own transaction).
- `transactionId` must match `/^[a-z0-9][a-z0-9-]{7,79}$/`; digests `/^[a-f0-9]{64}$/`.
- Approval file must be an absolute, regular, **non-symlink** file with `mode & 0o077 === 0` (0600).
- Journal statuses: `prepared` → `applying` → `applied`, and `rolling-back` → `rolled-back`. Journal root must be an owner-only non-symlink directory that **must not overlap** the source project or the worker workspace.
- Single lock file `.single-file-apply.lock` opened with `wx`; an existing lock is **never broken automatically** (human audit required).
- `noPendingTransaction`: any `tx-*` directory with status `prepared`/`applying`/`rolling-back`, or an unreadable `journal.json`, fails closed with `Unreconciled transaction journal must be manually reviewed`.
- Apply path: approval scope check → journal root → lock → no-pending → preview (digest mismatch or `changes.length !== 1` → `Single-file plan digest mismatch or more than one change`) → `mkdir tx-<id>` (EEXIST on reuse) → record `beforeMode` → private `before.bin` backup via `copyVerified` → worker drift check → durable `prepared` journal (temp + `fsync` + `rename` + `syncDir`) → **re-check approval** → durable `applying` → final source drift + exec-mode drift checks → action (`add` = hardlink from temp with no-clobber; `modify` = rename; `delete` = `unlink`) → `syncDir` → post-write verification → durable `applied`.
- Rollback path requires a **fresh** approval (reuse after `rolled-back` → `Rollback journal scope or terminal status mismatch`), validates journal directory and file trust (`Untrusted transaction journal directory`, `Unsafe private transaction journal file`), and re-hashes `{projectId, rootFingerprint, sourceRevision, changes:[row.change]}` against `previewDigest` (`Transaction journal change no longer matches approved preview`).
- Rollback accepts the source only if it matches the **before image with the exact recorded `beforeMode`**, or the **after image at the module canonical mode** (`0700` for executable, `0600` otherwise). Content alone is insufficient — mode-only edits share a blob OID, so a foreign `chmod` after apply must not qualify. If already restored, bytes are **not** rewritten. Otherwise restored from `before.bin` with `row.beforeMode` (`Private rollback backup corrupt`).
- Applied files carry the module canonical mode, not the original mode; the exact original mode returns only through an independent rollback.

## C. Synthetic positive acceptance (0700 temp fixtures, never a real project)

Harness: `~/.dsh-superagent-private/c6b1/adversarial.mts` — final run exit 0, `fail=0` (3 positive groups + 20 negatives + 1 mode-only group).

1. **Modify + rollback**: apply → `status: applied`, source `edited\n`, applied mode `0600`; journal records `beforeMode: 0o644` and `beforeExecutable: false`; `before.bin` backup exists; rollback restores **exact bytes and exact original mode 0644**; re-using the same rollback approval is rejected.
2. **Add + rollback**: hardlink no-clobber apply; journal has no before image; rollback deletes the added file exactly.
3. **Delete + rollback**: apply deletes; rollback restores backup bytes **and** the original executable mode 0755.
4. **Mode-only change** (worker `chmod 0600 → 0755`, identical content): preview still reports `action: modify` with `executable: true` despite identical blob OIDs; apply sets the canonical exec mode `0700`; rollback restores exact `0600`, `status: rolled-back`.

## D. Negative / adversarial acceptance (all fail-closed, with exact messages)

| Scenario | Result |
| --- | --- |
| Expired approval | `Invalid or expired single-file operator approval` |
| Approval `chmod 0644` | `Operator approval must be owner-only non-symlink` |
| Approval file replaced by a symlink | same |
| Approval digest tampered | `Single-file plan digest mismatch or more than one change` |
| Approval `rootFingerprint` tampered | `Apply approval scope mismatch` |
| Approval rewritten mid-flight during a slow preview (100 MB worker file, concurrent `approvalId` rewrite) | `Private approval changed before source write` |
| Multi-file plan | `Single-file plan digest mismatch or more than one change` |
| External write to source after worker snapshot | `Original project changed since worker snapshot` |
| Foreign `chmod` on source after apply (content = after image, mode ≠ canonical) | `Source content or mode changed since apply; manual review required` |
| Symlink added in source | `Unsafe symlink or special file in project change preview` |
| Journal root replaced by symlink | `Journal root must be owner-only non-symlink directory` |
| Journal directory inside the source project | `Journal must not overlap source project or worker workspace` |
| Reused transaction id (pre-existing `tx-<id>`) | `mkdir` EEXIST; source untouched (asserted) |
| Pending `prepared` journal | `Unreconciled transaction journal must be manually reviewed`; source untouched |
| Corrupt `journal.json` in a `tx-*` dir | `Unreconciled transaction journal must be manually reviewed` |
| Forged `row.change.after` in journal | `Transaction journal change no longer matches approved preview` |
| Corrupt `before.bin` | `Private rollback backup corrupt` |
| Worker file drift after preview | digest mismatch |
| Transaction directory `chmod 0750` | `Untrusted transaction journal directory` |
| `journal.json` `chmod 0644` | `Unsafe private transaction journal file` |

## E. Crash-state simulation (`crashstates.mts`, final exit 0, `fail=0`)

- **A — crash after `applying` journal, before the mutation.** New apply blocked (`Unreconciled…`); source bytes **untouched** (no auto-retry, no auto-write). A manual rollback with a fresh grant succeeds **without rewriting** existing bytes (restored short-circuit) → `rolled-back`.
- **B — crash after the mutation while journal still `applying`** (source = after image at canonical `0600`). New apply blocked; manual rollback reverts to exact original bytes → `rolled-back`.
- **C — crash during rollback** (`rolling-back` with `rollbackApprovalId` already set). **Both** new apply and new rollback blocked (`Unreconciled…` / `Rollback journal scope or terminal status mismatch`); the consumed rollback grant can never re-fire; source stays at the before image, manual reconciliation required.

Manual-intervention scenarios that must never be auto-resolved:
1. `prepared` — crash before any source write; no write happened; operator may remove the journal dir after audit.
2. `applying` — crash before or during mutation; source may be before- or after-image; only a fresh manual grant resolves it.
3. `rolling-back` — crash during rollback; both operations blocked until a human decides; that specific grant is spent.
4. Corrupt/unreadable `journal.json` in any `tx-*` directory — blocks **all** new applies until removed.
5. Left-behind `.single-file-apply.lock` after a crash — the module never breaks it (`wx` open would EEXIST); a human must remove it.
6. `EEXIST` transaction directory (reused transaction id) — operator must reconcile/remove.

## F. Default-OFF confirmation

Repo-wide search for `applyOneNonGitFile` / `rollbackOneNonGitFile` (excluding the module and its own test) returns **zero** call sites. The module is not re-exported from `src/index.ts` or `src/app/`; Runtime, Weixin and Worker do not reference it. No environment flag, Outbox or Prompt integration exists → the new write path is **default OFF**.

## G. Remaining risks for remote follow-up

1. **External concurrent writers** — the module's lock serializes only module users. Between the final drift check and the `rename`/`unlink` there is a window in which a third-party process can change the source; post-write verification catches content drift but a concurrent writer could still win the race.
2. **Path races / TOCTOU** — operations use plain path-based `stat`/`rename`/`unlink`, not `openat`/directory-file-descriptor-relative calls, so a symlink swap of an ancestor between checks and the operation is not fully excluded (journal root and source are checked, but not re-verified at write time).
3. **Crash durability ordering** — the journal is write-ahead durable (`temp` + `fsync` + `rename` + `syncDir`) before the source write, and `syncDir` follows the mutation; the private backup is written before the journal. The unverified gap is whether the backup itself is `fsync`ed before the `prepared` journal on all platforms.
4. **Multi-file atomicity** — exactly one file per transaction; multi-file plans are refused outright, so a multi-file change needs N sequential single-file transactions with no cross-file atomicity and no aggregate digest rollback.
5. **Canonical-mode semantics** — applied files get `0700`/`0600`, not the original mode. If an operator approves an apply but never approves the rollback, the project keeps the module's canonical mode, which may differ from the intended mode.
6. **No integration yet** — `LocalProjectRegistry`/worker snapshots still have no DSH Executor or Ticket wiring, so the apply/rollback module currently has no production caller.

## H. Zero-real-write declaration

No real project source directory, no `3080`/`3083`/`8123` service, no historical Session, no production database, no historical approval, no WeChat message, no service restart and no real prompt was touched. All files created by the harness live in disposable `0700` temporary directories and were removed at the end. The only host-side change in this stage is this report and its commit on the feature branch.
