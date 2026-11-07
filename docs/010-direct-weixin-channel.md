# 010 — Direct Weixin channel, no OpenClaw runtime (2026-11-08 decision)

**Status: chosen architecture, implementation in progress; NOT a working WeChat login or deployed Source.**

## Owner intent and precedence

The operator stopped using OpenClaw. The DSH Superagent should be the sole agent behind the WeChat/Clawbot conversation previously used with OpenClaw. Do **not** reinstall OpenClaw, require an OpenClaw Gateway, run the Tencent OpenClaw plugin, use `before_dispatch`, or bridge through OpenClaw HTTP/WS methods. The old bot may need new QR authorization/rebinding; reuse of the same visible bot identity or stale credentials is **not guaranteed**. Do not import the old OpenClaw profile/token without explicit authorization.

This decision **supersedes the selected transport** in 009. Any existing `integrations/openclaw-weixin-dsh/*`, `src/sources/openclaw-bridge.ts` and `src/local-first/weixin-http.ts` files are obsolete exploratory prototypes, **not** part of the selected architecture. Keep them disabled; remove them from package entry points before declaring the new channel complete. Their passing CI tests do not prove native Weixin support.

## Reuse before building

- [samanhappy/dsh-superagent](https://github.com/samanhappy/dsh-superagent), MIT + NOTICE: already implements a DSH Weixin Source, QR login in the DSH panel, authenticated iLink long polling, Trigger mapping, context tokens and outbound replies. Review its LICENSE and NOTICE; attribute copied/adapted code rather than silently copying.
- [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin), MIT: **protocol documentation/source reference only**. Its OpenClaw plugin entry point is incompatible with the requirement to avoid OpenClaw runtime. Read `docs/protocol_zh_CN.md` / `docs/protocol.md`, which describe QR challenge and `context_token`, login redirects, cursor `get_updates_buf`, and reply semantics.
- [lubaiUwU/DSH-WeChatClawBot](https://github.com/lubaiUwU/DSH-WeChatClawBot), independent DSH without OpenClaw, is another option to inspect but must not be installed indiscriminately.
- The iLink bot API can evolve or be restricted. Stop on token invalidation, unusual login challenges, bind conflicts or suspected platform policy restriction. No unauthorized workaround; login is operator-controlled.

## Selected design

```text
Operator scans QR once (only after staging report + explicit approval)
                       |
 WeChat / Tencent iLink API (HTTPS JSON, authenticated bot token)
                       |
        DSH-native SourceKind(weixin)
          | long-poll with durable cursor
          | map message -> stable Trigger ID + actor allowlist
          | retain each message's context_token with its reply channel
          v
    DSH Policy -> Intake -> Ticket -> Executor -> Outbox
                                           |
                         DSH-native Weixin reply sender
                         context_token + idempotency policy
                                           |
                                  WeChat private chat

DSH provider -> local OpenAI queue proxy (concurrency 1)
                  -> existing Qwen3.8-Flash-Next vLLM
```

Requirements:
- Run inside DSH host; no OpenClaw process, NPM plugin, dependency, Gateway or state directory.
- Source is disabled by default; no network, QR issuance, polling, or bot state mutation before operator explicitly enables test mode.
- Pairing credentials are written only after user's confirmation into locally secured storage (owner read/write only), never GitHub, logs, prompts, QR webpage with external QR renderers or permanent shell history; take redirected `baseurl` from login result and verify HTTPS.
- Durable poll cursor must advance **after** each Trigger is persisted; replay must deduplicate by stable message ID.
- Preserve conversation `context_token` for correct replies, including restart/replay, and avoid retrying an ambiguous send automatically until reconciled. Enforce sender allowlist and explicit approval for destructive commands, writes outside staging, sensitive data egress, new model payments, or production deployment.
- Only one active polling process per bot account. Test behavior of previous Clawbot binding (rebinding may require a scan and may not preserve old identity). Do not run old OpenClaw and new DSH channel concurrently.
- Start with private-chat text; media, images, voice, group messages and attachments should be represented as unsupported/not-ready unless proven.
- Operational readiness includes actual SDK compatibility, restart recovery, health, revoked credential handling, test inbound/outbound and cloud-disabled model path. A green mock CI is not a live channel acceptance.

## Two-stage handoff: pairing is a human gate

**Phase A / before QR (local Agent autonomous):**
1. Check out feature branch in independent worktree and inspect previous verification report (macOS/node25, pinned pnpm11.7.0, DSH checkout 0.2.2-alpha.2 vs the bundle 0.2.1-alpha.2); do not change production state.
2. Validate direct Weixin Source readiness **only if remote ChatGPT has committed it**; otherwise return exact missing files/APIs to remote ChatGPT, do not write the replacement locally.
3. Run frozen install, pnpm check, offline native Weixin protocol mocks (QR states, cursor, token, reply), local project and model-proxy tests. No outbound WeChat login/network messages yet.
4. Verify sandbox path, DSH isolated profile, provider through local queue proxy, restricted test project, state directory, file permissions, per-project locks, rollback. Reuse the previously tested model endpoint without re-running 400K.
5. Produce a PASS/FAIL/BLOCKED matrix and exact no-secrets staging report. **Then stop and explicitly request operator QR pairing.** Do not display a live QR before approval.

**Phase B / after operator explicitly approves & scans:**
1. Create QR locally through the DSH-native login flow, show it only to the operator, let the operator use WeChat mobile and confirm; do not simulate scan, import credentials from the abandoned OpenClaw profile, or bypass bind errors.
2. Validate token, HTTPS base URL and bot identity, save credentials in the isolated DSH staging profile with restricted permissions.
3. Test only operator-approved direct chat: receive/ack, allowlist rejects, stable IDs and no duplicate tickets, DSH worker using local queue proxy, native outbound with context token, reconnect/restart, stale-token re-pair and no duplicate sends on unknown outcome.
4. Return a second sanitized report with exact statuses and rollback. Do not deploy to production automatically. If the protocol cannot reuse the old bot identity, report this and ask the operator instead of claiming takeover.

## Ownership rule

Remote ChatGPT authors and tests all reusable code, CI and PR updates. Local Agent runs host-only commands and real-account tests; when code is missing/broken, it sends a minimal repro and waits for a remote fix. Both phases use this division. No paid cloud or unapproved release.
