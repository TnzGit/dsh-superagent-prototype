# C6B2B4B — offline non-Git multi-file Apply safety design

**DESIGN ONLY — NOT executable real-project Apply, not a production approval.** Previous C6B2B4A uses a test-injected arbitrary actor in a tagged synthetic fixture. It is not an OS sandbox and cannot touch real projects under this task.

## Objective

Specify falsifiable preconditions for a future standalone production-grade executor and a synthetic-only adversarial test harness. Do not implement, load or deploy any new source writer in this stage.

## Threat and gate matrix

| Threat | Required mitigation before any real-host write | Fail-closed trigger |
| --- | --- | --- |
| Symlink parent/path swaps | fd-relative verified ancestry with no-follow and inode checks | Any component changes |
| Hardlinks, filesystem aliasing | Detect inodes/shared links, untrusted targets and collisions | Alias ambiguity |
| APFS case/Unicode conflicts | Determine actual filesystem normalization/case behavior | Two paths alias |
| POSIX modes/ACLs/xattrs/ownership | Document exactly preserved metadata; refuse unsupported modes or flags | Metadata cannot be preserved |
| External noncooperating writer | Genuine project quiescence; advisory flock alone is insufficient | Quiescence unproven |
| Concurrent executors / replay | Exclusive cross-process fencing + durable one-shot authorization consumption | Existing unresolved attempt |
| Partial batch after crash | Write-ahead per-file receipt, before-images and after-image verification, manual reconciliation | Any ambiguous step |
| Power loss / fsync failure | Safe ordering of data fsync + parent directory fsync + journal fsync | Durability uncertain |
| Wrong file / missing file | Scoped root identity, sorted manifest, drift check under isolation | Identity/size/mode mismatch |
| Wrong volume / rename limitations | Same-volume operation policy and explicit fallback refusal | Cross-device rename |
| Forged public JSON grant | Separate human-approved authenticated capability OUTSIDE GitHub | No fresh independent approval |
| Arbitrary injected callback | Dedicated, bounded OS-level primitive, not an untrusted callback | Arbitrary source writer |

## macOS engineering constraints

MacOS cannot assume Linux openat2/renameat2. Node lstat + realpath + rename is not proof against TOCTOU. An eventual audited fd-relative native interface with openat, renameat, O_NOFOLLOW or a proven equivalent is required. Inspect risks without implementing or running it now.

A single-file rename is not a multi-file atomic transaction. External writers remain dangerous if only cooperating locks are used. Read-only audit receipts and SHA256 digests are integrity signals, not signatures or permissions.

## Proposed future control-flow (not permission to run)

1. Read-only preflight: root/worker identities, complete preview digest, sealed before/after images, file types, full modes and supported metadata.
2. Fresh out-of-band operator authorization scoped to exact project, bytes, hash, expiry and destination.
3. Durable private reserve and journal before ANY source mutation; consume real authorization.
4. For each file under verified OS-level quiescence: append durable attempt, perform OS-constrained fd-relative operation, fsync and verify, append confirmation; on uncertainty freeze entire batch.
5. Read-only recovery classification and operator-controlled remediation only; no automatic retries, no replay, no automatic rollback.
6. Completed receipt only after complete verified sequence, never claim atomic batch commit.

## Offline review checklist

Read actual C6A, C6B1, C6B2A/B1/B2/B3/B4A implementation and current tests. Provide at least 15 adversarial negative test cases including symlink swap, alias/hardlink, Unicode/case folding, xattrs, ACL, special bits, external writer race, duplicate approval, crash before/after each journal boundary, disk full, cross-device move, false-success journal and arbitrary callback. Classify each as COVERED / UNPROVEN / BLOCKED and recommend a Mac-compatible test strategy.

Separately verify, *read-only*, the user-reported migration to a DSH hourly scheduled task, real timer-triggered Agent dispatch, and whether old launchd still polls. Do not change DSH settings, provider/default, services, or model credentials.

**C6B2B4B may pass as DESIGN REVIEW only**, never as real-host safety acceptance. Next C6B2B4C is a synthetic-only race/adversarial harness design pending review; no production file writes authorized.
