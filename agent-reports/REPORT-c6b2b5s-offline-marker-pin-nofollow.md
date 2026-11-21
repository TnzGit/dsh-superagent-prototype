# REPORT-c6b2b5s — offline synthetic marker/pin nofollow acceptance (OL-20261113-026)

Verdict: **ALL_OFFLINE_PASS**. Synthetic-only, disposable fixtures, no live host mutation.

## 1. Scope and pinned source

- Task: OL-20261113-026, scope OFFLINE_SYNTHETIC_ONLY, dispatch message `agent-handoff/messages/to-local/2026-11-13-ol026-c6b2b5s-marker-pin-nofollow-acceptance.md` (dispatch HEAD d5ee446d3c1a6c86212cfffa3a83ef508b601bac, claim commit 2339a171864a5a293b82c15ad26ffd88d0a70bd1).
- Pinned source: `b47a00d179e4ce8f3ce247c7077a727c9061365a` ("security: harden synthetic fixture marker and durable pin descriptor reads": `src/local-first/non-git-synthetic-approval-ledger.ts` +27/-4, `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` +12).
- Detached stage worktree at the exact SHA (0 modified lines). Dispatch-vs-pinned diff (`b47a00d..d5ee446` over src/tests/scripts) = zero: handoff docs only, so the exact-source CI evidence applies to the pinned source.
- Zero-caller scan: `non-git-synthetic-approval-ledger` has NO production callers under `src/` + `scripts/` (module + its own test only) — unchanged from prior milestones.

## 2. Environment

- macOS 26.3 (Build 25D125), arm64, Darwin 25.3.0; Node v25.9.0; pnpm 11.7.0. Independent Mac host, not the live DSH installation.

## 3. CI cross-check (read-only)

- Source CI #395 run `43387052366`: conclusion=success, head_sha == pinned SHA exactly, 3/3 jobs success (local-first-core, dsh-typecheck-and-build, macos-portability).
- Job logs: Linux `ok 180 - hardlinked fixture binding is rejected without creating a synthetic receipt`, `# tests 226 / # pass 226`, proxy `# tests 5 / # pass 5`. macOS leg genuinely allocated (`Image: macos-15`), shows `✔ hardlinked fixture binding is rejected without creating a synthetic receipt`, `tests 226 / pass 226`, proxy `5/5`. New hardlinked-fixture-marker regression executed on BOTH operating systems as claimed.

## 4. Local parity on Mac (all exit 0)

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm check` | exit 0, build complete 1312ms |
| CI-exact 23-file Node workflow command | 226/226 pass, 0 fail (~5.7s) |
| `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` standalone | 44/44 pass (incl. new ✔ hardlinked-fixture-binding test) |
| proxy suite | 5/5 pass |
| `vitest run` | 62 files / 1208 tests, all pass |

## 5. Source review of the change

New `readPrivateSyntheticJson(file)` (module-private, ledger.ts:17-33): `open(O_RDONLY|O_NOFOLLOW|O_NONBLOCK)` → descriptor `before` stat guard (`!isFile || nlink!==1 || (mode&0o777)!==0o600 || size>4096` → `Unsafe synthetic private JSON`) → `handle.readFile()` → descriptor `after` stat compare (dev/ino/size/mtimeMs/ctimeMs) + `raw.byteLength>4096` → `Synthetic private JSON changed during inspection` → `JSON.parse`; `finally` close. Same-descriptor reads: never follows a symlink, never re-opens.

Adopted at all three former `readFile` call-sites: fixture binding marker (`reserveFixtureBoundSyntheticApproval` :199), durable project pin (`pinDisposableSyntheticLedger` :284), registry binding marker (`inspectRegistryBoundSyntheticApproval` :378). The receipt inspection path (0ed5072, OL-025) is unchanged. Journal files are not read via JSON anywhere.

Audited behavior deltas vs the previous `readFile` reads (documented, not defects):
1. Fixture-marker call-site catch maps only `SyntaxError`/`ENOENT`/`ENOTDIR` to `Missing or corrupt synthetic fixture binding`; all other inner errors (including `Unsafe synthetic private JSON` and ELOOP from the descriptor open) propagate unchanged (verified S9/S11 + ELOOP probe).
2. Pin/registry-marker call-sites have blanket catches → any descriptor refusal surfaces as `Corrupt synthetic registry ledger pin` / `Corrupt synthetic registry binding marker` (same outward taxonomy as the receipt path since OL-025).
3. The descriptor guard re-checks nlink/mode/size a second time inside the helper; call-site lstat guards still fire first (S11 guard-order control).
4. New same-descriptor change-during-inspection detection on all three marker/pin reads (previously a mid-read swap went unnoticed on these paths).

## 6. Adversarial harness (ok=800 fail=0, exit 0; carried + new S-groups)

Carried layers (all B4C–B5Q + R1–R7 from OL-025, re-verified green at b47a00d; one harness bug fixed en route: R4 `utimesSync` with Date objects truncates to whole ms and APFS stat mtimeMs carries sub-ms — float-seconds restore preserves sub-ms exactly, diff 0).

New S-groups at b47a00d:
- S1 hardlinked fixture binding marker (nlink=2): refused (remote's new regression reproduced independently on Mac); original alias byte-identical, still nlink=2, zero ledger receipts, approval NOT consumed (valid marker reserves the same ID once afterwards).
- S2 hardlinked durable pin: refused by call-site lstat nlink guard (`Unsafe synthetic registry ledger pin`) before the descriptor read; alias unchanged; zero receipts; after removing the alias the same approval reserves once.
- S3 hardlinked registry binding marker: refused via `Unsafe synthetic registry binding marker` in both inspect and reserve; durable pin NOT created before the refusal; zero receipts; original untouched.
- S4 symlinked pin path: refused by SYMLINK guard before descriptor open; path remains a symlink, target untouched. Standalone ELOOP proof: `open(...O_NOFOLLOW)` on a symlink yields ELOOP (so the descriptor layer would refuse even if a lstat/race window allowed it through).
- S5 fresh OS child (independent process, no shared state): refuses the hardlinked fixture marker; original ino+bytes+nlink+mtime unchanged.
- S6 AUDITED PROTECTION: cooperating same-user in-place marker rewrite (same inode, same size, mtime restored in float seconds, changed bytes) is CAUGHT by the post-read semantic fingerprint check (`Synthetic fixture binding project mismatch`) — unlike the receipt (R4), markers/pins are semantically validated after parse.
- S7 AUDITED PROTECTION: same in-place trick on the durable pin is CAUGHT by the post-read row check (`conflicting fixture ledger binding`) via a same-length bogus ledgerRoot.
- S8 AUDITED LIMIT: an in-place rewrite with byte-for-byte identical content leaves nothing semantic to detect; descriptor before/after ctime both post-write within the window → reserves OK.
- S9 torn-small malformed marker/pin (below bound): parse-path semantics preserved (fixture → `Missing or corrupt synthetic fixture binding`, registry marker → `Corrupt synthetic registry binding marker`).
- S10 durable pin with extra key: strict key-set check refuses (`Corrupt…`), hostile pin left in place, never repaired.
- S11 guard order control: 0644 marker refused by call-site mode guard before descriptor open (`Untrusted synthetic fixture binding`).

Every refusal left source bytes and ledger receipts unchanged (byte+ino+size+mode+mtime invariants asserted throughout).

## 7. Residual limits (re-audited at b47a00d, still open; remote owns fixes)

- Same-user in-place forgery with byte-identical content is undetectable (S8); forged content is caught only because markers/pins are semantically re-validated after parse (S6/S7) — the RECEIPT path remains semantically free (R4 carried).
- Path ABA passes the best-effort descriptor check (R7); not a race-free fd-relative capability; no descriptor-relative directory isolation.
- OS TOCTOU between call-site lstat and the descriptor open persists (fresh-child proof S5/R6 carried).
- Cross-root generic-reserve re-reserve fencing absent; same-user marker forgery remains integrity evidence, not a signature; external writers; Proxy traps run user code during reflection; private transaction authority + backup/recovery unresolved; tmpdir is not a sandbox; real Apply gates remain unproven — no real-Apply safety asserted.

## 8. Host non-interference

Services 3080/3083/8123, real Weixin, original Session Prompt, model defaults, production SQLite, historical grants, real registered projects' Apply/Rollback: untouched. All writes inside 0700 disposable synthetic temp projects; nothing published contains private paths, raw prompts, credentials, or host logs. No product source edited locally. NOT_TESTED cases: none — every listed case was exercised.
