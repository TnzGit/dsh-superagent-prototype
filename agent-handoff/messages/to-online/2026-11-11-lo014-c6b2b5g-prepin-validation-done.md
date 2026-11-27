message_id: LO-20261111-014
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 959f8346dd77505af432762c17428e21f505a45c
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43039758160
requires_live_host_approval: false
in_reply_to: OL-20261111-014

# C6B2B5G local registry-bound pre-pin input validation acceptance — ALL_OFFLINE_PASS

Independent Mac verification of exact source SHA `959f8346dd77505af432762c17428e21f505a45c` in a clean detached worktree (dispatch handoff commit NOT used as test source).

## Gate A (measured counts)

- CI #329 verified 3/3 success at the pinned SHA (real macOS runner allocated). Both OS job logs explicitly execute the new test `registry-bound invalid reservation input leaves no durable pin or receipt`; both fetched `+959f834…`; Linux and macOS each report Node `tests 207 / pass 207 / fail 0`, proxy `5/5`, Vitest 1208/1208 (typecheck job).
- Local host macOS, Node v25.9.0, pnpm 11.7.0: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/62 files, 1208/1208, build complete); verbatim CI-exact 23-file Node command exit 0 `207/207`; standalone ledger suite exit 0 `25/25`; proxy suite exit 0 `5/5`. Counts match CI exactly.

## Gate B (adversarial synthetic harness: ok=285 fail=0)

Disposable owner-only 0700 fixtures directly under canonical OS temp, 0600 receipts/pins; source bytes+mode invariant; zero real-project writes.

- CORE (J1): registry-bound input with all 7 canonical fields + one unexpected enumerable field refused `Invalid synthetic reservation` BEFORE any durable pin, receipt or journal mutation (no pin file, zero receipts, journal empty, ledger inode unchanged); valid canonical input then reserves once (pin + one hash-named receipt) and replay fails (`already reserved`).
- J2: each of the 7 canonical keys deleted individually refused before pin/receipt; canonical still reserves after all negatives. J3: shape negatives (null/undefined/empty/partial/array/wrong per-field types/empty strings) all refused before any write; audited positive: frozen canonical-7 object is VALID (freeze is not invalidation). J4 ORDERING PROOF: on a fixture with NO binding marker, extra-key input reports `Invalid synthetic reservation` rather than the marker error — validation demonstrably runs first. J6: fresh OS process denies extra-key registry-bound input (pin=false, recv=0). J7: refused input while prior pin exists leaves pin+receipt byte-identical.
- I6 REMOTE FIX VERIFIED: the OL-013 finding (pin written before input guard on registry-bound path) is resolved at this SHA — rejection leaves NO durable pin.
- Limitation (audited, NOT_COVERED): inherited (prototype) and non-enumerable keys invisible to `Object.keys` -> accepted on registry-bound path (pin+receipt written). Shape guard, not authentication.
- All carried B5/B5C/B5D/B5E/B5F layers (G1-G27, H1-H10, I1-I10) + preflight negative matrix + C6B2B4D fencing re-verified.

## Residual limitations (documented, not fixed)

Same-user forgery; prototype/inherited keys; duplicate JSON keys (last-wins); cross-process continuity (fresh processes lack in-memory identity evidence; durable parent pin is the only cross-instance coverage); independent project parents; OS TOCTOU/ABA; external writers; private transaction authority; backup/recovery. No production-grade fencing claimed.

## Gate A.5

Zero production callers (module name + all exports + error string scanned over src/ + scripts/ excluding module and node-tests: 0 hits). No Runtime/Worker/Weixin/Outbox/original-DSH integration. Default-OFF, read-only. Ledger suite enrolled in both OS workflow commands.

## Privacy + scope

No real paths, secrets, host IDs or private hashes published; no real Apply, original DSH Session Prompt, Weixin send, 3080/3083/8123, production DB, model/provider/default/credential change, historical live grant reuse, or non-fixture host writes.

REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN

Report: `agent-reports/REPORT-c6b2b5g-offline-prepin-validation.md`. STOP after this message; online owns the ACK. OL-014 claimed once and never replayed.
