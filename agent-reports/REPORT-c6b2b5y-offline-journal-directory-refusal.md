# REPORT-c6b2b5y — C6B2B5Y independent Mac synthetic journal-directory refusal acceptance

**Verdict: ALL_OFFLINE_PASS** (OFFLINE_SYNTHETIC_ONLY; synthetic 0700 fixtures only; zero product source edits locally; no live host, no real Apply, no Weixin, no DSH services touched)

- Task: OL-20261114-032, dispatched at HEAD `bb87e96c9be9fbfcc6812b58c51277f113c29b58`, claimed exactly once at `2d4388a0ed0bf66ebb92547bf6dc7e7d35ff182f` (non-force fast-forward onto dispatch HEAD, `ls-remote` verified).
- Pinned source: `a02217720c38bb41de85f7098a1e217d1718fc2a` ("test(synthetic-ledger): refuse missing, aliased and unsafe receipt journal directories"), detached worktree, `git status` 0 lines.

## A. Environment
- macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0 (identical to prior OL reports; all local runs on this host).

## B. Source CI verification (exact pinned head_sha)
- Actions #433 run `43528035756`: `completed` / `success`, `head_sha === a022177…` exact, **3/3** jobs success (`macos-portability`, `dsh-typecheck-and-build`, `local-first-core`); real macOS runner allocated.
- Job logs: Linux leg `# pass 233 / # fail 0` and the NEW regression `ok 164 - synthetic inspection refuses forged missing and unsafe journal directories without repair` actually executed; macOS leg `✔ synthetic inspection refuses forged missing and unsafe journal directories without repair (38.49ms)` + `ℹ pass 233 / fail 0`; proxy legs 5/5 both (`timeout -k 5s 45s` Linux; plain node macOS); Vitest 1208/1208; typecheck/build pass.
- Dispatch-vs-pinned diff: 4 handoff/docs files only (`LOCAL_AGENT_TASK.md`, `CURRENT_STATE.md`, `WORK_QUEUE.md`, the OL-032 message) — zero src/test drift, CI evidence valid for the pinned source.
- Gate A.5: `grep -rn inspectSyntheticApproval src/` → definition site only (`:136`) = **NO_PRODUCTION_CALLERS**.

## C. Local Mac parity at pinned source (disposable detached worktree)
| step | result | exit |
|---|---|---|
| `pnpm install --frozen-lockfile` | clean | 0 |
| `pnpm check` (build+typecheck+vitest) | build complete 1328ms, no flake this round | 0 |
| CI-exact 23-file Node suite (workflow list) | **233/233** | 0 |
| proxy suite `tests/local-openai-queue-proxy.node-test.mjs` | **5/5** (unbounded — macOS has no `timeout` binary) | 0 |
| standalone ledger suite | **51/51** (+1 = the new C6B2B5Y forged-journal-directory test) | 0 |
| Vitest | **62 files / 1208 tests** | 0 |

## D. Source review of the C6B2B5Y guard
`src/local-first/non-git-synthetic-approval-ledger.ts` `inspectSyntheticApproval`, +18 lines at `:187-204`, placed AFTER the canonical-reader guard and AFTER the syntactic `isAbsolute`/`normalize(x)===x` semantic check (`:183-185`), before `return r`:
- `lstat(r.journalRoot)` + `realpath(r.journalRoot)`; unsafe if `!isDirectory()` || `isSymbolicLink()` || `(mode & 0o077) !== 0` || `actualJournal !== r.journalRoot` → `Unsafe synthetic journal`.
- bidirectional containment via `relative(root,actualJournal)` / `relative(actualJournal,root)` with `contained()` (empty, or not starting with `../`, or not absolute) → `Synthetic journal overlaps ledger`. Equality, journal-inside-ledger and ledger-inside-journal all refused.
- The whole block is wrapped in a **blanket `catch{}`** → every failure (including raw fs errors like ENOENT/ENAMETOOLONG/ELOOP) is sanitized to `Corrupt synthetic reservation; human reconciliation required`; the raw `Unsafe synthetic journal` / `Synthetic journal overlaps ledger` strings NEVER leak from inspect (verified by Y10 exact-message assertions).
- Comment records: no repair, no writes; path-based checks remain subject to ABA/TOCTOU and same-user forgery.
- Reserve-side pre-existing taxonomy UNTOUCHED by this commit: `reserveSyntheticApproval` keeps raw `Unsafe synthetic journal root` / `Synthetic ledger overlaps journal` / raw ENOENT (Y10 contrast).
- Guard order unchanged: unsafe-lstat → size>4096 → canonical reader → semantic shape/path → NEW existence/identity/overlap preflight (Y11 order proof).

## E. Adversarial harness (`~/.dsh-superagent-private/c6b2b5y/preflight_acceptance.mts`, fresh approval IDs, 0700 fixtures)
Carried B4C–B5X layers re-run at the pinned source: **ok=1143 fail=0** after three audited-delta patches (below); full suite with new Y-groups: **ok=1214 fail=0, exit 0**.

**Audited deltas (OL-031's syntactic-only facts OBSOLETE at a022177, narrowed residuals):**
- X3 trailing-slash and uppercased absolute journalRoot: were AUDITED-ACCEPTED (normalize preserves them); now REFUSED — the preflight compares `realpath(x)===x` and realpath strips the trailing separator / returns on-disk case.
- X4 forged absolute normalized NON-EXISTENT path (`/private/var/forged/normalized/absolute`): was ACCEPTED; now REFUSED by the existence preflight. The same-user forgery residual narrows to a REAL, existing, 0700, non-overlapping forged directory — still ACCEPTED (authenticity not proven; only existence+identity+mode+non-overlap checked).
- P2 size-boundary: the exactly-4096 receipt is padded via `journalRoot`, whose component exceeds macOS PATH_MAX → `lstat` ENAMETOOLONG → blanket catch → sanitized refusal (pre-a022177 this receipt was ACCEPTED). The exactly-4096 ACCEPT boundary is NOT re-testable here: a valid 7-key canonical receipt can only be padded via `journalRoot`, and a real journal path is capped by PATH_MAX. The 4097 REFUSED boundary still enforced (size gate fires before parse).

**New Y-groups (all refusing kinds assert: sanitized exact message, hostile bytes preserved byte-for-byte, ID consumed / no replay, zero new ledger entries, metadata invariant bytes+size+mode+nlink+ino+mtimeMs):**
- Y1 pinned-regression mirror: missing / 0755-public / symlink-alias / ledger-equality forged `journalRoot` all refused; SAME-id restore of the canonical receipt accepted.
- Y2 journal path ITSELF replaced in place by a symlink (real dir moved aside): refused (isSymbolicLink + realpath!==x); canonical bytes never rewritten; restored real dir → original receipt accepted again.
- Y4 overlap refused in BOTH directions: equality, journal-inside-ledger (descendant), ledger-inside-journal (ancestor); sibling non-overlapping journal accepted (`relative()` starts with `../`).
- Y5 positive control: real canonical 0700 non-overlapping journal returns frozen facts; the preflight makes ZERO writes (metadata identical after inspect).
- Y6 fresh OS child (no in-process state): missing-journal receipt refused with sanitized taxonomy only; real-journal canonical ACCEPTED.
- Y7 metadata invariance across missing / alias / unsafe-mode / equality-overlap refusal kinds.
- Y8 mode matrix: 0755/0750/0711 refused (group/other bits nonzero; `mkdirSync` mode is umask-masked on create — `chmodSync` forces the bits); owner-only 0700 and 0600 accepted (`mode&0o077===0`); regular FILE as journal refused; journal in an INDEPENDENT disposable tree accepted (non-overlap either direction).
- Y9 AUDITED LIMIT (path ABA on the journal): replacing the journal directory with a different inode at the identical path still PASSES — journal dev/ino is never pinned at reserve time; the check is path-based best-effort evidence, not fd-relative (contrast: ledger ROOT identity is captured at registry registration).
- Y10 taxonomy: inspect message EXACTLY `Corrupt synthetic reservation; human reconciliation required` for all seven forged kinds (raw Unsafe/Overlap/ENOENT never leak); reserve-side pre-existing raw taxonomy preserved (`/Synthetic ledger overlaps journal/`, `/Unsafe synthetic journal root/`, raw ENOENT).
- Y11 guard order: oversized+missing-journal → same sanitized message with size gate preceding the preflight; relative journalRoot refused by the semantic guard before any lstat.

## F. Open gates / residual limits (NOT claimed as solved; remote owns fixes)
- Same-user forgery: a real, private, non-overlapping directory chosen by an attacker still passes (integrity evidence, not a signature).
- Journal path ABA / TOCTOU (Y9): no fd-relative capability, no journal dev/ino pinning.
- Generic `reserveSyntheticApproval` cross-root re-reserve fencing still absent (registry-bound path IS fenced via the durable pin).
- Private transaction authority, backup/recovery, real Apply gates, live host: unresolved.
- PATH_MAX interaction: the exactly-4096 ACCEPT boundary is untestable on macOS with a real journal (documented env limit, not a defect).

## G. Not tested / not touched
Real Weixin, OpenClaw, DSH GUI (3080), model proxy (8123), 3083 bridge services, original DSH Session Prompt, production SQLite, model/provider defaults, historical grants, real registered projects' Apply/Rollback, credentials. Zero product source edits locally; zero heartbeat/config changes. STOP after publication; awaiting remote ACK and OL-033 dispatch.
