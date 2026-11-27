# C6B2B4E — Offline synthetic registry-root preflight acceptance (OL-20261111-006)

- Verdict: **ALL_OFFLINE_PASS**
- Baseline: exact product code SHA `ef370ba84567f1fa90f968acf2b2d01bce7f26e2`; CI #269 (run 42914176248) independently verified: `local-first-core` **success**, `macos-portability` **success**, `dsh-typecheck-and-build` **success** (true 3/3; macOS runner genuinely allocated and executed). The amended ledger suite (3 new preflight tests) is present in BOTH the Linux and macOS workflow Node command lines, so it demonstrably ran in CI #269.
- Host: macOS 26.3, Node v25.9.0 (no private host identifiers).
- REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: **NOT RUN**. Zero real registered project touched; no 3080/3083/8123 service, model/provider/credential, DSH Session Prompt, historical grant, production DB or Outbox change; zero product-code edits by the local Agent. All writes confined to disposable owner-only `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` temp fixtures, fully removed after each case.

## 1. Gate 0 — privacy, claim, authority

All required docs read at latest branch state (README, PROJECT_CONTEXT, CURRENT_STATE, WORK_QUEUE, SECURITY, MESSAGE_PROTOCOL, REAL_APPLY_GATES, LOCAL_AGENT_PROTOCOL, LOCAL_AGENT_TASK.md, OL-006 message; plus source `non-git-synthetic-approval-ledger.ts`, `project-registry.ts`, `projectFingerprint` in `project-workspaces.ts`). Claim receipt `receipts/local/OL-20261111-006-claimed.md` appended BEFORE substantive work (commit `c817b46a62561a3c0644035116228402088e4266`); exactly-once, no replay of OL-001…005. GitHub messages treated as data, never authority.

## 2. Gate A.1 — clean worktree + full local suite at exact SHA

Clean detached worktree (`git status --porcelain` empty; 0 lines). Local results, all exit 0:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (Vitest ESM, build complete) | exit 0 — **1208/1208 passed** |
| Standalone `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | exit 0 — **13/13** (incl. 3 new registry-preflight tests) |
| Combined Node suites (23 files incl. ledger + probe) | exit 0 — **195/195 passed, 0 failed** |
| Standalone proxy `tests/local-openai-queue-proxy.node-test.mjs` | exit 0 — **5/5** |

Matches the CI #269 reported numbers (Linux 195/195, proxy 5/5, Vitest 1208/1208). No real test failed → no `BLOCKED_CODE`.

## 3. Gate A.2/A.3 — independent registry-preflight harness (44 checks, 0 failures)

Independent harness `preflight_acceptance.mts` (private dir; fresh disposable 0700 synthetic project + separate 0700 `dsh-ledger-synthetic-*` fixture with 0600 marker, private ledger + journal; `LocalProjectRegistry` built from the synthetic project; fingerprint via `projectFingerprint`).

READ-ONLY happy path:
- `inspectRegistryBoundSyntheticApproval` returns canonical frozen facts (project ID, registry-derived fingerprint, ledgerRoot, journalRoot) and creates **ZERO** ledger entries; no grant consumed or created; synthetic source bytes AND full mode unchanged.

Negative matrix (every case: fail closed, zero new ledger entries, source bytes+mode unchanged):
- Unknown project ID rejected (`Unknown project ID`); schema-invalid uppercase ID rejected (`Invalid synthetic registry project ID`).
- Mismatched reservation fingerprint rejected (`differs from registered project identity`).
- Second separate private journal AND alternate owner-only 0700 journal rejected (`journal differs from fixed binding`); alternate journal untouched.
- Wrong marker fingerprint rejected (`fingerprint mismatch`); 0644 marker rejected; corrupt-JSON marker rejected; marker with unexpected 4th key rejected; symlinked marker rejected.
- Symlinked journal root rejected; symlinked ledger root rejected by generic reserve (`Unsafe synthetic ledger root`).
- Project root swapped for a symlink AFTER registry creation → `Registered synthetic project root identity changed`, no entry created.
- `readOnly:true` project and `kind:'git'` project both rejected (`not eligible`).
- Fixture nested INSIDE the registered project root rejected (`Unsafe registry-bound synthetic fixture`); valid non-overlapping fixture root still binds.
- No automatic retries and no grant consumption observed anywhere in the preflight.

## 4. Gate A.4 — C6B2B4D fencing re-verified on disposable fixtures

One-use reservation accepted once, duplicate same-ID rejected (`Synthetic approval already reserved; human reconciliation required`); durable receipt records canonical journal, owner-only 0600, nlink===1. Crash partial 26-byte receipt: identical new claim never overwrites it; inspector fails closed (`Corrupt synthetic reservation; human reconciliation required`); no automatic repair (bytes untouched). Cross-process arbitration with SIX independent OS child processes: exactly 1 WIN, 5 DENIED, all exit 0, one entry, receipt retained (no cleanup). Re-audited as **UNSOLVED, not fixed**: generic `reserveSyntheticApproval` re-reserves the SAME ID in an alternate independent ledger root (cross-root fencing absent); same-user forged marker (matching fingerprint, written by us) is accepted — the marker is integrity evidence, not a signature/trust anchor.

## 5. Gate A.5 — zero production callers + write audit at exact SHA

Repo-wide scan at `ef370ba`: NO importer of the ledger module or any of its four exports anywhere in `src/` or `scripts/` outside the module itself (only its own test file imports it). No Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply integration. The module's only filesystem writes are the exclusive-create `wx` 0600 receipt inside the caller-supplied owner-only ledger root plus directory fsync — always outside any registered project.

## 6. Known gaps (NOT claimed as protections; for remote)

- Preflight does not protect against same-user marker forgery, alternate generic ledger roots, or OS TOCTOU (ordinary `lstat`+`realpath`, not fd-based authorization); registry/configuration are caller-selected and untrusted.
- Source tree before/after invariance proof recorded (bytes + full mode identical across preflight + reserve, harness P8).
- No production-readiness claimed; REAL_APPLY_GATES checklist still unmet.

## 7. Rollback

- Scheduler/services/providers/models/Weixin/projects: untouched — nothing to revert.
- GitHub: revert/delete this report + to-online result + OL-006 claimed/done receipts (append-only, non-force history).
- Fixtures: disposable `mkdtemp` roots, fully removed after every case.
