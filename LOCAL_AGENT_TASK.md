# LOCAL_AGENT_TASK — CURRENT: C6A OFFLINE NON-GIT WORKER CHANGE PREVIEW ACCEPTANCE

**Authorization:** This is a NEW, OFFLINE-ONLY product-code acceptance task after C5.5B's real E2E 6/6 PASS. No new real Weixin one-shot grant exists. The C5.5B authorization was consumed. The current code implements **only a read-only preview** of an isolated non-Git Ticket workspace's changes against its baseline. There is NO automatic merge/apply or rollback of changes to the registered original source. Do not infer permissions to deploy/restart, prompt, send, mutate host source projects, or approve a patch from this offline task.

Repository `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`. Read `LOCAL_AGENT_PROTOCOL.md`, this task, `agent-reports/REPORT-c5-5b-real-e2e-fixed-correlator.md`, `src/local-first/project-registry.ts`, `src/local-first/project-workspaces.ts` and `tests/local-project-workspaces.node-test.mjs` before execution.

## Gate A — exact-SHA code and CI acceptance

1. Fetch the latest remote feature HEAD; use a NEW clean test worktree and preserve old worktrees. Verify all three GitHub CI jobs **on the exact tested SHA**: `local-first-core`, `macos-portability`, `dsh-typecheck-and-build`. `pnpm install --frozen-lockfile`, `pnpm check`, and the full standalone local-first Node suites (at minimum `tests/local-project-workspaces.node-test.mjs`, `tests/local-projects.node-test.mjs`, relevant Ticket/Worker and relay tests, and proxy suite). Record exact run SHA, commands/exits, Vitest and Node counts; reject any unnoticed regression.
2. Test non-Git source snapshots with a PRIVATE disposable synthetic project under a fresh 0700 temp dir, not any real operator project. Source must stay byte-identical while worker snapshot edits a file, creates a binary file, deletes a file, or makes its own Git commit; `previewNonGitProjectChanges` must produce sorted deterministic `changes` (action, before/after blob OID, executable mode) and stable digest, without emitting real file bytes. No preview may write to original source. The `.dsh-project.json` and excluded secret/dependency paths are not patch entries.
3. Adversarial tests: original source file modification, deletion and unexpected added file since snapshot must fail-closed; symlinks/special files, changed `sourceRevision`, foreign project ID/fingerprint, redirected workspace and `kind:'git'` must not yield an authorized non-Git preview. Re-run on macOS (canonical `/var` paths), and on Linux; compare behavior without changing tests locally.
4. Source review: verify read-only operation, the immutable recorded baseline revision (not merely current Worker HEAD), source-drift comparison for all non-excluded source files, bounded file/count limits and no direct writable source operation. The preview's digest is **NOT** an authorization token: it must never implicitly trigger `apply`, `rollback`, Outbox, a Ticket action, or a DSH prompt. Verify existing `createProjectSnapshot` and `verifyProjectSnapshot` still work.
5. If code or real runtime wire assumptions differ, STOP `BLOCKED_CODE` or `BLOCKED_DESIGN`. Do not patch product code on Mac; remote ChatGPT owns corrections.

## Gate B — no live host write

This task is best completed entirely in isolated temp directories on the test worktree. Optional system reads only when necessary to verify the expected original 3080/3083/8123 invariant. **Never** stage/restart a service, create a new genuine Trigger, run `session/prompt`, send Weixin messages/replies, alter original history, rewrite a `review-required` row, create a grant, modify operator source files, change model/default, or invoke any apply/rollback outside synthetic throwaway test fixtures.

## Gate C — publish one sanitized result

Write `agent-reports/REPORT-c6a-offline-nongit-change-preview.md` from a dedicated clean report-only worktree. Include code-under-test SHA, CI link and exact job status, local build/test counts, source immutability checks, positive/negative cases and final `ALL_OFFLINE_PASS` or `BLOCKED_CODE`/`BLOCKED_DESIGN`; confirm **REAL APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN**. Never publish real file contents, original project paths, user IDs or credentials. Keep all private evidence owner-only. Normal non-force report-only push; no old worktree reset, no source patch or schema mutation. Completion response to operator is ONLY status, GitHub report path and SHA. STOP.

## Future C6B (not granted by this task)

The next product-code stage may design a default-OFF operator-authorized apply and rollback transaction, with independent out-of-source durable journaling and verified source drift/recovery semantics; or integrate a read-only project preview into a Ticket tool. Neither stage is implemented nor authorized for real operator project mutation by C6A. C5.5B real Weixin loop is proven, but its consumed authorization must never be revived.
