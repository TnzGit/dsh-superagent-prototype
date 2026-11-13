# REPORT C6B2B5W — Independent Mac acceptance: canonical synthetic receipt writer order (OL-20261114-030)

**Verdict: ALL_OFFLINE_PASS** — OFFLINE_SYNTHETIC_ONLY; no live host actions; zero product source edits locally.

- Pinned source: `8f0283d4e864bda99d4dcb5bc5befd80676ffbcf` (dispatch head `cb369c6c4bf3fdb53e49885a515b6c1496897755`; dispatch-vs-pinned diff = 4 handoff/docs files only, zero src/test delta).
- Claim: `1b95cd9b7d047d724db40fe2c03f7dd14f20bfaa` (exactly once, before any work; no replay).
- Host: macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0, disposable detached worktree at pinned SHA + 0700 owner-private synthetic fixtures only (tmp `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*`), never a real project.

## A. Local parity (exit codes recorded)

| Check | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | clean |
| `pnpm check` | 0 | build clean (1310ms), typecheck pass, no flake this round |
| CI-exact 23-file Node suite (workflow file list, Mac) | 0 | **231/231** pass, 0 fail/skip/cancel |
| `tests/local-openai-queue-proxy.node-test.mjs` (unbounded on macOS; no `timeout` binary) | 0 | **5/5** |
| standalone ledger suite `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | 0 | **49/49** (was 48 at OL-029; +1 = new reorder regression) |
| `pnpm vitest run` | 0 | **62 files / 1208 tests** all pass |

## B. Remote CI cross-check (read-only)

Actions #422 run `43493539397`: `completed / success`, 3/3 jobs (dsh-typecheck-and-build, local-first-core, macos-portability), `head_sha` EXACTLY equal to the pinned source. Job logs confirm both legs ran the new regressions: Linux `ok 161 - synthetic inspection rejects duplicate JSON keys without rewriting receipt` and Node `# tests 231`; macOS `✔ synthetic receipt refuses reordered canonical JSON keys without repair or replay` and `✔ synthetic inspection rejects duplicate JSON keys ...`, proxy 5/5 on both. #421 (failed 230/231 on the stale fixture regex `/"version":1(?=})/`) is NOT pass evidence, as the dispatch states.

## C. Source review (facts, not re-implementation)

- `reserveSyntheticApproval` writer (src/local-first/non-git-synthetic-approval-ledger.ts:125-128) now serializes an EXPLICIT seven-field literal `{version, approvalId, transactionId, projectFingerprint, previewDigest, operation, journalRoot}` + `'\n'` — no spread. History: 8b5157c introduced the order literal but left two LITERAL `\n` escape tokens inside the line continuation (7ef994c replaced them with real line breaks; receipt JSON content unaffected by either).
- Reader guard (inspectSyntheticApproval :166-171) is now **order-SENSITIVE**: `Object.keys(value).join(',')` must equal the exact insertion-order list AND `serialized===JSON.stringify(value)+'\n'`; failure throws `Noncanonical synthetic reservation`, blanket-caught to sanitized `Corrupt synthetic reservation; human reconciliation required` (raw guard message never surfaces at the call site).
- Post-parse semantic guard (:176-184, sorted-set + field types/values) unchanged. Duplicate-key detection stays via parse last-wins + dup-key text mismatch.
- Input guard of `reserveSyntheticApproval` remains a SORTED-SET check: permuted input key order is accepted and the writer re-emits the fixed order regardless (W7).
- 8f0283d changes ONLY the duplicate-key test's tamper regex to target the canonical leading `{"version":1,` (the earlier `(?=})` regex missed the now-non-spread serialization — the #421 failure).
- Gate A.5: `grep` over `src/` for `reserveSyntheticApproval|inspectSyntheticApproval|readPrivateSyntheticJson` outside the ledger module → **NO_PRODUCTION_CALLERS** (module + tests only).

## D. Adversarial matrix (bounded; fresh approval IDs throughout)

Independent harness `preflight_acceptance.mts` (carried B4C–B5V layers + new W1–W10): **ok=1097 fail=0, exit 0**. Three carried audited facts were REVISED because 8f0283d makes the receipt guard order-sensitive (the prior order-INSENSITIVE fact is obsolete):

- W1: every receipt from the generic writer carries the exact fixed key order + canonical single-line serialization + trailing newline (3 IDs).
- W2: pinned-test tamper (duplicate `version` in FIRST position) refused with sanitized Corrupt taxonomy, no raw leak; hostile bytes preserved byte-for-byte (no repair); approval ID consumed; differing-value dup also refused; restored canonical inspects fine for the SAME ID.
- W3: reordered VALID canonical JSON refused (order-sensitive guard); no repair/replay; ID consumed; fresh canonical positive-control accepted.
- W4: extra-field / pretty / pretty-no-newline / leading-space / double-newline all refused sanitized, bytes preserved, restored canonical accepted.
- W5: 0644 / hardlink / >4096-byte cases keep the PRIOR pre-parse descriptor taxonomy (mode/nlink/size guards fire BEFORE the canonical check); oversized bytes preserved.
- W6: fresh OS child (no in-process memory) refuses a reordered receipt with the sanitized Corrupt taxonomy ONLY and ACCEPTS the canonical receipt (positive control).
- W7: permuted reserve INPUT accepted (sorted-set input guard); writer order fixed regardless.
- W9: fixture-bound and registry-bound writers also emit the fixed seven-field receipt order.
- W10 (audited limit): a same-user cooperating rewrite preserving key ORDER and VALUES passes — the order guard is integrity evidence, NOT authentication.

## E. Explicit open gates / NOT_TESTED

Not claimed and not tested: same-user authentication (integrity ≠ signature); OS race freedom / TOCTOU (realpath/lstat pre-checks); directory fd-relative root isolation; generic cross-root reservation fencing (generic `reserveSyntheticApproval` re-reserves the same ID in an alternate independent ledger root — carried limitation); private grant authority / backup / recovery; real Apply gates; real Weixin, 3080/3083/8123 services, Session Prompt, model defaults, production SQLite, historical grants untouched (exit codes above all from synthetic 0700 fixtures).

## F. Publication

Pushed via guarded non-force fast-forward from the claim worktree: this report + `agent-handoff/messages/to-online/2026-11-14-lo030-c6b2b5w-canonical-receipt-done.md` + `agent-handoff/receipts/local/OL-20261114-030-done.md`. Done SHA recorded in the LO message and the private claim file; done-commit CI polled separately. STOP after publication; no replay of OL-030 or any earlier closed task.
