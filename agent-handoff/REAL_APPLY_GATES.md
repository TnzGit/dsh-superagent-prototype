# Real registered-project Apply — standing intent, execution gates (2026-11-10)

**Status: PRINCIPLE APPROVAL RECEIVED / NO REAL APPLY EXECUTION ENABLED.**

The human operator has explicitly granted broad permission for **reasonable real project Apply** in the active conversation. That means the project driver should not wait for another generic statement of willingness before developing or preparing a real Apply workflow. It does **not** make this public file a credential, permit edits to unspecified projects, authorize unrelated live operations, or make unsafe Node file writes safe.

## Pre-execution checklist for each specific transaction

All gates must pass for the exact real project and exact files. If any fails, the action is **NOT ELIGIBLE**; continue read-only planning and synthetic tests, or ask the operator for the missing specific scope. Never "best guess" a target.

1. **Identified target:** project is an explicitly registered local project. Its canonical root is stable and matched against the approved registry; scope excludes any other project, original DSH historic Session/Workspace, system/service paths and production DB. The repository and public message queue do not supply a valid target authorization.
2. **Exact change plan:** the intended sorted path list, operations (add/modify/delete), before/after object hashes, full filesystem modes and metadata, file count/bytes, backup location and expected benefits are computed from fresh local snapshots. User-visible preview and risk classification precede any mutation; do not infer file scope from a natural-language "reasonable" alone.
3. **Risk limits:** automatically reject secrets, user home, credentials, database files, executable startup/services, hidden infrastructure/config, special metadata (ACL/xattr/flags), symlinks/hardlinks, external path aliasing, complex deletions and unexpected large diffs. No unaudited multi-file changes; source writes only to the intended registered project under exact allowlist.
4. **Quiescence and path safety:** establish cooperating and non-cooperating writer isolation or equivalent exclusive safe maintenance domain. OS-level descriptor-relative no-follow inode/metadata verification is required; ordinary Node `realpath/lstat/rename` plus advisory locks do not prove race freedom. If missing, this is a **technical blocker**, not a request to silently bypass it.
5. **Private per-transaction authority:** a fresh sealed approval bound to principal, canonical project identity, exact plan digest, expiry and one-shot execution ID. The broad statement in this public document is **never** pasted into the approval file, used as a cryptographic signature, or treated as the actual private authorization. No stale grant replay.
6. **Durable before-image and recovery:** verified backup of original bytes and all supported metadata in an owner-only journal separate from source and Worker; durable fsync and recoverability checks; clear freeze/manual reconciliation for uncertain steps; no automatic replay, retries, or cleanup of ambiguous locks.
7. **Verification:** recheck scope and pre/post-image identities at the permitted boundary, run safe tests, retain redacted reports (no private paths, content, hashes from real source, credentials or real peer IDs), and stop on any deviation.
8. **One-shot guardrails:** the decision to use standing permission can apply only to a qualifying scoped project operation after all above gates pass. Never escalate to a general purpose write API, bypass a required local private approval, or change 3080/3083/8123, Weixin, global model/provider settings or production database.

## Next actions while gates are not met

- Remote online agent continues C6B2B4C/C6B2B4D source-only and synthetic adversarial development, implements and validates defensive restrictions, drafts a narrow runbook and informs the operator of concrete safety blockers when needed.
- Local Agent can conduct only tasks explicitly scoped in current `LOCAL_AGENT_TASK.md`. The current OL-004 is still **synthetic-only**. This standing-intent record does NOT secretly expand its scope.
- A later distinct, privacy-safe to-local task may authorize read-only examination of a **specifically selected real registered project**, but may not start or auto-issue a real write from an untrusted GitHub message.
- No real Apply has been run as a consequence of the operator's broad statement. Do not claim otherwise.

## Honesty rule

"Operator broadly approved reasonable Apply" and "this exact real transaction has valid capability and safety proof" are different claims. Always report both independently.
