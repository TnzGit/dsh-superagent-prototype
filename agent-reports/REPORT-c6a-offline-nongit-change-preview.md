# REPORT — C6A offline acceptance: isolated non-Git Ticket change preview (read-only, drift-checked)

Code-under-test SHA: `d58aaab2aafe77e69c14a244da94655179cc2d41` (NEW clean worktree `.worktrees/stage-c6a`; old worktrees preserved; zero writes to any real operator project or service — **REAL APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN**).
Feature commit under test: `feaf922` — `previewNonGitProjectChanges()` in `src/local-first/project-workspaces.ts` (lines 251–293; interfaces at 169–186, safe enumeration 193–211, baseline tree parse 212–226, streaming blob OID 230–246).

## Verdict: `ALL_OFFLINE_PASS`

### Gate A.1 — exact-SHA CI + local build/tests: PASS

GitHub Actions run **42603998240** (#208, push, exact SHA): all three jobs `local-first-core`, `dsh-typecheck-and-build`, `macos-portability` → **success** (verified via `gh run view --json jobs`). Fix commit `feaf922` run #207 also green.
Local on the exact SHA:
- `pnpm install --frozen-lockfile` → exit 0 (pnpm 11.7.0 via packageManager pin).
- `pnpm check` (typecheck+test+build) → exit 0; **Vitest 62 files / 1208 tests passed**, build complete.
- `tests/local-project-workspaces.node-test.mjs` → exit 0, **10/10 pass** (incl. the 5 new preview tests: additions/edits/deletion without touching source; fail-closed source drift; symlink/git/workspace-baseline rejections; committed worker changes compared with the pinned immutable snapshot baseline).
- `tests/local-projects.node-test.mjs` → exit 0, **3/3 pass** — the two macOS `/var`-symlink environment failures recorded in earlier rounds were fixed upstream (commit `c509a6a` canonicalizes the temp fixture root); no residual env failure.
- Combined run of 17 local-first Node suites (bridge 14/14, output 12/12, relay-coordinator 7/7, relay-routing, relay-store, model-queue, weixin-native, weixin-qr, existing-dsh-projects, probe, new-workspace, model-gate, operator-rpc, operator-provision, project-workspaces, projects, probe-local-llm) → exit 0, **122/122 pass** (previous rounds' baseline for these files was 75/75 on older lists; the count rose with the new workspaces/preview suites — no regression: all prior suites still fully green).
- Proxy suite `tests/local-openai-queue-proxy.node-test.mjs` → exit 0, **5/5 pass**.

### Gate A.2 — synthetic non-Git snapshot + worker edits + preview determinism: PASS

Private disposable fixture under fresh 0700 temp dirs (never a real operator project):
- `createProjectSnapshot` for `kind:'local'`: secret-filtered copy (`.env`, `node_modules`, `id_rsa` etc. excluded; normal files like `config.ini` copied), offline baseline commit created, `.dsh-project.json` manifest written 0600 with `projectId/rootFingerprint/kind/sourceRevision`; `verifyProjectSnapshot` OK.
- Worker edits inside the isolated workspace: **modify** `readme.txt`, **add** binary `new.bin`, **delete** `sub/data.bin`, then the worker makes its **own git commit** (HEAD moves). Preview still compares against the pinned immutable `sourceRevision` from the manifest (proven: change list is identical to the pre-commit diff; test `committed worker changes…` mirrors this).
- `previewNonGitProjectChanges()` output: `changes` sorted deterministically (`add, modify, delete` paths alphabetical), each entry has `action`, before/after **git blob OIDs** (sha1) and `executable` mode — **no file content bytes emitted**; digest stable across two runs (`3463ac1e…`, SHA256 over stable identifiers + change metadata only, never over private file contents); `.dsh-project.json` is NOT a patch entry; excluded secret/dependency paths never appear.
- Source immutability: full-tree hash of the original project identical before/after snapshot+preview; `secret.env`/`.env` still byte-identical in source; preview function body contains **zero** write-path calls (`writeFile|rm|rename|mkdir|appendFile` count = 0, static source check) and only read ops (`lstat`, `createReadStream`, git `ls-tree`/`rev-parse` on the workspace).

### Gate A.3 — adversarial matrix: PASS (every case safely rejected, none yields a preview)

13 negative cases on fresh fixtures:
- Source file **modified** since snapshot → `Original project changed since worker snapshot`
- Source file **deleted** → same fail-closed
- **Surprise source addition** → same (count mismatch is caught first: `source.size !== tree.size`)
- Source **executable-bit** change → same (mode compared, not just content)
- **Symlink inside worker workspace** → `Unsafe symlink or special file in project change preview`
- **Symlink inside source project** → same (enumeration never follows symlinks)
- Worker `.git` directory **replaced by a symlink** → `Worker baseline Git metadata was redirected`
- **Workspace redirected through a symlink** → `Ticket workspace is not a normal directory` (lstat guard in `verifyProjectSnapshot`)
- Manifest `sourceRevision` **tampered** (non-hash) → `Invalid immutable worker snapshot revision`
- **Foreign fingerprint** → `Project configuration differs from original Ticket`
- **Foreign projectId** (workspace belongs to another registered project) → `Ticket workspace belongs to another registered project`
- **`kind:'git'`** project → rejected (manifest kind mismatch / `Only writable registered non-Git…`)
- **`readOnly:true`** project → `Only writable registered non-Git projects support this preview`
No case produced `completed`/a change list; all throw before any write.

### Gate A.4 — bounds, permissions, macOS normalization: PASS

- `MAX_PREVIEW_CHANGES=500`: exactly **500** changes accepted; **501** → `Too many worker changes for a bounded manual review` (fail-closed, no partial patch).
- `MAX_ITEMS=10000`: snapshot of 10001-file tree → `Project exceeds snapshot limits`; preview enumeration enforces the same cap (`Project exceeds change preview limits`) and `MAX_BYTES=1GiB` for total size (`MAX_ITEMS` check also in baseline `treeObjects`).
- Registry-file guard: operator-owned registry must be a regular file, not a symlink, not group/other-writable (0o022 check); manifest written `{flag:'wx', mode:0o600}`; workspace dirs 0700.
- macOS path normalization: `/var` → `/private/var` alias handled by canonical-parent comparison in `createProjectSnapshot`/`assertWorkspaceOutsideProject`/`verifyProjectSnapshot`; the Linux-vs-macOS behavior is covered by CI `macos-portability` + upstream fixture fix (`c509a6a`). Blob streaming re-checks size and executable mode after read (`Project file changed while being read/during preview` guards).
- Digest is evidence, NOT an authorization token: static grep shows `previewNonGitProjectChanges` has **no consumers anywhere in `src/`** (only its own definition/export and the test file) — it cannot implicitly trigger apply, rollback, Outbox, Ticket actions, or a DSH prompt. No new apply/rollback code exists at this SHA.

### Gate B — no live host write: honored

All work inside isolated temp dirs on the test worktree; no service staging/restart, no Trigger, no `session/prompt`, no Weixin send/reply, no grant, no model/default change, no operator source mutation. 3080/3083/8123 invariants (from the C5.5B Gate E snapshot) remain as recorded; nothing touched them.

### Remaining risks / notes for remote

- Future apply/rollback (C6B, not granted here) must: re-check source drift under an exclusive host lock at apply time (the preview's drift check is only a point-in-time proof), journal durably OUT of the source tree, and treat the digest as evidence only — never as an authorization token.
- `previewNonGitProjectChanges` currently rejects sha256-object-format repos only when the manifest revision length mismatches; `treeObjects` accepts both 40-hex and 64-hex OIDs, matching `rev-parse --show-object-format` validation — consistent.
- Excluded-path list (`.git/.hg/.svn/node_modules/.venv/.tox/.cache/.idea/.DS_Store/.ssh/.aws/.gnupg/.npmrc/.pypirc/.netrc/id_rsa/id_ed25519/.env*`) is hardcoded; a project that legitimately needs a file named e.g. `config.ini`-style secrets inside `node_modules`-like dirs is fine (they are simply not previewable) — operator must know excluded paths are invisible to preview/apply.

### Zero-change verification (rollback N/A — offline)

Report-only push from a dedicated clean worktree; no product source modified; no old worktree reset; private fixture output kept owner-only (never uploaded); all hashes truncated above are synthetic-only, no real project paths, user IDs, or credentials published.
