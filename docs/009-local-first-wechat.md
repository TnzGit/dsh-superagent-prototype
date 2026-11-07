# 009 Local-first WeChat Superagent — integration plan

> Status: **design and prerequisite probes only**. This document does not claim the WhatsApp/Weixin bridge, local-workspace Source, or model router is implemented by this PR. The original superagent is a research prototype, not production-ready. Keep changes additive and test each version boundary.

## Goals and invariants

- WeChat direct chat is the principal operator entry point, using Tencent's `openclaw-weixin` channel when the full OpenClaw plugin is required.
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

Use the existing per-role model selection plus LiteLLM or a verified DSH-native router. **Do not implement another provider adapter or generic gateway in this fork.** A strict priority chain should consider (a) capability, (b) privacy, (c) operator price ceiling, (d) live health, (e) queue wait time; only then cost. Routing must record the actual selected model and why.

With one primary model at concurrency 1, `executor.maxWorkers=1` is the safe initial limit but is **not enough**: evaluations and other DSH sessions can still contend for the same endpoint. A central per-endpoint semaphore/priority queue is required; interactive acknowledgment and short evaluation get reserved priority, with fairness so long jobs cannot starve. Busy is not the same as failed; do not automatically escalate paid API due solely to queueing. If output length is 10,000 tokens at 200 tok/s, decoding alone is ~50 seconds; if prompt length is 60,000 at 3,000 tok/s, prefill alone is ~20 seconds. Budget accordingly.

Nominal 400K context must be tested with the real deployment, not inferred from `/models`. Favor retrieval, bounded context, stable prefix caching, summaries and task-specific context budgets; do not stuff entire repositories into every request. Secondary models on the same GPU may compete for memory/throughput, so benchmark actual concurrent deployment before enabling.

## Phased work and acceptance

**P0 (this PR):** architecture decision record, sample local-only LiteLLM config, read-only `scripts/probe-local-llm.mjs` with a Node test. These are real deliverables; channel and runtime integration are not yet complete.

**P1 — transport:** decide strict OpenClaw plugin versus DSH-direct iLink; implement and test authenticated Source/Channel bridge, replay, ordering, identity/allowlist, reply correlation, reconnect, credential rotation, media and interactive authorization. Do not expose an unguarded ingress publicly.

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

## Rollback and report requirements

Keep upstream `main` unchanged until code passes CI and local staging. Deploy additions behind flags with default-off external ingestion and paid fallback. Back up SQLite and credentials before migrating. Record source commit SHAs and tests. Report reproducible versions, per-scenario acceptance, route decisions, retries, cancellation, total API spend, privacy-egress denials and any unverified capabilities.
