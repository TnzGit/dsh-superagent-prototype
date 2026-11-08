# LOCAL_AGENT_TASK — CURRENT: GATE1-3080-PROVIDER

**First read:** `LOCAL_AGENT_PROTOCOL.md`; then **execute all phases and STOP conditions** in `LOCAL_AGENT_GATE1_PROVIDER_RUNBOOK.md`.  
**Repository:** `TnzGit/dsh-superagent-prototype`; **feature branch:** `feat/local-first-wechat-foundation`.

## Operator authorization: GATE ① ONLY

The operator explicitly replied **“同意”** on 2026-11-08 to the request for Gate ①: a **test-only** `llm-local-proxy` provider pointing from the original DSH 3080 to the local one-slot Qwen proxy `127.0.0.1:8123`, plus a **strictly conditional** `session/selectModel` with proven original global-model-default rollback.

This approval **supersedes the previous HOLD only within Gate ①'s narrow scope**. It is permission for the documented minimal original-host provider configuration change, **not** a permit to choose or modify any arbitrary historical Session, or alter the original host's global default permanently.

### Essential constraints

- **Never change 3080's `0.0.0.0:3080` listener, `allowUnauthenticated: true`, original trustedHosts, or any anonymous LAN client's access.** This is an operator-required deployment feature.
- Preserve original 27 Workspaces / 841 Sessions, all histories and files. Do not change existing `cmp170hx` route, existing providers, old Session models, or default `cmp170hx/Qwen3.8-Flash-Next/xhigh` (verify effective value before/after).
- **No restart/reload of any service**, even for provider activation; Gate ② remains separately unapproved. No `session/prompt` or real Weixin reply; Gate ③ remains separately unapproved. Never enable live 3083 relay or OpenClaw.
- Before changes, identify the exact installed DSH 0.2.2-alpha.2 provider settings schema and create an owner-only private backup with a demonstrated rollback procedure; never guess config path/schema or publish private data.
- **SelectModel is conditional, not unconditional:** do **not** run it unless provider is live-visible, the official API and **independent** durable global-default restore are verified, and a specific disposable Workspace+Session is already explicitly designated by the operator. No Session ID was designated in the remote chat; the 62 screened candidates are not automatically approved for mutation. A safely configured provider with `SELECTMODEL_DEFERRED_NO_DESIGNATED_SESSION` is an acceptable completed Gate ① phase.
- If provider is configured but cannot be activated without Gate ② restart, **STOP and report `PROVIDER_CONFIGURED_PENDING_GATE2`**; no restart now.
- On drift or unexpected changes, safely undo only the allowed provider change from the private backup, verify restoration, and STOP, or escalate `MANUAL_RECOVERY_REQUIRED` if not verifiable.

## Required execution and reporting

1. Follow `LOCAL_AGENT_GATE1_PROVIDER_RUNBOOK.md` **in full**; do not substitute the stale C0/C1/C2/C3 task files.
2. Publish one **redacted**, no-private-ID/no-secret report as `agent-reports/REPORT-gate1-3080-provider.md`, with a meaningful normal non-force push on the feature branch. Upload no local config, logs or Session identities. Report the exact provider status, whether selectModel was actually attempted, original global-default before/after status, and the LAN-invariant status.
3. **STOP**. The next Gate is NOT automatically approved even if provider becomes visible. The user should only get one short sentence:

`GATE1 完成：Provider=<VISIBLE/PENDING/ROLLED_BACK/BLOCKED>，selectModel=<DONE_AND_DEFAULT_RESTORED/DEFERRED>，3080 LAN=PASS；报告 agent-reports/REPORT-gate1-3080-provider.md（SHA <sha>）；未重启、未投递 Prompt。`

If blocked from GitHub push, state that explicitly in one sentence; do not claim report upload success.
