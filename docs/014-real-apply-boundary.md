# 014 — Real registered-project Apply: OS boundary architecture decision (PROPOSAL ONLY)

**Status: DESIGN REQUIRED / NO REAL WRITE ENABLED.** Human standing in-principle agreement for reasonable Apply is known, but none of these design notes is a private signed grant. `agent-handoff/REAL_APPLY_GATES.md` remains controlling. Do not connect synthetic approval APIs directly to production Runtime/Worker.

## Threat model and decision

Protect registered source trees, unrelated 3080 Sessions/Workspaces and production credentials from accidental cross-project edits, stale plans, symlink/hardlink/path races and duplicated transactions. The same effective OS user can mutate owner-only synthetic markers and directories; a SHA256 digest or 0600 file alone does NOT authenticate that user or defeat non-cooperating writers.

**Decision for engineering evaluation:** separate the AI-facing Ticket/Worker (untrusted plans and isolated workspace) from a **small, audited, independently gated local write helper**. The model and public GitHub handoff may only propose a canonical diff. The helper must receive a private per-transaction capability from a trusted local operator approval path, never from GitHub message content. Keep helper DISABLED until a named test project and the complete gates have passed.

## Proposed interface — deliberately NOT an implemented executable API

- `inspect(projectId)` returns a stable identity of an explicitly allowed registered root, source metadata and safe paths, no write.
- `prepare(projectId, planDigest, paths, expectedBefore, afterImageRefs, expiry)` is read-only to source: validates path/metadata/permissions/limits, creates an owner-private before-image + journal and returns a preview ID. No model-generated absolute paths are accepted.
- `authorize(previewId, principal, oneShotNonce)` comes only from a verified private operator channel, exact canonical project identity and immutable plan digest; expires and cannot be reused after ambiguous delivery.
- `applyOnce(transactionId, capability)` runs under exclusive project maintenance/quiescence; opens path components from a trusted directory file descriptor using appropriate OS-specific no-follow operations; validates stable file identities; writes controlled temporary files, syncs file and directory, and marks per-file state durably BEFORE each transition. STOP with REVIEW_REQUIRED on ambiguous state, no retry.
- `inspectRecovery(transactionId)` never alters source; reports source/before/after/diverged/indeterminate per path. Any rollback requires separate scoped authority and cannot pretend multiple rename operations form one atomic transaction.

## Operating-system realities / blockers

- **macOS:** `openat` with no-follow component-by-component and `fstat` are useful primitives, but cannot alone guarantee immunity to a same-user attacker who swaps ancestor directories between operations, mount points or external writes. Specify and TEST a trusted root fd + stable ownership/identity policy and an exclusive maintenance/isolation domain before claiming race freedom.
- **Linux:** `openat2` resolve flags may offer stronger relative resolution, but they do not magically guarantee full multi-file atomicity or prevent non-cooperating writes; require kernel capability checks and tests. Do not assume Linux primitives exist on the actual Mac.
- Source-specific ACLs, xattrs, flags, hardlinks, symlinks, ownership and other non-restorable metadata must be rejected or completely preserved and verified. Set hard size/count/deletion limits. No path-string-only or process-local `Map` locks as a substitute for a trusted OS boundary.
- Need bounded crash injection at each journal/write/sync transition and manual reconciliation proof after real OS process termination. A successful unit test cannot establish power-loss durability; power-cut claims need separate evidence.
- A same-user compromised writer or arbitrary subprocess may bypass 0700/0600 and replace folders; either guarantee writer quiescence through a tested external isolation mechanism or explicitly exclude the threat and refuse Apply when that guarantee is missing.

## Acceptance matrix for helper prototypes (ALL initially PENDING)

| Gate | Minimum reproducible evidence |
| --- | --- |
| Root and metadata | Exact registered project ID; canonical root provenance; fd-relative no-follow walk; ownership/mode/ACL/xattr/hardlink checks on target OS |
| Exclusive writer domain | A documented and verified quiescence/isolation protocol, including non-cooperating subprocess negative test |
| Plan and authority | Private one-use nonce, fixed principal/project/plan digest/expiry, duplicate/altered/replayed capability refusal |
| Preimage and crash | Before-byte + mode/metadata durable backup, fsync where supported; kill-after-each-step, read-only recovery classifier and separate rollback consent |
| Correctness | Add/modify/delete positive and negative tests in disposable registered project, no cross-project writes, original workspaces/sessions remain unchanged |
| Integration | Worker can provide only diff and after-images; helper is invoked only after explicit approval, emits one correlated auditable result, never auto-retries ambiguous steps |
| Public safety | Only redacted evidence uploaded; no real source paths, hashes, secrets or raw diagnostic logs in the public Git repository |

## Current recommendation

Do Gate I1 integration first, then prototype this helper in an OS-isolated disposable environment; review its attack surface and only later consider approved real registered-project writes. Existing C6B2B6G shared fence is valuable fixture evidence, **not** a substitute for any helper gate.
