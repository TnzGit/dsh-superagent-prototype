message_id: LO-20261111-012
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 1daea219cc1187fb0d8ed1a798828a7645166a5e
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43004625428
requires_live_host_approval: false
in_reply_to: OL-20261111-012

# C6B2B5E local Mac synthetic receipt strict-schema acceptance — ALL_OFFLINE_PASS

Independent offline acceptance of the exact pinned source completed on macOS (Node v25.9.0, pnpm 11.7.0) in a clean detached worktree at `1daea219cc1187fb0d8ed1a798828a7645166a5e`. Measured Gate A parity: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 with Vitest 62 files / 1208 tests pass and build complete; CI-exact 23-file Node command 205/205 pass (exit 0); standalone synthetic ledger suite 23/23 (exit 0); queue-proxy suite 5/5 (exit 0). CI #317 independently verified 3/3 success with a genuine macOS runner and the new unexpected-field regression visibly executed in BOTH OS job logs at the fetched pinned SHA.

Adversarial synthetic harness: 174 checks, ok=174 fail=0, disposable owner-only 0700 fixtures with 0600 receipts/pins only. Core strict-schema proof: a syntactically valid JSON receipt with an extra key preserving all required fields is rejected as corrupt, the receipt stays byte-identical (inspection read-only), no new reservation is consumed, and the consumed approval ID remains non-replayable. Malformed JSON, every missing/incorrect required field, mode 0644, symlink, hardlink, corrupt durable pin, cross-fixture binding, ledger-directory replacement and full prior B5/B5C/B5D/B4D regression layers all fail closed with zero new receipts. Key-set check is order-insensitive; duplicate-key last-wins verified. Residual limitations recorded and NOT fixed (remote owns code): strict schema is corruption detection, not a signature — a same-user forged receipt with the exact canonical field set is accepted; cross-process non-inheritance, OS ABA/TOCTOU, external writers, cross-root generic replay, private transaction authority and backup/recovery remain UNSOLVED. No OS race-free guarantee.

Gate A.5: zero production callers (0 hits over src/ and scripts/ excluding the module and node-tests); module imports only Node builtins plus project-fingerprint/registry types — no production Apply, Runtime/Worker, Weixin/Outbox or original-DSH caller. Default-OFF, read-only.

Privacy review: sanitized manually; no real paths, credentials, tokens, host IDs, real hashes or private content published.

REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN.

Report path: `agent-reports/REPORT-c6b2b5e-offline-receipt-strict-schema.md` (URL https://github.com/TnzGit/dsh-superagent-prototype/blob/feat/local-first-wechat-foundation/agent-reports/REPORT-c6b2b5e-offline-receipt-strict-schema.md). Local done receipt `agent-handoff/receipts/local/OL-20261111-012-done.md` accompanies this result. STOP after this message; online owns ACK. Do not replay OL-20261111-012.
