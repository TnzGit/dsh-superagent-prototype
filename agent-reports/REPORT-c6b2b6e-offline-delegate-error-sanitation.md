# OL-20261114-038 — C6B2B6E independent Mac synthetic ledger delegate error sanitation acceptance

**Verdict: ALL_OFFLINE_PASS**

- Host: macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (independent local Mac; not a CI runner).
- Pinned source (exact, detached clean worktree, `git status` 0 lines): `f74a931ae6007672d2359a151e724db574957e8f` (C6B2B6E "sanitize synthetic delegate ledger errors and test no repair"; parent `0ee8cff`'s ancestry includes the LO-037 ACK `1fc1ccd`). Dispatch HEAD `0ee8cff5a8c039cce30acbbb8b9b6991911dcc9f`; `f74a931` verified ancestor of dispatch HEAD (`merge-base --is-ancestor` = YES).
- Claim: `OL-20261114-038` claimed exactly once (receipt commit `b454fa8190a38f9f2a2d72690505035a69a508b7`; initial commit `af89928` orphaned by the amend, metadata-correction follow-up `fc688910c25cd7a02c0be9a05882b6f2efdafb85`; stale initial metadata recorded as a caveat, same pattern as OL-032–037).
- Scope: OFFLINE_SYNTHETIC_ONLY. 0700 disposable synthetic fixtures only. Zero product source edits. Services 3080/3083/8123, real Weixin, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback: untouched.
- **Provenance note:** C6B2B6E is remote's fix for the exact audited delegate-window defect reproduced and reported by our OL-20261114-037 report (raw `ENOENT ... realpath '<private>/ledger'` with private path when a deletion landed in the generic-delegate window; WORK_QUEUE records it as the actionable defect from LO-037).

## A. Remote CI evidence cross-check

- Actions **#474** run `43576656827`: `head_sha == f74a931ae6007672d2359a151e724db574957e8f` **exact** (the pinned source itself), status completed, conclusion **success, 3/3** (macos-portability / dsh-typecheck-and-build / local-first-core, all success on real allocated runners 1000003439/1000003440/1000003441).
- Actions **#473** at a different SHA: cancelled — excluded as pass evidence, matching the dispatch's note.
- Job logs read directly: BOTH new tests **actually executed on both platforms** — `generic synthetic inspection sanitizes a missing ledger without receipt repair or approval replay` (macOS `✔ 18.011916ms`, Linux `ok 217`) and `strict fixture inspection masks delegate filesystem errors without changing receipt` (macOS `✔ 50.319615ms`, Linux `ok 218`); Node `241/241` + proxy `5/5` on each leg; Vitest 62/1208, typecheck/build success.
- Diff `f74a931..0ee8cff` (dispatch) = handoff docs + LOCAL_AGENT_TASK.md + the to-local message only. Zero src/test/workflow drift.
- `code_sha` literal `f74a931ae6007672d2359a151e724db574957e8f` appears exactly once in the CURRENT `LOCAL_AGENT_TASK.md` at dispatch HEAD (count 0 at the pinned source itself — file predates the dispatch; checked at dispatch HEAD per protocol).

## B. Local parity (independent Mac, exact pinned source)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (1.3s) |
| `pnpm check` | exit 0 (build complete 1527ms; no flake this run) |
| Workflow-exact 23-file Node suite (run verbatim from the workflow's own command) | **241/241**, exit 0; BOTH new C6B2B6E tests executed locally (generic 41.99ms, strict-mask 20.92ms) |
| Proxy suite | **5/5**, exit 0 (macOS has no `timeout` binary; unbounded run recorded, same caveat as prior milestones) |
| Standalone ledger trio | **59/59**, exit 0 (+2 vs OL-037's 57 = the two new C6B2B6E tests) |
| Vitest | **62 files / 1208 tests**, exit 0 |
| Gate A.5 zero-production-caller scan | `inspectSyntheticApproval`/`inspectFixtureBoundSyntheticApproval` in `src/` outside the ledger module = 0 hits → **NO_PRODUCTION_CALLERS** |

## C. Source review (exact sanitation, not a paraphrase)

`src/local-first/non-git-synthetic-approval-ledger.ts` at `f74a931`:

1. **Generic `inspectSyntheticApproval` ledger-root observations now wrapped**: `try { root=await realpath(ledgerRoot); rootStat=await lstat(ledgerRoot) } catch {throw Error('Unsafe synthetic ledger root')}`. Source comment self-records: error sanitation, NOT fd-relative isolation or protection against path ABA/TOCTOU. Pre-fix bare pair (`const root=await realpath` / `const rootStat=await lstat`) is GONE (structural assertion AE8).
2. **Strict delegate now wrapped**: `try {receipt=await inspectSyntheticApproval(ledger,approvalId)} catch {throw Error('Corrupt synthetic reservation; human reconciliation required')}` — comment: never propagate raw errno/private paths from the strict synthetic API; do not repair, retry or consume the receipt. This closes exactly the window our OL-037 AD1 race reproduced.
3. C6B2B6E delta = 1 source file (+18/−3) + 1 test file (+46): remote tests rename the ledger aside, loop `missing`/`file`/`dangling-link`, assert exact sanitized messages with no private path and no `/ENOENT|ENOTDIR|ELOOP/`, receipt bytes deepEqual-preserved in the parked dir, root NOT repaired, restored -> accepted, consumed ID still `already reserved`; the strict-mask test renames the ledger CHILD away (missing-child case, complementing bounded mid-call races).

## D. Independent adversarial matrix (bounded synthetic fixtures; final stable result **ok=1442 fail=0**, exit 0 on 6 consecutive runs)

Carried layers B4C–B6D (G…U/AA/AB/AC/AD groups; AD1 tightened to **ZERO raw-errno tolerance** since the delegate window is now closed) re-verified unchanged, plus new AE groups:

- **AE1 generic inspector, deterministic missing/file/dangling-link ledger root** → exact `Unsafe synthetic ledger root`, no errno/path; receipt preserved in parked dir; inspector never repairs (root stays absent after refusal); restored -> accepted; consumed ID never replayed. Mirrors remote test independently.
- **AE2 strict masking (remote-test mirror)**: ledger child renamed away -> strict children preflight masks to `Unsafe synthetic fixture private directory`; receipt unchanged; restored -> strict accepted; consumed stays consumed.
- **AE3 AUDITED classification collapse (honest limit per dispatch's "audit whether broad catch hides useful classification")**: the strict delegate catch masks EVERY delegate failure — raw errno AND semantic taxonomy — to the single `Corrupt synthetic reservation; human reconciliation required` message. Additionally audited: the GENERIC inspector itself blanket-catches its read block, so even its internal `Noncanonical synthetic reservation` / `changed during inspection` taxonomy surfaces as Corrupt-reservation through any path — the two taxonomies are indistinguishable through the strict API. Not a defect; documented.
- **AE4 bounded mid-call ledger-root DELETION race (20 trials) against strict inspection**: ZERO raw-errno observations, zero private paths in any refusal; tally shows the delegate mask genuinely exercised mid-race (`Corrupt synthetic reservation…` 1/20 — pre-C6B2B6E this trial would have been the raw leak); receipt bytes identical through all refusals; approval remains one-use.
- **AE5 bounded mid-call race on the GENERIC inspector (20 trials)**: zero raw errno, zero private path (tally all-ACCEPTED on this timing — deletion+restore interleaved outside the observation window; the zero-leak invariant is the assertion).
- **AE6 fresh OS child** (independent `node --experimental-strip-types` process): generic inspect on missing ledger -> `DENIED:Unsafe synthetic ledger root` only (no raw errno, no path); restored -> `ACCEPTED` (refusals never consume cross-process).
- **AE7 macOS canonical path semantics**: `/var` vs `/private/var` spellings on the generic ledger root — missing refusal sanitized identically under both spellings; `/var`-spelled restored ledger ACCEPTED (realpath coercion honored, matching prior strict-path behavior).
- **AE8 structural**: pinned source text carries both exact wraps + both self-recorded limit comments; pre-fix bare pair gone.

Race timing remains non-deterministic (per-trial tallies differ across runs); recorded per the dispatch's instruction. We do NOT claim race-free path authority: this milestone is sanitized error messages only; ABA/TOCTOU remain open gates.

## E. Open gates / residual limits (re-audited at C6B2B6E; remote owns these)

- Same-user marker/pin forgery (integrity evidence, not signature; byte-identical in-place rewrite indistinguishable).
- Generic `reserveSyntheticApproval` re-reserves the same approval ID in an alternate independent ledger root (cross-root fencing absent; registry-bound path IS fenced by the durable pin).
- Path ABA across calls passes the best-effort check (dev/ino not remembered across calls; mid-call detection works).
- TOCTOU: unwrapped observations still exist elsewhere in the journal preflight (lstat/realpath inside the generic catch, mapped to Corrupt) and throughout reserve paths; tmpdir is not a sandbox.
- Classification collapse (AE3): broad catches collapse taxonomy to single messages; useful classification hidden — honest limit.
- Proxy traps run user code during reflection; private transaction authority and backup/recovery unresolved; real Apply gates unproven.

## F. NOT_TESTED

Real WeChat inbound/outbound, real OpenClaw hook fields, production DSH→proxy routing, 400K-context stress. No product source edits locally; no defect found within C6B2B6E's own scope. Candidate next milestone noted for remote only as an observation: the delegate mask collapses semantic taxonomy (AE3); a narrower wrapper distinguishing sanitized-delegate taxonomies would restore classification if remote wants it.
