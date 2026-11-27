# OL-20261114-039 — C6B2B6F independent Mac synthetic delegate error classification acceptance

**Verdict: ALL_OFFLINE_PASS**

- Host: macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (independent local Mac; not a CI runner).
- Pinned source (exact, detached clean worktree, `git status` 0 lines): `40e3c2a06ec647314c3dd922daf496be9825b446` (C6B2B6F "test(local-first): classify synthetic delegate root loss without leaking paths"). Dispatch HEAD `15cfb673eb4e4d341ae989d3ef7e684289a284db`; ancestry verified (`merge-base --is-ancestor` = YES). Diff `40e3c2a..15cfb67` = LOCAL_AGENT_TASK.md + CURRENT_STATE + WORK_QUEUE + the to-local message only — zero src/test/workflow drift.
- Claim: `OL-20261114-039` claimed exactly once (claim commit `8aba0cbcdaa6874be3d7f247b69bc7a53aa4952d`; claim_sha metadata follow-up `c6964be0cb537fc3c25498c63ef05394bd790f30`; two-commit pattern, no amend orphan this time).
- Scope: OFFLINE_SYNTHETIC_ONLY; 0700 disposable synthetic fixtures only; zero product source edits; services 3080/3083/8123, real Weixin, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback: untouched.
- **Provenance note:** C6B2B6F is remote's response to the classification-collapse limit our OL-20261114-038 report documented — it preserves ONE class (the generic delegate's `Unsafe synthetic ledger root`) instead of collapsing everything.

## A. Remote CI evidence cross-check

- Actions **#480** run `43585815131`: `head_sha == 40e3c2a06ec647314c3dd922daf496be9825b446` **exact** (the pinned source itself), completed/success, **3/3** (macos-portability / dsh-typecheck-and-build / local-first-core; real runners 1000003457/3458/3459).
- Actions #481 run 43585978754 at dispatch HEAD also success (handoff docs only; not required evidence).
- Job logs read directly: BOTH new tests executed on **both platforms** — `strict fixture inspection keeps missing receipt distinct from unsafe ledger root` (Linux `ok 218`, macOS `✔ 26.028195ms`) and carried `strict fixture inspection masks delegate filesystem errors without changing receipt` (Linux `ok 219`, macOS `✔ 25.994685ms`); Node **242/242** + proxy **5/5** each leg; Vitest **62 files/1208**; typecheck/build success.
- `code_sha` literal `40e3c2a06ec647314c3dd922daf496be9825b446` appears exactly once in the CURRENT `LOCAL_AGENT_TASK.md` at dispatch HEAD (count 0 at the pinned source itself — file predates the dispatch; checked at dispatch HEAD per protocol).

## B. Local parity (independent Mac, exact pinned source)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (859ms) |
| `pnpm check` | exit 0 (build complete 1315ms; no flake this run) |
| Workflow-exact 23-file Node suite (run verbatim from the workflow's own command) | **242/242**, exit 0; both new C6B2B6F/C6B2B6E tests executed locally (missing-receipt-distinct 40ms; masks-delegate 26ms) |
| Proxy suite | **5/5**, exit 0 (macOS has no `timeout` binary; unbounded run recorded — same caveat as prior milestones) |
| Standalone ledger trio | **60/60**, exit 0 (+1 vs OL-038's 59 = the new C6B2B6F test) |
| Vitest | **62 files / 1208 tests**, exit 0 |
| Gate A.5 zero-production-caller scan | `inspectSyntheticApproval`/`inspectFixtureBoundSyntheticApproval` in `src/` outside the ledger module = 0 hits → **NO_PRODUCTION_CALLERS** |

## C. Source review (exact classification, not a paraphrase)

`src/local-first/non-git-synthetic-approval-ledger.ts` at `40e3c2a` (`inspectFixtureBoundSyntheticApproval` delegate catch, ~:289-295):

```ts
try {receipt=await inspectSyntheticApproval(ledger,approvalId)}
catch(error) {
  if(error instanceof Error&&error.message==='Unsafe synthetic ledger root')
    throw Error('Unsafe synthetic fixture private directory')
  throw Error('Corrupt synthetic reservation; human reconciliation required')
}
```

- The match is **exact string equality (`===`)** against the generic delegate's verbatim message — not `includes`/`startsWith`. Structural audit (AF8): the generic inspector emits that exact verbatim message at exactly 3 throw sites (wrapped ledger-observation catch, post-check unsafe-dir/symlink/mode, reserve pre-check); all three are path-unsafe ledger-root classes with no path suffix, so a path-appended lookalike cannot spoof the match.
- Comment self-records the design: "Preserve the known root-identity classification without leaking paths or errno. Unknown delegate errors still collapse to the generic corrupt receipt category: never relay arbitrary error.message from a filesystem."
- C6B2B6F delta = 1 source file (+9/−1) + 1 test file (+19). Remote's new test renames the RECEIPT aside (ledger child intact → strict preflight passes → delegate open ENOENT → blanket-catch → Corrupt) and asserts the exact Corrupt class with no private path/errno, receipt deepEqual-preserved, restored → accepted, consumed → `already reserved`.
- Pre-C6B2B6F single blanket-catch form at the strict delegate is GONE (only the classified `catch(error)` remains).

## D. Independent adversarial matrix (bounded synthetic fixtures; final stable result **ok=1480 fail=0**, exit 0 on 4 consecutive runs)

Carried layers B4C–B6E (G…U/AA/AB/AC/AD/AE groups; AE3/AE8/AD3 patched for the audited delta — the delegate catch is now a classifying wrapper, not a single blanket catch) re-verified unchanged, plus new AF groups:

- **AF1 (mirror of remote's new test)**: receipt parked away → strict throws **EXACT** `Corrupt synthetic reservation; human reconciliation required` (the distinct class), no path/errno; receipt preserved; restored → accepted; consumed never replayed.
- **AF2 + AF2b (inverse deterministic distinct class)**: ledger child deleted BEFORE the call → strict children-loop → **EXACT** `Unsafe synthetic fixture private directory`; AF2b extends coverage to the dispatch's requested forms: ordinary-FILE and DANGLING-LINK ledger children classify to the same fixture-private-dir class (no ENOENT/ENOTDIR/ELOOP, no path); rebuilt → accepted.
- **AF3 bounded mid-call ledger deletion (immediate 0ms timer, 30 trials)**: the deletion lands inside the delegate window often enough to exercise C6B2B6F's mapping live — `Unsafe synthetic fixture private directory` observed 5–10x per run (tallies differ run-to-run: non-deterministic, recorded); **ZERO raw errno, ZERO private paths** in every refusal across all runs; receipt bytes identical; approval remains one-use. Through the strict API the children-loop mask and the delegate classification are indistinguishable (same message) — audited.
- **AF4 (deterministic delegate-class collapses)**: receipt `journalRoot` tampered to a 0777 directory (delegate throws `Unsafe synthetic journal`) or inside the ledger (delegate throws `Synthetic journal overlaps ledger`) → generic blanket catch → Corrupt → strict second branch → Corrupt. The journal taxonomy NEVER surfaces through the strict API — distinct from the ledger-root class (audited collapse). Restored canonical receipt accepted; tampering never consumed.
- **AF5 (audited honest limit of C6B2B6F)**: ONLY the ledger-root class is preserved. Receipt-level path unsafety — 0644 receipt (`Unsafe synthetic reservation`) and symlinked receipt (`O_NOFOLLOW` ELOOP) — still collapses to Corrupt-reservation through the strict API; neither surfaces its own taxonomy nor ELOOP. Receipts never repaired; restored real receipt accepted.
- **AF6 fresh OS children (deterministic cross-process classification)**: (a) receipt parked → `DENIED:Corrupt synthetic reservation…` only; (b) ledger child missing → `DENIED:Unsafe synthetic fixture private directory` only; (c) restored → `ACCEPTED` (cross-process refusals never consume).
- **AF7 macOS canonical path forms through the STRICT API**: `/private/var` vs `/var` spellings with the ledger child missing → identical sanitized fixture-private-dir class under both spellings, no path leaked; `/var`-spelled restored fixture ACCEPTED.
- **AF8 structural**: pinned source carries the exact `===` match + the Corrupt second branch + the never-relay comment; the exact verbatim message occurs at exactly 3 generic-throw sites; pre-C6B2B6F single-catch form gone.

Race timing remains non-deterministic (per-trial tallies differ across runs); recorded per the dispatch's instruction. We do NOT claim ABA/TOCTOU protection or authenticated/fd-relative authority: this milestone is error classification only.

## E. Open gates / residual limits (re-audited at C6B2B6F; remote owns these)

- Same-user marker/pin forgery (integrity evidence, not signature; byte-identical in-place rewrite indistinguishable).
- Generic `reserveSyntheticApproval` re-reserves the same approval ID in an alternate independent ledger root (cross-root fencing absent; registry-bound path IS fenced by the durable pin).
- Path ABA across calls passes the best-effort check; TOCTOU windows remain (journal preflight inside the generic catch; unwrapped reserve-path observations; tmpdir is not a sandbox).
- Classification collapse NARROWED but NOT closed: strict API preserves ONLY `Unsafe synthetic ledger root` → `Unsafe synthetic fixture private directory`; journal classes (AF4) and receipt-level unsafe classes (AF5: `Unsafe synthetic reservation`, `changed during inspection`, ELOOP, Noncanonical) still collapse to the single Corrupt-reservation message — and the generic inspector's own blanket read-block catch hides even its internal taxonomy (AF4/AE3 audited).
- Proxy traps run user code during reflection; private transaction authority and backup/recovery unresolved; real Apply gates unproven.

## F. NOT_TESTED

Real WeChat inbound/outbound, real OpenClaw hook fields, production DSH→proxy routing, 400K-context stress. No product source edits locally; no defect found within C6B2B6F's own scope. Candidate observation for remote only: if restored classification is ever wanted for the journal/receipt-unsafe classes, the generic inspector's own read-block blanket catch (line ~192-194) is the layer that hides them even generically.
