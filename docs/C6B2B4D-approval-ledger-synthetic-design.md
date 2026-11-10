# C6B2B4D — single-file approval reuse and cross-root fencing: source-only safety design

Status: REMOTE SOURCE REVIEW COMPLETE / IMPLEMENTATION AND SYNTHETIC TESTS PENDING. No production Apply enabled. Reviewed source: `src/local-first/non-git-apply.ts` at code SHA `c955892055b916f2d37edf4d8f8f2d06e21fafb5`; local C6B2B4C acceptance is synthetic-only.

## Confirmed source behavior and limits

1. `readApproval()` validates owner-only mode, expiry, scope, and syntactic IDs, and `recheckApproval()` compares the same file before mutation. Neither records a durable global consumption of `approvalId`. The approval binds `transactionId`, so a *byte-identical* grant cannot simply change transaction ID; the real concern is reuse across independent `journalDirectory` roots or private grant replacement, not an unrestricted same-root fresh transaction.
2. `underLock()` creates `.single-file-apply.lock` under the caller-supplied journal root; `noPendingTransaction()` scans only that root. Two disjoint journal roots therefore do not share fencing, even if both point to the same registered source. The source module's existing path checks do not establish global exclusive ownership.
3. Apply records `prepared` and `applying` before mutation, but an external non-cooperating writer can race the final path-based `fileBlob/lstat/rename/unlink` checks. SHA256 journals are integrity evidence, not authenticated approvals.
4. `finally` removes the lock on ordinary exception; the durable uncertain journal blocks a later apply only in the same journal root. An interrupted process or another journal root must fail closed until human reconciliation.

## Next safe implementation unit (remote-owned, default-OFF, synthetic only)

- Introduce an explicit *synthetic fixture-only* approval-use ledger, rooted at a single canonical owner-only coordinator directory that is separate from source, Worker, and journals. Bind records to approval ID, transaction ID, project fingerprint, operation, preview digest and canonical journal root. A caller must not select a second independent ledger for the same synthetic project without a verified owner-controlled registry binding; otherwise reject rather than claim cross-root exclusivity.
- Atomically reserve a previously unused approval ID **before** any potential source mutation. Persist and sync the reservation and parent directory. Once reserved, the ID stays consumed even if the operation throws, the process crashes, or journal initialization fails; no automatic retry. Corrupt, missing, symlinked, mode-unsafe, or conflicting ledger entries fail closed.
- The ledger is not a cryptographic signature and does not grant a real project write. Avoid interpreting owner-only files or a synthetic marker as secure against a malicious same-user process. Do not add a production caller.
- Add disposable-fixture regression tests for same-ID second invocation, same grant against a second journal root, conflicting transaction binding, process crash after reserve, corrupt reservation, symlink and mode violations, and two concurrent synthetic invocations. Assert at-most-one actor/write attempt and preserved source bytes/mode on refused paths. Test platform-specific behavior explicitly; no unsupported case may be labeled PASS.
- Keep the source default-OFF. No user-host deployment, real registered project, DSH Session Prompt, Weixin, service/model/provider change or production DB operation.

## Independent production gates still open

A real writer needs an OS-level no-follow descriptor-relative mutation API, stable project-root identity, actual external-writer quiescence, durable backup and crash reconciliation, ACL/xattr policy, private per-transaction operator authority, and a precise user-visible target/diff. The synthetic ledger above is a defensive regression step, not evidence those gates are satisfied.

## Acceptance and next owner

Remote owner: implement the bounded synthetic ledger and regression tests in a later source-only increment; obtain CI for the exact code SHA. Local owner: **no new task dispatched** while this remote implementation is pending. A subsequent uniquely identified local offline acceptance may be issued only after the remote code and CI gate are reviewed. C6B2B4C OL-004 is closed and must not be replayed.
