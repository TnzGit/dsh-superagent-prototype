# REPORT — C6B2B5Q offline marker/pin size-gate acceptance (Mac)

- verdict: ALL_OFFLINE_PASS
- task: OL-20261113-024 (OFFLINE_SYNTHETIC_ONLY, requires_live_host_approval: false)
- pinned_source_sha: 4f206cc78f8d8d85b4705d229817699ad3e66020 (fix commit; dispatch head 7b83163)
- host: macOS (Darwin 25.3.0, arm64), Node v25.9.0, pnpm 11.7.0

## A. CI evidence (source CI #385, run 43261811891, head cca2635)

- 3/3 jobs completed/success per job; macOS runner 1000003168 genuinely allocated (macos-15 image, x64 Node 25.9.0 acquired).
- All four oversized synthetic tests executed on BOTH OS logs:
  - Linux (job 131334821504): ok 168 oversized receipt, ok 199 oversized fixture binding marker, ok 200 oversized registry marker, ok 201 oversized durable registry pin; Node 224/pass 224/fail 0; proxy 5/5.
  - macOS (job 131334821915): ✔ all four oversized tests, ℹ tests 224 / pass 224 / fail 0; proxy 5/5.
- dsh-typecheck-and-build: Vitest 62 files / 1208 passed; Build complete.
- Pinned→CI-head diff (4f206cc..cca2635) = workflow-only (macos-latest → macos-15-intel label); zero source/test changes → CI evidence valid for the pinned source.

## B. Gate A.1 local (stage worktree, detached at pinned SHA, git status 0 lines)

- pnpm install --frozen-lockfile: exit 0. pnpm check: exit 0 (Vitest 62 files/1208, Build complete).
- CI-exact 23-file Node command (workflow lines 28/45 identical): exit 0, 224/224 fail 0.
- tests/local-openai-queue-proxy: 5/5. Standalone ledger suite: 42/42 (all 4 oversized tests ✔).
- Workflow ledger-suite grep -c = 2 (Linux + macOS commands). Exact parity with CI counts.

## C. Source review at 4f206cc

Three new size gates, each AFTER the unsafe-lstat (isFile/symlink/mode/nlink) check and BEFORE readFile/JSON.parse, in src/local-first/non-git-synthetic-approval-ledger.ts:
- :165 reserveFixtureBoundSyntheticApproval fixture marker: `st.size>4096` → `Corrupt synthetic fixture binding; manual review required` (SyntaxError/ENOENT/ENOTDIR mapping still funnels to `Missing or corrupt synthetic fixture binding`).
- :249 durable registry pin reader: `entry.size>4096` → `Corrupt synthetic registry ledger pin; manual review required`; comment states "Never repair or overwrite it".
- :343 inspectRegistryBoundSyntheticApproval binding marker: `markerStat.size>4096` → `Corrupt synthetic registry binding marker`.
Receipt path (:116, B5P) unchanged. 3 new regression tests in tests/local-nongit-synthetic-approval-ledger.node-test.mjs.

## D. Gate B adversarial harness (synthetic 0700 disposable fixtures only)

~/.dsh-superagent-private/c6b2b5q/preflight_acceptance.mts (B5P harness + Q1–Q8). FINAL: exit 0, ok=750 fail=0.
- Q1 fixture marker: exactly 4096 ACCEPTS (strict >4096 boundary), 4097 REFUSES before parse; marker byte-identical after refusal (same ino/size/mtime/mode, no rewrite); ZERO receipts; approval NOT consumed (valid marker reserves same ID once).
- Q2 durable pin: exactly 4096 ACCEPTS, 4097 REFUSES before parse; NEVER repaired (second attempt still refused, pin still 4097 on disk); zero receipts; approval NOT consumed (valid pin reserves once); INDEPENDENT LocalProjectRegistry instance hits same durable-pin corrupt bound.
- Q3 registry marker: exactly 4096 ACCEPTS (read-only inspect, zero entries); 4097 REFUSES for inspect AND reserve BEFORE pin write AND before receipt (durable pin NOT created — size check precedes pin); marker byte-identical; approval NOT consumed after valid marker.
- Q4 guard ORDER: oversized 0644 / symlinked marker & pin refused by MODE/SYMLINK guards first (Untrusted/Unsafe messages), proving the unsafe checks run before the size bound.
- Q5 parse path still active BELOW the bound: torn-small pin corrupt-rejected; torn-small fixture marker → Missing or corrupt synthetic fixture binding.
- Q6 fresh OS child processes (independent node -e): oversized pin DENIED (`Corrupt synthetic registry ledger pin`), oversized fixture marker DENIED (`Corrupt synthetic fixture binding`), both exit 0 with files byte-identical (ino/size/mtime unchanged, no repair).
- Q7 replay invariants on size-bound paths: registry-bound + fixture-bound replay of same approval refused (`already reserved; human reconciliation required`).
- Q8 memory-identity ABA: pin path swapped for foreign oversized inode after first success → `identity changed; manual review required` fires BEFORE the size bound.
- All carried B4C–B5P layers re-verified green at 4f206cc (one-use, duplicate, cross-process fencing 1 WIN/5 DENIED, receipt strict schema, hostile IDs, ancestor/root inode identity, ledger-dir continuity, pre-pin validation, input strict schema incl. hidden/inherited keys).

## E. Gate A.5 zero-caller scan at 4f206cc

grep module name + 5 exports over src/ + scripts/ (excluding module itself and tests) → rc=1 zero hits. Default-OFF read-only module; writes only wx 0600 receipt + 0600 pin + dir fsync. (The 5 `manual review required` phrasing hits in non-git-apply.ts:242/302/334, dsh-3080-model-gate.ts:210, dsh-3080-new-workspace.ts:97 are unrelated modules.) Workflow ledger-suite count = 2 (both OS).

## F. Residual limits (audited, not fixed by this milestone)

- Same-user marker/pin forgery: 0600 files are integrity evidence, not signatures.
- Cross-root generic-reserve fencing still absent (alternate independent ledger root re-reserves same ID).
- Best-effort lstat/realpath checks: TOCTOU/ABA, external writers, PATH-ABA on ancestor swap-back; not an authenticated fd-relative capability; Proxy traps run user code during reflection.
- No private transaction authority, no backup/recovery guarantees; a temporary directory is not an OS sandbox.

## G. Rollback

Nothing in production touched. This round added: worktrees .worktrees/claim-c6b2b5q + .worktrees/stage-c6b2b5q (removable via git worktree remove), private dir ~/.dsh-superagent-private/c6b2b5q (0700), private claim state file (0600), and the claim commit fa48fcb582d08fd841cd35bbdd265b0427bbcd74 + done commit on branch (docs-only). Services 3080/3083/8123, Weixin, model queue, production DB untouched.
