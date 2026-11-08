# LOCAL_AGENT_STAGE_C3 — 已完成的旧任务书（请使用 Stage C3R）

> **2026-11-08 C3 已完成，结果非全绿**：实测 SHA 153bb3c，`pnpm check` 被新 EffectKind 本地化缺项阻断、九个 Node 离线文件 57/58（另一项只为错误消息与测试正则不一致）。两项已由远程提交修复；**下一次验证请只使用 `LOCAL_AGENT_STAGE_C3R.md`**。保留原始 C3 worktree 及所有线上实例，3080 LAN 无鉴权访问必须维持原状。

## 下文是旧版 C3 任务书，仅供追溯

> B / C0 / C1 / C2 already completed. The C2 local baseline was `d98da43`:
> `pnpm check` 1205/1205, five Node test files 35/35 PASS; 27 original Workspaces,
> 841 Sessions and the accepted LAN anonymous access unchanged.
> **This C3 task tests the REMOTE code newly committed AFTER d98da43.**
> It is NOT approval to deploy or configure a real relay.

## Invariants: absolutely no live mutations

The user REQUIRES DSH **3080** to preserve `0.0.0.0:3080`, `allowUnauthenticated: true`, original trustedHosts, anonymous LAN access and all 27/841 original Workspaces/Sessions. This is an operator-accepted deployment property, not an issue to remediate. Do not change DSH_HOME, session logs, old project files or run `session/selectModel`.

Leave existing 3080 / 3083 / 8123 processes online, no restart, no profile/provider changes, no Weixin QR, no real DSH prompt. No OpenClaw.

## C3.1 Fetch NEW code into independent worktree

Repo: https://github.com/TnzGit/dsh-superagent-prototype
Branch: `feat/local-first-wechat-foundation`.

Run `git status --short` and `git fetch origin feat/local-first-wechat-foundation`, then use a clean independent `.worktrees/stage-c3` worktree at the new remote tip. Do not reset stage-c, stage-c1, stage-c2 or the production 3083 checkout. Record full commit SHA. If prior changes are present, do NOT overwrite them.

Read:
- `LOCAL_AGENT_STAGE_C3.md` (this file)
- `docs/012-existing-dsh-host-3080.md`
- `src/local-first/dsh-relay-store.ts`
- `src/local-first/dsh-relay-routing.ts`
- `src/local-first/dsh-relay-coordinator.ts`
- `src/sources/weixin-native.ts` and `src/app/runtime.ts`.

## C3.2 Entirely OFFLINE test/build

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

Log exact exit codes, totals and minimal stack traces. If any failure: **report upstream; DO NOT patch source on this Mac**. The remote ChatGPT writes the fix and local Agent reruns tests at the updated SHA only.

The coordinator Node test must use a fake DSH HTTP server/transport and in-memory SQLite; **do not point it to localhost:3080, 3083, 8123 or Tencent**.

## C3.3 Verify gated routing and durable receipts

1. With `DSH_SUPERAGENT_DSH_RELAY_APPROVAL_FILE` **unset**, the new runtime must not instantiate the relay coordinator, alter default native Weixin chat routing, or create relay tables in the live 3083 SQLite file. Inspect code and offline tests only; do not attach to the live 3083 database.
2. Verify BOTH source `allowedPeers` and DSH Policy sender `allowed` are required before the one-shot hook can consume any Weixin Trigger. Nonmatching messages continue to the old Engine.
3. The authorization is a 0600 private JSON grant, **not a message supplied by a model**. Exact Weixin peer, text SHA256, original project alias, exact Session ID, short expiration and unique approvalId must all match. A multi-Session Workspace MUST include explicit `/session <id>` or already confirmed exact binding.
4. `DshRelayStore` stores one immutable receipt per original Weixin Trigger: original Workspace/Session, stable requestId, pre-prompt event cursor, status, timestamps, SHA256 of text. The original Weixin contextToken is not copied into the relay receipt; it remains in the native stored Trigger.
5. Duplicate / retried / crash-interrupted requests MUST NOT automatically call `session/prompt` again. The retry path reads `session/wait` and `session/page` and either produces an exactly correlated result or marks manual review. It cannot substitute another Session's output.
6. `DshRelayStore.confirmBinding` persists a human-confirmed Weixin-thread → original Workspace + exact Session mapping. Ordinary “继续之前项目” requests still need fresh per-message authorization and must never infer an unknown Session.
7. Exactly correlated assistant text enqueues a stable Outbox message within the same SQLite transaction as updating the relay record. Never copy reasoning content or leak original private paths/Session history.
8. Replies carry an absolute conservative contextToken cutoff (5 minutes from original inbound time). If expired, refuse the send with `gone` and keep the request for explicit human follow-up. A NEW unrelated Weixin message never silently refreshes the token.
9. Confirm the mock one-shot grant can produce exactly one fake original-DSH prompt and one fake Outbox response, with repeat Trigger/effect incapable of duplicating either.
10. Existing LAN owner access on 3080 is not reduced in any code path.

## C3.4 Read-only original 3080 probe (optional)

If the existing private catalog remains readable without modifying service state:

```bash
node --experimental-strip-types scripts/probe-dsh-3080.mjs \
  --catalog "$HOME/.dsh-superagent-private/DSH-CATALOG.json"
```

C2 baseline: 27 Workspaces / 841 Sessions / 1 running / 286 migration-required;
551 `lastUsedLocalQwen`, 552 `nextSelectedLocalQwen`, 289 `nextUnknownOrDifferent` and 76 `historicalCloudSelections`. Report any read-only drift; **do not** scan raw historical conversation contents.

No test provider yet exists on 3080. The existing `cmp170hx` still bypasses 8123. A private one-shot grant and route-attestation file must NOT be created in the live staging environment during C3.

## C3.5 Assess future three explicit approval gates, do not enact

Keep separate approvals:
1. Test-only `llm-local-proxy` Provider plus `session/selectModel`, including its CONFIRMED side effect of saving a new global DSH default. Back up original default `cmp170hx/Qwen3.8-Flash-Next/xhigh`, pre-existing Session selection and profile before any later test, and prove rollback of all of them.
2. A bounded controlled restart for 3080 and/or staging 3083 if actually required. LAN clients could be briefly interrupted during 3080 restart; the eventual operator must authorize that window and verify LAN anonymous access afterward.
3. ONE real prompt to a user-approved disposable test Session (task01/task02 candidate IDs remain private), after recent 8123 route attestation, correct exact sequenced model `next`, safe Session format/idle/permissions and full receipt persistence.

**No automatic provider switch, no public network rebind, no model migration, no actual test here.**

## C3.6 Write and STOP

Report `REPORT-existing-dsh-stageC3-offline.md` with:
- SHA, Node/pnpm, pnpm check/tsdown, all test totals and failures;
- explicit `MOCK E2E PASS/FAIL` versus `REAL 3080 SESSION PROMPT NOT RUN` and `REAL WEIXIN RETURN NOT RUN`;
- source/Policy allowlists, operator-grant gate, persisted receipts, one-shot behavior, binding, context expiry and Outbox proofs;
- any discrepancies or code bugs sent to remote ChatGPT;
- an accurate profile/provider/global-default rollback plan; explicit LAN accessibility PASS;
- no secrets, no raw Session IDs or private paths;
- the three approval requests still outstanding.

C3 is a **code-only offline stage**. At completion, STOP. No user approval is needed to perform these purely offline checks.
