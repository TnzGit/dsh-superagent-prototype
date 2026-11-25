> **CURRENT 2026-11-25:** OL-053 true controlled staging-guest I3 and dedicated REAL registered-test-project Apply/rollback **independently ACKed `LIVE_BOTH_PASS`** for this pilot scope. Final source `c402b48276b74eba0ecf0a697cf09d1138a0f92e`, done `c0527b087d64640d5eedfd7b4f4b23c0fde03dc3`, [online ACK](agent-handoff/receipts/online/LO-20261125-053-done.md). 3083 installed cutover and general production Apply caller are NOT implied. **NO ACTIVE TASK** after this ACK; no OL-054 auto-dispatch, remote scheduler PAUSED, `no_auto_dispatch=true`. Root `PLAN.md` is historical and consumed. Read `STATE.json`, `LOCAL_AGENT_TASK.md`, `docs/020-postlive-i3-and-apply-operator-runbook.md` for next technical gates.

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


## Pure proposal contract milestone — no OS helper (2026-11-18)

src/local-first/real-apply-contract.ts is a pure, side-effect-free proposed change-plan filter. It validates deterministic digest, sorted ASCII-only relative paths, case-fold duplicates, obvious secret names, size/mode/hash consistency and bounded operations. It provides NO filesystem API, operator principal/approval, one-shot nonce, OS helper, journal, backup, recovery or source Apply. tests/real-apply-contract.spec.ts 5/5 on Linux and macOS in CI #516 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44254449518.

This digest is only plan correlation and cannot serve as a private capability. The OS helper matrix remains entirely pending: trusted root fd, fd-relative no-follow path resolution, ACL/xattr/flags/link checks, external writer quiescence, private authenticated per-transaction consent, durable pre-images, crash recovery, manual reconciliation and macOS adversarial evidence. Real Apply is NOT enabled.


## OL-041 Mac feasibility findings and remote contract fix (2026-11-18)

Independent local sanitized report `agent-reports/REPORT-ol041-i1b-mac-batch.md` records on disposable macOS APFS fixtures: O_NOFOLLOW/ELOOP works on final symlinks; an open directory fd holds original root inode across path ABA; Node stdlib lacks native descriptor-relative openat; case-insensitive filesystem aliases are real; `uchg` flags and xattrs are not reflected by `fs.stat`; external-writer TOCTOU and SIGKILL partial files are possible. Process kill is not power-loss durability proof. These are **local reported synthetic observations**, not remote independent live OS reproduction.

The report found non-enumerable key bypass in `real-apply-contract.ts` shape checks, fixed at source `1b9fe55ce2e59d8e3a7e6c979101774bb9a72890` with Reflect.ownKeys, own data-descriptor verification and dense ordinary changes-array checks. New tests reject hidden, Symbol, getter, inherited and sparse/extra array properties; P3 now 9/9 on Linux/macOS in [CI #539](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44289161705). It is still purely a proposal/correlation filter with NO OS file writer, authenticated grant, backup/journal or Apply. REAL_APPLY_GATES remain fully effective and production source writes disabled. Do not confuse JSON digest with a signed capability.


## Native read-only fd-path prototype (2026-11-18) — NOT a write helper

\`research/os-path-inspector.c\` is a standalone **read-only, TEST-ONLY** POSIX C tool using an opened trusted fixture root fd and component-by-component \`openat(..., O_NOFOLLOW)\`. It rejects hidden/traversal/absolute paths, unsafe directory/file modes, symlinks, hardlinks and nonregular files, and rejects observable nonzero xattrs. Its CLI prints only OK/REJECT, never file content or host metadata, and has no write API or production Runtime caller. \`tests/os-path-inspector.node-test.mjs\` compiles it under new temp roots and executes 5 synthetic cases. At \`ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead\`, [CI #550](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819) ran **5/5** as part of Node 253/253 on BOTH Linux and macOS, with 3/3 jobs and full Vitest 1238/1238.

**NO REAL APPLY:** the research tool does not attest registered project identity, currently checks neither ACLs fully nor external writers, has no owner-operator private one-shot capability, no stored after-images, no journal, backup, crash recovery or rollback. Opening a path for read itself is not a general production trust boundary; further OS-specific file types/mount/external-writer threats remain. Even a rooted openat walk does not grant writer quiescence or transactional multi-file atomicity. The helper acceptance matrix is still PENDING. New OL-042 operator Mac runbook tests the prototype ONLY on fresh synthetic 0700 roots and investigates xattr/uchg/ACL behavior without touching user source.


## F1 exact macOS provenance system-attribute compatibility (2026-11-19; test-only)

OL-042 independently recorded operator macOS 26.3 Node **249/253**, four real positive inspector cases rejecting after `com.apple.provenance` auto-stamp. Historical failure stays recorded; hosted macOS 15 runner had passed the old 5/5. At code SHA `6c75c43f43b9133f8796b628155cc278c2025838`, [CI #584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) 3/3 SUCCESS: `research/os-path-inspector.c` now parses the bounded native `flistxattr` NUL-separated list and allows **exactly** one `com.apple.provenance` NAME on Darwin, not wildcard Apple/system/user xattrs. It continues to reject any unknown attribute, including a synthetic nontrivial unknown xattr set by the **TEST-ONLY** `tests/fixtures/os-xattr-fixture.c` on a new disposable fixture file. Linux allows NO nonempty xattr list. Both OS CI suites now run **6/6 native read-only cases** within Node 254/254. The operator Mac 26.3 true auto-stamped filesystem MUST independently rerun: assigned as manual-only OL-20261119-043.

**Safety caveats remain:** the provenance name is not trusted content or an operator principal; this research inspector DOES NOT attest ACL absence, native flags beyond its tiny check, dev/inode/project authority, cross-root symlink/fd rename races, non-cooperating writers, durable journaling, backups, one-shot private approval, rollback or real source Apply. No production Runtime caller or OS WRITE API exists. All `REAL_APPLY_GATES.md` remain effective; do not connect the test-only xattr writer or inspector to live projects.
