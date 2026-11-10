# C6B2B4C — Offline synthetic adversarial hardening acceptance (OL-20261110-004)

- Verdict: **ALL_OFFLINE_PASS**
- `GH_MACOS_CI_INFRA_NOT_COVERED`: the hosted macOS GitHub CI job was **cancelled without ever allocating a runner** in both code run #250 and docs-only run #251 (retry also cancelled) — per the task's updated infrastructure gate, we used **independent local macOS synthetic-only acceptance** instead of waiting forever; we do NOT claim GitHub 3/3.
- REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: **NOT RUN**. No service (3080/3083/8123), model credential/default, DSH Session Prompt, Weixin or production database was touched. Zero product-code changes by the local Agent. All writes stayed inside disposable owner-only `0700` synthetic fixture roots.

## 1. Mandatory preflight (exact code SHA)

- Code under test: `c955892055b916f2d37edf4d8f8f2d06e21fafb5` ("refuse known hardlink aliases and special source modes in synthetic single-file apply").
- Required code CI #250 (run 42844707509): `local-first-core` **success**, `dsh-typecheck-and-build` **success**, `macos-portability` **cancelled** (runner never allocated). Linux/build gate satisfied; macOS gate handled independently (see verdict line).
- Docs-only run #251 (run 42851568782, same unchanged source tree, HEAD `d423ea1`): both Linux jobs success, macOS again cancelled. Check-suites at the exact code SHA confirm the same pattern.
- Branch HEAD at execution: `4111ccedf4ae78700e4a5925d49e503ef9bd0740` — newer docs-only handoff commits do not change the tested source tree.
- Claim: `agent-handoff/receipts/local/OL-20261110-004-claimed.md` appended before substantive work (commit `adf7b64a00e525dda183ebe0fcbcf3a32ddc8754`); single execution, no replay of OL-001/OL-003.

## 2. Gate A — clean worktree + full local macOS suite

Clean detached worktree at the exact SHA (`git status --porcelain` empty). Independent macOS results (all exit 0):

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (Vitest ESM) | exit 0 — **62 files / 1208 tests passed**, build complete |
| `tests/local-nongit-apply.node-test.mjs` | exit 0 — **18/18** (includes 4 new hardening tests + 2 orphan-lock tests) |
| `tests/local-nongit-batch-audit.node-test.mjs` | exit 0 — 14/14 |
| `tests/local-nongit-batch-executor.node-test.mjs` | exit 0 — 8/8 |
| `tests/local-nongit-batch-recovery.node-test.mjs` | exit 0 — 7/7 |
| `tests/local-nongit-batch-stage.node-test.mjs` | exit 0 — 13/13 |
| `tests/local-project-workspaces` / `local-projects` | 10/10, 3/3 |
| `tests/local-existing-dsh-projects` / `local-model-queue` | 6/6, 6/6 |
| `tests/local-weixin-native` / `local-weixin-qr` | 6/6, 4/4 |
| `scripts/probe-local-llm.node-test.mjs` | 3/3 |
| Standalone proxy `tests/local-openai-queue-proxy.node-test.mjs` | 5/5 |
| Combined Node suites (23 files) + probe | **187 passed / 0 failed** |

No real test failed → no `BLOCKED_CODE`. Required handoff/protocol docs (README, PROJECT_CONTEXT, WORK_QUEUE, CURRENT_STATE, MESSAGE_PROTOCOL, SECURITY, LOCAL_AGENT_TASK, LOCAL_AGENT_PROTOCOL, docs/C6B2B4C-synthetic-adversarial-plan.md) all read.

## 3. Gate B — independent adversarial harness (fresh 0700 fixtures, 35 checks, 0 failures)

Harness: private disposable fixtures only (registry `doc`, 0700 roots, 0600 approvals). Special POSIX bits are **supported on this APFS volume**, so those cases are real PASS, not SKIPPED_UNSUPPORTED.

Orphan-lock redaction (apply + rollback):
1. Pre-existing owner-only `.single-file-apply.lock` → error message is EXACTLY `Single-file apply lock exists; human reconciliation required`; embeds NO private fixture/journal path; second invocation returns an identical error (never steals, never retries); orphan lock content retained verbatim; source bytes AND full POSIX mode (0o644 incl. any special bits) unchanged; NO journal directory created.
2. Orphan lock after a genuine apply blocks rollback: same stable path-free message; orphan retained; applied bytes + applied mode (0o600) unchanged; journal row stays `applied` with `rollbackApprovalId` undefined → rollback approval NOT consumed.

Hardlink alias refusal (identical inode aliases):
3. Alias present BEFORE apply → `Hardlinked source path requires manual review`; both alias paths keep `before` bytes; inode alias still shared; no journal created.
4. Alias created AFTER apply (nlink 2) blocks rollback → refusal; both paths keep applied bytes; nlink 2 preserved; prior applied journal preserved, not consumed.

Special POSIX mode refusal (where supported — sticky 0o1644 and setuid 0o4644 both supported here):
5. Special bits BEFORE apply → `Special source mode bits require manual review`; content unchanged; full `mode&0o7777` preserved; no journal.
6. Special bits added AFTER apply block rollback → refusal; applied content and external special mode both untouched; journal still `applied`.
7. Setuid variant refused with the same contract; setuid preserved.

Regression sanity (one-shot/no-replay): normal modify apply → `applied`; immediate same-grant replay after apply is blocked (post-apply preview fails: `Original project changed since worker snapshot`); rollback restores content AND original 0o600 mode.

Existing repo tests at this SHA independently cover the same negative contracts (orphan-lock redaction 0o644→0600 paths, hardlink before/after, special bits) — 18/18 green; C6B2 staged evidence, audit, recovery and synthetic coordinator suites re-run green including one-shot/no-replay behavior.

## 4. Gate C — conservative hardening vs actual OS path safety (explicit distinction)

This increment delivers **conservative preflight refusals**, not race-free OS-level guarantees: the new checks (`nlink!==1`, `mode&0o7000!==0`, sanitized EEXIST lock error) close *known* alias/metadata states deterministically, but the hardlink/TOCTOU window (an alias created between the preflight and the mutation by an external writer) remains **UNPROVEN**; likewise ancestor-symlink TOCTOU, non-cooperating external writer races, ACL/xattr preservation, APFS case/Unicode normalization, authenticated one-use out-of-band approvals, power-loss durability and non-atomic batch writes remain open (carried from C6B2B4B §4/§5). No production-readiness or authorization is claimed.

## 5. Gate C — zero production callers at the exact SHA

Repo-wide scan (`src/app`, `src/executor`, `src/client`, `src/core`, `src/index.ts`, `scripts/`) finds NO importer of `non-git-apply`/`non-git-batch-*` outside `src/local-first/`; module files import each other only; exports are referenced only from their own tests. No Runtime, Weixin, Outbox, original DSH or Worker production caller. Default-OFF.

## 6. Residual items for remote (no local patching)

- Out-of-band approval file is still not *consumed* after a successful apply within its expiry window (only the `tx-<transactionId>` journal collision blocks same-tx replay; a new transaction id could reuse a still-valid approval — C6B2B4B §5.2, still open).
- The new hardlink preflight checks `nlink` of the target only at two points; a writer creating an alias inside the mutation window is not caught (design-level; needs fd-relative native primitive).
- ACL/xattr capture-vs-refusal decision remains remote-owned (C6B2B4B §5.3).

## 7. Rollback

- Scheduler/services/providers/models/Weixin/projects: untouched this round (nothing to revert).
- GitHub: revert/delete this report + result message + OL-004 claimed/done receipts (append-only, non-force push history).
- Fixtures were disposable `mkdtemp` roots, fully removed after the run.
