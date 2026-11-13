# REPORT: OL-20261114-031 C6B2B5X synthetic journal-path canonicalization acceptance (Mac, offline synthetic only)

- **Verdict: ALL_OFFLINE_PASS**
- Dispatch message: `agent-handoff/messages/to-local/2026-11-14-ol031-c6b2b5x-journal-path-canonical-acceptance.md` (OL-20261114-031, `from: online`, `to: local`, `type: task`, `scope: OFFLINE_SYNTHETIC_ONLY`, `code_sha: c7155abc60dde214d29273d822c8ffc615ec6ec2`, literal in current `LOCAL_AGENT_TASK.md` line 5)
- Claim: `agent-handoff/receipts/local/OL-20261114-031-claimed.md`, claim commit `a4e4ad45000449f730567916696ba73825fcaad7`, non-force fast-forward push `6734e45..a4e4ad4`, verified by `ls-remote`
- Pinned source: `c7155abc60dde214d29273d822c8ffc615ec6ec2` (staged in a disposable detached worktree, `git status` clean, zero product source edits on the Mac)
- Host: macOS 26.3 (arm64), Node v25.9.0, pnpm 11.7.0
- Claimed-once executed-once: this milestone ran exactly once on this host; STOP-after-done, never replay.

## A. Environment

macOS arm64 Mac mini-class host. Node v25.9.0, pnpm 11.7.0. All writes inside disposable `dsh-ledger-synthetic-*` / `dsh-project-synthetic-*` 0700 temp fixtures only. Ports 3080/3083/8123, real Weixin, original Session Prompt, model/provider defaults, historical grants, production SQLite and real registered projects' Apply/Rollback untouched.

## B. Compatibility / parity (exit codes)

| Step | Command | Exit | Result |
| --- | --- | --- | --- |
| frozen install | `pnpm install --frozen-lockfile` | 0 | pass |
| full check | `pnpm check` | 0 | typecheck + build pass (1309 ms) |
| CI-exact Node suite (23 files, workflow list order) | `node --experimental-strip-types --test <23 files>` | 0 | **232/232**, 0 fail/cancelled/skipped |
| proxy suite | `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` | 0 | **5/5** (unbounded run; macOS has no `timeout` binary) |
| standalone ledger suite | `node --experimental-strip-types --test tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | 0 | **50/50** (includes the new C6B2B5X noncanonical-journal-path test + the c7155ab macOS realpath assertion) |
| Vitest | `pnpm vitest run` | 0 | **62 files / 1208 tests** |

## C. Source CI (read-only `gh` API)

- Actions #428 run `43513316089`: `status: completed`, `conclusion: success`, `head_sha == c7155abc…` (exact pinned source), 3 jobs all `success` (`local-first-core`, `macos-portability`, `dsh-typecheck-and-build`). Dispatch-vs-pinned diff = 4 handoff/docs files only (`LOCAL_AGENT_TASK.md`, `CURRENT_STATE.md`, `WORK_QUEUE.md`, the OL-031 dispatch message) — zero src/test drift, so CI evidence applies to the pinned source.
- Earlier #427 (`0827886`) failed the macOS `/var` vs `/private/var` expectation — recorded as NOT pass evidence; `c7155ab` fixes the expected value via `realpathSync` and #428 is green on both legs (Linux/macOS Node 232/232, new test executed on both, per WORK_QUEUE).

## D. Source review (pinned `c7155ab`)

The guard in `inspectSyntheticApproval` (`src/local-first/non-git-synthetic-approval-ledger.ts:183-185`) adds two conditions to the semantic validation AFTER the canonical reader guard:

```ts
typeof r.journalRoot!=='string'||!r.journalRoot||
!isAbsolute(r.journalRoot)||normalize(r.journalRoot)!==r.journalRoot)
```

throwing `Corrupt synthetic reservation; human reconciliation required`. `0827886` imports `normalize` from `node:path`; `c7155ab` touches only the ledger test's expected value (macOS canonical temp path via `realpathSync`). Writer at `:128` stores `journal=await realpath(reservation.journalRoot)` — canonical by construction. `reserveSyntheticApproval` realpaths the INPUT before writing (`:241`), so noncanonical input paths (`../` forms) are stored normalized. Gate A.5: `inspectSyntheticApproval` has **zero non-test callers in `src/`** (`NO_PRODUCTION_CALLERS`).

## E. Adversarial harness (`~/.dsh-superagent-private/c6b2b5x/preflight_acceptance.mts`, X-groups on top of the carried B4C–B5W layers)

Final result: **ok=1137 fail=0** (exit 0). Carried layers: all B4C–B5W groups (inode/ancestor/ledger-dir/strict-schema/canonical marker+pin/receipt-order) re-run unchanged at the pinned source (1097/1097 before X-groups). New:

- **X1** positive control: writer stores `realpath(journal)`; inspect returns it unchanged on macOS (`/private/var/folders/…`), mirroring the c7155ab pinned assertion.
- **X2** relative (`relative/journal`, `./relative/journal`, `journal/../journal`) journalRoot inside otherwise-canonical JSON: refused with the sanitized `Corrupt synthetic reservation; human reconciliation required`; hostile bytes preserved byte-for-byte (no repair, no replay); approval ID consumed (one-use fence); restored canonical SAME-id accepted (mirrors pinned restore-assert).
- **X3** syntactic edge matrix. REFUSED: double-slash absolute, internal-dotdot-same-target, `/tmp/../private/var/folders`, Windows drive form `C:\…`, UNC `\\server\share`, relative `journal/relative` — each with byte preservation + consumed ID. **AUDITED (accepted)**: trailing-slash absolute and uppercased absolute — `node:path` POSIX `normalize` preserves trailing separators and case, so `normalize(x)===x` holds and the syntactic guard accepts them; this is path-format integrity only, not authenticity.
- **X4** AUDITED limit: a forged absolute, normalized, non-existent path (`/private/var/forged/normalized/absolute`) PASSES inspection — the guard never checks existence or matches the realpath; integrity evidence, not same-user authentication.
- **X5** fresh OS child (no in-process state): refuses the noncanonical journalRoot with the sanitized taxonomy ONLY (raw message never surfaces at call site); accepts a canonical receipt (positive control).
- **X6** noncanonical INPUT journalRoot (`join(c.journal,'..','journal')`) accepted by reserve because `realpath` resolves it BEFORE writing; stored receipt is canonical realpath regardless.

## F. Open gates / residual limits (unchanged, remote-owned)

Same-user marker/receipt forgery (integrity evidence, not signature); path ABA passes the best-effort identity check; OS TOCTOU/non-atomic checks; cross-root generic-reserve fencing absent; fd-relative root isolation absent; private transaction authority + backup/recovery unresolved; the journal-path guard is syntactic only (X4 forged-path acceptance). Real Apply gates unproven.

## G. NOT_TESTED

Real WeChat inbound/outbound, DSH→OpenClaw outbound bridge, real Apply/Rollback against registered projects, 400K-context stress, production database, live OpenClaw hooks.

## H. Changes to local state

One claim commit + one publication commit on the branch (fast-forward, non-force). Private state: `claim-OL-20261114-031.md`, `last_head`. Rollback: revert the two handoff commits only; nothing local (services, configs, model defaults) was modified.
