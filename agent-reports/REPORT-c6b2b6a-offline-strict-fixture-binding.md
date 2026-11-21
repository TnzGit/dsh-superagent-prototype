# REPORT-c6b2b6a — C6B2B6A independent Mac strict fixture-bound receipt inspection acceptance

**Verdict: ALL_OFFLINE_PASS** (OFFLINE_SYNTHETIC_ONLY; synthetic 0700 fixtures only; zero product source edits locally; no live host, no real Apply, no Weixin, no DSH services touched)

- Task: OL-20261114-034, dispatched at HEAD `7468615f6f0228ce22d7adcd0cd3286a828199e6`, claimed exactly once at `ebcdd2de67b040d578de9ef1675175b8bfc184de` (non-force fast-forward onto dispatch HEAD, `ls-remote` verified). The claimed receipt's `claim_sha` metadata was corrected to the pushed claim commit by an ancestry-complete follow-up commit `405aae08c7833d53ab1a23dab7a030be0e7d820f` (amend-placeholder stale SHA recorded openly — same class as the OL-032/OL-033 audit caveats).
- Pinned source: `276f47ed25d78e52b51767bf1f566389933da61a` ("C6B2B6A: strictly inspect synthetic receipts against fixed fixture binding"), detached worktree, `git status` 0 lines.

## A. Environment
- macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (identical to prior OL reports; all local runs on this host).

## B. Source CI verification (exact pinned head_sha)
- Actions #442 run `43553179535`: `completed` / `success`, `head_sha === 276f47e…` exact, **3/3** jobs success (`macos-portability`, `dsh-typecheck-and-build`, `local-first-core`).
- Actual job logs: BOTH new strict regressions executed on both legs — Linux `ok 182 - fixture-bound reservation denies alternate private journal roots and a mismatched project` + `ok 183 - fixture-bound Proxy is refused before binding reads, traps or receipt` + the two strict-inspection subtests + `# pass 237 / # fail 0`, proxy `# pass 5 / # fail 0`; macOS `✔ strict synthetic fixture inspection rejects canonical forgeries to another private journal or fingerprint without repair (34.97ms)` + `✔ …rejects missing/corrupt marker, unsafe journal and symlink fixture without replay (41.48ms)` + `ℹ pass 237 / fail 0`, proxy `ℹ pass 5 / fail 0`. Vitest 1208/1208, typecheck/build pass.
- Dispatch-vs-pinned diff (`276f47e..7468615`): 9 handoff/docs files only (task, state, queue, OL-034 message, LO-033 result + OL-033 claim/done receipts + LO-033 online receipt + REPORT-c6b2b5z) — zero src/test drift; CI evidence valid for the pinned source. `276f47e` verified as an ancestor of the dispatch HEAD.
- Gate A.5: `grep -rn inspectFixtureBoundSyntheticApproval src/` excluding the definition → empty = **NO_PRODUCTION_CALLERS**.

## C. Local Mac parity at pinned source (disposable detached worktree)
| step | result | exit |
|---|---|---|
| `pnpm install --frozen-lockfile` | Done in 1s | 0 |
| `pnpm check` | build complete 1330ms, no flake this round | 0 |
| CI-exact 23-file Node suite (workflow list) | **237/237** | 0 |
| proxy suite | **5/5** (unbounded — macOS has no `timeout` binary) | 0 |
| standalone ledger suite | **55/55** (+2 = the two C6B2B6A strict tests) | 0 |
| Vitest | **62 files / 1208 tests** | 0 |

## D. Source review of the C6B2B6A strict API
`src/local-first/non-git-synthetic-approval-ledger.ts` `inspectFixtureBoundSyntheticApproval(fixtureRoot, approvalId)` at `:228-265`, exported. Order of checks, all BEFORE any receipt read:
1. Input guards: non-string/blank fixtureRoot → `Invalid synthetic fixture root`; approvalId non-string or failing `^[a-z0-9][a-z0-9-]{7,79}$` → `Invalid synthetic approval ID` (schema-only regex, NOT a whitelist — audited AA5: a schema-legal 20-char ID is not rejected and reaches the fs).
2. Fixture root safety: non-following `lstat` — non-directory/symlink/`(mode&0o077)!==0` → `Unsafe synthetic fixture root`; then `realpath` must be a DIRECT child of `realpath(tmpdir())` with basename matching `dsh-ledger-synthetic-[a-zA-Z0-9_-]{6,70}` → `Synthetic approval fixture is not a disposable temp root`.
3. Marker: `readPrivateSyntheticJson(...,'marker')` (canonical key order + exact serialization + size/lstat guards, blanket-caught) → sanitized `Missing or corrupt synthetic fixture binding`; then semantic shape (`version===1`, `purpose==='offline-synthetic-only'`, SHA-shaped fingerprint, exact keys) → raw `Untrusted synthetic fixture binding`.
4. Private children: `ledger` and `journal` each lstat'd — non-dir/symlink/`(mode&0o077)!==0`/`(mode&0o500)!==0o500`/`realpath!==dir` → raw `Unsafe synthetic fixture private directory`. AUDITED: this loop is NOT blanket-caught — a MISSING child leaks raw ENOENT from the strict API (AA4; reserve-side raw-ENOENT precedent, no sanitizer for this kind).
5. Delegates generic `inspectSyntheticApproval(ledger, approvalId)` for receipt integrity (canonical JSON, path normalization, journal preflight all inherited).
6. **Binding comparison**: `receipt.journalRoot!==journal || receipt.projectFingerprint!==row.projectFingerprint` → `Synthetic receipt differs from fixture binding; manual review required` (message carries NO private paths — AA10).
7. Final fixture-root identity re-check (`dev`/`ino`/symlink/realpath vs the initial lstat) → `Synthetic fixture root identity changed; manual review required` (catches mid-call swap only when the race loses; not remembered across calls — AA9 audited).
- Read-only by construction: no writeFileSync/open('wx') anywhere in the function (AA0/AA10: zero new files in the whole fixture tree after inspection; marker/receipt bytes never mutated).
- Strict does NOT replace generic inspection: `inspectSyntheticApproval` unchanged; generic still accepts canonical forgeries (AA1/AA2 contrast) — strict-only catches binding-level mismatches. Neither authorizes live Apply (no production callers; REAL_APPLY_GATES unchanged).

## E. Adversarial harness (`~/.dsh-superagent-private/c6b2b6a/preflight_acceptance.mts`, fresh approval IDs, 0700 fixtures)
Carried B4C–B5Z layers re-run at the pinned source unchanged: **ok=1263 fail=0**; with new AA-groups: **ok=1335 fail=0, exit 0**.
- AA0 positive: strict inspection on a canonical fixed binding returns frozen facts (journal = canonical realpath), idempotent (never consumes), read-only (marker bytes + entry count unchanged).
- AA1 canonical receipt forged to a DIFFERENT EXISTING 0700 journal (realpath, canonical JSON): strict refuses `differs from fixture binding`; hostile bytes preserved; generic inspection ACCEPTS the forgery (AUDITED contrast — not equivalent); consumed ID not replayable; restored original strict-accepted again (no repair by inspector).
- AA2 swapped projectFingerprint (SHA-shaped): strict refuses; generic accepts (strict-only binding catches it); bytes preserved.
- AA3 marker tamper matrix (trailing-newline, dup-key, reorder, extra-field, pretty, plus canonical-but-string-version): noncanonical/0644/missing → sanitized `Missing or corrupt synthetic fixture binding` (raw Noncanonical never leaks from the strict API); string-version → raw semantic `Untrusted synthetic fixture binding` (mirrors OL-029 taxonomy); receipt untouched across all kinds; restored marker strict-accepted.
- AA4 private-child matrix: journal 0755/0750/0711/0200/0100/0400/0600 and ledger 0755 refused raw `Unsafe synthetic fixture private directory` (0o500 traversal requirement carried from C6B2B5Z); journal symlink alias refused; AUDITED: missing journal child leaks RAW ENOENT (child-loop lstat not blanket-caught).
- AA5 input guards BEFORE any fs: object/Tracked-string (zero traps executed), revoked Proxy, empty/blank/42 fixtureRoot all refused; numeric/uppercase/7-char approvalId refused by regex; AUDITED: schema-legal 20-char ID reaches fs and fails closed as sanitized Corrupt (regex is schema-only, not a whitelist); valid pair still accepted after all guard attempts (guards never consume or mutate).
- AA6 fixture root safety: 0755 root, symlinked root alias, non-temp location, bad basename all refused before any read.
- AA7 macOS /var-spelled ancestor positive control (mirrors C6B2B5Z): ancestor spelling ACCEPTED by strict inspection; returned facts canonical /private/var realpath (ancestor honored ≠ leaf alias honored).
- AA8 fresh OS child (no in-process state): forged receipt → DENIED `differs`; canonical → OK; cross-process reserve of consumed ID → DENIED `already reserved` (one-use holds across processes).
- AA9 AUDITED LIMITS on fixture-root identity: a different-inode fixture swapped at the identical path BEFORE the call PASSES strict inspection (dev/ino not remembered across calls — best-effort evidence, not a capability); mid-call swap caught by the final identity check only when the race loses (TOCTOU non-determinism is the audited limit); zero mutation either way.
- AA10 message privacy + read-only: binding refusal carries NO fixture/journal/other private paths; strict inspection created ZERO new files in the whole tree; strict never authorizes live Apply.

## F. Open gates / residual limits (NOT claimed as solved; remote owns fixes)
- Same-user forgery: the marker is unsigned integrity evidence; a real private non-overlapping forged directory still passes generic paths (carried Z7); strict catches only binding-level mismatch, not authenticity of the fixture itself.
- Fixture-root identity across calls and journal ABA/TOCTOU (AA9): no fd-relative capability.
- Missing-child raw ENOENT leak and raw `Unsafe…` taxonomy from the strict API are audited behavior (documented), not defects.
- Generic `reserveSyntheticApproval` cross-root re-reserve fencing still absent.
- Private transaction authority, backup/recovery, real Apply gates, live host: unresolved.

## G. Not tested / not touched
Real Weixin, OpenClaw, DSH GUI (3080), model proxy (8123), 3083 bridge services, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback, credentials. Zero product source edits locally; zero heartbeat/config changes. STOP after publication; awaiting remote ACK and the next dispatch.
