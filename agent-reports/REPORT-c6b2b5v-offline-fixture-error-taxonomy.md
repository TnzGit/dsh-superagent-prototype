# OL-20261113-029 — C6B2B5V fixture-marker refusal taxonomy: independent Mac offline acceptance

Verdict: **ALL_OFFLINE_PASS**. Pinned source `9cbe9fea3a9971888093cd236cf214780a8d1618` accepted in an independent detached disposable worktree on this Mac (never the live DSH). All writes inside owner-private 0700 synthetic fixtures only.

## Environment

macOS 26.3 (25D125), arm64, Node v25.9.0, pnpm 11.7.0. Host commands executed under the stage worktree `.worktrees/stage-c6b2b5v` (detached at the pinned source, `git status` 0 lines).

## Local parity (exact commands + exit codes)

| command | exit | result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | ok |
| `pnpm check` | 0 | build complete 1336ms (clean this round; no flake hit) |
| CI-exact 23-file Node suite (workflow `local-first-core` macOS command list) | 0 | **pass 230 / fail 0** |
| `node --experimental-strip-types --test tests/local-openai-queue-proxy.node-test.mjs` | 0 | **pass 5 / fail 0** (`timeout` binary absent on macOS; run unbounded) |
| standalone ledger suite `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` | 0 | **pass 48 / fail 0** (incl. the modified fixture-marker matrix test at 9cbe9fe) |
| `npx vitest run` | 0 | **62 files / 1208 tests passed** |

## Source review at pinned source

- `b80e2fd` (the C6B2B5V product change, one line): the fixture-marker catch at `src/local-first/non-git-synthetic-approval-ledger.ts:216-223` gains `(error instanceof Error && error.message==='Noncanonical synthetic private JSON')` alongside `SyntaxError`/`ENOENT`/`ENOTDIR`, so the raw guard error is now **sanitized** to `Missing or corrupt synthetic fixture binding` on the fixture path (previously it propagated raw at a673563).
- `9cbe9fe` (the pinned source, test-only): the altered-content matrix test now distinguishes the two refusal classes — canonical JSON with a string-valued `"version":"1"` expects `Synthetic fixture binding project mismatch` (semantic layer after canonical parse succeeds), every noncanonical byte variant expects the sanitized `Missing or corrupt synthetic fixture binding`; marker must not be repaired; zero receipts.
- Dispatch-vs-pinned diff (`41b5a68` vs `9cbe9fe`) = 4 handoff/docs files only (LOCAL_AGENT_TASK.md, CURRENT_STATE.md, WORK_QUEUE.md, the OL-029 message). Zero src/test deltas.
- Gate A.5: zero production callers — `reserveFixtureBoundSyntheticApproval`/`readPrivateSyntheticJson` referenced only by the ledger module itself and its node test; the fixture taxonomy strings appear nowhere in `src/` outside the ledger module.

## CI cross-check (independent re-read)

Actions #413 run `43445352187` at the exact pinned head_sha: conclusion=success, **3/3** (local-first-core, macos-portability, dsh-typecheck-and-build); check-runs for the commit all completed/success. Linux/macOS Node 230/230 + proxy 5/5 each with the modified fixture-marker regression executed on both legs; Vitest 62/1208. Failed #412 at `b80e2fd` (229/230, wrong test expectation for the string-version case) confirmed NOT pass evidence; fixed by `9cbe9fe` (test-expectation only).

## Adversarial harness (bounded, synthetic-only)

`~/.dsh-superagent-private/c6b2b5v/preflight_acceptance.mts` — carried B4C–B5U layers (R/S/Q/T/U groups re-patched for the audited V delta: every fixture-path raw-`Noncanonical` matcher now asserts the sanitized `Missing or corrupt synthetic fixture binding`; U10 fresh child asserts the sanitized denial) + new V1–V6:

- V1 numeric `1.0` (parse→1 but serialized text keeps `1.0`, so the exact-serialized guard fires): refusal sanitized; raw `Noncanonical synthetic private JSON` NOT visible on the fixture path; hostile bytes preserved byte-for-byte (no repair); zero receipts; approval NOT consumed; restored canonical reserves the SAME id once and the one-use fence still applies afterwards.
- V2 the five dispatch-named tamper forms — duplicate key, reordered keys, extra trailing newline, leading space, noncanonical numeric 1.0 — ALL refuse with the sanitized taxonomy and never leak the raw guard message; bytes preserved; zero receipts; canonical restore reserves a fresh id once each.
- V3 canonical-but-semantically-invalid `"version":"1"` (string): passes the canonical-text guard (parse/re-serialize identical) and refuses at the semantic layer with `Synthetic fixture binding project mismatch`, NOT the corrupt taxonomy, NOT raw noncanonical; never grants; marker not repaired; zero receipts — mirrors the pinned test distinction exactly.
- V4 fresh OS child (no remembered in-process state): dup-key marker denies with the SANITIZED message only; zero receipts written; canonical positive control ACCEPTED in the fresh process.
- V5 cross-path contrast: the fixture path is the ONLY bound reader whose catch lists the guard message explicitly (mapped to Missing-or-corrupt); the durable-pin and registry-marker call sites use blanket catches mapped to their own Corrupt taxonomies (`Corrupt synthetic registry ledger pin; manual review required` / `Corrupt synthetic registry binding marker`); on NONE of the three paths does the raw `Noncanonical synthetic private JSON` string surface at the call site.
- V6 prior taxonomy preserved by descriptor/size guards: symlink/hardlink/0644 → `Untrusted synthetic fixture binding` (lstat guard fires BEFORE any parse — unchanged); 4097-byte marker refused by the size guard before parse (`Corrupt synthetic fixture binding; manual review required`, ledger module :215); sanitization touches only the canonical-guard message, never the untrusted-refusal surface.

Final tally: **RESULT ok=1048 fail=0** (exit 0).

## Open gates (unchanged, preserved per dispatch)

Same-user marker forgery (integrity evidence, not signature); path ABA / TOCTOU (best-effort identity check passes when the original inode returns); no fd-relative root isolation; cross-root generic-reserve fencing absent (`reserveSyntheticApproval` re-reserves the same id in an independent ledger root — re-audited); receipt-path key-order acceptance is tamper detection, not cryptographic authenticity (reorder of the same keys is ACCEPTED by `inspectSyntheticApproval`); private transaction authority + grant backup/recovery unresolved; Proxy traps execute user code during reflection; tmpdir is not a sandbox; real project Apply/Rollback gates unproven.

## NOT_TESTED

Real Weixin send/receive, real OpenClaw hooks, real registered-project Apply/Rollback, production DSH callers of these ledger APIs, 400K-context model stress. No live host operations.

## Rollback / config impact

Zero product source edits on this host. Services 3080/3083/8123, real Weixin, original Session Prompt, model/provider defaults, production SQLite, historical grants, real registered projects untouched. Only GitHub-side artifacts added: claimed receipt commit `56ec743d6995cb17e0a3594a4ef59f69cadaf125`, then this publication commit; private claim state files (0600) under `~/.dsh-superagent-private/`.

STOP after this result pending online ACK; never replay this milestone.
