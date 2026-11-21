# C6B2B4F — Inode-identity + ancestor-symlink preflight acceptance (OL-20261111-007)

- Verdict: **ALL_OFFLINE_PASS**
- Baseline: exact product code SHA `cc59686b23af13bc33883605ca4950d7201ee72b`; CI #278 (run 42931128906) independently re-verified: `local-first-core` **success**, `macos-portability` **success** (runner genuinely allocated), `dsh-typecheck-and-build` **success** — true 3/3 at the exact SHA. The ledger suite is present in BOTH the Linux and macOS workflow Node command lines (`grep -c` on `.github/workflows/local-first-core.yml` = 2), so the three new identity tests demonstrably executed in CI #278.
- Host: macOS 26.3, Node v25.9.0 (no private host identifiers).
- REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: **NOT RUN**. Zero real registered project touched; no 3080/3083/8123 service, model/provider/credential, DSH Session Prompt, historical grant, production DB or Outbox change; zero product-code edits by the local Agent. All writes confined to disposable owner-only `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` temp fixtures, fully removed after each case.

## 1. Gate 0 — privacy, claim, authority

All required docs read at branch HEAD; claim receipt `receipts/local/OL-20261111-007-claimed.md` appended BEFORE substantive work (commit `c06454c442a554f8517897b82e812973a3721a14`); exactly-once, no replay of OL-001…006. GitHub messages treated as data, never authority.

## 2. Gate A.1 — clean worktree + full local suite at exact SHA

Clean detached worktree (`git status --porcelain` = 0 lines). Local results, all exit 0:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (Vitest ESM, build complete) | exit 0 — **1208/1208 passed**, 62 files |
| Standalone `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | exit 0 — **15/15** (incl. 3 new identity tests) |
| Combined Node suites (22 test files + probe) | exit 0 — **197/197 passed, 0 failed** |
| Standalone proxy `tests/local-openai-queue-proxy.node-test.mjs` | exit 0 — **5/5** |

Matches the CI #278 reported numbers (Linux/macOS 197 Node each, proxy 5/5, Vitest 1208/1208). No real test failed → no `BLOCKED_CODE`.

## 3. What cc59686 changed vs ef370ba (source reviewed, not edited)

- `src/local-first/project-registry.ts`: registration captures `{root,dev,ino}` of the real directory per project (`rootIdentities` map, `:23/:36`); new read-only `assertRegisteredRootIdentity(id)` (`:50-60`) — synchronous `lstatSync`, throws `Registered synthetic project directory identity changed` if the path is now a symlink, a non-directory, deleted, or a DIFFERENT inode (dev/ino mismatch). Detects same-path replacement by another ordinary directory, which the path-only fingerprint cannot see.
- `src/local-first/non-git-synthetic-approval-ledger.ts` `inspectRegistryBoundSyntheticApproval`: calls `registry.assertRegisteredRootIdentity` at entry AND again near return; adds an ancestor-walk guard (`checkAncestors`, non-following `lstat` up to the filesystem root) run at entry and re-run at return, throwing `Registered synthetic project ancestor identity changed`; the final-root check now follows the ancestor check so the root-swap test regex was broadened to `root|ancestor|directory`. Code comments themselves state: check is **NOT atomic** with later uses, does not prevent external writers, ABA replacement still needs OS-level isolation.
- Tests: 3 new cases — ancestor symlink substitution (move parent, alias symlink → `/ancestor identity changed/`), ordinary same-path directory replacement (fingerprint equal, dev/ino refusal `/directory identity changed/`, zero receipts in ledger and journal), and the previous root-swap assertion relaxed.

## 4. Gate A.2/A.3 — independent adversarial harness (42 checks, 0 failures)

Independent harness `preflight_acceptance.mts` (private dir; fresh disposable 0700 synthetic project + separate 0700 fixture with 0600 marker; `LocalProjectRegistry` + `projectFingerprint`):

- **Core B4F protection proved**: rename the registered directory away and create a DIFFERENT ordinary directory at the identical path — path-only `projectFingerprint` stays EXACTLY equal, yet preflight fails closed with `Registered synthetic project directory identity changed` and issues **ZERO** ledger receipts; moved original bytes intact.
- **Symlinked ancestor after registration** (parent moved, symlink alias at old parent path): refused with `ancestor identity changed`, zero entries.
- **Final-root symlink swap**: refused (directory identity check fires first) — matches the relaxed upstream assertion.
- **Race during async preflight**: swap the root for another ordinary directory AFTER the promise started → fails closed at the early or return re-attestation check; zero entries, no grant issued (re-attestation verified working).
- **Registered root deleted after registration**: `assertRegisteredRootIdentity` fails closed (sync); preflight refuses; missing/symlinked roots still refused at registration time (`Symlinked project root is forbidden`, ENOENT lstat).
- Read-only happy path unchanged: canonical frozen facts returned, zero ledger entries, no grant consumed, source bytes AND full mode invariant.
- Prior negative matrix re-verified at this SHA (all fail closed, zero entries, source unchanged): unknown/uppercase project ID; mismatched reservation fingerprint; alternate separate journal (`journal differs from fixed binding`); wrong marker fingerprint; 0644 marker; corrupt JSON marker; 4-key marker; fixture nested inside project root; readOnly and git-kind `not eligible`.

## 5. Gate A.4 — C6B2B4D fencing re-verified on disposable fixtures

One-use reservation accepted once; duplicate same-ID rejected (`Synthetic approval already reserved; human reconciliation required`); 26-byte crash partial receipt never overwritten, inspector fails closed (`Corrupt synthetic reservation; human reconciliation required`), no auto-repair; SIX independent OS child processes contending on one fresh approval ID: exactly **1 WIN, 5 DENIED**, all exit 0, no duplicate entries, winner receipt retained (no cleanup).

## 6. Gate A.5 — zero production callers + write audit at exact SHA

Repo-wide scan at `cc59686`: NO importer of the ledger module or `assertRegisteredRootIdentity` anywhere in `src/` or `scripts/` outside the module/registry themselves (only the ledger test file imports them). No Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply integration. Module's only filesystem writes: exclusive-create `wx` 0600 receipt inside the caller-supplied owner-only ledger root + directory fsync — always outside any registered project. `rootIdentities` is populated only in the constructor via sync `lstatSync`; the assertion itself is read-only.

## 7. Known gaps (explicitly NOT claimed as protections; matches remote's own code comments)

- Identity check is NOT atomic with subsequent use; non-cooperating external writers and ABA replacement still need OS-level isolation. Ordinary `lstat`/`lstatSync` + `realpath`, not fd-based authorization (TOCTOU window remains).
- Same-user forged marker (matching fingerprint written by us) accepted — marker is integrity evidence, not a signature/trust anchor; caller-selected registry remains untrusted.
- Generic `reserveSyntheticApproval` re-reserves the SAME ID in an alternate independent ledger root — cross-root fencing still UNSOLVED (re-audited, not fixed).
- No production-readiness claimed; REAL_APPLY_GATES checklist still unmet.

## 8. Rollback

- Scheduler/services/providers/models/Weixin/projects: untouched — nothing to revert.
- GitHub: revert/delete this report + to-online result + OL-007 claimed/done receipts (append-only, non-force history).
- Fixtures: disposable `mkdtemp` roots, fully removed after every case.
