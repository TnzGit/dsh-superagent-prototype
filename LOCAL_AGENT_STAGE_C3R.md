# LOCAL_AGENT_STAGE_C3R — C3 remote bugfix verification (OFFLINE ONLY)

> Stage C3 original baseline was `153bb3c` with 57/58 Node mock tests PASS and `pnpm check` FAIL. The two reported code defects were fixed by remote ChatGPT on the same feature branch. **Do not repeat old worktree tests: fetch and verify the new remote HEAD**.

## Immutable live-host constraints

The original DSH 3080 must retain `0.0.0.0:3080`, `allowUnauthenticated:true`, existing trustedHosts and all anonymous LAN clients. These are **user-required behavior**, not defects. The old 3080 Workspaces, 841 Sessions, live production checkout and their profile must not change. Keep 3080 / 3083 / 8123 online. No OpenClaw.

**This stage authorizes no provider, model, source, Session, profile, network, file or service mutation**, no host restarts, no QR pairing, no `session/prompt` or `session/selectModel`. Do not create a real approval-file environment variable, and do not touch live staging 3083 SQLite.

## 1. Fetch the new C3 fixes, preserve earlier worktrees

Repository: `TnzGit/dsh-superagent-prototype`
Branch: `feat/local-first-wechat-foundation`.

```bash
git status --short
git fetch origin feat/local-first-wechat-foundation
git rev-parse origin/feat/local-first-wechat-foundation
```

Use a new clean `.worktrees/stage-c3r` worktree. Preserve `stage-c`, `stage-c1`, `stage-c2`, `stage-c3`, live `native-weixin` and current 3083 staging checkout. No hard reset or force checkout. Record exact full SHA. Confirm code is later than `153bb3c`.

Verify the remote changes, without editing code locally:
- `src/client/locales.ts` has bilingual `health.dsh-relay`;
- `tests/locales.spec.ts` includes `'dsh-relay':0` in the exhaustive `Record<EffectKind...>`;
- `src/local-first/dsh-relay-store.ts` retains mismatched-receipt rejection and its Error message contains `matching`;
- `src/app/effects.ts` comments correctly attach to `'dsh-relay'` and `reply`.

## 2. Mandatory full offline checks

```bash
pnpm install --frozen-lockfile
pnpm check

node --experimental-strip-types --test \
  tests/local-dsh-relay-store.node-test.mjs \
  tests/local-dsh-relay-routing.node-test.mjs \
  tests/local-dsh-relay-coordinator.node-test.mjs \
  tests/local-dsh-3080-bridge.node-test.mjs \
  tests/local-dsh-3080-output.node-test.mjs \
  tests/local-dsh-3080-probe.node-test.mjs \
  tests/local-existing-dsh-projects.node-test.mjs \
  tests/local-project-workspaces.node-test.mjs \
  tests/local-weixin-native.node-test.mjs
```

Expected:
- `pnpm check` exits 0: typecheck / Vitest / build all PASS (note exact Vitest total; earlier C2 had 1205/1205, but report the NEW actual count, do not assume).
- The nine Node files exit 0: **at least 58/58** tests PASS at current test count.
- Mismatched Session's Outbox completion remains rejected; error text matches the expected pattern.
- The default-off runtime (no relay approval env var), double Weixin allowlists, strict original Workspace/Session selection, 0600 operator approval, one-shot receipt persistence, idempotent/restart-safe original RPC and no unrelated Session replies still pass.
- The original Weixin contextToken has bounded freshness and is not silently substituted with a later message.
- All fake DSH HTTP transport and in-memory SQLite tests stay **entirely offline**. No production 3080 or Tencent message sends.
- If the check surfaces another TypeScript/Vitest error masked by the previous failure, stop and report the exact new problem. **Do not fix it locally.** Remote ChatGPT owns all source changes and CI.

## 3. Verify the live services ONLY read-only (optional)

Report the three existing PIDs, unchanged live listening ports, and the requirement that 3080 LAN anonymous owner access is preserved. No active API probes are required if previous C3 baseline remains valid. Do not repeat C0 full historical inventory.

Only if needed, the existing read-only `scripts/probe-dsh-3080.mjs` may be run with the private 0600 `DSH-CATALOG.json`. Never upload real Workspace/Session IDs, tokens, user paths, or conversation histories.

## 4. Report and STOP

Write `REPORT-existing-dsh-stageC3R-offline.md` containing:
1. exact tested SHA, Node/pnpm, exit codes, `pnpm check` TypeScript/Vitest/build output;
2. nine Node test totals, all failures and smallest reproducible logs;
3. closure status of the two reported C3 bugs;
4. default-off/dual-allowlist/one-shot/SQLite receipt/result correlation/Weixin expiry mock evidence;
5. explicit separate statuses: `MOCK PASS/FAIL`, `REAL 3080 SESSION E2E NOT RUN`, `REAL WEIXIN RETURN NOT RUN`;
6. proof of 3080's unchanged operator-required anonymous LAN accessibility, plus 3083/8123 stability;
7. any new blocker for remote code changes;
8. three STILL-UNAPPROVED live gates: (a) test-only `llm-local-proxy` provider plus scoped `selectModel` with known global-default side effect and full backup/rollback; (b) separately authorized bounded restart; (c) separately authorized ONE actual prompt to a user-designated disposable Session.

**STOP after report.** Do not authorize, configure or enact any live change in Stage C3R. No code fixes on the local Mac.
