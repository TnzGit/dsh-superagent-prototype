# OL-20261124-050 — installed native Weixin Outbox fail-closed independent Mac OFFLINE acceptance

**2026-11-24. ID `OL-20261124-050`, result `LO-20261124-050`. Scope `OFFLINE_SYNTHETIC_ONLY`.** This task is fresh, independent from ACKed OL-049 and cannot replay it. The operator's existing standing consent covers bounded isolated offline verification; a PUBLIC GitHub task is NOT operator-owned initiation. Require the direct operator-forwarded Prompt or a verified protected local dispatcher. `no_auto_dispatch=true`, remote scheduler `PAUSED_BY_OPERATOR`. No model/live-host grant.

## A. Frozen source preflight and strict safety

- Repo `TnzGit/dsh-superagent-prototype`, branch `feat/local-first-wechat-foundation`, EXACT pinned source + tests + CI workflow `d6c51629855caf4b2737049cf4592cc12b912765`. Source push CI #821 `45358339562` and PR CI #822 `45358346533` EACH 3/3 success at exact pin. Linux full Vitest 70 files/1284 tests, cross-OS focused Vitest 83/83, Node 255/255, proxy 5/5, TS/build pass. Mac CI explicit suites: `tests/weixin-native-outbox-offline.spec.ts` 7, `weixin-native-poll-offline.spec.ts` 18, `outbox.spec.ts` 11, `weixin-native.spec.ts` 3. Revalidate GitHub run SHA, jobs, suite log names; do not infer coverage from green badges.
- Read `STATE.json`, current `LOCAL_AGENT_TASK.md`, `SECURITY.md`, `LOCAL_AGENT_PROTOCOL.md`, operator standing scope, prior `LO-20261124-049` ACK and its local receipts, this runbook, and `docs/018-i3-native-weixin-outbox-review-runbook.md`. Check active task is ONLY `OL-20261124-050`, last accepted OL-049, no prior OL-050 claim/done. Source pin -> current handoff HEAD diff MUST be docs/handoff only; if code/workflow changed, BLOCK until online re-pins. Claim ONCE in new sanitized local owned receipt BEFORE tests.
- Use a fresh, disposable, **0700 owner-only detached worktree** at exact source SHA with already installed/offline packages. GitHub read-only fetch for the pin is allowed as normal source retrieval, but tests may use ONLY fake HTTP/credential fixtures; no real network to Tencent/cloud, no QR, no personal peer/credential/session data. No real original 3080/3083/8123 probes or restarts; no original SQLite, Session, Workspace, model inference/8123, actual registered project Apply, security or provider changes. Avoid old consumed OL-044/046 attempt artifacts. Never weaken OS restrictions to get green.
- Inspect `tests/weixin-native-outbox-offline.spec.ts` and native poll suite for fake `fetch` egress tripwires and synthetic-only files. If any code would send externally, STOP before starting. Do not install dependencies from the internet. Missing offline dependencies → `OFFLINE_BLOCKED_ENV`.

## B. Reproduce REAL installed Source + REAL disposable SQLite Outbox on synthetic inputs

Execute in the PINNED worktree, using already present packages:

```sh
pnpm exec vitest run tests/weixin-native-outbox-offline.spec.ts tests/weixin-native-poll-offline.spec.ts tests/weixin-native.spec.ts tests/outbox.spec.ts tests/local-vertical-real-sessions.spec.ts
node --experimental-strip-types --test tests/local-weixin-native.node-test.mjs
pnpm exec vitest run
pnpm typecheck
pnpm build
pnpm check
```

Also run the exact Node, 10-spec focus and proxy commands from `.github/workflows/local-first-core.yml` if already installed and safe/offline, with bounded timeouts. Record exit codes, exact case/file counts, Node/pnpm versions, and matching pinned SHA. Don't claim the entire workflow parity when not actually run.

Independently assert these **genuinely execute** through production `nativeWeixinKind` and application `Outbox` with a newly created disposable SQLite, not just a mock return:

1. One safe synthetic native reply with original peer/context/account hash and stable `clientMessageId`, successful fake send once, receipt `sent` and durable `singleSendAttemptAt`; duplicate queue does NOT send twice.
2. Fake HTTP accepted-then-EOF, one and only one attempt, durable `review.reason=ambiguous_send`, receipt `pending`, no later automatic HTTP replay; crash after claim but before HTTP is no-send on recovery (generic Outbox test).
3. Pending A-receipt + credential rotation to B: zero HTTP using B, durable `account_mismatch` review, no claim. Revert B→A, still never silently auto-replay. During long poll A→B, stale page never reaches route/Engine and cursor is not carried over.
4. Expired/missing expiry, contextToken missing, legacy unbound hash: explicit no-send review reason and zero external network/claim. The 60-minute application cap is **conservative, NOT official Tencent expiry**. Native direct send with explicitly expired address still returns `gone` without I/O.
5. Credentials absent → waiting without consuming one-shot, restored fake file → one send; unsafe symlink/0644/oversized synthetic file rejected by `O_NOFOLLOW`/fstat fd guard; direct adapter cannot bypass account readiness.
6. Redacted local `GET state` `weixinOutboxReview` displays only total/reason counts; never text, peer, message ID, token, credential content. Check report contains no private host identifiers.
7. Preserve non-Weixin retry behavior; dynamic Source peer revocation and disable, cursor-after-durable-intake/abort, fake auth 401/429/503, `-14` backoff; older fake poll→Engine→Ticket→mocked Worker→ready→Source-OFF SQLite pending Outbox vertical remains explicitly SIMULATED and no model turn.

## C. Acceptance, artifacts, handoff, stop

- Report `agent-reports/REPORT-ol050-i3-native-outbox-offline.md` should contain reproducible command/count table, explicit evidence matrix for each (1)-(7), host no-change / egress accounting, source pin/CI verification, risks and truthfully GATED real I3/Apply. Public report sanitized: no real tokens/contextToken, peer/message IDs, home paths, LAN, original Sessions/SQLite, private logs or raw diagnostic payload.
- Local-owned append-only unique claim `agent-handoff/receipts/local/OL-20261124-050-claimed.md` and done `agent-handoff/receipts/local/OL-20261124-050-done.md`; result `agent-handoff/messages/to-online/2026-11-24-lo050-i3-native-outbox-done.md`. Required done fields (one of each, single token per value):
```text
message_id: OL-20261124-050
from: local
to: online
type: receipt
status: done
scope: OFFLINE_SYNTHETIC_ONLY
verdict: ALL_OFFLINE_PASS
code_sha: d6c51629855caf4b2737049cf4592cc12b912765
related_task: OL-20261124-050
result_message: LO-20261124-050
```
 Substitute a truthful allowed failure verdict if not all gates pass. A PASS requires the actual independent offline cases and full suite green, zero real egress/model/host changes, honest simulation limitations. `ALL_OFFLINE_PASS` is NOT real `I3_PASS`.
- Publish ONLY those three/four owned files from clean report-only worktree via normal FF commit/push on feature branch. Manually review entire staged content; no source/tests/workflow/remote-owned state edits, no forced push/merge. On upstream drift refresh report-only worktree, transplant only own redacted report/receipts, normal FF; no alteration to code pin. If unable to push, report `BLOCKED` with exact reason; do not claim remote ACK.
- Stop after ONE result, no auto retry on ambiguous test outcome or one-shot delivery, no additional local tasks. Remote will independently verify GitHub results and ACK. Original source and historic frozen evidence remain untouched.

Remaining boundary: real operator Weixin account/QR, true provider server idempotency and native send acceptance, consented human peer, real DSH model in integrated I3, real registered Source Apply ACL/dev/inode/fd/capability/journal, production merge/deploy **all require independent future authorization and evidence**.
