message_id: LO-20261111-009
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
in_reply_to: OL-20261111-009
code_sha: 06de7c16599dc348857a0b0548135e458d5964e5
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42942799009
requires_live_host_approval: false
verdict: ALL_OFFLINE_PASS
report: agent-reports/REPORT-c6b2b5-offline-durable-ledger-pin-acceptance.md

# C6B2B5 durable synthetic ledger-root pin accepted — independent Mac adversarial matrix all green (71 checks / 0 failures)

Replies to `OL-20261111-009` (exact source SHA `06de7c16599dc348857a0b0548135e458d5964e5`). Full required header; CI #291 cancellation correctly excluded from verification.

## Gate A.1 — full suite at exact SHA (all exit 0)

- CI #292 re-verified at the exact SHA: `local-first-core`, `macos-portability` (genuine hosted macOS runner), `dsh-typecheck-and-build` all success (3/3). Ledger suite present in BOTH workflow OS command lines (`grep -c` = 2); the four new cross-fixture/durable-pin tests execute in both platform jobs.
- `pnpm install --frozen-lockfile`: exit 0. `pnpm check`: exit 0 — Vitest **1208/1208**, 62 files, build complete.
- Standalone ledger suite: **20/20**, including all four new durable-pin cases.
- Combined Node suites (workflow file list + probe): **207/207** (202 Node + 5 proxy, matches CI per-platform math); proxy standalone **5/5**.

## Gate A.2/A.3 — independent adversarial harness, 71 checks / 0 failures

Disposable owner-only `0700` synthetic fixtures only (canonicalized temp paths; macOS `/var` symlink handled). Positive: exactly one `0600` durable pin under the disposable project PARENT and one exclusive `wx` receipt under fixture A; pin never inside the registered project root; registered source bytes AND full mode invariant. Replay matrix: same-ID replay into A rejected by `wx`; alternate fixture B rejected by BOTH the same registry instance AND an INDEPENDENT `LocalProjectRegistry` instance sharing the same synthetic project parent (`conflicting fixture ledger binding`), with ZERO receipts in B's ledger and journal. Pin guards: corrupt and torn partial pins fail closed and are terminal (never auto-repaired, zero receipts); 0644/symlink/nlink-unsafe pins refused; pin bound to a different projectId or version conflicts. Location guards: parent must be a `0700` non-symlink `dsh-project-synthetic-*` DIRECTLY under canonical temp — nested, bad-name, group-writable and realpath-diverging parents all refused; a deleted registered root fails closed without mutating pin or receipt. Core cross-process proof: SIX independent OS processes sharing one synthetic project parent but six DIFFERENT private ledgers contending one approval ID → exactly 1 WIN / 5 DENIED, all exit 0, total receipts across all ledgers == 1 (no duplicate). Crash semantics: torn receipts stay terminal, no silent recovery. No raw private paths leak in expected errors. Full prior negative matrix (ID schema, fingerprint mismatch, alternate journal, marker shapes, readOnly/git ineligible) re-verified fail-closed. In-memory pin confirmed process-local; two projects in different parents pin independently.

## Gate A.4 — C6B2B4D synthetic concurrency re-verified

One-use reservation; duplicate same-ID fail-closed; crash partial receipts never overwritten and inspector fails closed without auto-repair; six independent OS processes on one shared ledger and one fresh approval ID → exactly 1 WIN / 5 DENIED, all exit 0, winner receipt retained.

## Gate A.5 — integration and write audit

Zero importers of the ledger module or any of its exports in `src/` or `scripts/` outside their own definitions; `assertRegisteredRootIdentity` has no external caller. No Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply wiring. Module writes only: `wx` 0600 pin + receipt inside caller-supplied owner-only disposable fixtures plus directory fsync — never inside a registered project root. An owner-private temp fixture is NOT an OS sandbox.

## Unresolved risks (UNSOLVED, independently re-audited, not claimed fixed)

Same-user forged-first pin denies all legitimate reservations and the attacker whose ledger matches the forgery gets the reservation (integrity evidence, not a signature); same-user pin deletion bypasses the fence; SEPARATE synthetic project parents re-bind the same approval ID into different ledgers (fencing bounded to ONE disposable parent, no cross-parent fence); a second project inside the same pinned parent conflicts with the single pin (per-parent scope, by design); ABA content replacement of the pin is trusted as whatever is present; check is not atomic with subsequent use; external writers/TOCTOU, private transaction authority and backup/recovery remain. No production-readiness claimed; NEVER for real Apply.

## Host boundary

Nothing real touched: no real project Apply, no real host source write, no Weixin E2E, no ports 3080/3083/8123, no service/model/provider/credential change, no production DB, no DSH Session Prompt, no historical grants. All fixtures disposable `0700` and removed. Local Agent made zero product-code edits. STOP after this result.
