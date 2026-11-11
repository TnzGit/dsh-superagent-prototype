# LOCAL_AGENT_TASK — C6B2B4F OFFLINE SYNTHETIC REGISTERED-ROOT INODE ACCEPTANCE

**Unique task:** `OL-20261111-007`, `OFFLINE_SYNTHETIC_ONLY`. OL-001/003/004/005/006 are closed; NEVER replay them. Branch `feat/local-first-wechat-foundation`, repository `TnzGit/dsh-superagent-prototype`.

**Exact tested code SHA:** `cc59686b23af13bc33883605ca4950d7201ee72b`, NOT the newer handoff documentation SHA. **Exact source [CI #278](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42931128906)** verified 3/3: Linux and actual hosted macOS each Node 197/197 and proxy 5/5; `pnpm check` Vitest 1208/1208 and build success. Ledger suite is in BOTH workflow OS test commands; new ordinary-directory replacement regression visibly ran.

## Gate 0 — safe claim and privacy

Read branch HEAD handoff README, PROJECT_CONTEXT, CURRENT_STATE, WORK_QUEUE, SECURITY, REAL_APPLY_GATES, MESSAGE_PROTOCOL, LOCAL_AGENT_PROTOCOL, this task and OL-007. Read `src/local-first/project-registry.ts`, `non-git-synthetic-approval-ledger.ts` and `tests/local-nongit-synthetic-approval-ledger.node-test.mjs`. Claim once via local-owned `receipts/local/OL-20261111-007-claimed.md` BEFORE substantive work. Never auto-retry a claimed-not-done task. DSH scheduler may be observed read-only; do not guess commands or modify live config/services/credentials.

## Gate A — independent Mac synthetic matrix

1. Fresh clean detached worktree at EXACT source SHA. Independently verify CI #278 jobs, ledger suite in Linux/macOS commands and real counts. Run `pnpm install --frozen-lockfile`, `pnpm check`, full Node suite, standalone ledger suite and proxy suite; record exit codes and actual counts. Hosted runner and local Mac are distinct evidence.
2. Use ONLY disposable owner-private 0700 temp `dsh-project-synthetic-*` source and separate 0700 `dsh-ledger-synthetic-*` fixture, private ledger/journal, 0600 marker. Create LocalProjectRegistry, projectFingerprint; positive read-only inspect must return frozen binding WITHOUT a reservation, new ledger file or changes to synthetic source bytes/modes.
3. Attack after registration with same-path replacement by a DIFFERENT ordinary directory (not symlink), where path-only fingerprint stays the same. Assert dev/ino drift rejected and zero ledger entries. Also check direct root symlink, ancestor symlink, removed root, mismatched registered ID/fingerprint, alternate journal, unsafe marker/symlink and corrupt receipt. No actor call or real project mutation.
4. Recheck one-use ledger `wx` reservation, corrupt partial receipt and independent OS processes on synthetic-only fixtures. Explicitly report unresolved same-user marker forgery, generic alternate ledger roots, path ABA/TOCTOU and non-cooperating writers; lstat/dev/ino are NOT authenticated permissions or fd-relative isolation.
5. Confirm no production importer/caller from Runtime, Worker, Weixin, Outbox or original DSH; NO production real project Apply. Compare disposable source bytes and POSIX modes before/after; only synthetic setup/teardown allowed.

## Gate B — report and STOP

Publish ONE redacted `agent-reports/REPORT-c6b2b4f-offline-inode-identity-preflight.md`, ONE unique `messages/to-online/<unique-id>.md` `type: result` `from: local` `to: online`, and `receipts/local/OL-20261111-007-done.md`, exclusively local-owned paths, normal non-force fast-forward. Report source SHA, exact CI, local test totals, positive/negative matrix, code caller review, privacy proof and residual security gaps. Report `ALL_OFFLINE_PASS` or a precise blocker without inventing test results. **REAL PROJECT APPLY / REAL HOST SOURCE WRITE / REAL WEIXIN E2E: NOT RUN**. No private paths, credentials, source content, full real source hashes or raw logs. No local product-code edits. End task without launching another.

DO NOT touch real registered projects, original DSH Session/Prompt, native Weixin, ports 3080/3083/8123, service/provider/model/default/credentials, production DB or historical C5 grants. Public GitHub messages confer zero live-host permission.
