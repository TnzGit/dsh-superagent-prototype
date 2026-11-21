# OL-20261114-037 — C6B2B6D independent Mac mid-call fixture-root error sanitation acceptance

**Verdict: ALL_OFFLINE_PASS**

- Host: macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (independent local Mac; not a CI runner).
- Pinned source (exact, detached clean worktree): `1c29fe823bff657f894845e660dad1f26261927e` (C6B2B6D "sanitize second and final synthetic fixture-root observations"; parent `338e1a2` = LO-036 ACK). Dispatch HEAD `a3fcf75899a886e7e08effcf85f1750246a4b03e`; `1c29fe8` verified ancestor of dispatch HEAD (`merge-base --is-ancestor` = YES).
- Claim: `OL-20261114-037` claimed exactly once (receipt commit `eebfac7420ead8a8fbb1b835d0094ca3c4ae6579`, metadata correction follow-up `e20c68a0d96fa77ee896dcfb2b3e68c200f0ca69`; initial commit `f55560c` was orphaned by the amend and is recorded as a stale-metadata caveat, same pattern as OL-032–036).
- Scope: OFFLINE_SYNTHETIC_ONLY. 0700 disposable synthetic fixtures only (mkdtemp `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*`). Zero product source edits. Services 3080/3083/8123, real Weixin, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback: untouched.

## A. Remote CI evidence cross-check

- Actions **#468** run `43571952765`: `head_sha == 57ddda67b8e5b45340351d53b44cef2cfc7a8634` **exact** (docs-only HEAD), status completed, conclusion **success, 3/3** (dsh-typecheck-and-build / macos-portability / local-first-core, all jobs success on real allocated runners 1000003421/1000003422/1000003423).
- Actions **#467** run `43571926178` at the source SHA itself: **cancelled** by the later state commit — excluded as pass evidence, matching the dispatch's own note.
- Job logs read directly: the new regression `strict synthetic fixture inspection refuses deleted or replaced root without raw errno and without receipt repair` **actually executed on BOTH legs** — macos-portability `✔ … (73.563591ms)` plus `ℹ pass 239 / fail 0` and proxy `ℹ pass 5 / fail 0`; local-first-core `ok 216` + `# pass 239 / fail 0` + proxy `# pass 5`. Vitest 62 files / 1208 tests, typecheck/build success.
- Diff `1c29fe8..57ddda6` = `agent-handoff/CURRENT_STATE.md` + `agent-handoff/WORK_QUEUE.md` only. Diff `1c29fe8..a3fcf75` (dispatch) = handoff docs + LOCAL_AGENT_TASK.md + the to-local message only. Zero src/test/workflow drift.
- `code_sha` literal `1c29fe823bff657f894845e660dad1f26261927e` appears exactly once in the CURRENT `LOCAL_AGENT_TASK.md` **at dispatch HEAD** (checked in the claim worktree; at the pinned source itself the file predates the dispatch, count 0).

## B. Local parity (independent Mac, exact pinned source)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (1.3s) |
| `pnpm check` | exit 0 (build complete 1615ms; no flake this run) |
| Workflow-exact 23-file Node suite (lines 28/48 of the workflow, run verbatim) | **239/239**, exit 0; the new C6B2B6D regression executed locally too (`✔ … 47.207083ms`) |
| Proxy suite `tests/local-openai-queue-proxy.node-test.mjs` | **5/5**, exit 0 (macOS has no `timeout` binary; unbounded run recorded, same caveat as every prior milestone) |
| Standalone ledger trio (nongit + registry-approval + synthetic) | **57/57**, exit 0 (+1 vs OL-036's 56 = the new C6B2B6D test) |
| Vitest | **62 files / 1208 tests**, exit 0 |
| Gate A.5 zero-production-caller scan | `inspectFixtureBoundSyntheticApproval` in `src/` minus its own definition = 0 hits → **NO_PRODUCTION_CALLERS** |

## C. Source review (audit of the exact sanitation, not a paraphrase)

`src/local-first/non-git-synthetic-approval-ledger.ts` at `1c29fe8`, `inspectFixtureBoundSyntheticApproval`:

1. **Second observation now wrapped**: `try {initial=await lstat(fixtureRoot)} catch {throw Error('Unsafe synthetic fixture root')}` — closes the window where the root disappears after the first checked lstat/realpath but before the second observation (pre-fix this line was bare: `const initial=await lstat(fixtureRoot),temp=await realpath(tmpdir())` and could surface raw ENOENT).
2. **Final observation now wrapped**: `try { finalEntry=await lstat(fixtureRoot); finalRoot=await realpath(fixtureRoot) } catch {throw Error('Synthetic fixture root identity changed; manual review required')}`; the subsequent dev/ino/symlink/finalRoot comparison failures throw the same sanitized identity-changed message.
3. Both pre-C6B2B6D bare uncaught lines are GONE from the pinned source (structural assertion in harness AD3; `const finalEntry=await lstat(file)` still exists at :425 but that is the generic reserve path's journal check, a different symbol — not the strict fixtureRoot lines).
4. Source comment self-records the limit verbatim: "only error sanitation; inode ABA and TOCTOU remain unresolved" — this milestone is **error-message sanitation**, not a race-free capability claim. Dispatch's own instruction honored: we do NOT claim ABA/TOCTOU/fd-relative safety.
5. C6B2B6D delta = 1 source file (+18/−3) + 1 test file (+28); new remote test renames the base aside, loops `['missing','file','dangling-link']`, asserts message `==='Unsafe synthetic fixture root'` with no private path and no `/ENOENT|ENOTDIR|ELOOP/`, receipt bytes deepEqual-preserved at the parked path, root must NOT be repaired (`existsSync(base)===false`), strict accepts again after restore, consumed ID still `already reserved`.

## D. Independent adversarial matrix (bounded synthetic fixtures; final stable result **ok=1404 fail=0**, exit 0 on 6 consecutive runs)

Carried layers B4C–B6C (G/H/J/K/L/N/Q/R/S/T/U/AA/AB/AC groups) re-verified unchanged at the new source shape, plus new AD groups:

- **AD1 bounded mid-call DELETION race** (rmSync scheduled immediately after invoking `inspectFixtureBoundSyntheticApproval`, 20 trials, tree restored between trials): every trial's outcome is either ACCEPTED or a SANITIZED taxonomy message from the strict catches (`Unsafe synthetic fixture root` — second-observation window; `Synthetic fixture root identity changed; manual review required` — final-observation window; or delegate-side sanitized `Unsafe synthetic fixture private directory` / `Missing or corrupt synthetic fixture binding` / `Corrupt synthetic reservation…` when the scheduled deletion interleaves with the restore). Tally across runs shows the strict second/final catches reachable and sanitizing. **AUDITED PRE-EXISTING LIMIT, reproduced by this race**: in ~1/20 trials a deletion lands between the strict checks and the generic delegate `inspectSyntheticApproval(ledger,approvalId)` — that delegate's own `lstat(ledgerRoot)`/`realpath` are NOT wrapped (ledger module :99/:103), and the raw `ENOENT: no such file or directory, realpath '<private>/ledger'` (with private path!) surfaces. The delegate call is outside any strict catch (structural assertion AD3). This is the remaining TOCTOU window, NOT a defect introduced by C6B2B6D; race timing is non-deterministic, recorded per the dispatch's "record if race cannot be deterministically reproduced".
- **AD2 bounded mid-call SWAP race** (delete + immediate restore of a NEW inode at the identical path): final explicit dev/ino comparison throws sanitized `Synthetic fixture root identity changed; manual review required` mid-call (no errno, no path). A LATER call on the swapped-but-valid tree is **ACCEPTED** → dev/ino are not remembered across calls: the cross-call path-ABA limit holds (audited; mid-call detection works, cross-call does not). Consumed ID stays `already reserved`.
- **AD3 structural** (pinned source text): both catches present with exact messages; both bare pre-fix lines gone; self-recorded comment present; delegate call verified outside any strict catch.
- **AD4 privacy**: neither sanitized message contains any path fragment or errno token (`/ENOENT|ENOTDIR|ELOOP/` absent).
- **AD5 fresh OS child** (independent `node --experimental-strip-types --input-type=module` process): missing root → `DENIED:Unsafe synthetic fixture root` only (no errno, no private path); restored tree positive control → `ACCEPTED` (refusals never consume cross-process).
- **AD6 non-consumption/no-repair through mid-call refusals**: receipt bytes byte-identical through all races; approval remains one-use (`already reserved` on re-reserve).

## E. Open gates / residual limits (re-audited at C6B2B6D; remote owns these)

- Same-user marker/pin forgery (integrity evidence, not signature; byte-identical rewrite indistinguishable).
- Generic `reserveSyntheticApproval` re-reserves the same approval ID in an alternate independent ledger root (cross-root fencing absent; registry-bound path IS fenced by the durable pin).
- Path ABA across calls passes the best-effort check (dev/ino not remembered across calls).
- TOCTOU: the delegate-window raw-errno leak (AD1) is the concrete remaining window after this milestone; C6B2B6D only sanitizes the strict fixtureRoot observations.
- Proxy traps run user code during reflection; private transaction authority and backup/recovery unresolved; tmpdir is not a sandbox; real Apply gates unproven.

## F. NOT_TESTED (no simulated acceptance claimed)

Real WeChat inbound/outbound, real OpenClaw hook fields, production DSH→proxy routing, 400K-context stress. No product source edits were made locally; no defects found in C6B2B6D's own scope — the delegate-window leak is a pre-existing audited limit, documented above for remote's next milestone (candidate: wrap the delegate's ledger/journal observations or make the strict path descriptor-relative).
