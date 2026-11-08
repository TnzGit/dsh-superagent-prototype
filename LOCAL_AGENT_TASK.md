# LOCAL_AGENT_TASK — CURRENT: C5.2 OFFLINE ACCEPTANCE + READ-ONLY WIRE CONTRACT AUDIT

**Mandatory first reads:** `LOCAL_AGENT_PROTOCOL.md`, this file, C5 report, and C5.1 audit summary. The original C5 runbook is historical, NOT permission to repeat it.

Repository: `TnzGit/dsh-superagent-prototype`. Branch: `feat/local-first-wechat-foundation`.

## C5 STOPPED; C5 one-shot message approval consumed

C5 stopped before the real original DSH prompt. C5.1 read-only audit confirmed the disposable original Workspace/Session still exists, is idle, has `next=llm-local-proxy/Qwen3.8-Flash-Next/high`, and the global default was restored to `cmp170hx/Qwen3.8-Flash-Next/xhigh`. Keep these unchanged.

**This C5.2 task authorizes OFFLINE TESTS and READ-ONLY HOST OBSERVATION ONLY.** NO live prompt, new Weixin message, Weixin approval/route grant, model/profile/default writes, Workspace/Session creation, Session selection, 3080/3083/8123 restart, product-code edits on Mac, history writes/copies, CI configuration changes, merge, or force-push. The old C5 authorization must NOT be reused; do not run `LOCAL_AGENT_GATE3_LIVE_E2E_RUNBOOK.md` stages again.

## Stage A — exact-HEAD offline acceptance

1. Fetch current remote feature branch into a **fresh** worktree; preserve existing worktrees. Confirm tested HEAD SHA and matching GitHub CI (Linux + macOS + `pnpm check`) on exactly that SHA.
2. Run `pnpm install --frozen-lockfile`, `pnpm check`, the relevant standalone Node suites (`local-dsh-3080-bridge`, `local-dsh-relay-store`, `local-dsh-relay-coordinator`, output and operator-RPC).
3. Verify the method-specific request envelope, durable `not-submitted` terminal, repeat-protection, and read-only `session/page` preflight BEFORE `session/prompt`. If tests fail, STOP `BLOCKED_CODE`; do not locally repair source.

## Stage B — real installed DSH read-only RPC contracts (NO PROMPT)

Using only the existing verified disposable Session, installed controller/descriptors and bounded read-only calls:

1. Record the exact sanitized `result.value` schema for `session/state` (whether it is wrapped in `kind:'sequenced'`, and actual location/type of cursor, running, queue, pendingInput). Do not assume mock structure is real.
2. Confirm `session/wait` full request shape and response schema on an idle Session; no long-polling that risks other host activity.
3. Resolve `session/page` from installed source/descriptor, not guessed HTTP shapes. Demonstrate exactly one bounded **read-only** success at a safe cursor and report required input fields, response field names, pagination/seq boundary semantics, and whether read-cut can be guaranteed. If unresolved, report `BLOCKED_PAGE_PROTOCOL_UNKNOWN`.
4. Inspect `session/prompt` **statically only**: accepted argument names and result schema. Never call it, invoke inference, or test a real delivery.
5. Read back host invariants: original LAN listener/anonymous access, unchanged historical Workspace/Session inventory, disposable membership, default model, three services and local-only route. No mutation.

Retain raw IDs, upstream IPs, local paths, tokens, private logs and any original chat content ONLY in the private owner-only evidence directory.

## Stage C — sanitized GitHub report and STOP

Publish `agent-reports/REPORT-c5-2-offline-wire-audit.md` as the **only** staged GitHub file from a clean report-publishing worktree. Use normal non-force push; no product code edits. Report the exact SHA, CI conclusion, local test counts, validated schema facts, unknowns and no-write invariants. Final local message: short status, link and pushed SHA. DO NOT proceed to another E2E until remote code changes and a NEW independent one-shot human authorization.
