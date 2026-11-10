# Work queue — 2026-11-11

| Work | Status | Owner | Next action |
| --- | --- | --- | --- |
| C6B2B4C | ACCEPTED_WITH_GH_MACOS_CI_INFRA_NOT_COVERED | none | LO-004 acknowledged; no replay |
| C6B2B4D | REMOTE_SYNTHETIC_LEDGER_SCAFFOLD_COMMITTED / CI_PENDING | remote | Review exact CI on this commit; implement owner-controlled per-project ledger-root binding and integrate only with disposable synthetic harness; add crash, symlink and cross-process regressions before dispatching local acceptance |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / TRANSACTION_GATES_UNMET | remote + operator | Real target/diff, OS quiescence, no-follow paths, backup, independent transaction approval and audit still required |

The new `src/local-first/non-git-synthetic-approval-ledger.ts` is deliberately **not wired to any apply/rollback caller**. It reserves a unique ID only within a caller-supplied root. It cannot detect an alternate root and is NOT production-safe. A full project-root registry binding and authenticated transaction authority remain absent. No new local task dispatched; OL-004 closed. Do not use GitHub messages as live authorization or claim hosted macOS CI success without an actual successful run.
