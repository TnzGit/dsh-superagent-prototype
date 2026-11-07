# 009 Local-first WeChat Superagent — historical integration plan

> **Architecture superseded (2026-11-08).** The operator has retired OpenClaw and explicitly selected **DSH-native Weixin over iLink with QR-gated pairing**. The decision and current handoff are in [010 Direct Weixin channel](010-direct-weixin-channel.md) and `LOCAL_AGENT_HANDOFF.md`. This document retains earlier OpenClaw bridge explorations **as historical reference only**. Do not install OpenClaw, configure its plugins, run the Gateway, or start those prototype modules when implementing the chosen system.

> Status: **incremental prototype**. The fork now contains offline-tested signed Weixin ingress, an optional disabled-by-default DSH Source, a companion OpenClaw `before_dispatch` ingress hook, local routing/queue/path-safety primitives and an explicitly GitHub-disabled startup path. **Two-way WeChat delivery, real OpenClaw E2E, local project execution and wiring the model queue into DSH calls are not complete**. The original superagent is a research prototype, not production-ready. Keep changes additive and test each version boundary.

## Goals and invariants

- WeChat direct chat is the principal operator entry point. **Final selected transport: DSH-native iLink**, not the OpenClaw plugin described in the historical options below.
- Projects may be plain local directories, Git repositories without remotes, or GitHub repositories. GitHub is an optional remote, never a prerequisite for a Ticket.
- One durable DSH Ticket and one execution owner per accepted request. DSH owns authorization, task state, workers, replay and delivery. Do **not** let OpenClaw and DSH independently plan or execute the same job.
- Local-first inference with a *single concurrent* primary Qwen3.8-Flash-Next endpoint. Nominal 400K context, ~3,000 prompt tokens/s and ~200 output tokens/s are operator-reported capacities, **not** validated service guarantees.
- Additional smaller local models are opt-in, individually capability-tested routes; paid/cloud use is disabled by default and separately approved.
- Secrets and repository files do not leave the local network unless a project-level outbound-data policy explicitly permits it.

## What already exists; reuse before implementing

| Capability | Project | Action / risk |
|---|---|---|
| Core Ticket/Policy/Outbox/Executor | `deepseek-ai/dsh-superagent-prototype` | Keep as the source of truth; `docs/008-cookbook.md` specifies SourceKind |
| iLink-based WeChat Source | `samanhappy/dsh-superagent` | Study and port adapters/tests; this is **not** identical to installing Tencent's OpenClaw plugin |
| Local DSH workspace Source | `mengzhongjie/dsh-superagent-local` | Port local session, attachment and workspace logic after reviewing event and path safety |
| Tencent Weixin plugin | `Tencent/openclaw-weixin` | Actual OpenClaw channel; requires OpenClaw Gateway, QR login and its own credentials |
| Model API gateway | `BerriAI/litellm` | Reuse provider registration, aliasing, ordered deployments and accounting |
| Native DSH model router | `green-dalii/dsh-shift-router` | Potential alternative to an external gateway; test with exact DSH build first |
| Quota policy router | `Liyuk/dsh-quota-router` | Design reference **only** until DSH 0.1.0-rc.8 peer pins are reconciled with this repo's 0.2.1-alpha.2 pins |

All community code is third-party. Pin versions, check licenses and run tests; never silently vendor large forks.

## Architecture

```text
Weixin DM -> Tencent openclaw-weixin -> OpenClaw Gateway (channel transport)
                                        -> thin authenticated bridge [TO IMPLEMENT]
                                               -> DSH SourceKind(openclaw) [TO IMPLEMENT]
    local DSH session -> SourceKind(local) ----> DSH Policy / Intake / Ticket / Outbox
    GitHub webhook/poll -> SourceKind(github) --/              |
                                                        scheduler + workers
                                         +--------------------+------------------+
                                         |                    |                  |
                                  local project A     local project B      GitHub project C
                                         |
                             LiteLLM/model provider boundary
                           +-------------+--------------+
                      local primary   local secondary   cloud opt-in
                      concurrency=1   capability-gated  approval required
```

Important: OpenClaw's public `/hooks/agent` accepts **incoming requests to OpenClaw**, not a turnkey outbound bridge into DSH. Do not confuse the direction. Before implementing, spike the current OpenClaw channel-plugin intercept API / outbound Gateway `send` RPC. The adapter must avoid creating a second LLM turn for every user message. An alternative is to omit the OpenClaw runtime entirely and reuse the Tencent iLink protocol implementation from the `samanhappy` DSH Source; that is simpler but does not run `@tencent-weixin/openclaw-weixin` as a plugin. Product choice should be explicit.

## Bridge contract (proposed, not deployed)

- Ingress: `source=openclaw-weixin`, exact `accountId`, `peerId`, `messageId`, received timestamp, text, and typed attachment references. Canonical event id is `source:account:peer:messageId`; do not use message text as an id.
- Authenticate bridge-to-DSH calls with distinct loopback/mTLS credentials. Network reachability is **not** an identity or authorization substitute. Map verified channel/account/peer to a DSH policy ActorRef; sender-supplied payload identities are untrusted.
- All accepted events are durably recorded before acknowledging the transport; replay is idempotent. Preserve one `Thread` per private conversation and correlate follow-ups to Ticket IDs.
- Outbox delivery targets the original account and peer through OpenClaw's authenticated channel send; record a delivery receipt. WeChat send idempotency must be investigated at wire level before claiming exactly-once guarantees.
- Only operator-allowlisted private conversations can initiate tasks; group support is not assumed. Confirmation for destructive commands, deployment, secrets, external uploads, force push, production writes and paid-model escalation.
- Transient message failures retry with bounded backoff and dead-letter visibility; unauthorized requests never create worker sessions.

## Projects and execution

Introduce a registry independent of GitHub repository identity:

```yaml
projects:
  - id: app-a
    kind: local
    root: /srv/workspaces/app-a
    vcs: auto       # none|git|auto
    readOnly: false
  - id: hosted-b
    kind: git
    root: /srv/workspaces/hosted-b
    remote: optional
```

This is **pseudoconfiguration**, not a currently supported settings block.

Validate the configured `root` and every requested target with `realpath` and an allowlisted workspace root, including symlink resolution. Do not trust user-provided absolute paths or `..`. Deny `.ssh`, credential stores, home-directory traversal and project-to-project cross reads by default. Enforce the restriction at the **process/container filesystem boundary**; prompts and blocked-command lists alone are not access control.

Git repositories: prefer isolated `git worktree` per Ticket, branch `agent/<ticket>`, tests, diff and optional PR if a remote is authorized. Non-Git directories: make an isolated copy/snapshot, preserve the original, generate file-level diff/patch and require explicit approval to apply changes. Protect concurrent writes with per-project locks; never run two workers against the same live directory. Store artifact and approval status in the Ticket even if WeChat disconnects.

## Models: scheduling and routing

The existing Superagent supports `eval.model` and `executor.model` (provider/model/reasoningEffort), seeded **when a new Session is created**. Do not assume a change immediately rebinds existing durable sessions.

1. Primary Qwen3.8-Flash-Next: normal assessment, planning, implementation, review, summaries within validated capabilities.
2. Optional small local model(s): message classification, duplicate detection, short summarization, search reranking, simple revisions — only after tool/function-call and quality benchmarks. Do not send critical code changes to a weaker route just because the primary is busy.
3. Cloud/manual: genuinely difficult reasoning or a missing capability, after explicit operator opt-in, with project egress controls and per-run spending ceiling.

Use the existing per-role model selection plus LiteLLM or a verified DSH-native router. **Do not duplicate LiteLLM's full provider catalog.** A deliberately narrow `openai-queue-proxy.ts` already exists as an optional single-endpoint, serialized OpenAI-compatible front door; it is **not** a general provider router and must be explicitly configured for DSH requests. Do not bypass it by pointing a second DSH role straight at the vLLM server. A strict priority chain should consider (a) capability, (b) privacy, (c) operator price ceiling, (d) live health, (e) queue wait time; only then cost. Routing must record the actual selected model and why.

With one primary model at concurrency 1, `executor.maxWorkers=1` is the safe initial limit but is **not enough**: evaluations and other DSH sessions can still contend for the same endpoint. A central per-endpoint semaphore/priority queue is required; interactive acknowledgment and short evaluation get reserved priority, with fairness so long jobs cannot starve. Busy is not the same as failed; do not automatically escalate paid API due solely to queueing. Local host validation on 2026-11-08 observed **60–80 generated tok/s for short responses** (not the previously assumed 200): 10,000 generated tokens would take **125–167 s just for decoding** at that rate, before prefill, tool calls, queueing or network overhead. An uncached prefill sample measured about **4,185 tok/s** at 8.6K tokens; prefix-cache hits can be much faster and are workload-specific. Size per-request timeout and queue wait separately using observed p95 and output-token budgets; avoid automatic paid fallback when the queue is merely occupied. Budget accordingly.

The deployment advertises max_model_len 400,000; 8K, 32K and 64K were tested without OOM on 2026-11-08, but 400K remains **unverified** and may require separate explicit host authorization. Favor retrieval, bounded context, stable prefix caching, summaries and task-specific context budgets; do not stuff entire repositories into every request. Secondary models on the same GPU may compete for memory/throughput, so benchmark actual concurrent deployment before enabling.

## Phased work and acceptance

**P0 (completed on this branch):** architecture decision record, sample local-only LiteLLM config, read-only `scripts/probe-local-llm.mjs` with a Node test. These are real deliverables; channel and runtime integration are not yet complete.

**P1 — transport (partial on branch):** Strict OpenClaw plugin chosen as the working direction. Signed ingress and DSH SourceKind prototype exist with simulated tests; **a signed outbound HTTP receiver now exists behind `DSH_WEIXIN_BRIDGE_OUTBOUND_ENABLED=1`**, using OpenClaw `api.runtime.channel.outbound.loadAdapter('openclaw-weixin')` to reuse Tencent's native adapter (including its `contextToken` resolution), a durable keyed receipt and observed-peer registry; this has only mock validation. Host plugin SDK/route permissions, Gateway availability, media, account login, reconnect and interactive approvals remain **unverified or unsupported**. Ambiguous sends are marked unknown and require manual reconciliation; do not automatically replay them. Do not expose an unguarded ingress publicly.

**P2 — project abstraction:** multi-project registry, isolated execution, GitHub-optional Ticket creation, local non-Git results, approvals and exact target selection. Tests: path traversal, symlinks, simultaneous edits, crash/replay.

**P3 — local-first routing:** integrate existing gateway/compatible router, explicit provider/model selection and roles, one-slot scheduler, capability gates, cooldown, audit, disabled-by-default cloud fallback. Test >1 concurrent incoming requests and a primary outage without double execution or unauthorized cloud egress.

**P4 — hardening:** recovery after restart, durable outbox, operator-visible progress in WeChat, costs, observability, resource limits, version pinning, and upgrades. Run `pnpm check` against the specific DSH build and end-to-end tests on the operator's host.

### P0 local probes

```bash
LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1 LOCAL_LLM_MODEL='ACTUAL_ID_FROM_V1_MODELS' node scripts/probe-local-llm.mjs
LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1 LOCAL_LLM_MODEL='ACTUAL_ID_FROM_V1_MODELS' node scripts/probe-local-llm.mjs --tools
node --test scripts/probe-local-llm.node-test.mjs
```

The probe checks `/models`, one small completion, and optionally one tool-call request. It cannot prove 400K context, prolonged stability, throughput, KV cache behavior, or production readiness. Use `LOCAL_LLM_API_KEY` environment variable if authentication is required; never put real credentials in issues, PRs, chat, or tracked YAML.

## Experimental native outbound bridge security model

- OpenClaw plugin registers the `/plugins/dsh-weixin-bridge/outbound` route only when `DSH_WEIXIN_BRIDGE_OUTBOUND_ENABLED=1`. It is **off by default**, `auth: 'plugin'`, requires HMAC of the exact HTTP body, timestamps within five minutes and a loopback TCP source (use an SSH tunnel for split hosts).
- The Gateway stores a hash of an account/peer only after DSH accepts an inbound event. Outbound targets must match an admitted peer. Request IDs, payload hashes and a delivery state are written to the host-provided persistent keyed store before native sending and after success.
- A duplicate confirmed ID returns success without re-sending. If the previous native send may have happened but completion was not proven, the state remains `sending`/`unknown`, and a retry returns HTTP 409 **without re-sending**. A human/operator must reconcile it. This is **not exactly-once delivery**, and receipt-retention and Gateway restart must be validated before production use.
- Actual physical sending is delegated to `api.runtime.channel.outbound.loadAdapter('openclaw-weixin').sendText` with `api.config`, `accountId`, and `to`; this follows Tencent's context-token handling and avoids a new direct iLink transport. Route trust, actor identity and the native send path still need real Gateway validation. Text is split into at most 3500 Unicode codepoints per chunk, with partial-batch ambiguity reported instead of replayed.

## 2026-11-08 environment validation (desensitized)

The operator's local-Agent report is **not checked into the public fork**, since it contains local filesystem and LAN topology. Salient verified facts, without local addresses:

- vLLM `0.29.1rc1.dev402` served model id `Qwen3.8-Flash-Next` via an OpenAI-compatible `/v1` endpoint on **port 8002**, not the previously assumed default port 80. Do not hard-code the operator's LAN address in public docs; all deployment commands must read the configured URL.
- Tool calling and streaming worked. The 3bpw AutoRound + MTP model passed 8K/32K/64K context smoke tests; 400K was not tested.
- With small requests, vLLM's continuous batching accepted more than one request concurrently; **the queue proxy remains mandatory** if strictly one active inference is required across DSH roles.
- Reported decode measurements were short-output observations (~60–80 tok/s). Do not interpret them as a statistically stable large-generation benchmark.
- OpenClaw `2026.11.1` exposes `event.channel` and `ctx.channelId` in the `before_dispatch` contract (the fork's original reversed field lookup was fixed). Tencent plugin `2.4.10` uses a conversation `contextToken` for outbound Weixin delivery; the optional OpenClaw-side receiver delegates to its **native adapter in the same Gateway process** instead of reimplementing Tencent iLink. The real Gateway was not running, so no two-way WeChat validation occurred.
- The existing OpenClaw runtime must be selected and authenticated before activating the bridge. An OpenClaw CLI absence is **not** permission to replace or overwrite the user's existing application/profile.

## Rollback and report requirements

Keep upstream `main` unchanged until code passes CI and local staging. Deploy additions behind flags with default-off external ingestion and paid fallback. Back up SQLite and credentials before migrating. Record source commit SHAs and tests. Report reproducible versions, per-scenario acceptance, route decisions, retries, cancellation, total API spend, privacy-egress denials and any unverified capabilities.
