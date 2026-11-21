# C6B2B5C Offline Synthetic Durable Pin Identity Continuity Acceptance — Local Mac Agent

**Verdict: ALL_OFFLINE_PASS**
**Exact tested source SHA:** `6461e03a50952c56c6b7ef6fdb89d7fa1ad3201c`
**CI:** [#302](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42967199576) independently verified 3/3 SUCCESS (per-job conclusions)
**REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN**
**Host:** macOS; Node `v25.9.0`; pnpm `11.7.0`. All fixtures disposable 0700 under canonical OS temp only.

## Gate A.1 — CI + local suite reproduction at pinned SHA

- CI #302: `dsh-typecheck-and-build`, `local-first-core`, `macos-portability` all `conclusion=success`, `head_sha` = pinned SHA; hosted macOS runner genuinely allocated (`macos-latest`).
- Job logs inspected: Linux and macOS each **Node 203/203 + proxy 5/5**; the new regression test name `same registry refuses deleted or replaced durable pin without issuing another receipt` executes in BOTH OS logs; enrolled ledger suite present in both workflow commands (`grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2, lines 28 and 45).
- Local: `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (**Vitest 62 files / 1208 tests**, build complete); standalone ledger suite **21/21** (1 new pin-identity test); combined 22-file Node suite + probe **203/203** (exact match with CI); queue-proxy **5/5**.
- CI #300 history: earlier unlink+recreate test could recycle the same inode on Linux; the pinned fixture now renames the old pin aside to keep its inode alive — the corrected deterministic regression is what #302 verifies.

## Source review at pinned SHA (diff vs `06de7c1`)

`src/local-first/non-git-synthetic-approval-ledger.ts` adds a process-local `syntheticPinFileIdentities: WeakMap<registry, Map<projectId,{dev,ino}>>` (module :156). In `pinDisposableSyntheticLedger` (:164): when the registry already remembers an identity for the project, it `lstat`s the pin file first — missing → `Synthetic registry ledger pin disappeared; manual review required` (:182); dev/ino drift → `Synthetic registry ledger pin identity changed; manual review required` (:185). After a successful wx-create + guards + content validation, it re-`lstat`s (:214-216, same identity-changed error) and records `{dev,ino}` in the WeakMap (:217-220). Comments state explicitly: in-process inode evidence, NOT cross-process auth, NOT race-free. `src/local-first/project-registry.ts` unchanged in this range. Test diff: one new deterministic test (rename-aside keeps inode, then same-content 0600 replacement refused) in the already-enrolled ledger suite.

## Gate B — independent adversarial harness (107 checks / 0 failures)

Synthetic fixtures only: fresh 0700 `dsh-project-synthetic-*` parent + registered child + 0700 `dsh-ledger-synthetic-*` with 0600 marker; source bytes/full modes snapshotted before/after (invariant).

Core B5C proofs:
- **G13 (deterministic rename-aside):** after a valid first reservation (one 0600 pin under the disposable parent + exactly one hash-named receipt in fixture ledger, never under registered root), `rename` the pin to a distinct name **without deleting its inode** — dev/ino identical under the new name; a second reservation in the SAME registry refuses `pin disappeared; manual review required`, **zero new receipts**, original pin bytes+0600 mode unchanged at `.moved`, no auto-cleanup/repair/recreation.
- **G14 (replacement refusal):** same-content, mode-0600 replacement pin at the original path (fresh inode, original still live at `.moved` so no recycling possible — deterministic) is refused as `pin identity changed; manual review required` **even though bytes match exactly**; zero new receipts; refusal is inode-identity-based, not content-based; both original and replacement persist, prior receipt evidence unchanged.
- **G15 (limitation, documented):** a fresh OS process does NOT inherit the in-memory dev/ino evidence, so it accepts a same-content replacement pin and issues a second receipt into the same ledger (cross-process non-inheritance = UNSOLVED limitation, not a PASS claim).
- **G16 (same-user deletion bypass):** same-instance deletion refuses (`pin disappeared`), but a fresh registry instance re-pins after `rm` and re-reserves (second receipt) — same-user deletion bypass remains UNSOLVED.
- **G17-G18 pin guards re-verified at 6461e03:** corrupt/partial 0600 pin fail-closed never auto-repaired; 0644/symlinked pin refused (incl. dangling symlink); wrong projectId, pin ledgerRoot pointing at a DIFFERENT fixture, version!==1 → `conflicting fixture ledger binding`; reservation-level fingerprint/journal mismatches fail closed BEFORE any pin/receipt; all refusals wrote zero receipts and created no pin.
- **G19:** new error messages (`pin disappeared`, corrupt, unsafe) leak NO raw private paths.
- **G20:** cross-process forged replacement pin (attacker rewrites pin content to name ledger B) makes a fresh process DENY A and WIN for B — forgery chooses the winner even cross-process; pin file is NOT a signed/authenticated capability.

Re-verified prior layers (G1–G12, carried from the OL-009 harness at the new SHA): happy-path reservation facts; alternate-fixture/alternate-registry rejection; parent location/mode guards; 6-way cross-process one-winner (same parent, six different ledgers → 1 WIN, 5 DENIED, total receipts == 1); crash/partial-receipt terminal invariants; full prior negative matrix (unknown/uppercase ID, fingerprint mismatch, alternate journal, marker fingerprint/0644/corrupt/4-key/symlink, nested fixture, readOnly/git ineligible); C6B2B4D one-use/duplicate/corrupt-partial + 6-child generic-ledger fencing (1 WIN 5 DENIED); cross-root generic-replay and same-user forged-marker audits remain UNSOLVED as documented.

Harness bug lessons (local, non-product): dangling-symlink pin (target fixture removed before rewrite) → writeFileSync ENOENT — unlink symlink first; G17 ledgerRoot-mismatch case must point at a genuinely different fixture ledger, not the same path re-serialized.

## Gate A.5 — caller scan

`grep -rE 'reserveRegistryBoundSyntheticApproval|syntheticPinFileIdentities|pinDisposableSyntheticLedger' src scripts` excluding the module itself → **zero hits** (rc=1). Default-OFF read-only synthetic module; no Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply importer; no real project Apply or rollback executed.

## Known limitations (unchanged by B5C)

In-memory dev/ino evidence is process-local: a new process/registry does not inherit it; same-user attacker can forge/replace the private pin or marker (G10/G20 demonstrate forgery chooses the winner); alternate disposable project parents bypass global one-use semantics (G10); OS path ABA/TOCTOU and non-cooperating foreign writers unresolved; no MAC/key-backed authenticated capability, no fd-relative race-free path guarantee; pin is integrity evidence, not a signature.

## Rollback

Local Agent made zero changes to DSH/OpenClaw/services/provider/model/DB and zero product-source edits. This round's only mutations: disposable 0700 temp fixtures (auto-removed), a claim receipt and this report + completion message/receipt pushed non-force to the feature branch. Private claim state kept 0600 in `~/.dsh-superagent-private/`.
