# C6B2B5E — Local Mac synthetic receipt strict-schema acceptance (sanitized)

**Verdict: ALL_OFFLINE_PASS**
**Pinned tested code SHA:** `1daea219cc1187fb0d8ed1a798828a7645166a5e` (branch `feat/local-first-wechat-foundation`, clean detached worktree, `git status` 0 lines)
**Task:** `OL-20261111-012` (OFFLINE_SYNTHETIC_ONLY). Claimed once (`7396ac5e6ab7db573fb0f7e2135c48d673f5692b`), never replayed OL-001…011.

## Gate A — CI parity + full offline suite (measured, not prefilled)

- CI #317 (run `43004625428`) at pinned SHA: `dsh-typecheck-and-build`, `local-first-core`, `macos-portability` all conclusion=success (3/3). Real macOS runner allocated (runner 1000002822). New B5E test `read-only synthetic receipt inspection rejects unexpected fields without consuming or rewriting receipt` present in BOTH OS job logs; Linux and macOS both report `tests 205`. Both fetched the exact pinned SHA (log line `+1daea219…`). Ledger suite enrolled in both OS workflow commands (grep count = 2). CI #315/#316 cancelled — not counted.
- Local host: macOS, Node `v25.9.0`, pnpm `11.7.0`.
- `pnpm install --frozen-lockfile` exit 0. `pnpm check` exit 0: Vitest **62 files / 1208 tests** all pass, build complete (matches CI 1208/1208).
- CI-exact 23-file Node command on Mac: **205/205 pass** (matches CI `tests 205` on both OSes; exit 0).
- Standalone ledger suite: **23/23** (the new B5E test among them; exit 0). Queue-proxy suite: **5/5** (exit 0).

## Gate B — synthetic adversarial harness (174 checks, ok=174 fail=0)

Disposable `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` fixtures with `0600` marker/pin/receipts only. Zero real-project writes; source bytes+mode invariant proved after every sequence.

B5E-specific groups (new at `1daea219`, `inspectSyntheticApproval` canonical-key-set check `Object.keys(r).sort().join(',')` must equal exactly the 7 canonical keys; non-object/array rejected):
- **H1** happy path: reserve + read-only inspect returns exactly the canonical 7 fields, zero extra state, source invariant, no consumption.
- **H2 CORE:** syntactically valid JSON with one EXTRA key (`unexpected:'not-authority'`) while preserving all required fields → inspection rejected `Corrupt synthetic reservation; human reconciliation required`; receipt **byte-identical** to the tampered bytes (read-only proven); mode 0600 + nlink 1 unchanged; consumed approval ID remains non-replayable (`already reserved`); zero new receipts, no auto-cleanup/rewrite/silent recovery.
- **H3** rejected inspection does NOT consume a new reservation: a fresh approval ID still reserves successfully against the same tampered fixture (corrupt receipt left for reconciliation).
- **H4** 11 required-field negative cases (missing version/approvalId key, array instead of object, operation outside apply/rollback, malformed transactionId, non-hex projectFingerprint/previewDigest, non-string journalRoot, version!==1, in-file approvalId differing from requested ID, torn partial JSON): all rejected as corrupt, receipt byte-identical after rejection, no new receipts.
- **H5** receipt-file mode 0644, symlinked receipt, hardlinked receipt (nlink=2): all refused `Unsafe synthetic reservation` (read-only, ledger holds exactly one receipt name).
- **H6** key-set check is order-insensitive: a permutation of exactly the canonical keys is accepted (set equality, not order).
- **H7** duplicate-key JSON collapses last-wins: identical duplicate value accepted (key set unchanged); duplicate with differing value caught via the last-wins `version` value.
- **H8 residual limitation (audited):** strict schema is corruption DETECTION, not a signature — a same-user-forged receipt carrying the exact canonical field set (never reserved through the API) is ACCEPTED.
- **H9** fresh OS process rejects the extra-key receipt (`REJECTED:Corrupt synthetic reservation`); child did not rewrite the receipt — strict schema holds across the process boundary.
- **H10** fresh OS process reserves + inspects with canonical keys and reports exactly the canonical set; one receipt in ledger (cross-process reserve fence unaffected).

Carried-over regressions re-verified at `1daea219`: full B5/B5C/B5D layers (G1–G27: durable pin guards, cross-fixture binding, 6-way cross-process one-winner, crash-after-partial terminal invariants, rename-aside inode/deletion/ledger-directory continuity, precedence fix, mid-flight swaps, error-message no-path-leak), registry-bound preflight negative matrix (OL-006/007/008 layers: uppercase/unknown ID, fingerprint mismatch, alt journal, marker guards, nested fixture, readOnly/git ineligible, ancestor/root symlink swaps, ordinary same-path replacements), C6B2B4D fencing (one-use, duplicate reconciliation, 26-byte partial terminal + corrupt-inspector no-repair, 6 independent OS children on fresh approval ID → 1 WIN / 5 DENIED).

## Known limitations (documented, NOT fixed — remote owns the code)

- **Same-user forgery:** an attacker who can write the ledger can forge a receipt with the exact canonical field set and pass inspection (H8). Strict schema = integrity evidence, not authentication; no MAC/keyed signature.
- **Cross-process non-inheritance / TOCTOU / ABA:** unchanged from B5C/B5D (fresh process has no in-memory identity evidence; mid-flight swaps complete against post-swap state in fresh processes).
- **Cross-root:** generic `reserveSyntheticApproval` still re-reserves the same ID under an alternate independent ledger root (no cross-root fencing).
- No OS-level race-free descriptor-relative capability; external writers uncooperative.

## Gate A.5 — deployment constraint

Zero production callers: grep for the module name and all five exports over `src/` + `scripts/` (excluding the module itself and node-tests) → **0 hits** (rc=1). The module imports only Node builtins plus `projectFingerprint`/`LocalProjectRegistry` types — no production Apply, no Runtime/Worker, no Weixin/Outbox, no original-DSH caller. Default-OFF, read-only except `wx 0600` receipt + dir fsync. Workflow enrollment confirmed on both OS commands (grep count = 2).

## Scope compliance

No real project Apply, no original DSH Session Prompt, no Weixin send, no 3080/3083/8123 changes, no production SQLite, no model/provider/default/credential changes, no historical live grant reuse, no non-fixture host writes. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`.

## Rollback

Local-only additions this round: detached worktrees `.worktrees/claim-c6b2b5e` (→ report worktree) and `.worktrees/stage-c6b2b5e`, harness/report under `~/.dsh-superagent-private/c6b2b5e/` (0700 dir, 0600 files), private claim state update. Remove worktrees + private dir to restore prior state; branch advanced only by the claim + docs commits (normal non-force fast-forward pushes, no force, no rebase).
