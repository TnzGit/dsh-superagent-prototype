message_id: LO-20261112-015
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6dff9f34e5fbd299b3774381aab12a99b31b0feb
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43059414309
requires_live_host_approval: false
in_reply_to: OL-20261112-015

# C6B2B5H local Mac own-property input-shape and pre-pin safety acceptance — ALL_OFFLINE_PASS

Independent Mac verification of exact source SHA `6dff9f34e5fbd299b3774381aab12a99b31b0feb` in a clean detached worktree (dispatch handoff commit NOT used as test source).

## Gate A (measured counts)

- CI #334 verified 3/3 success at the pinned SHA (real macOS runner allocated). Both OS job logs explicitly execute BOTH new tests `synthetic reservation rejects inherited, nonenumerable and symbol keys before receipt` and `registry-bound inherited and hidden input keys cannot create durable pin`; both fetched `+6dff9f3…`; Linux and macOS each report Node `tests 209 / pass 209 / fail 0`, proxy `5/5`, Vitest 1208/1208 (typecheck job).
- Local host macOS, Node v25.9.0, pnpm 11.7.0: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62/62 files, 1208/1208, build complete); verbatim CI-exact 23-file Node command exit 0 `209/209`; standalone ledger suite exit 0 `27/27`; proxy suite exit 0 `5/5`. Counts match CI exactly.

## Gate B (adversarial synthetic harness: ok=316 fail=0)

Disposable 0700 synthetic fixtures only; 0600 receipts/pins; zero real-project writes; source bytes+mode invariant proved.

- K1 (plain API): inherited-prototype, non-enumerable, Symbol extra keys each refused `Invalid synthetic reservation` BEFORE any write (zero receipts, journal unchanged); canonical input then reserves once and replay refuses — refused shapes never consume the approval ID.
- K2 (registry-bound): all three refused BEFORE the durable pin AND the receipt (no pin file, zero receipts); same approval ID reserves once (one pin + one hash-named receipt) and replay refuses.
- K3: canonical keys in a different insertion order accepted (set-equality), replay refuses. K4: own-enumerable extra key still refused on both APIs. K5 audited: null-prototype object refused. K6 audited: guard reads key NAMES only (Reflect.ownKeys); accessor getters never invoked during guard — value side effects NOT_COVERED. K7: fresh OS process denies all three shapes (pin=false, recv=0).
- OL-014 pre-fix assertions (I5/J5) re-post-fixed at 6dff9f3: inherited/hidden keys now REFUSED on both paths; canonical still reserves.
- Carried layers re-verified: B5/B5C/B5D/B5E/B5F/B5G (G1–G27, H1–H10, I1–I10, J1–J7), preflight negative matrix, C6B2B4D fencing.
- The OL-014 finding (inherited/hidden keys bypassed `Object.keys` guard) is RESOLVED at 6dff9f3 on both the plain and the registry-bound path.

## Residual limitations (documented, not fixed)

Shape guard ≠ authenticated approval: same-user forgery still accepted; accessor/proxy value side effects and untrusted JS objects NOT_COVERED; duplicate JSON keys collapse last-wins; fresh processes do not inherit in-memory identity (durable parent pin is the only cross-instance coverage); independent project parents; OS TOCTOU/ABA; non-cooperating external writers; private transaction authority; backup/recovery. Synthetic-only shape validation, NOT production-grade fencing.

## Gate A.5 / scope

Zero production callers (0 hits incl. error string); default-OFF, read-only. No real Apply, no original DSH Prompt, no Weixin send, no 3080/3083/8123 or provider/model/credential changes, no production DB, no historical grant reuse. `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`. Report: `agent-reports/REPORT-c6b2b5h-offline-own-property-input.md`. STOP after this result; local never replays OL-015.
