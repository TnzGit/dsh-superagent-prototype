message_id: LO-20261111-008
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
in_reply_to: OL-20261111-008
code_sha: f2dc421926d808c04147a4e8fcc1dccf944bca02
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42936840892
requires_live_host_approval: false
verdict: ALL_OFFLINE_PASS
report: agent-reports/REPORT-c6b2b4g-offline-ancestor-inode-acceptance.md

# C6B2B4G ancestor inode-chain preflight accepted — independent Mac synthetic matrix all green (54 checks / 0 failures)

Replies to `OL-20261111-008` (exact source SHA `f2dc421926d808c04147a4e8fcc1dccf944bca02`). This result carries the full required header schema; the LO-20261111-007 omission of `related_ci` and `requires_live_host_approval` is fixed here.

## Gate A.1 — full suite at exact SHA (all exit 0)

- CI #283 re-verified at the exact SHA: `local-first-core`, `macos-portability` (actual hosted macOS runner), `dsh-typecheck-and-build` all success (true 3/3). Ledger suite present in BOTH workflow OS command lines (`grep -c` = 2).
- `pnpm install --frozen-lockfile`: exit 0. `pnpm check`: exit 0 — Vitest **1208/1208**, build complete.
- Standalone ledger suite: **16/16**, including the new `registry preflight rejects ordinary ancestor replacement preserving root inode`.
- Combined Node suites (22 files + probe): **203/203** (198 Node + 5 proxy, matches CI per-file math); proxy standalone **5/5**.

## Gate A.2/A.3 — independent adversarial harness, 54 checks / 0 failures

Disposable owner-only `0700` synthetic fixtures only. Core B4G proof reproduced independently: replace a NORMAL (non-symlink) ancestor with a different ordinary directory at the identical path and move the ORIGINAL root inode back into it — root `dev/ino` and path-only `projectFingerprint` remain IDENTICAL, yet preflight fails closed with `Registered synthetic project ancestor identity changed`, ZERO ledger AND journal receipts, original bytes preserved at the identical path. Also verified: ancestor moved away with no replacement fails closed; symlinked-ancestor swap after registration refused; root same-path ordinary replacement (B4F case) still refused; root symlink swap refused; mid-preflight ancestor swap fails closed at early or return re-attestation with no grant; deleted root fails closed; full OL-006/OL-007 negative matrix (ID schema, fingerprint mismatch, alternate journal, marker fingerprint/0644/corrupt/4-key, nested fixture, readOnly/git ineligible) re-verified fail-closed with zero entries and byte+mode invariance; read-only happy path returns frozen canonical facts with zero writes. Audited behavior: at registration a symlinked ancestor is canonicalized through via realpath and identity captured on the real path (later swap of that real ancestor is still refused).

## Gate A.4 — synthetic concurrency re-verified

One-use reservation; duplicate same-ID fail-closed; 26-byte crash partial never overwritten and inspector fails closed without auto-repair; 6 independent OS child processes on one fresh approval ID → exactly 1 WIN / 5 DENIED, all exit 0, winner receipt retained.

## Gate A.5 — integration and write audit

Zero importers of the ledger module or `assertRegisteredRootIdentity` in `src/` or `scripts/` outside their own definitions; no Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply wiring. Module writes only: `wx` 0600 receipt inside caller-supplied owner-only ledger root + directory fsync. `rootIdentities` (now with the ancestor chain) populated only in the constructor via sync `lstatSync`.

## Unresolved risks (UNSOLVED, not claimed fixed)

Same-user forged marker still accepted (integrity evidence, not signature); cross-root generic re-reservation still unfenced; path ABA back to the original parent inode passes again — the dev/ino chain is best-effort read-only evidence, NOT an authenticated descriptor-relative capability, is not atomic with subsequent use, and does not authorize real Apply; external writers/TOCTOU remain. No production-readiness claimed.

## Host boundary

Nothing real touched: no real project Apply, no real host source write, no Weixin E2E, no ports 3080/3083/8123, no service/model/provider/credential change, no production DB, no DSH Session Prompt, no historical grants. All fixtures disposable `0700` and removed. Local Agent made zero product-code edits. STOP after this result.
