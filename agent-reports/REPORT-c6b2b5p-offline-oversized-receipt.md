# REPORT — C6B2B5P offline oversized-receipt fail-closed acceptance (macOS)

**Verdict: `ALL_OFFLINE_PASS`** — OL-20261112-023, scope OFFLINE_SYNTHETIC_ONLY, executor = local DSH agent (macOS host).

## 1. Pinned source and task identity

- Pinned SOURCE SHA: `7e05749d14e469d4e19f15c282d6d9620fc6f01f` (`test: fail closed on oversized synthetic approval receipts`) — checked out in a clean detached worktree (`.worktrees/stage-c6b2b5p`, `git status` 0 lines). The dispatch handoff commit `fc8bd5657b1a3af5ba66b09fd4c23b2829d751a8` and the CI-bearing HEAD `29f4d060f3ca50095de137af3d23f6b4cbe798c1` were NOT used as source.
- `git diff --stat 7e05749..29f4d06` = only `agent-handoff/CURRENT_STATE.md` (+5) and `agent-handoff/WORK_QUEUE.md` (+5): 29f4d06 contains this source with NO later source changes (as the task claims).
- Claim: `d08c2faf31ad5cd340a2f830f98624499eb5c987` (receipt `agent-handoff/receipts/local/OL-20261112-023-claimed.md`), non-force fast-forward `fc8bd56..d08c2fa`, remote HEAD verified. Claimed once; no retry.
- Host toolchain: Node v25.9.0, pnpm 11.7.0 (macOS, Darwin).

## 2. CI evidence (#379 — the #378 cancellation noted)

- Run `43211358744` = workflow #379, `head_sha=29f4d06…`, attempt 1, `conclusion=success`, **3/3 jobs**: `local-first-core` (job 131159627576, runner 1000003139, image `ubuntu-26.04`), `macos-portability` (job 131159628027, runner **1000003141 — real macOS runner allocated**, image `macos-26-arm64`), `dsh-typecheck-and-build` (job 131159628077, runner 1000003140).
- Earlier run `43211308197` (#378, head `7e05749`) confirmed **`conclusion=cancelled`** — correctly excluded as passing evidence, matching the task text.
- Job logs (fetched): both new/oversized regression names appear in BOTH OS logs — Linux 2 hits, macOS 1 hit — `oversized synthetic receipt fails closed without rewriting or reusing approval` executed as `ok 168` (Linux) and `✔ … (3.79ms)` (macOS).
- Counts from logs: Linux Node `# tests 221 / # pass 221 / # fail 0` + proxy `# tests 5 / # pass 5 / # fail 0`; macOS `ℹ tests 221 / pass 221 / fail 0` + proxy `5/5`; typecheck job Vitest `Test Files 62 passed (62)` + `Tests 1208 passed (1208)` + `✔ Build complete`.

## 3. Local Gate A.1 at pinned source (exact parity)

| Command (stage-c6b2b5p) | exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Done in 843ms |
| `pnpm check` | 0 | Vitest 62 files / 1208 tests passed; `✔ Build complete in 1352ms` |
| CI-exact workflow Node command (27 files, line 28 of `local-first-core.yml`) | 0 | `ℹ tests 221 / pass 221 / fail 0` — oversized test executed locally |
| standalone ledger suite `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | 0 | `ℹ tests 39 / pass 39 / fail 0` (oversized test present) |
| proxy suite `tests/local-openai-queue-proxy.node-test.mjs` | 0 | `ℹ tests 5 / pass 5 / fail 0` |

Workflow enrollment: `grep -c local-nongit-synthetic-approval-ledger .github/workflows/local-first-core.yml` = 2 (identical Linux line 28 + macOS line 45 commands). Counts exactly match CI #379: 221/221, 5/5, 1208.

## 4. Source change under review

`src/local-first/non-git-synthetic-approval-ledger.ts` +2 lines at `inspectSyntheticApproval` (:114-116): after the unsafe-mode/lstat check (:113) and BEFORE `JSON.parse(await readFile(...))` (:118): `if(stat.size>4096)throw Error('Corrupt synthetic reservation; human reconciliation required')`. Tests +12 lines (`tests/…:90`): oversized receipt (canonical grant + 8192-byte `unexpected` field) → inspect rejects `/Corrupt synthetic reservation/`, file byte-identical afterwards, same-ID re-reserve rejects `/already reserved/`.

## 5. Gate B — independent adversarial harness (P1–P10)

Harness: `preflight_acceptance.mts` (owner-private 0700 disposable fixture parents `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*`, 0600 receipts/pins, imports from stage worktree, full carried layers B4C–B5O re-verified at this SHA).

**Final result: `RESULT ok=708 fail=0` (exit 0).**

New P groups:
- **P1** oversized (4097B, `unexpected`×8192) rejected BEFORE parse with `Corrupt synthetic reservation; human reconciliation required`; receipt bytes+size+mode+nlink+ino+**mtimeMs** identical afterwards (never rewritten); same-ID re-reserve refused (approval NOT reused); zero new ledger entries; registered source bytes+mode invariant.
- **P2 boundary**: built a canonical receipt of EXACTLY 4096 bytes (journalRoot padding search) → inspects OK (boundary allowed); exactly 4097 bytes → REFUSED (strict `>4096`). This is the exact threshold the implementation encodes.
- **P3** valid bounded canonical receipt (<4096) → frozen canonical facts returned; receipt stays 0600 nlink=1 after inspect.
- **P4** huge (128KB) rejected BEFORE allocation; bytes+ino+mtime+size unchanged; approval not reused.
- **P5** symlinked hash-path receipt (hash path renamed to symlink): `Unsafe synthetic reservation` fires BEFORE the size check (lstat symlink check precedes); oversized target untouched (nlink=1).
- **P6** oversized 0644 receipt: mode check fires before size check; oversized bytes preserved.
- **P7** cross-ledger: oversized receipt in A; alternate ledger B (no receipt) fails closed WITHOUT consuming A approval; B can reserve its own copy of the same approval ID in an independent ledger root — **cross-root fencing still absent (audited limitation, unchanged from prior rounds)**.
- **P8** registry-bound preflight: DESIGN FACT recorded — `inspectRegistryBoundSyntheticApproval` never reads the receipt file (identity/binding/journal preflight only); it returns canonical facts even with an oversized receipt present, while `inspectSyntheticApproval` on the same fixture ledger rejects it; zero new ledger entries; oversized bytes preserved.
- **P9** fresh OS child process independently refuses the oversized receipt (`DENIED|Corrupt synthetic reservation…`, exit 0) and receipt ino+bytes+mtime unchanged after the child refusal.
- **P10** duplicate reserve while oversized never rewrites the receipt (`already reserved`, oversized content still on disk); torn-but-SMALL (26-byte truncated) control still corrupt-rejected via the parse path (bound does not mask small corruption).

## 6. Residual limits (documented, NOT resolved by this milestone)

Same-user forgery of marker/pin (integrity evidence, not signature); independent process parents / alternate generic ledger roots (cross-root fencing absent); OS TOCTOU/ABA path races — `lstat`+`realpath` best-effort, not race-free descriptor-relative capability; non-cooperating external writers; private per-transaction authority; backup/recovery; real Apply gates remain unproven (`REAL_APPLY_GATES.md`: PRINCIPLE APPROVAL only, per-transaction gates unmet). This milestone bounds ONE untrusted-input dimension (receipt allocation size); shape guards remain unauthenticated best-effort evidence.

## 7. Zero production callers (Gate A.5)

Scan of `src/` + `scripts/` for the module name and all five exports + `normalizeSyntheticReservation` (excluding the module itself and node-tests): **0 hits**. Default-OFF, read-only module. Module writes only `wx` 0600 receipt + dir fsync.

## 8. Scope compliance

No real project paths, no 3080/3083/8123 services, no Weixin, no original DSH Prompt, no production SQLite, no model/provider/credential/default changes, no service restarts, no historical grants, no real Apply/Rollback. All writes into owner-private 0700 disposable synthetic fixtures under `tmpdir`; receipts/pins 0600. Source worktree clean and detached.

## 9. Rollback

- Remove worktrees `.worktrees/claim-c6b2b5p` (at `fc8bd56` + claim commit `d08c2fa`) and `.worktrees/stage-c6b2b5p` (detached `7e05749`).
- Remove `~/.dsh-superagent-private/c6b2b5p/` (harness + report + LO message).
- Private claim state: `claim-OL-20261112-023` (0600), `last_head` (0600).
- No config, service, provider, or model defaults were changed this round.
