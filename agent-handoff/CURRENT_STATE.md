# CURRENT_STATE — 2026-11-20 LO-044 ACK, I2 still PARTIAL

Machine authority `agent-handoff/STATE.json`. OL-044 CLOSED/ACKED at `agent-handoff/receipts/online/LO-20261119-044-done.md`; **NO ACTIVE LOCAL TASK**, no auto-dispatch, online scheduler PAUSED_BY_OPERATOR. OL-044 one-shot consent consumed. PR #1 Draft/unmerged; main and original production 3080/3083/8123 are untouched by remote work.

## Independently inspected evidence

- Frozen code source `c0da76b14f4893397428c025670f731e0629555d`, Actions CI #618 3/3. Local one-shot I2 report `agent-reports/REPORT-ol044-i2-isolated-worker.md`, done SHA `f2aca2c0ab6cdccde286ecae9853aaf16418879f`, truthful `I2_PARTIAL_NO_EDIT`.
- Per local report: Stage B macOS outer Seatbelt guest OS isolation succeeded for synthetic filesystem/network and child process probes; DSH 0.2.2-rc.1 disposable headless instance booted, one synthetic Trigger, one Ticket, one new Worker Session/Workspace. One real Worker model-driven turn used 2 local requests/3 tools; outer OS boundary remained. DSH inner Seatbelt `sandbox-exec` could not nest: `SANDBOX_UNAVAILABLE`. Headless `approval/asked` was unanswered, bounded watchdog stopped the session. **No edit, diff or review record**; one pending unsent Core Outbox acknowledgment only. Scratch source unchanged; zero production drift claimed in local report.
- Report SHA CI #633 run 44571609628: **1/3** — both OS jobs red ONLY at remote `tests/handoff-convergence.node-test.mjs` requiring `ALL_OFFLINE_PASS` for all done receipts; typecheck/build green. Remote amended scoped verdict parser/test at commits `8fafbe6c` and `ac9ff505`, with separate CI verification required.
- Local OS safety caveats persist: outer Seatbelt success does NOT fix nested DSH sandbox; setting inner `danger-full-access` silently is NOT a supported or pre-approved remedy. External writer/ACL/inode/path ABA/one-shot file capability/journal all remain missing for real Apply.

## Next REMOTE owner only

Research actual installed DSH sandbox backend and `ctx.approval.request`/headless approval APIs; engineer a STRICTLY OFFLINE fix/protocol and tests for a safe file-tool-only staging profile or genuinely attested outer OS boundary. Avoid approving `danger-full-access`, defaulting to unconfined tools or monkey-patching original 3080. Do not create or auto-dispatch OL-045. A NEW one-shot live I2 would need fresh private human approval after independently verified technical gates; I3 and real Apply remain forbidden.

## Remote OFFLINE remediation candidate (verified source; no new live stage)

- New exact opt-in code SHA `e458afc2ee6261a1ba3106e2f1de1c4df9c97f86`, [CI #641](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44575812654) **3/3 success**. Linux/hosted macOS Node **255/255**, focus **37/37** per OS, full Vitest **1245/1245**, proxy **5/5**, TypeScript/build PASS.
- `DSH_SUPERAGENT_I2_STAGING_FS_ONLY=1` applies **only to registered-project Worker**: `read/write/edit/glob/grep` allowed, bash/pwsh/jobs/web/skill/subagents denied at listing and tool-use guard. Default/unset (including other values) is unchanged; F2 Ticket/Workspace guards and `workspace-write` permission remain. This is a deny-only logical restriction, **not OS confinement** or a permit for an original host.
- Upstream DSH `dsh-user-approval` has `policy: never` with deterministic `rejected` before headless answerer dispatch; `dsh-fs-sandbox` offers in-process native file edit tools. Their COMPATIBILITY and effective per-session mounts/override with the operator-installed 0.2.2-rc.1 have **NOT** been rechecked for OL-044's next-stage context. Exact research/stop gates: `docs/015-i2-seatbelt-headless-remediation.md`. No new local OL, no fresh live grant, no sandbox bypass.
