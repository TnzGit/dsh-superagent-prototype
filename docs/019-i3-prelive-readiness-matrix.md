> **CURRENT 2026-11-25:** OL-053 true controlled staging-guest I3 and dedicated REAL registered-test-project Apply/rollback **independently ACKed `LIVE_BOTH_PASS`** for this pilot scope. Final source `c402b48276b74eba0ecf0a697cf09d1138a0f92e`, done `c0527b087d64640d5eedfd7b4f4b23c0fde03dc3`, `agent-handoff/receipts/online/LO-20261125-053-done.md`. 3083 installed cutover and general production Apply caller are NOT implied. **NO ACTIVE TASK** after this ACK; no OL-054 auto-dispatch, remote scheduler PAUSED, `no_auto_dispatch=true`. Root `PLAN.md` is historical and consumed. Read `STATE.json`, `LOCAL_AGENT_TASK.md`, `docs/020-postlive-i3-and-apply-operator-runbook.md` for next technical gates.

# 019 — I3 pre-live readiness matrix (OFFLINE, planning only)

**2026-11-24, OL-20261124-052 batch (lead + 2 subagents).** One consolidated matrix of what the
offline batch actually proves, what stays unresolved for a real Weixin pilot, and which specific
future operator actions and evidence would be required before any live step. This document is
**planning, NOT live approval**: it authorizes nothing by itself, enables no real Weixin, QR, peer
send, model turn, host service change, or production Apply, and PR #1 remains DRAFT/unmerged.
`LOCAL_AGENT_TASK.md` and `agent-handoff/STATE.json` remain authoritative for task state.

## What is proved offline (synthetic behavior → test evidence)

All rows are fake HTTP / synthetic credentials / disposable SQLite / disposable 0700 copy fixtures.
None of them is real Tencent, a real account, a real peer, a real model turn, or the original host.

| Synthetic behavior | Proven by | Layer |
| --- | --- | --- |
| Peer allowlist, owner-only credentials, trigger fingerprinting | `tests/weixin-native.spec.ts` | unit |
| Native poll loop: cursor-after-receive, failed-ingest cursor retention, relay-consumed-before-Engine, invalid/bot updates, transport fault matrix (timeout/EOF/HTTP error/malformed JSON) | `tests/weixin-native-poll-offline.spec.ts`, `tests/local-weixin-native.node-test.mjs` | loop |
| Installed native Outbox: one-shot durable claim before send, accepted-then-EOF ⇒ `ambiguous_send` review hold (never a second send), A→B credential rotation hold, stale/expired/missing context hold, missing-credential wait, no-claim drop `channelIgnored`, fd-only final-file guards | `tests/weixin-native-outbox-offline.spec.ts` | outbox |
| Review-ledger retention: reason allowlist at write AND read, `unclassified_hold` redaction, read-only aggregate `weixinOutboxReview` summary, same-Ticket backpressure (reviewed row blocks later replies indefinitely), late registry peer-revoke | `tests/outbox.spec.ts`, `tests/registry.spec.ts` | ledger |
| Integrated fake-delivery vertical: fake `getupdates` → real poll → real Engine intake → Ticket → disposable Worker copy (mocked agent, zero real model turns) → installed native Source → durable Outbox → fake `sendmessage` acceptance AND ambiguous-EOF paths; duplicate input, double queue, source-off→on, peer revoke, restart replay over the same disposable SQLite, account swap, stale context, poll fault | `tests/local-vertical-native-fake-delivery.spec.ts` | vertical |
| Non-Git synthetic-copy Apply/rollback threat matrix: concurrent external writer fail-closed, interrupted-apply journal recovery, durable before-image, symlink traversal denial, hardlinked-inode drift, fresh-inode worker drift, mode-only change apply+exact-mode rollback, missing journal, replay refusal, expired/foreign grant, lock never auto-stolen, rollback refusals (symlink/hardlink/special mode), journal-overlap refusal | `tests/local-nongit-copy-apply-threats.node-test.mjs` (OL-052 P4, disposable copy only) | apply prototype |
| Credential ancestor-path no-follow preflight + capped strict-UTF-8 streaming response read | `tests/local-weixin-native.node-test.mjs`, `src/local-first/weixin-native-protocol.ts` | transport hardening |
| Queue proxy single-concurrency + client key auth | `tests/local-openai-queue-proxy.node-test.mjs` | proxy |

CI parity for this batch is verified on Linux and macOS (macos-15-intel) at the exact final
implementation SHA and again at the done HEAD; the run URLs and counts are recorded in the
OL-052 batch report (`agent-reports/` under the `REPORT-ol052` file name, referenced here as
plain text because that report is published after this document's commit).

## Still unresolved for a live pilot (GATED)

1. **Real sender consent / QR / account identity** — no real QR login, no consented real peer, no
   proof the real iLink account the operator logs into matches the fingerprint the tests assume.
2. **Real server semantics** — official provider token lifetime, real `client_id` idempotency at
   Tencent, real 429/-14/timeout behavior, real accepted-then-EOF ambiguity (a real send may be
   irreversibly accepted despite client EOF; synthetic at-most-once prevents a second attempt but
   cannot prove actual delivery).
3. **Real model turn** — every vertical test mocks the worker agent deterministically; no real
   inference has run through the native chain end to end.
4. **Auth policy / host exposure** — the loopback management surface and approval policy on the
   real host remain operator decisions; no live reconciliation transaction/UI is authorized (only
   the read-only aggregate review summary exists; a mutating resolve/claim reset/resend against the
   LIVE Outbox remains forbidden, with only a test-only-flagged dry-run projection).
5. **Production Apply / OS containment** — the P4 matrix proves the PROTOTYPE CONTRACT on a
   disposable copy, not registered-production Apply safety. Same-user marker forgery, cross-root
   fencing absence, PATH ABA, OS TOCTOU, external writers, Proxy traps during reflection, private
   transaction authority and backup/recovery remain documented limitations (see
   `agent-handoff/REAL_APPLY_GATES.md`). No production Apply enable switch exists in this batch.
6. **Original host state** — 3080/3083/8123 services, real Weixin credentials, production SQLite,
   model defaults, Session Prompt and historical grants are untouched; no original host file was
   ever read into public state.

## Specific future operator actions required before a live pilot

- Decide + perform the real QR login and record the real account fingerprint privately (never public).
- Grant exactly one consented test peer and keep the allowlist narrow; send one real message with the
  native Source enabled and keep the read-only review summary as the only management view.
- Verify real provider semantics for the ambiguous-EOF case against actual logs before any resend
  decision (human reconciliation only; NEVER automatic resend).
- Run one real model turn through the Ticket→Worker→report chain in an isolated disposable DSH
  (I2-class Seatbelt staging, fresh one-shot consent per run) before trusting native turns.
- For Apply: separate operator-owned narrow grants against a real registered project, with the
  full journal/backup/rollback drill on a copy first; only then consider enabling a real write,
  and never before host permission and OS-containment evidence is complete.

## Safe human actions vs forbidden actions

- **Safe (read-only):** inspect the loopback `GET state` review aggregate; count reasons; inspect a
  disposable private test SQLite copy; escalate to the remote ChatGPT owner with sanitized facts.
- **Forbidden without a new explicit operator decision:** any live resolve/resend/ack/claim reset,
  any edit of production receipt JSON, clearing `singleSendAttemptAt`, reusing a reviewed ID,
  adopting a rotated account for an old receipt, real Weixin send, real source Apply, or any
  change to the running 3080/3083/8123 services.
