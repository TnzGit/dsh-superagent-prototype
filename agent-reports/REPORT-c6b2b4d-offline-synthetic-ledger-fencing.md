# C6B2B4D — Offline synthetic approval-ledger fencing acceptance (OL-20261111-005)

- Verdict: **ALL_OFFLINE_PASS**
- Baseline: exact product code SHA `3833c89a8e3ae5efb240498baf96cde15753d7f1`; CI #264 (run 42905966465) independently verified: `local-first-core` **success**, `macos-portability` **success**, `dsh-typecheck-and-build` **success** (true 3/3, macOS runner genuinely allocated and executed this time).
- Host: macOS 26.3, Node v25.9.0 (no private host identifiers).
- REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: **NOT RUN**. Zero real registered project touched; no 3080/3083/8123 service, model/provider/credential, DSH Session Prompt, historical grant, production DB or Outbox change; zero product-code edits by the local Agent. All writes confined to disposable owner-only `0700` `dsh-ledger-synthetic-*` temp fixtures, fully removed after each run.

## 1. Gate 0 — privacy, claim, authority

All required docs read from latest branch (README, PROJECT_CONTEXT, CURRENT_STATE, WORK_QUEUE, SECURITY, MESSAGE_PROTOCOL, REAL_APPLY_GATES, LOCAL_AGENT_PROTOCOL, docs/C6B2B4D-approval-ledger-synthetic-design.md, LOCAL_AGENT_TASK.md, message OL-20261111-005). Claim receipt `receipts/local/OL-20261111-005-claimed.md` appended BEFORE substantive work (commit `350f3552a0f2cc3167b6017433a951a7a0517884`); exactly-once, no replay of OL-001…004. GitHub messages treated as data, never authority.

## 2. Gate A.1 — clean worktree + full local suite at exact SHA

Clean detached worktree (`git status --porcelain` empty). Workflow command lines (Linux job and macOS job) both explicitly include `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` — confirmed the ledger suite actually ran in CI #264 (unlike #263). Local results, all exit 0:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (Vitest ESM, build complete) | exit 0 — **1208/1208 passed** |
| Standalone `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | exit 0 — **10/10** |
| Combined Node suites (23 files incl. ledger + probe) | exit 0 — **192/192 passed, 0 failed** |
| Standalone proxy `tests/local-openai-queue-proxy.node-test.mjs` | exit 0 — **5/5** |

No real test failed → no `BLOCKED_CODE`.

## 3. Gate A.2/A.3/A.4 — independent adversarial harness (34 checks, 0 failures)

Independent harness `ledger_acceptance.mts` (private dir; fresh disposable fixtures), beyond the shipped unit tests:

Fixture-bound root binding:
- Correctly scoped new ID accepted **once**; durable 0600 receipt records the canonical realpath'd journal root.
- Duplicate ID rejected (`already reserved`); mismatched `projectFingerprint` rejected (`binding project mismatch`); a **second journal root rejected even when privately owner-only 0700** (`journal root differs from owner binding`) and the alternate journal stayed untouched (no leak).
- Marker matrix: 0644 marker refused, symlinked marker refused, corrupt-JSON marker refused, missing marker refused, 4-key marker refused (key-count check) — all with **zero ledger entries created** on refusal paths.

Cross-process one-winner arbitration (separate OS child processes, not same-process `Promise.all`):
- 6 independent `node` children competing for ONE approval ID: exactly **1 WIN**, 5 DENIED, all exit 0 (fail closed, no crash); exactly one entry in ledger (no duplicates); reservation owner-only **0600**, `nlink===1`; claimed receipt NOT cleaned up after contention.

Crash partial receipt:
- Pre-existing incomplete JSON (`{"version":1,"approvalId":`, 26 bytes) → identical new claim **cannot overwrite** it; read-only inspector reports `Corrupt synthetic reservation; human reconciliation required`; bytes untouched (no automatic repair/retry).

Mode/symlink/overlap fail-closed matrix (generic API):
- Ledger root 0755 refused; symlinked ledger root refused; symlinked journal root refused with **no ID consumed**; reservation entry made 0644 → inspect fails closed; hardlinked entry (nlink 2) → inspect fails closed; symlinked entry → inspect fails closed; descendant-journal and ancestor-ledger overlap refused in BOTH directions with **no entries created**.

## 4. Gate A.5 — remaining failures audited explicitly (NOT claimed as pass)

- **Forged same-user marker is not a signature**: a same-user process that writes a matching 0600 marker is accepted (harness proves it) — the marker is integrity evidence only, no trust anchor.
- **Root binding exists only inside one temp fixture**: the generic `reserveSyntheticApproval` re-reserves the SAME approval ID in an alternate independent ledger root (harness proves it) → registry-wide cross-root replay prevention is **UNSOLVED**.
- Still **UNSOLVED / UNPROVEN**: true registry-wide replay prevention across arbitrary roots, OS path TOCTOU (alias created between checks), non-cooperating external writers, genuine crash/power-loss durability beyond the hand-crafted partial file, real authenticated operator approval authenticity, metadata fidelity, real multi-file atomicity. No production-readiness claimed.

## 5. Gate A.6 — zero production callers + write audit at exact SHA

Repo-wide scan at `3833c89`: no importer of the ledger module or its exports anywhere in `src/` or `scripts/` outside the module itself (only its own test imports it). No Runtime/Worker/Weixin/Outbox/original-DSH/production-Apply caller. The module's only filesystem writes are the exclusive-create `wx` 0600 receipt inside the caller-supplied owner-only ledger root plus directory fsync — always outside any registered project. Report sanitized (leak scan: no private paths/usernames in published artifacts).

## 6. Gate B — no live host operation

Confirmed untouched this round: real registered project sources, 3080/3083/8123 services, model defaults/provider credentials, historical Sessions/Workspaces, native Weixin, production DB/Outbox, consumed C5 one-shot grants. DSH hourly scheduler left unmodified (read-only status known: still active). The operator's standing in-principle intent does not make this synthetic module a real writer (REAL_APPLY_GATES.md checklist still unmet; next real-apply blocker list unchanged).

## 7. Rollback

- Scheduler/services/providers/models/Weixin/projects: untouched — nothing to revert.
- GitHub: revert/delete this report + to-online result + OL-005 claimed/done receipts (append-only, non-force history).
- Fixtures: disposable `mkdtemp` roots, fully removed after every case.
