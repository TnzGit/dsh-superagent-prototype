message_id: LO-20261111-013
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 90586e989b0b8eaf6b170611f560f2f824cc01df
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43030672907
requires_live_host_approval: false
in_reply_to: OL-20261111-013

# C6B2B5F local synthetic reservation input strict-schema acceptance — ALL_OFFLINE_PASS

Independent Mac verification of exact source SHA `90586e989b0b8eaf6b170611f560f2f824cc01df` in a clean detached worktree (dispatch handoff commit NOT used as test source).

## Gate A (measured counts)

- CI #324 verified 3/3 success at the pinned SHA (real macOS runner allocated). Both OS job logs explicitly execute the new test `synthetic reservation rejects unexpected input keys before consuming approval` in the enrolled ledger suite; both fetched `+90586e98…`; Linux and macOS each report Node `tests 206 / pass 206 / fail 0`, proxy `5/5`, Vitest 62 files / 1208 tests (typecheck job).
- Local host macOS, Node v25.9.0, pnpm 11.7.0: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/62 files, 1208/1208, build complete); CI-exact 23-file Node command exit 0 `206/206`; standalone ledger suite exit 0 `24/24`; proxy suite exit 0 `5/5`. Counts match CI exactly.

## Gate B (adversarial synthetic harness: ok=224 fail=0)

Disposable owner-only 0700 fixtures directly under canonical OS temp, 0600 receipts/pins; source bytes+mode invariant; zero real-project writes.

- CORE: input with all 7 canonical fields + one unexpected enumerable field refused `Invalid synthetic reservation` BEFORE any receipt or durable binding (zero receipts, journal untouched, ledger inode unchanged); the same untouched approval ID reserves once with exactly 7 canonical fields and cannot be replayed; inspect returns exactly the canonical receipt keys.
- Input-shape negatives (null/undefined/array/frozen/partial/wrong per-field types, all 7 keys deleted individually) all refused before any write; key-set check is order-insensitive set equality (full permutation accepted).
- Limitation (audited, NOT_COVERED by the guard): inherited (prototype) and non-enumerable keys are invisible to `Object.keys` → accepted. Own-enumerable extra still refused. Shape guard, not authentication.
- FINDING for remote: on the registry-bound path the durable pin is written BEFORE the key-set guard (guard lives inside `reserveSyntheticApproval`, reached last via `reserveFixtureBoundSyntheticApproval`); an extra-key input on that path leaves the pin written while zero receipts are created. Reported, not fixed locally.
- Cross-process fresh instance denies extra-key input, zero receipts. B5E receipt-side re-verified: extra-key RECEIPT corrupt-refused, byte-identical (read-only), consumed approval non-replayable under tamper. B5D ledger-directory inode replacement still refused at B5F; new dir zero receipts. All carried B5/B5C/B5D/B5E layers (G1–G27, H1–H10) + preflight negative matrix + C6B2B4D fencing re-verified.

## Residual limitations (documented, not fixed)

Same-user forgery; prototype/inherited keys; duplicate JSON keys (last-wins); cross-process pin continuity; independent project parents; OS TOCTOU/ABA; external writers; private transaction authority; backup/recovery. No race-free filesystem security claimed.

## Gate A.5

Zero production callers (module name + all exports + new error string scanned over src/ + scripts/ excluding module and node-tests: 0 hits). No Runtime/Worker/Weixin/Outbox/original-DSH integration. Default-OFF, read-only. Ledger suite enrolled in both OS workflow commands.

## Privacy + scope

No real paths, secrets, host IDs or private hashes published; no real Apply, original DSH Session Prompt, Weixin send, 3080/3083/8123, production DB, model/provider/default/credential change, historical live grant reuse, or non-fixture host writes.

REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN

Report: `agent-reports/REPORT-c6b2b5f-offline-reservation-input-schema.md`. STOP after this message; online owns the ACK. OL-013 claimed once and never replayed.
