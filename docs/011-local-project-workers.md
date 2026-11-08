# 011 — Registered local-project Ticket execution (isolated snapshots)

> **Architecture update:** The operator has a separate DSH host on Mac port 3080 containing valuable existing Workspaces and Sessions. This snapshot Worker mode does **NOT** replace or resume those sessions. For existing DSH projects, prefer continuation on the original 3080 host; see the later `docs/012-existing-dsh-host-3080.md` architecture decision rather than substituting snapshot Workers. This file documents the strictly opt-in staging/sandbox execution path for new projects or tasks that deliberately request a fresh, isolated workspace. Do not auto-migrate project directories or Session logs.

> 2026-11-08 Stage B showed real Weixin ↔ DSH ↔ Qwen chat/outbox success. **Ticket → Worker was not yet E2E accepted.** This document describes the first code path for Git/non-Git worker workspaces; it is **not** permission to auto-apply changes to the operator's original projects.

## Operational boundary

- `DSH_SUPERAGENT_LOCAL_PROJECTS_FILE` may point to an **absolute-path, non-symlink, operator-owned JSON file** with `allowedRoots` and `projects`. It is loaded at DSH runtime startup; errors fail startup rather than silently selecting another project. Do not check in this local file or reveal absolute private roots in a public PR.
- An allowed project must exist under one of the canonical allowlisted roots, have a unique restricted project ID and a declared `kind: "git"` or `kind: "local"`. The existing `LocalProjectRegistry` resolves/validates roots and supplies a one-at-a-time preparation queue per project.
- A Weixin change request **must have the exact first line `/project <id>`**, followed by the task on the next line. Equivalent Chinese selector: `项目：<id>`. Ordinary chat without a project selector remains chat. Unrecognized or missing IDs fail closed **at Ticket launch**, rather than falling back to `repository: ''` and a free-form empty worker directory. No paths may be supplied in the message.
- In a GitHub-enabled installation with no explicit project selector, the legacy GitHub `executor.prepare` behavior is preserved. With a project selector, the local project takes precedence regardless of GitHub mode.

Example **private** registry file (replace these paths on the operator's host and store the JSON outside the Git checkout):

```json
{
  "allowedRoots": ["/ABSOLUTE/OPERATOR/APPROVED/ROOT"],
  "projects": [
    {"id": "test-git", "kind": "git", "root": "/ABSOLUTE/OPERATOR/APPROVED/ROOT/test-git"},
    {"id": "test-plain", "kind": "local", "root": "/ABSOLUTE/OPERATOR/APPROVED/ROOT/test-plain"}
  ]
}
```

Store as a regular file not group/world writable (prefer 0600). For the **isolated staging instance only**, set `DSH_SUPERAGENT_LOCAL_PROJECTS_FILE` to this file's absolute path, then restart staging DSH to load it. Do **not** change the running host's environment or restart it until the operator approves the host-only regression.

An example Weixin task:

```text
/project test-plain
在一个仅用于验收的 README.md 中纠正测试错字，跑一个本地检查，给我变更摘要；不要发布或把变更写回原项目。
```

## Worker workspace lifetime and safety

At accept time `DshExecutor.prepare()` determines the project from the **primary Trigger text** and stores the ID and a non-secret registry fingerprint in `Ticket.execution`. At launch it creates:

`<stateDir>/work/<project-id>/<ticket-name>-<ticket-prefix>`

The workspace is **created in a sibling temporary directory and atomically renamed** only after preparation. A failed copy/clone leaves no partial Ticket directory. On restarts it validates the workspace's project identity/fingerprint instead of trusting any pre-existing directory.

- **Git source:** require a clean source working tree and no submodules or tracked sensitive paths; create a local offline clone with `--no-hardlinks`, and remove the workspace's `origin` remote. Uncommitted source edits are **not silently omitted**. The original Git source and its `.git` remain unchanged.
- **Plain directory:** create a bounded (10,000 items / 1 GiB) source snapshot; skip known credential files, version-control metadata, node_modules and cache directories. Reject symlinks/special files rather than following them. Run `git init` inside **the copy only** and record a baseline commit to support an ordinary `git diff`.
- **Sessions:** for a project-bound Worker select DSH `workspace-write` permissions rather than the legacy `danger-full-access`; run within its staged workspace. The Qwen provider must remain behind the localhost one-slot proxy.
- **No automatic apply, no git push or remote access**: the worker can produce changes and a diff in its isolated staging workspace. Applying those changes to the original root is a later, separately approved feature requiring conflict checks, backups/rollback and process-boundary enforcement.

**Not yet proven:** the behavior of real Worker session tools under the exact DSH 0.2.2-alpha.2 host, especially whether `workspace-write` fully restricts subprocesses; the selector's effect on real auto/classifier Ticket acceptance; reboot/retry and local executor status reporting. These require a disposable project and authorized real test.

## Remaining hardening

This code does **not** claim complete project filesystem isolation from arbitrary hostile processes. `realpath` and in-process queue locks cannot prevent an external process from racing on the source files. Registry locks cover **snapshot creation only**; project-based workers edit separate copies, but no automatic write-back is permitted. User-space filesystem tools, subprocesses, symlink races and mounting need an OS sandbox/container and real-host tests before allowing writes to original projects.

The native Weixin Source, context tokens and existing local Qwen queue proxy remain unchanged. A code update is not deployed merely by pushing the feature branch. Keep the existing Stage B staging process running while offline CI executes.

## Stage C operator checks

1. Back up the isolated staging state and inspect the actual `git status` of each selected test project. Do **not** force-pull a running worktree or stop the Weixin Source.
2. With explicit operator approval, load an owner-only registry containing only **disposable test projects** and restart staging DSH in a controlled window after the safe preflight. Use `executor.maxWorkers=1`.
3. Send one authorized, explicit `/project test-plain` change request in the original Weixin conversation. The expected progression is `accept → Ticket created → local snapshot → worker Session with workspace-write → report/diff → Weixin reply`. Preserve all receipts and review the original project to confirm no writes.
4. Repeat with a clean Git test project and check clone `origin` removed; negative tests for unknown ID, missing selector, dirty Git root and symlinked content. Keep cloud disabled.
5. Compare exact worker model route/provider against `localqwen`; confirm it passes via the single-slot proxy. Record times, errors and idempotency/restart behavior, plus method to revert staging config.
6. Report failures (not local rewrites) to the remote ChatGPT. Production project approval/apply should **not** be enabled by this test.
