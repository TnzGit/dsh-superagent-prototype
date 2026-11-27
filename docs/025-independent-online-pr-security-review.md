# 025 — Independent online scoped PR #1 security and release review

**Date:** 2026-11-27. **Scope:** targeted source-level review of the OL-054/055 native Weixin poll/cursor, operator audit/loopback UI, bounded real Apply connector, and CI/release artifacts. **This is NOT a 553-file / ~837-commit line-by-line audit, not a human approval, and not a production authorization.**

## Review basis

- Last operator-host accepted candidate: OL-055 `RC_READY` on the installed TEST 3083, final source `89090b3eb02844030a592d8d87e500471599b2b7`, done `cf866a98b3d15b63d154272b22a57fa588039a6f`, exact done Push #909 / Draft-PR #910 3/3. Formal online ACK `agent-handoff/receipts/online/LO-20261126-055-done.md`. Host Mac and Tencent/device evidence remain **local private Agent/operator attestation**, not GitHub CI evidence.
- PR #1 remains **DRAFT/unmerged**; its existing history was extremely large (837 commits and 553 paths at review start). A CI-green status cannot substitute for independent human code/security approval or a dedicated release authorization.
- Online follow-up is branch-only: the host-installed 3083 is still the previously attested paused+ready bundle. No new QR, Tencent sends, local model sessions, Apply, OS permissions, main merge or local service restart were performed during this review.

## Findings addressed in new branch code (verify final exact-head CI)

| Priority | Source and finding | Action taken | Risk model |
| --- | --- | --- | --- |
| High | `src/local-first/real-apply-operator-connector.ts`: the 8 KiB operator bound counted `abs(afterBytes-beforeBytes)`; a giant same-length file replacement cost zero bytes | Count the maximum before/after image size for **every** touched file including rollback; test equal-size replacement + cumulative two-file limit | Independent native file hashing and one-shot capability remain, but budget bypass needed fixing |
| Medium | `tests/weixin-native-restart-ambiguity-offline.spec.ts`: fixed `80ms` wait aborted before durable cursor commit under a loaded macOS runner | Wait for the actual durable cursor or expected terminal error, then abort in `finally` | Test reliability; no product poll logic changed |
| High | `src/app/operator-review.ts`: journal descriptor might leak when ownership/hardlink validation threw; a truncated or malformed earlier JSONL record could be concealed by a later valid append/re-projection | Close FD on every failed validation; validate **all** existing records before projection, freeze malformed/duplicate records, revalidate before each mutating operator request, refuse post-start journal path swaps and missing newline | No auto reconcile/replay; legacy pre-ledger records remain admitted only if corroborated by terminal durable state, still within same-UID trust boundary |
| Medium | `src/client/locales.ts` and operator runbook: Resume confirmation claimed “sends nothing” despite enabling queued Ticket execution and subsequent outbound effects | Explicit bilingual warning, UI regression assertion and runbook boundary. Resume still requires a conscious operator action; do not use outside a scoped window | Not an OS-enforced separate authorization for Resume. Required human/UX review still applies |

## Accepted-but-unresolved security gates

1. **Same-UID integrity:** an adversarial process under the same UID can forge `0600` review/capability/opt-in markers and race the last native preimage verification against `renameat`; `openat`, path pinning and no-follow close important classes but cannot prove integrity against that attacker. A dedicated different-UID approval helper or user-presence primitive needs deliberate operator provisioning and its own scope.
2. **Poll owner and mount trust:** the account-scoped SQLite exclusive lease and generation fence protect the cooperative installed poller, with replay backstop after FIFO 2000. It cannot prove exclusivity across adversarial same-UID aliases, ancestor/mount substitution, or a host an operator does not control.
3. **Crash/power loss:** SQLite audit's same-transaction authoritative commit fixes split-commit ambiguity; external JSONL is an append-only projection. Native Apply SIGKILL/fsync tests are not proof of instantaneous power-loss durability; recovery stays read-only and ambiguous transactions freeze.
4. **Bearer lifecycle and Resume effects:** loopback token proves possession, not named-human identity; in-memory rate window resets on restart. Resuming the Executor may trigger real downstream effects even though the HTTP handler itself sends nothing. Preserve the default paused test runtime and independently bound human run window.
5. **Release scale and portability:** Mac host Node 25 and CI Ubuntu Node 22 are not equivalent to live Node 22 macOS support. No live rollback of the original test listener was performed; clone rehearsal passed. Volume root was intentionally hardened `0775→0755` and should not be casually reverted.

## Merge decision and offline-only closure

**Current merge recommendation: DO NOT MERGE PR #1 YET.** A separate qualified human reviewer should inspect the latest HEAD's critical files and account/recipient/session boundaries; inspect every new review-fix commit and verify both exact-SHA Push and Draft PR job sets 3/3, and decide a release scope. Repo-wide 837-commit history merits a logical diff/review plan or smaller replacement PR before making main a production deployment vehicle. The original bounded `RC_READY` remains accepted, but **new online source changes were not installed into 3083** and are not included in that local live-host verdict.

No auto OL-056, no remote scheduler changes, no main merge, no auto-unpause or live send. Only the human owner can authorize any later local rollout or broader production Apply.
