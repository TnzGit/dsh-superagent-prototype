# LOCAL_AGENT_TASK — CURRENT: C6B1 OFFLINE SINGLE-FILE APPLY/ROLLBACK SAFETY ACCEPTANCE

**Authority: OFFLINE-ONLY, SYNTHETIC PROJECTS ONLY.** C6A read-only preview passed. C5.5B one-shot live Weixin authorization remains permanently consumed. A new default-OFF module `src/local-first/non-git-apply.ts` implements a narrow independently-approved ONE-FILE apply and rollback primitive and is **not connected to Runtime, native Weixin, Ticket/Worker, real source roots or public APIs**. It MUST NEVER be invoked against an actual operator project under this task. No live grant, real Prompt, Weixin send, service restart, existing SQLite/project writes, or global model change is authorized.

Repo `TnzGit/dsh-superagent-prototype`; branch `feat/local-first-wechat-foundation`. Read this task, `LOCAL_AGENT_PROTOCOL.md`, the C6A report, `src/local-first/project-workspaces.ts`, `src/local-first/non-git-apply.ts`, `tests/local-nongit-apply.node-test.mjs` and architecture docs.

## Gate A — fresh worktree exact-SHA acceptance

1. Fetch exact remote feature HEAD into a NEW clean isolated worktree; preserve every older worktree. Confirm all three GitHub jobs on **that SHA** (local-first-core incl. new synthetic test, macos-portability incl. same, dsh-typecheck-and-build). Run `pnpm install --frozen-lockfile`, `pnpm check`, full 18 local-first standalone Node suites (including `tests/local-nongit-apply.node-test.mjs`) and the proxy suite. Record exact totals and exits. STOP `BLOCKED_CODE` if any failure. Mac Agent does not patch product code.
2. With NEW SYNTHETIC 0700 temporary source, worker and separate journal trees, test one-file **modify/add/delete**: quote-free private 0600 approval, unique transaction ID, approved full preview SHA256 digest, original source drift recheck, private backup, durable prepared/applying/applied records, one source-file operation, exact after-image validation, second independent rollback approval and recovery to exact original file bytes and POSIX file mode. Confirm no retries or repeated operations; one approval cannot be reused.
3. Adversarial cases: missing/expired/invalid/non-0600 approval, wrong ID/project/fingerprint/digest, more than one changed file, changed original source bytes/mode, altered Worker bytes, unexpected symlink, journal root symlink/overlap, already-used transaction IDs, unreconciled pending journals, interrupted write-ahead state, corrupt backup, changed source after apply before rollback, forged journal, changed source mode and changed rollback grant. All cases must fail closed without overwriting external state. Do NOT use any actual operator file or credential.
4. Strict source review: no call site in Runtime/Weixin/Worker; no env/global default, real DSH calls or Outbox; journal backed by private directory OUTSIDE both worker workspace and source, exclusive module lock and retained write-ahead states. Multi-file change sets refused. `previewNonGitProjectChanges` digest alone does NOT authorize any write. Critically record remaining race: a process not honoring module lock can modify source between last check and rename/unlink; Node paths are not dirfd/openat-secure. This module is an offline prototype and NOT approved for production writes until host-level quiescence, atomicity/recovery and full threat model are separately accepted.
5. STOP if any cross-filesystem, host-specific fsync, macOS rights or source mode restoration differs. No speculative patch, live apply, rollback or host repair.

## Gate B — no real host operations

Do not touch 3080/3083/8123, real registered project roots, existing original DSH Sessions, native Weixin sources, durable production receipt/journal/Outbox, live configs or previously consumed grants. Use only disposable synthetic temp fixtures. No separate permission to test on the user's source directories.

## Gate C — one sanitized report and STOP

Publish `agent-reports/REPORT-c6b1-offline-single-file-apply-rollback.md` in a dedicated clean report-only worktree, with tested SHA/CI links, local test counts, positive and negative results, source immutability after rollback, crash/recovery limits, permissions, audit files, remaining races, and explicit **REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN PROMPT: NOT RUN**. Operator-only logs stay private 0700/0600; no raw project paths, real user IDs/credentials or private screenshots in GitHub. On failure status `BLOCKED_CODE`/`BLOCKED_DESIGN`; no local code changes. Send only report URL, SHA and short status; STOP.

## Next product scope — not authorized locally

Remote may harden multi-file apply, true external-writer quiescence, immutable signed authorization and arbitrary crash-recovery on synthetic projects. Live project mutation requires a **new, separate human approval** after those gates. The C5.5B Weixin E2E remains proven, with its old approval permanently finished.
