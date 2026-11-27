# REPORT — OL-20261113-025 · C6B2B5R offline synthetic nofollow receipt acceptance (macOS)

**Verdict: `ALL_OFFLINE_PASS`.** Scope: OFFLINE_SYNTHETIC_ONLY. No real Apply, Weixin, production authorization, DSH service, model/provider/credential, or historical-grant reuse.

## 1. Environment (independent Mac)

- macOS product version 26.3, architecture arm64; Node v25.9.0; pnpm 11.7.0.
- Worktrees: claim at dispatch HEAD `3b762713c8fef9485bf2cf37d98856a1381f8860`; stage detached at pinned SOURCE `0ed50723b57811b54129b4347ecea7651b2b6d50` (clean, `git status` 0 lines).
- Dispatch `3b76271` vs pinned `0ed5072` diff = 4 handoff/docs files only (`LOCAL_AGENT_TASK.md`, `CURRENT_STATE.md`, `WORK_QUEUE.md`, the OL-025 message) — zero source/test changes → CI evidence is valid for the pinned source.

## 2. Claim

- Claimed once BEFORE execution: GitHub receipt commit `e8b87d1ea894202c6385b6de2a3dca34db630168` (non-force fast-forward `3b76271..e8b87d1`, remote HEAD verified after push; no retry), plus private claim file (status claimed). No automatic retry after claim.

## 3. Source CI cross-check (read-only)

- CI #390 run `43339186653` (`https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43339186653`): conclusion success, 3/3 jobs (`local-first-core`, `dsh-typecheck-and-build`, `macos-portability`), head_sha = pinned `0ed5072…` exactly.
- Job logs: Linux leg `# tests 225 / # pass 225`, proxy `# tests 5 / # pass 5`; the new adversarial test `synthetic inspection rejects hardlinked receipt without consuming or rewriting it` executed (`ok 160`); macOS leg ran on a genuinely allocated `macos-15` runner and shows `✔` for the same hardlink test. Vitest 62 files / 1208 + build success per job logs.

## 4. Local parity at pinned source (exit codes recorded)

- `pnpm install --frozen-lockfile` → exit 0.
- `pnpm check` → exit 0 (Vitest 62 files / 1208 tests passed; build complete).
- CI-exact workflow Node command (23 files) → exit 0, `225/225` pass, 0 fail.
- Standalone ledger suite `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` → exit 0, `43/43` (includes the new hardlink test ✔, oversized-receipt ✔, mode/malformed fail-closed ✔).
- Proxy suite `tests/local-openai-queue-proxy.node-test.mjs` → exit 0, `5/5`.
- Standalone ledger enrollment in workflow: present on both OS legs.

## 5. Source review at pinned SHA (`src/local-first/non-git-synthetic-approval-ledger.ts`, `inspectSyntheticApproval` ~:113-129)

The receipt is now inspected through an opened descriptor instead of a path re-lstat:
`open(file, O_RDONLY|O_NOFOLLOW|O_NONBLOCK)` → `handle.stat()` (before) → guard `!isFile() || nlink!==1 || (mode&0o777)!==0o600 || size>4096` → `handle.readFile()` → `handle.stat()` (after) → compare `raw.byteLength>4096 || after.dev/ino/size/mtimeMs/ctimeMs !== before` → `JSON.parse`.
ALL throws inside the try (including the inner `Unsafe synthetic reservation` and `Synthetic reservation changed during inspection`) are swallowed by a blanket `catch` and re-thrown as `Corrupt synthetic reservation; human reconciliation required`. Source comment states explicitly: still NOT descriptor-relative root isolation, NOT protection from a cooperating same-user in-place writer.

Behavior deltas audited (documented, not defects):
1. **Error message change:** unsafe-mode / symlink / hardlink / oversized receipt refusals now surface as `Corrupt synthetic reservation…`, not `Unsafe synthetic reservation…` (blanket catch). Carried P5/P6/H5 matcher expectations updated accordingly in the harness; the refusal itself is unchanged (fail closed, read-only).
2. **Mode strictness tightened:** exact `0o600` required now (previous code accepted any mode with `(mode&0o077)===0`, e.g. `0o400`); `0o400` receipts are now refused (R3).
3. **Symlink refusal mechanism:** O_NOFOLLOW on open (ELOOP) instead of lstat `isSymbolicLink()` (R2); target stays untouched.

## 6. Independent adversarial harness (owner-only 0700 disposable fixtures under tmpdir)

`preflight_acceptance.mts` (private, re-pointed at the stage worktree): **ok=769 fail=0**, exit 0. New R-groups at pinned source + all carried B4C–B5Q layers re-verified green:

- R1 hardlink alias: receipt hardlinked to a journal-side alias (nlink=2) → inspect refused (`Corrupt…`); receipt bytes+ino+size+mode+mtime identical afterwards (no rewrite, no repair); approval NOT reusable (`already reserved`); zero new ledger entries. Matches remote's own new test, independently.
- R2 O_NOFOLLOW: hash-named path replaced by a symlink → inspect refused; rename-target file untouched (bytes+ino); no new entries.
- R3 mode tightening: `0o400` receipt refused; restored `0o600` inspects OK; same inode throughout.
- R4 AUDITED LIMIT (cooperating same-user in-place writer): same inode, SAME size, altered bytes, atime/mtime restored via utimes → inspection PASSES with the altered content (descriptor before/after stat self-consistent within the window; ctime cannot be forged but before==after inside it). Confirms the source comment: not protection from a cooperating in-place writer.
- R5 descriptor size bound: 4100-byte receipt refused (before.size check); file intact, >4096 after refusal.
- R6 fresh OS child process (no remembered identity) inspects a valid receipt successfully — no cross-process state assumption.
- R7 path ABA on the receipt: fresh inode with identical bytes at the same path inspects OK (descriptor self-consistent); approval still not reusable; restoring the original inode at the same path PASSES the best-effort check — audited limit, not a race-free fd-relative capability.
- Carried: exact 4096/4097 boundary (P2: 4096 ACCEPTS, 4097 REFUSES), oversized no-repair + no-reuse (P1/P4/P8/P10), guard ORDER (mode/symlink guards fire before size bound, Q4), torn-parse controls below bound (Q5/P-groups), marker/pin size gates (Q1–Q3), fresh-child DENIED controls (Q6/P-groups), replay/non-consumption invariants (Q7), ancestor/descendant identity-changed controls (G3/B5Q/G8/G9), one-use ledger fencing (B5D), strict schemas (B5E/B5F/B5G/B5H), hostile project ID (B5M), ledger root guard (B5N).

## 7. Gate A.5 (production wiring)

Zero-caller scan over `src/` + `scripts/` (excluding the module itself and its tests) for `non-git-synthetic-approval-ledger`: 0 production callers. Default-OFF read-only module; writes remain `wx` 0600 receipt + 0600 pin + dir fsync. Not wired into DSH Executor yet — remote owns integration.

## 8. Residual limits (unchanged, audited; remote owns fixes)

- Same-user forgery: receipt/marker/pin are integrity evidence, not signatures; a cooperating same-user writer can rewrite content in place with identical inode/size/mtime (R4) and pass inspection.
- No descriptor-relative root isolation: the opened descriptor is path-resolved; cross-root generic-reserve fencing still absent (alternate independent ledger root can re-reserve the same approval ID via the generic reserve).
- Path ABA restores the original inode and passes the best-effort check (R7); OS TOCTOU between realpath/lstat of the ledger root persists (R6 fresh-child proof).
- External writers; Proxy traps run user code during reflection; private transaction authority unresolved; backup/recovery unresolved; tmpdir is not an OS sandbox; real Apply gates unproven — no race-free real Apply claimed.

## 9. Synthetic-only guarantees

Writes only inside owner-only 0700 disposable synthetic fixtures under tmpdir (cleaned up after each case). Untouched: DSH 3080/3083, model proxy 8123, real Weixin, original Session Prompt, production SQLite, model defaults, historical grants, real registered projects' Apply/Rollback. No product source edits locally. STOP after this receipt: OL-20261113-025 must not be replayed; next owner: remote.
