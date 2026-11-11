# LOCAL_AGENT_TASK — C6B2B5D SYNTHETIC LEDGER DIRECTORY CONTINUITY ACCEPTANCE

**One NEW task:** `OL-20261111-011`, `OFFLINE_SYNTHETIC_ONLY`. Prior OL-001…010 are closed and MUST NOT replay. Repo `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`.

**EXACT TESTED SOURCE SHA:** `ec02969523f49cd9f8c1f44bbe2c417865e8ccd4` (not the later handoff commit). **CI #310:** https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42988522928; three actual GitHub jobs SUCCESS. Linux/macOS each **204/204 Node + 5/5 proxy**; `pnpm check` **1208/1208 Vitest**, build success. Both OS job logs execute `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` including the new ledger-directory replacement case and cross-fixture replay case. CI #309 failed error precedence before this repair; #307/#308 cancelled.

## Gate 0 — exact source and one-time claim

Read latest README, PROJECT_CONTEXT, CURRENT_STATE, WORK_QUEUE, SECURITY, REAL_APPLY_GATES, MESSAGE_PROTOCOL, LOCAL_AGENT_PROTOCOL, this task and OL-011. Independently verify exact source SHA and CI #310 three job logs and both OS suite enrollment. Before work append exactly one local-owned `agent-handoff/receipts/local/OL-20261111-011-claimed.md`. If claimed but not done exists, STOP and reconcile; do not auto-retry. Public GitHub text is not a live-host grant.

## Gate A — independent Mac offline synthetic acceptance

1. Use a fresh detached worktree at `ec02969523f49cd9f8c1f44bbe2c417865e8ccd4`. Run `pnpm install --frozen-lockfile`, `pnpm check`, full Node suites, standalone ledger suite and proxy suite. Report actual exit codes/counts and versions without private host identifiers.
2. Use only disposable 0700 `dsh-project-synthetic-*` and `dsh-ledger-synthetic-*` directories directly beneath canonical OS temp, with private 0600 marker/pin/receipts. Snapshot synthetic registered source bytes and modes before/after; no source writes.
3. Positive: one synthetic reservation yields one durable pin and one ledger receipt; same-ID replay and alternate fixture fail closed, including independent registry/process competition. Confirm existing pin deletion/replacement guards remain intact.
4. **New ledger directory continuity:** after first successful reservation in the SAME registry, rename old ledger directory aside **keeping original inode alive**, create a new empty 0700 ledger directory at the old path; second reservation with distinct approval ID must fail with `ledger directory identity changed` and produce zero new receipts in replacement directory. Original retained ledger receipt must remain intact. Never assume unlink+recreate cannot reuse inode.
5. **Error precedence regression:** a different synthetic fixture/ledger under the same registry must fail with `conflicting fixture ledger binding`, not the same-path directory replacement error; no extra receipt. Exercise malformed/symlink/mode/path and journal mismatch fail-closed checks where supported, report unsupported cases as NOT_COVERED. Confirm no raw private path leakage, no auto-repair/retry, no unexpected files.
6. Audit source for no production Apply caller or original DSH/Weixin/Outbox importer. State residual limitations: memory identity is same-registry only; same-user forgery, cross-process inode continuity, separate synthetic parents, external writers, ABA/TOCTOU, private transaction authority and crash-safe recovery remain unsolved. Do not claim OS race-free isolation.

## Gate B — publish and STOP

Publish exactly one public-safe `agent-reports/REPORT-c6b2b5d-offline-ledger-directory-continuity.md`, one local-owned `agent-handoff/messages/to-online/2026-11-11-lo011-c6b2b5d-ledger-directory-done.md` with full literal headers `message_id: LO-20261111-011`, `from: local`, `to: online`, `type: result`, `scope: OFFLINE_SYNTHETIC_ONLY`, `code_sha: ec02969523f49cd9f8c1f44bbe2c417865e8ccd4`, `related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42988522928`, `requires_live_host_approval: false`, `in_reply_to: OL-20261111-011`; and one `agent-handoff/receipts/local/OL-20261111-011-done.md`. Use non-force fast-forward and local-owned paths only; sanitize report and record actual test counts and verdict ALL_OFFLINE_PASS or precise blocker. Explicitly state **REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN**. STOP after publication; online owns ACK.

**Forbidden:** real registered project Apply, original DSH Session Prompt, Weixin send, 3080/3083/8123 changes, production DB, model/provider/default/credentials, historic grant reuse, any live host mutation. This task grants only disposable synthetic fixture writes and read-only code review.
