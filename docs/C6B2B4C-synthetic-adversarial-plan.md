# C6B2B4C — synthetic adversarial regression plan (remote-owned)

Status: **REMOTE DESIGN IN PROGRESS**. No production Apply implementation or live host authorization.

## Evidence baseline
C6B2B4B sanitized report at `fcc8a0b5b4cb79878bcbd2d147f36238883f1a4d` (CI #247 3/3 green) identified 24 cases: 10 covered, 12 unproven, 2 blocked for production. Design review alone does not establish OS path safety, metadata preservation, approval authenticity or crash atomicity.

## First remote code/test increment
1. In `src/local-first/non-git-apply.ts`, normalize orphan/contended single-file lock errors: EEXIST must produce a stable, path-free human-reconciliation error; never remove, steal or retry the lock. Add a synthetic regression with a pre-existing owner-only lock and assert no absolute fixture path in error, source bytes/mode unchanged and lock retained.
2. Extend synthetic-only tests using fresh owner-only temporary fixtures to probe hardlink alias behavior, metadata special bits and no-replay receipt semantics. Negative tests should document observed limitations, not claim production-grade protections.
3. Separate deterministic Linux/macOS portable tests from macOS-specific APFS/ACL/xattr probes. For platform-dependent cases, report NOT_COVERED rather than passing an unsupported assertion.
4. Keep all test-controlled source writes inside disposable fixture roots. Never call real Runtime/Worker/Weixin/Outbox/DSH APIs, change 3080/3083/8123, credentials or global model defaults.

## Deferred hard gates
Ancestor-symlink TOCTOU, non-cooperating external writers, inode aliasing, full ACL/xattr preservation, authenticated one-use grants, crash-consistent cross-process fencing and native fd-relative file operations are **not solved** by synthetic tests. Any real project Apply requires fresh independent operator approval and OS-level design review. No implicit escalation from a green CI.

## Release/acceptance criteria
Remote code commit with all relevant CI jobs green, exact SHA, sanitized tests and negative evidence; only then update `LOCAL_AGENT_TASK.md` and issue one unique `type: task` / `OFFLINE_SYNTHETIC_ONLY` local message. Claimed-but-not-done tasks are not replayed.
