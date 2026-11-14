# REPORT-c6b2b6g — OL-20261114-040 independent Mac acceptance of the shared synthetic reservation fence

message_id: OL-20261114-040
scope: OFFLINE_SYNTHETIC_ONLY
pinned_source_sha: 9adced9a40b5ef80c05d2d7916a54add65c6a8f0
dispatch_head: d83ef66a5880d10cebeb9cfc9f3716853a9011a3
verdict: ALL_OFFLINE_PASS
host: macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0

## 1. Handoff validation (schema gate)

- `git fetch` succeeded on the first attempt (no TLS flake this round). Advance `f912710..d83ef66` = 2 commits: `9adced9` (C6B2B6G source+tests) then `d83ef66` (OL-040 dispatch).
- Task message `2026-11-14-ol040-c6b2b6g-shared-fence-acceptance.md`: from: online, to: local, type: task, scope OFFLINE_SYNTHETIC_ONLY, code_sha `9adced9a40b5ef80c05d2d7916a54add65c6a8f0` (exact 40-hex), requires_live_host_approval: false.
- `code_sha` literal appears EXACTLY ONCE in the current `LOCAL_AGENT_TASK.md` at the dispatch HEAD (0 occurrences at the pinned source itself — expected, always checked at dispatch HEAD).
- Ancestry `9adced9 -> d83ef66`: YES. Pinned→dispatch diff = `LOCAL_AGENT_TASK.md`, `CURRENT_STATE.md`, `WORK_QUEUE.md`, the to-local message only — zero product/test/workflow drift.
- Claimed exactly once BEFORE any work: claim commit `e4ea1c675a5b5797cb995b3d34a2ff50044cd2d8` (claimed receipt pushed `d83ef66..e4ea1c6`, non-force fast-forward, verified via `ls-remote`) + private claim file (`0600`), `last_head -> d83ef66`.

## 2. Remote CI cross-check (exact-source)

- Source CI #485 run `43596061640`: head_sha `9adced9…` EXACT, completed/success, 3/3 jobs success on real runners (1000003472–1000003474).
- Job logs fetched (`gh run view --log`): both new tests executed on BOTH legs — `shared synthetic fence rejects cross-ledger re-reservation without repair or replay` (macOS ✔ 28.5ms; Linux ok 220) and `shared synthetic fence consumes failed downstream reservation and rejects unsafe fence` (macOS ✔ 29.6ms; Linux ok 221). Node **244/244** each leg, proxy **5/5** each, Vitest **62 files / 1208 tests**, typecheck/build success.
- Dispatch-HEAD CI #486 run `43596208197`: also completed/success (docs-only).

## 3. Independent local Mac parity (detached clean worktree at the exact pinned source)

- `pnpm install --frozen-lockfile` exit 0 (1.4s), `pnpm check` exit 0 (build 1311ms, no flake).
- Workflow-exact 23-file Node list: **244/244** exit 0 — both shared-fence tests executed locally (`✔ rejects cross-ledger re-reservation` 42.7ms, `✔ consumes failed downstream reservation` 50.3ms).
- Proxy suite: **5/5** exit 0.
- Standalone ledger suite: **62/62** exit 0 (+2 vs OL-039's 60 — the two new fence regressions).
- Vitest: **62 files / 1208** exit 0 (19.0s).
- Gate A.5: `reserveSharedFenceSyntheticApproval` has ZERO production callers outside the ledger module (grep over `src/`).

## 4. Source audit (C6B2B6G, `src/local-first/non-git-synthetic-approval-ledger.ts:605-649`)

- New opt-in API `reserveSharedFenceSyntheticApproval(fenceRoot, ledgerRoot, reservation)`: normalizes the reservation first (strict 7-key schema from carried C6B2B5F/G guards), then a shape guard (`typeof !== 'string' || !trim()` on either root) throws `Invalid synthetic shared fence root` BEFORE any fs observation.
- Fence validation: non-following `lstat` + `realpath`; must be a real 0700 directory, not a symlink, absolute, path-normalized (`normalize(fenceRoot)===fenceRoot`), and realpath-stable (`fence === join(realpath(dirname),basename)`); overlap checks (ledger/journal inside fence or fence inside ledger/journal) refuse. The whole validation block is wrapped `catch{throw Error('Unsafe synthetic shared fence root')}` — any fs error inside collapses to the unsafe class (error-sanitation pattern, consistent with C6B2B6E/F).
- Durable fence: `open(<sha256(approvalId)>.fence,'wx',0o600)`; EEXIST → exact `Synthetic approval already fenced; human reconciliation required`; any other open error → unsafe class. Payload written + `handle.sync()` + directory fsync.
- Terminal consumption (audited, matches dispatch requirement): the fence file is created BEFORE the downstream `reserveSyntheticApproval`; if the downstream fails, the fence stays consumed — source comments self-record `The durable fence is consumed even when the downstream reservation fails` and `No automatic rollback of an ambiguous reservation is permitted`. Never unlink/repair/auto-retry.
- Doc comment self-records the opt-in limits: `A different root, same-user mutation, inode ABA or a non-cooperating writer defeats this experiment. This is NOT a global authority or real Apply gate.`

## 5. Adversarial matrix (harness `~/.dsh-superagent-private/c6b2b6g/preflight_acceptance.mts`, AG1–AG12 on top of the full carried B4C–B6F layers)

Stable **RESULT ok=1541 fail=0** across 4 consecutive runs (exit 0; AG7 race tally non-deterministic and recorded per run).

- AG1 cross-ledger coordination: first shared-fence reserve returns `reserved`; second reserve against a SEPARATE fresh ledger refuses the EXACT `Synthetic approval already fenced; human reconciliation required`; loser ledger gains ZERO entries (no consumption); ledger-A receipt bytes identical after refusal; fence listing unchanged (no repair, no release) — mirrors the remote test.
- AG2 same-root replay refuses (`already fenced`) before any downstream call; no new ledger entries.
- AG3 terminal failure: with the ledger receipt pre-consumed via the generic reserve, the fence-wx create SUCCEEDS then downstream refuses `already reserved`; fence remains CONSUMED (1 entry) and a later attempt is refused by the FENCE (`already fenced`), never by the downstream — auto-delete/auto-retry would have re-reached the downstream, this does not.
- AG4 input/unsafe classes: symlink alias, 0644 mode, ordinary-file fence, raw non-normalized path (`<base>/./fence`) → all `Unsafe synthetic shared fence root`; null/42/whitespace/empty roots → `Invalid synthetic shared fence root` before any fs observation.
- AG4b overlap classes: ledger nested inside fence, journal nested inside fence, fence nested inside ledger → all unsafe-class refusals.
- AG5 crash-partial fence (25-byte truncated file at the hash name) → EXACT already-fenced refusal; bytes NEVER overwritten/repaired; zero ledger entries (no downstream call).
- AG6 cross-process: fresh OS child with NO remembered state, same consumed fence + second fresh ledger + same approval → DENIED `already fenced`, its ledger zero entries, fence unchanged (refusals never consume cross-process).
- AG6b cross-process WIN: fresh child, DIFFERENT approval ID on the same fence → `reserved`, fence gains a second per-approval entry, its ledger one receipt (fence is per-approval, not global).
- AG7 bounded race: two CONCURRENT independent OS children, same fence + same approval + different ledgers → exactly 1 WIN, 1 DENIED (wx create is atomic); loser ledger zero entries; fence exactly one entry. Timing non-deterministic (recorded).
- AG8 documented BYPASS (recorded as required by dispatch): an ALTERNATE independent fence root does not coordinate — same approval, two fences, two ledgers → BOTH reserved. The opt-in works only when callers cooperate on the same shared root.
- AG9 macOS canonicalization: `/var` vs `/private/var` fence spelling behaves identically (realpath coercion inside validation); refusal on a consumed fence via the alternate spelling → exact already-fenced, no path/errno leaked.
- AG10 recorded ABA LIMIT: unlike the C6B2B4F/G ledger-identity checks, the fence PATH inode is NOT remembered across calls — replacing the fence DIRECTORY between calls (same path, new inode, empty) makes the same approval re-reservable in the second ledger. Honest best-effort, NOT race-free path authority.
- AG11 observables: fence entry is a 0600 regular file named `<sha256(approvalId)>.fence` with self-describing JSON (`offline-synthetic-shared-fence` + approvalId). AG11b: a FORGED same-user fence file (any content) blocks the reserve exactly like a real one — payload is integrity evidence, NOT a signature (carried same-user-forgery limit applies to the fence too).
- AG12 structural (pinned source text): Invalid-guard precedes fs; validation blanket-catch to unsafe class; EEXIST branch + exact fenced message; terminal-consumption comments present; opt-in-limit doc self-recorded (`A different root, same-user mutation, inode ABA or a non-cooperating writer` + `NOT a global authority or real Apply gate`).

## 6. Privacy review

All fixtures 0700 owner-only under the system tmpdir; harness output shows sanitized error classes only (no private paths, no raw errno in any refusal); no real Weixin identity, no credentials, no chat bodies. Nothing uploaded beyond the sanitized report.

## 7. Residual gates (unchanged, remote-owned)

Same-user marker/fence forgery; alternate fence-root bypass (AG8) and fence-path ABA (AG10) are explicitly OUTSIDE this opt-in mechanism's protection; generic cross-root re-reserve; OS TOCTOU; cross-call path ABA; Proxy traps run user code during reflection; private transaction authority + backup/recovery; real Apply. No global security claimed.

## 8. Environment safety

No product source edited locally. No live host actions: 3080/3083/8123 services, real Weixin, Session Prompt, model defaults, production SQLite, historical grants, real registered projects' Apply/Rollback all untouched. Only synthetic disposable fixtures were written.
