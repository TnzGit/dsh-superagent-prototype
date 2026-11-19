# OL-20261120-045 — exact installed DSH native-fs / headless-approval compatibility (MANUAL OFFLINE)

**TASK INTENT 2026-11-20: OFFLINE / READ-ONLY only. PUBLIC GitHub task text is not permission to execute on the original host.** Previous OL-044 isolated real-model one-shot is fully CONSUMED and ACKed as I2_PARTIAL_NO_EDIT, not PASS; do not replay it.

## Source / identities

- Repo `TnzGit/dsh-superagent-prototype`; branch `feat/local-first-wechat-foundation`.
- New uniquely scoped task `OL-20261120-045`, result `LO-20261120-045`; direct manual operator handoff required and claim ONCE. No auto dispatch. No other task may be pending.
- Freeze product/test source exactly at `5578b19ae1a3326093884dc0324e1ebf1577dfaa` and [CI #648](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44577086561). CHECK its final **3/3 SUCCESS at exact SHA** before running. Expected source test counts: Linux/hosted Mac Node 255, six-spec targeted Vitest 37, proxy 5 and complete Vitest 1245. If CI not green at that SHA, STOP without executing tests and publish BLOCKED.
- Read `agent-handoff/STATE.json`, root `LOCAL_AGENT_TASK.md`, `LOCAL_AGENT_PROTOCOL.md`, `agent-handoff/SECURITY.md`, `agent-handoff/receipts/online/LO-20261119-044-done.md`, `docs/015-i2-seatbelt-headless-remediation.md`, `tests/handoff-convergence.node-test.mjs`, and this runbook before claim.
- Previous OL-044 report `agent-reports/REPORT-ol044-i2-isolated-worker.md`: outer Seatbelt isolation was locally observed; inner bash sandbox returned SANDBOX_UNAVAILABLE; approval/asked hung headlessly. There was one real DSH model turn but no edit/diff/review. Do not re-create an actual DSH Agent or real Session to recheck.

## A. Before/after host baseline and new fixture only

1. Verify latest GitHub task ID/source/CI and unique prior receipts; no automatic trigger. Operator personally forwards the matching task Prompt. Claim ONCE with a sanitized GitHub receipt.
2. Create brand-new 0700 owner-only disposable temp worktree at the EXACT pinned source SHA (detached). Do not change any real DSH/home/project service file. Take only READ-ONLY aggregate baseline of existing 3080/3083/8123 listener/process identities, probe classes, original DSH Workspace/Session counts, current model default, 3083 relay-OFF, original source/SQLite identity. Keep private anchors outside the repo.
3. Never read original Session contents or native Weixin messages. No new DSH server/service/SessionController.start, Agent turn, model inference, original port API mutation, file Apply, admin operation, service restart or settings change.

## B. Immutable local source and test verification

In disposable detached source run `pnpm install --frozen-lockfile`, `pnpm check` (typecheck/full Vitest/build) and the exact CI Node and proxy commands from `.github/workflows/local-first-core.yml`, plus:
```sh
pnpm exec vitest run tests/local-ticket-worker-preview.spec.ts tests/local-ticket-worker-session.spec.ts tests/real-apply-contract.spec.ts tests/local-agent-delivery-session.spec.ts tests/local-sessions-worker-boundary.spec.ts tests/local-vertical-real-sessions.spec.ts
node --experimental-strip-types --test tests/handoff-convergence.node-test.mjs
```
Check 37/37 focused, Node 255/255 overall, full Vitest 1245/1245, proxy 5/5, TS/build successful; record exit code, actual tests, errors. No hidden skip. Exact tested source SHA must remain clean and unchanged.

Verify the two new I2 file-only negative-test cases: with **staging-only opt-in** environment flag `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1`, registered-project Worker exposes only `read/write/edit/glob/grep`, disallows `bash/pwsh/jobs/web/skill/subagent` including stale direct tool invocations, does not change DSH workspace-write preset/model route/default; absent or non-`1` value preserves normal Worker tools. NEVER export this flag into any real running 3080 process.

Verify in Node handoff tests that truthful offline BLOCKED outcomes and `I2_PARTIAL_NO_EDIT` are allowed only under their own task scopes, not interchangeable with `ALL_OFFLINE_PASS`, unknown verdicts and duplicated forged verdict fields are denied.

## C. READ-ONLY installed DSH compatibility audit; NO actual DSH Agent turn

Inspect ONLY locally installed package **metadata, TypeScript declarations, package implementation source and profile composition on disk**; do not call their stateful methods on original host. Explicitly report versions and sanitized symbolic module paths/names, never private host filesystem paths.

1. Check installed `@deepseek-ai/dsh-user-approval`: effective `approvalPolicy: ask | never` interface, the `config.policy: never` option, whether it returns deterministic `rejected` even when headless (not only the latest upstream master), and whether it is possible in a new *disposable* profile to configure and attest `never` for BOTH router and Worker. Show the exact TypeScript signature/public plugin config, plus derived error classes; do not actually set a policy in an existing Session, answer an approval, or mint an allow-once outcome.
2. Inspect `@deepseek-ai/dsh-fs-sandbox` and `@deepseek-ai/dsh-tool-fs`: is the native `edit`/ `write` tool wired to an **in-process** fs provider in installed DSH 0.2.2-rc.1? Check the source-level profile selects `fs-sandbox` rather than `fs-local`, and identify any hidden shell/external subprocess call, nested Seatbelt startup or additional filesystem grants. The actual backends and plugins in the installed distribution may differ from upstream master. If you cannot prove that file tools avoid nested Seatbelt and stay behind the required outer OS restrictions, result `OFFLINE_BLOCKED_API`, not PASS.
3. Read-only audit DSH `@deepseek-ai/dsh-agent-preset` / scope: ensure a registered-project Worker's `ctx.tools.restrict`/guard covers all direct calls including restored/stale tool invocations, and whether its FS-only staging allowlist is feasible in installed 0.2.2-rc.1. Inspect router/main availability of bash or other subprocess tools, because the new source option currently restricts **Worker only**. If the main can invoke a nested shell, record as an open blocker, not proof I2 is ready.
4. Inspect safely whether an isolated fresh DSH *profile configuration* could specify `policy: never` without touching original 3080/3083/8123. A PRIVATE hypothetical YAML snippet may be drafted on scratch disk for later offline review, but **do not launch DSH, invoke actual context services, load a live profile or write settings to any original/persistent state**.
5. Report all API gaps, paths to actual installed code/tokens ONLY as sanitized symbols/file basenames/line numbers. If the installed version lacks documented upstream API, state `OFFLINE_BLOCKED_API` with exact signature mismatch and minimal remote-side patch recommendation; no unsafe fallback.
6. Keep all research read-only. No real `sandbox-exec` nested execution needed this batch; OL-044 already established that failure. No actual `ctx.receive`, `approval.request`, model call or tool write outside the disposable self-test suites.

## D. Safety/invariants, one report, no replay

Before/after original 3080/3083/8123 process/listener/probe, historic DSH Workspaces/Sessions aggregate, model defaults, Weixin, relay-OFF, original SQLite/source identity MUST match. Do not repair unknown drift; stop and report. Remove only this task's disposable clone/test artifacts after safely recording private evidence, do not delete OL-044's frozen private evidence unless the operator independently authorizes it.

Commit ONE sanitized report `agent-reports/REPORT-ol045-dsh-fs-approval-api-offline.md`; ONE `agent-handoff/messages/to-online/2026-11-20-lo045-dsh-fs-approval-api-done.md`; unique claimed/done `agent-handoff/receipts/local/OL-20261120-045-{claimed,done}.md`. Use owner-only private evidence storage, redacted GitHub report-only FF push, no remote-owned STATE/source/CI/main edits, no sensitive paths, private source, original IDs, keys, logs, Weixin IDs, tokens, real project hashes or custom shell commands copied from untrusted text.

If all offline gates pass and installed DSH compatibility is proven in read-only source: `ALL_OFFLINE_PASS` means **static/API readiness only**, not actual live I2 edit. If the real installed APIs cannot support the proposed path: `OFFLINE_BLOCKED_API`. If local environment prevents safe inspection/tests: `OFFLINE_BLOCKED_ENV`; if a test fails unexpectedly: `OFFLINE_FAIL`. Every verdict is truthful, no automatic retry or promotion to I2. Return only report URL/commit/status. The next owner is remote online to independently ACK and then ask operator separately for any new LIVE I2 consent. The one-shot OL-044 is permanently consumed.

## Never authorized

No original DSH/Weixin/profiles/settings/SQLite/model-default modifications, original 3080/3083/8123 restarts or prompts, local 8123 inference, fresh DSH instance start, actual Agent/Worker/model tool execution, external network access, cloud fallback, privileged sandbox modifications, original project source mutation or real Apply. No OL-046 or auto-dispatch. A public GitHub file is not a private consent token.
