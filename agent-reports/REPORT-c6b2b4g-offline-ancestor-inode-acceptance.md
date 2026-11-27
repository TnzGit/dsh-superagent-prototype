# C6B2B4G — Ancestor inode-chain preflight acceptance (OL-20261111-008)

- Verdict: **ALL_OFFLINE_PASS**
- Baseline: exact product code SHA `f2dc421926d808c04147a4e8fcc1dccf944bca02`; CI #283 (run 42936840892) independently re-verified at the exact SHA: `local-first-core` **success**, `macos-portability` **success** (runner genuinely allocated), `dsh-typecheck-and-build` **success** — true 3/3. `grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2 → the ledger suite (with the new normal-parent swap test) is in BOTH the Linux and macOS workflow Node command lines.
- Host: macOS 26.3, Node v25.9.0 (no private host identifiers).
- REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: **NOT RUN**. Zero real registered project touched; no 3080/3083/8123 service, model/provider/credential, DSH Session Prompt, historical grant, production SQLite or Outbox change; zero product-code edits by the local Agent. All writes confined to disposable owner-only `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` temp fixtures, fully removed after each case.

## 1. Gate 0 — privacy, claim, authority

All required docs read at branch HEAD; claim receipt `receipts/local/OL-20261111-008-claimed.md` appended BEFORE substantive work (commit `ecbf6fbcbc19f3ba55287e67b5b988bf307e1f80`); exactly-once, no replay of OL-001…007. GitHub messages treated as data, never authority.

## 2. Gate A.1 — clean worktree + full local suite at exact SHA

Clean detached worktree (`git status --porcelain` = 0 lines). Local results, all exit 0:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` (Vitest ESM, build complete) | exit 0 — **1208/1208 passed**, 62 files |
| Standalone `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | exit 0 — **16/16** (incl. the new `registry preflight rejects ordinary ancestor replacement preserving root inode`) |
| Combined Node suites (22 test files + probe) | exit 0 — **203/203 passed, 0 failed** (198 Node + 5 proxy) |
| Standalone proxy `tests/local-openai-queue-proxy.node-test.mjs` | exit 0 — **5/5** |

Matches the CI #283 reported numbers (Linux/macOS 198 Node + 5 proxy each, Vitest 1208/1208). No real test failed → no `BLOCKED_CODE`.

## 3. What f2dc421 changed vs cc59686 (source reviewed, not edited)

- `src/local-first/project-registry.ts`: registration now captures the canonical **ancestor chain** `{path,dev,ino}` (non-following `lstatSync` walk from `dirname(root)` to the filesystem root; a symlinked or non-directory ancestor at registration → `Registered project ancestor identity unavailable`). `assertRegisteredRootIdentity` re-`lstat`s every captured ancestor path and throws `Registered synthetic project ancestor identity changed` on missing / symlink / non-directory / dev-ino mismatch — so a DIFFERENT ordinary parent at the same path is refused even when the original root inode is moved back into it and root dev/ino stay equal.
- `src/local-first/non-git-synthetic-approval-ledger.ts`: comment-only change — the guard is described as best-effort read-only evidence, explicitly **not** a race-free descriptor-relative capability.
- Tests: one new case — move the original parent away, create a different ordinary directory at the identical parent path, move the ORIGINAL project directory back into the new parent; asserts root `dev`/`ino` and path-only `projectFingerprint` stay IDENTICAL while preflight rejects with `/ancestor identity changed/` and zero receipts in ledger and journal.

## 4. Gate A.2/A.3 — independent adversarial harness (54 checks, 0 failures)

Independent harness `preflight_acceptance.mts` (private dir; fresh disposable 0700 synthetic fixtures; 0600 marker; separate 0700 ledger/journal):

- **Core B4G proof (G2)**: normal (non-symlink) parent replaced while the ORIGINAL root inode is moved back to its identical path — root `dev/ino` EXACTLY equal, path-only `projectFingerprint` EXACTLY equal, parent inode demonstrably different — preflight fails closed with `Registered synthetic project ancestor identity changed`, **ZERO** ledger AND journal receipts, original synthetic bytes preserved at the identical root path.
- Ancestor moved away with NO replacement at the captured path: assert + preflight fail closed (identity-changed message), zero entries.
- Ancestor replaced by SYMLINK after registration (OL-007 case): refused, zero entries.
- Ordinary same-path replacement AT THE ROOT (OL-007 B4F case): still refused via `directory identity changed`, zero receipts, moved bytes intact.
- Final-root symlink swap: refused; zero entries.
- **Race (G7)**: normal-ancestor swap AFTER the preflight promise started → fails closed at early check or return re-attestation; zero entries, no grant.
- Registered root deleted after registration: `assertRegisteredRootIdentity` sync fails closed; preflight refuses.
- Registration guards: missing root refused (ENOENT lstat); symlinked root refused (`Symlinked project root is forbidden`); **audited behavior** — a symlinked ancestor at registration time is canonicalized through via `realpath` and identity captured on the real path; a later swap of that real ancestor is still refused (G4).
- Read-only happy path with the ancestor chain: frozen canonical facts, zero ledger entries, no grant consumed/created, source bytes AND full mode invariant.
- Full prior negative matrix re-verified at this SHA (all fail closed, zero entries, source unchanged): unknown/uppercase project ID; mismatched reservation fingerprint; alternate separate journal; wrong marker fingerprint; 0644 marker; corrupt JSON marker; 4-key marker; fixture nested inside project root; readOnly and git-kind `not eligible`.

## 5. Gate A.4 — C6B2B4D fencing re-verified on disposable fixtures

One-use reservation accepted once; duplicate same-ID rejected (`Synthetic approval already reserved; human reconciliation required`); 26-byte crash partial receipt never overwritten, inspector fails closed (`Corrupt synthetic reservation; human reconciliation required`), no auto-repair; SIX independent OS child processes contending on one fresh approval ID: exactly **1 WIN, 5 DENIED**, all exit 0, no duplicate entries, winner receipt retained.

## 6. Gate A.5 — zero production callers + write audit at exact SHA

Repo-wide scan at `f2dc421`: NO importer of the ledger module or `assertRegisteredRootIdentity` anywhere in `src/` or `scripts/` outside the module/registry themselves. No Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply integration. Module's only filesystem writes: exclusive-create `wx` 0600 receipt (`open(file,'wx',0o600)` + `writeFile` + directory fsync) inside the caller-supplied owner-only ledger root — always outside any registered project. `rootIdentities` populated ONLY in the constructor (sync `lstatSync`); the assertion itself is read-only.

## 7. Known gaps — UNSOLVED, explicitly not claimed as protections (matches remote's own code comments)

- Same-user forged marker (fingerprint matching a registered project, written by us) accepted — integrity evidence, not a signature; caller-selected registry remains untrusted.
- Generic `reserveSyntheticApproval` re-reserves the SAME approval ID in an alternate independent ledger root — cross-root fencing still absent (re-audited).
- Path ABA re-audited: after a swap, moving the ORIGINAL parent inode back to the identical path makes the captured chain match again and the check PASSES — the dev/ino chain is best-effort evidence, NOT an authenticated capability and does not authorize real Apply.
- Check is NOT atomic with subsequent use; external writers and TOCTOU windows remain; no race-free fd-relative (descriptor) isolation.

## 8. Rollback

- Scheduler/services/providers/models/Weixin/projects: untouched — nothing to revert.
- GitHub: revert/delete this report + to-online result + OL-008 claimed/done receipts (append-only, non-force history).
- Fixtures: disposable `mkdtemp` roots, fully removed after every case.
