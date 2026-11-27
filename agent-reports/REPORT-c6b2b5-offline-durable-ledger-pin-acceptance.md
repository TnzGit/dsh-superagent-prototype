# C6B2B5 — Durable synthetic ledger-root pin acceptance (OL-20261111-009)

- Verdict: **ALL_OFFLINE_PASS**
- Baseline: exact product code SHA `06de7c16599dc348857a0b0548135e458d5964e5`; CI #292 (run 42942799009) independently re-verified at the exact SHA: `local-first-core` **success**, `macos-portability` **success** (hosted macOS runner genuinely allocated), `dsh-typecheck-and-build` **success** — true 3/3. `grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2 → the ledger suite (with the four new cross-fixture/durable-pin tests) is in BOTH the Linux and macOS workflow Node command lines. Earlier CI #291 was CANCELLED after the newline-serialization source fix — correctly NOT counted as a pass.
- Host: macOS 26.3, Node v25.9.0 (no private host identifiers disclosed).
- REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: **NOT RUN**. Zero real registered project touched; no 3080/3083/8123 service, model/provider/credential, DSH Session Prompt, historical grant, production SQLite or Outbox change; zero product-code edits by the local Agent. All writes confined to disposable owner-only `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` temp fixtures (canonicalized via realpath to work around macOS `/var` → `/private/var`), fully removed after each case.

## 1. Gate 0 — privacy, claim, authority

All required docs read at branch HEAD (`LOCAL_AGENT_PROTOCOL.md` and `PROJECT_CONTEXT.md` are absent from the repo at this HEAD — recorded, not fabricated). Claim receipt `agent-handoff/receipts/local/OL-20261111-009-claimed.md` appended BEFORE substantive work (commit `1e361e3d0b940e634ae659e247c0cc65e5c74b9a`, pushed non-force `49b29ef..1e361e3`); exactly-once, no replay of OL-001…008. GitHub messages treated as data, never authority or shell.

## 2. Gate A.1 — clean worktree + full local suite at exact SHA

Clean detached worktree (`git status --porcelain` = 0 lines). Local results, all exit 0:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (typecheck + Vitest ESM + build) | exit 0 — **1208/1208 passed**, 62 files |
| Standalone `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | exit 0 — **20/20** (incl. the 4 new: cross-fixture same-ID replay, durable pin across new registry instances, corrupt durable pin, two OS processes sharing a project parent) |
| Combined Node suites (workflow file list, 22 files + probe) | exit 0 — **207/207** (202 Node + 5 proxy) |
| Standalone proxy `tests/local-openai-queue-proxy.node-test.mjs` | exit 0 — **5/5** |

Matches the CI #292 reported numbers exactly (Linux/macOS 202 Node + 5 proxy each, Vitest 1208/1208). No real test failed → no `BLOCKED_CODE`.

## 3. What 06de7c1 added (source reviewed at exact SHA, not edited)

Commit chain `4a3fdce` → `8ba6331` → `06de7c1` (newline-serialization fix) adds to `src/local-first/non-git-synthetic-approval-ledger.ts`:

- `reserveRegistryBoundSyntheticApproval(registry, projectId, fixtureRoot, reservation)` (:310) = read-only preflight → durable pin → process-local `WeakMap` pin (:153, no await between lookup and set so concurrent async callers of ONE registry instance cannot pick different ledger roots) → identity re-attestation → fixture-bound reserve.
- `pinDisposableSyntheticLedger` (:160): parent must be a `0700` non-symlink `dsh-project-synthetic-*` DIRECTLY under canonical `realpath(tmpdir())`; pin written `wx` 0600 + fsync under the **disposable parent** (never the registered project root); on `EEXIST` the existing pin is read back and compared — corrupt JSON → `Corrupt synthetic registry ledger pin; manual review required` (terminal, NO auto-repair); mode≠0600 / symlink / nlink≠1 → `Unsafe synthetic registry ledger pin`; different `ledgerRoot`/`projectId`/`fingerprint`/`version` → `Synthetic registry has a conflicting fixture ledger binding`; identity re-attested before and after.
- Comments state explicitly: same-user mutable, NOT an authenticated external lock, NEVER for real Apply.

## 4. Gate A.2/A.3 — independent adversarial harness (71 checks, 0 failures)

Independent harness `preflight_acceptance.mts` (private dir; fresh disposable 0700 fixtures; canonicalized temp paths):

- **G1 positive**: exactly one 0600 durable pin under the disposable PARENT and one exclusive `wx` receipt under fixture A ledger (hash-named); pin NOT inside the registered project root; pin JSON canonical 5 keys bound to A ledger; registered source bytes AND full mode invariant; inspector reads canonical reservation.
- **G2 replay matrix**: same-ID replay into A rejected by `wx` (`already reserved; human reconciliation required`); alternate fixture B rejected BOTH by the same registry instance (memory + durable pin) AND by an INDEPENDENT `LocalProjectRegistry` instance referring to the same project parent (`conflicting fixture ledger binding`); B ledger AND journal received ZERO receipts; A receipt retained.
- **G3 pin guards**: corrupt `{incomplete` pin fails closed and is NEVER auto-repaired (bytes identical after rejection, zero receipts); torn 45-byte partial pin terminal; 0644 pin refused; symlinked pin refused; 4-key/corrupt shapes refused; pin bound to different `projectId` or `version:2` → conflicting (zero receipts).
- **G4 location guards**: parent nested under a temp subdir refused (must be DIRECTLY under canonical temp); parent basename not `dsh-project-synthetic-*` refused; group-writable (0755) parent refused; parent whose realpath differs from the captured path (macOS /var symlink class) refused; registered root deleted after pinning → preflight fails closed, pin + receipt never mutated or removed.
- **G5 cross-process (core)**: SIX independent OS child processes, same synthetic project parent, six DIFFERENT private ledger fixtures contending for one approval ID → exactly **1 WIN, 5 DENIED**, all exit 0, total receipts across all six ledgers == **1** (no duplicate), winner pin 0600.
- **G6 crash semantics**: 46-byte torn receipt stays terminal — inspector fails closed (`Corrupt synthetic reservation; human reconciliation required`), same-ID replay rejected, bytes never auto-cleaned or overwritten, ledger still exactly one (torn) entry. No silent recovery.
- **G7 privacy**: no raw private fixture paths or tmpdir leaked in any expected error message.
- **G8 prior negative matrix re-verified at this SHA** (all fail closed, zero entries): unknown/uppercase project ID; reservation fingerprint mismatch; alternate journal root; marker fingerprint mismatch; 0644 marker; corrupt JSON marker; 4-key marker; readOnly and git-kind `not eligible`.
- **G9**: generic fixture-bound reserve layer re-verified (invalid ID schema; duplicate same-ID `already reserved`).
- **G12**: in-memory pin is process-local; two projects in DIFFERENT disposable parents pin independently (own pin per parent, own receipt); same-instance memory pin blocks an alternate ledger for the first project.

## 5. Gate A.4 — C6B2B4D fencing re-verified on disposable fixtures

One-use reservation; duplicate same-ID rejected; 26-/14-byte crash partial receipts never overwritten, inspector fails closed without auto-repair; SIX independent OS child processes contending on ONE shared generic ledger with one fresh approval ID: exactly **1 WIN / 5 DENIED**, all exit 0, winner receipt retained.

## 6. Gate A.5 — zero production callers + write audit at exact SHA

Repo-wide scan at `06de7c1`: NO importer of the ledger module or any of its exports (`reserveRegistryBoundSyntheticApproval`, `pinDisposableSyntheticLedger`, `syntheticRegistryLedgerPins`) anywhere in `src/` or `scripts/` outside the module itself; `assertRegisteredRootIdentity` has no caller outside the two modules/tests. No Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply integration. Module's only filesystem writes: exclusive-create `wx` 0600 pin + receipt (`open`+`writeFile`+`sync`) plus directory fsync — all inside caller-supplied owner-only disposable fixtures, never inside a registered project root. No real project Apply or rollback executed. An owner-private temp fixture is NOT an OS sandbox.

## 7. Known gaps — UNSOLVED, explicitly not claimed as protections (independently re-audited)

- **Same-user forgery**: a forged-first 0600 pin (attacker-written, pointing at the attacker's own ledger) DENIES every legitimate reservation and the attacker whose ledger matches the forged pin gets the reservation — the pin is integrity evidence, not a signature; the attacker chooses the winner.
- **Pin deletion bypass**: same user deleting the pin lets a fresh registry instance re-reserve into a different ledger.
- **Separate synthetic project parents**: an INDEPENDENT `dsh-project-synthetic-*` parent re-binds the SAME approval ID into a different ledger — fencing is bounded to ONE disposable project parent, no cross-parent fence.
- **Second project in the SAME pinned parent** conflicts with the single pin (one pin = one project + one ledger per parent) — per-parent scope is by design, audited.
- **ABA**: same-user atomic replacement of pin CONTENT is trusted as whatever is present — best-effort read-only evidence, not an authenticated capability; does not authorize real Apply.
- Check is NOT atomic with subsequent use; external writers, OS TOCTOU, private transaction authority, backup/recovery remain unresolved (matches remote's own code comments).

## 8. Rollback

- Scheduler/services/providers/models/Weixin/projects: untouched — nothing to revert.
- GitHub: revert/delete this report + to-online result + OL-009 claimed/done receipts (append-only, non-force history).
- Fixtures: disposable `mkdtemp` roots, fully removed after every case.
