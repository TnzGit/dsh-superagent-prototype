# Work queue — 2026-11-11

| Work | Status | Owner | Next action |
| --- | --- | --- | --- |
| C6B2B4C | ACCEPTED_WITH_GH_MACOS_CI_INFRA_NOT_COVERED | none | LO-004 acknowledged; no replay |
| C6B2B4D | REMOTE_SYNTHETIC_LEDGER_SCAFFOLD_COMMITTED / CI_PENDING | remote | Review exact CI on this commit; implement owner-controlled per-project ledger-root binding and integrate only with disposable synthetic harness; add crash, symlink and cross-process regressions before dispatching local acceptance |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / TRANSACTION_GATES_UNMET | remote + operator | Real target/diff, OS quiescence, no-follow paths, backup, independent transaction approval and audit still required |

The new `src/local-first/non-git-synthetic-approval-ledger.ts` is deliberately **not wired to any apply/rollback caller**. It reserves a unique ID only within a caller-supplied root. It cannot detect an alternate root and is NOT production-safe. A full project-root registry binding and authenticated transaction authority remain absent. No new local task dispatched; OL-004 closed. Do not use GitHub messages as live authorization or claim hosted macOS CI success without an actual successful run.

## 2026-11-11 remote synthetic path-overlap increment

- Source commit `154c898fe73518f4b7c3965efac2619fb4cca669` rejects ledger/journal ancestor and descendant directory overlap; regression commit `5ec84fcb743131c1c67ee2a3fdaf090c051bf138` tests both directions and verifies no approval entry was created. These are **remote source/test changes only**, not a production fence or approval.
- Previous exact SHA `65c5c052babfb5439007c16185583618836ed42b` CI #256: Linux core success; `dsh-typecheck-and-build` failed at `pnpm check`; macOS cancelled without executed tests. The detailed compiler diagnostic has not been recovered. New patch CI must be checked independently; do not infer PASS.
- Next owner: **remote**. Obtain the exact `pnpm check` diagnostic and repair without loosening TypeScript checks; then test process crash, symlink/ancestor TOCTOU, and per-project ledger-root binding. Do not dispatch local acceptance before remote CI evidence. No new local task; OL-004 already closed.

## 2026-11-11 synthetic journal symlink hardening

- Remote code/test commit `478457b757309a16c312904410e602866ae43bec` rejects a symlink at the supplied journal root before creating a synthetic reservation; adds a no-reservation regression. This is limited to the disconnected synthetic ledger and does not prove ancestor TOCTOU or production path safety.
- Exact CI for this commit remains **UNVERIFIED** at publication. Earlier HEAD `ffc60051b3249d9b2a8be65713d9a6bbc23b6443` CI #259: Linux core and macOS portability passed, but `dsh-typecheck-and-build` failed in `pnpm check`. The precise TypeScript diagnostic remains unavailable through the available GitHub connector endpoints.
- Next owner: **remote**. Retrieve actual `pnpm check` compiler output, fix the exact failure without loosening checks, then validate current source and proceed to cross-process and project-root binding regressions. No new local task; OL-004 already done and LO-004 acknowledged.
