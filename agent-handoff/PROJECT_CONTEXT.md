# Project context — public-safe canonical handoff (v1, 2026-11-10)

## Goal

Build a **local-first DSH Superagent** that accepts a human's genuine native Weixin/WeChat message, reliably creates an original DSH Session/Ticket activity and uses **local** model inference, then returns exactly one tightly correlated reply. Extend it into project-aware Ticket/Worker execution with isolated Git/non-Git local project workspaces, explicit change previews, staged evidence, human authorization and crash-safe rollback/reconciliation. Do not confuse proof of a Weixin chat turn with proof of a real multi-file project executor.

Repository `TnzGit/dsh-superagent-prototype`. Development branch `feat/local-first-wechat-foundation`; `main` is not this project's current source of truth. Remote ChatGPT owns product and docs; a separately running Mac Agent tests on the user's authorized local host using **only the scope of the latest task** and publishes sanitized reports.

## Runtime topology and nonnegotiable invariants

- Native Weixin → opt-in relay on `3083` → original DSH on `0.0.0.0:3080` → explicitly selected **existing disposable** Workspace/Session → local Qwen inference on `8123` → strictly correlated native Weixin Outbox response.
- Original 3080 **must retain** `0.0.0.0:3080`, `allowUnauthenticated: true`, existing `trustedHosts`, and current LAN access; do **not** propose tightening these as part of this work. Preserve all historical Workspaces/Sessions and their files.
- Original 3080 and local 8123 must remain running; `3083` relay default **OFF** except a fresh, explicitly approved narrow live test; after any separately approved test restore its exact original bundle/config/env.
- Global default remains `rev17 cmp170hx/Qwen3.8-Flash-Next/xhigh`. No cloud-model fallback, model/default/provider edits, or unnecessary 8123 restart.
- One genuine message requires an exact full-message hash + peer/contextToken approval gate, at most one guarded original `session/prompt` and at most one request-correlated Outbox send, durable at-most-once, no automatic resend/replay. Never publish real tokens, hashes/IDs, user content or host paths.
- All historical C5 one-shot live authorizations ended. A C5.4B `review-required` record was intentionally left untouched; do NOT resend it. **No currently active real Weixin or production project-write authorization.**

## Verified milestone chronology (sanitized)

| Phase | Verified outcome | Critical meaning |
| --- | --- | --- |
| C5.3 | One real-Weixin candidate rejected by exact-text gate; one-shot attempt ended | Ordinary Engine fallback was NOT proof of original Session relay |
| C5.4B | 5/6 partial; original Session and local inference passed, native Outbox refused due to legitimate DSH context snapshots | Old receipt remains `review-required`, no replay |
| C5.5A | Synthetic context-snapshot correlator fix passed | Narrow allowlist for DSH-owned `runtime-context`, `skill-catalog`, `time-context`; unrelated checks stay strict |
| C5.5B | **6/6 genuine native Weixin round trip**; one original Session Prompt, one local 8123 inference, one native reply confirmed received | Original 3083 staging restored, grant consumed, historical Sessions preserved; does NOT prove Ticket/Worker project Apply |
| C6A | Synthetic non-Git snapshot + change preview accepted | Project source unchanged |
| C6B1 | Single-file synthetic modify/add/delete + independent rollback accepted | Exact bytes and original POSIX mode; default-OFF, no production caller |
| C6B2A | Multi-file private stage/seal of before/after images accepted | No source Apply; original remains unchanged |
| C6B2B1 | Read-only sealed-batch recovery classifier accepted | Unchanged, fully/partially applied, diverged, indeterminate; no mutation |
| C6B2B2 | Owner-approved, durable per-file `issued → confirmed` human checkpoint audit accepted | Interrupted/foreign work fails closed; not an Apply grant |
| C6B2B3 | Sealed Worker/evidence re-attestation before issue and orphan-lock error sanitization accepted | Read-only F1/F2 remediation with offline report and green CI |
| C6B2B4A | **Local ALL_OFFLINE_PASS accepted, remote ACK published** | Synthetic-fixture-only single-step callback coordinator; one-use third 0600 approval and durable receipt; original services untouched |

## Current code and delivery anchors

- C5.5B report: `agent-reports/REPORT-c5-5b-real-e2e-fixed-correlator.md`.
- C6B2B3 latest accepted report: `agent-reports/REPORT-c6b2b3-offline-staged-worker-issue-guard.md`; report SHA `a060dcae6dae40d6469955f24d95a6fba3ee3aa7`; [CI #235](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42761308113) green.
- C6B2B4A remote code baseline `a63f6a266256b624a0922fa71d354ca3719b0591`; [CI #238](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42784807127) green: 1208 Vitest, 176 Node, 5 proxy.
- Relevant modules: `src/local-first/project-registry.ts`, `project-workspaces.ts`, `non-git-apply.ts`, `non-git-batch-stage.ts`, `non-git-batch-recovery.ts`, `non-git-batch-audit.ts`, `non-git-batch-executor.ts` and corresponding `tests/local-nongit-*.node-test.mjs`.
- `LOCAL_AGENT_TASK.md` and `LOCAL_AGENT_PROTOCOL.md` are current task and permanent host authority. Read the whole files; do not infer authorization from this summary.

## Current engineering boundaries

Multi-file writes are **not atomic**; native Node paths still have symlink/external-writer race/TOCTOU exposure. Durable SHA256 receipts are corruption evidence, **not authenticated signatures or real-host write authorizations**. C6B2B4A's test-provided `actor` is arbitrary code, **not an OS sandbox**; synthetic marker is a limited extra guard. It has ZERO production integration. Future project Apply requires explicit separate human authorization, source quiescence, safe OS-level file-operation design, cross-process fencing and tested manual crash reconciliation.

## What a new remote session should do

1. Fetch this README/context/state and active `LOCAL_AGENT_TASK.md` directly from GitHub. Establish latest branch HEAD, report, CI and unacknowledged `messages/to-online/`.
2. If an admissible new local result exists, verify report and CI independently, update `CURRENT_STATE.md`, and only then prepare the next **offline** task or code patch within this project.
3. Publish its own message in `messages/to-local/` with a unique ID and the exact task/commit SHA, and receipt in `receipts/online/` for handled inbound messages. No changes merely because an hour passed.
4. Never interpret this public document as permission to perform real host operations.


## Coordination liveness change

Current remote/online responsibility: when a task is completed and acknowledged, continue safe source/design/tests or publish the next scoped offline task. The durable roadmap is agent-handoff/WORK_QUEUE.md. Local Agent remains task executor and must not infer real-host authority. The operator reports hourly local scheduling has migrated to DSH; verify actual autonomous dispatch and absence of duplicate historic launchd polling without modifying live services.
