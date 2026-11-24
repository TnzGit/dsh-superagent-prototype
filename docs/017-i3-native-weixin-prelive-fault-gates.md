> **CURRENT update 2026-11-24:** The table below is the original *pre-fix finding*, NOT the current code state. Remote source/tests/workflow pin `d6c51629855caf4b2737049cf4592cc12b912765` resolved synthetic R1/R2/R3 and bounded R4/R5, CI #821/#822 both 3/3, with 1284 full Linux Vitest and 83 focus tests on EACH OS. See `docs/018-i3-native-weixin-outbox-review-runbook.md` (unlinked text to preserve numbered-document ordering). `OL-20261124-050` is pending operator-initiated OFFLINE Mac independent retest; this public doc does not authorize execution. R6 genuine iLink/host, real sender/peer consent, server idempotency, original Apply and manual reconciliation action remain gated.

# 017 — Native Weixin I3 pre-live fault gates (source review, not live authorization)

**Date:** 2026-11-24. **Scope:** remote-only source/security review and synthetic testing; **NO real iLink/QR/credentials/peer send/8123/3080/3083/registered-source Apply**. No new local task. PR #1 DRAFT, remote automation PAUSED, `no_auto_dispatch=true`.

## Verified anchors and non-claims

- Independent OL-049 Mac offline report and online ACK: `agent-reports/REPORT-ol049-i3-unified-fake-vertical-offline.md` and `agent-handoff/receipts/online/LO-20261124-049-done.md`. Pinned source `df9757b3acd7ba2a5e234264a6c607c024858a79`, CI #780/#781 and local done CI #791/#792 all 3/3. Fake poll→Engine→Ticket→mocked DSH Agent Worker→review-ready→real application SQLite Outbox **pending, Source OFF** is accepted **only** offline.
- Post-ACK remote code `6d69a794d08a742a39e62a5c6d3bef508fc3f9c9` plus task-sentinel fix at `676bc321ae33bc691b64d17f90a9789f5683a2b3`; source Actions push #797 (45321974373) and PR #798 (45321979189) each 3/3 SUCCESS. Three new fake polling regressions check live peer revocation during getupdates, Source disable during long poll without cursor commit, and async route revocation before Engine; 17 fake poll tests, full Vitest 1269, Node 255, focus 44, proxy 5. These prove offline behavior, **not** a real account.
- Historic OL-047 genuine I2 is a separately accepted bounded macOS synthetic-COPY model-driven edit and UNSENT Outbox; it does not close I3.

## Source-grounded remaining risks (must be resolved before real I3)

| Gate | Current implementation/evidence | Required independent offline proof |
| --- | --- | --- |
| **R1: ambiguous outgoing delivery** | `src/app/outbox.ts` claims a durable one-shot BEFORE HTTP only for C5 relay reply IDs matching `dsh-3080-reply-[a-f0-9]{40}`. `tests/outbox.spec.ts` explicitly proves **ordinary** native Weixin replies retry a thrown send. `clientMessageId()` is stable, but server idempotency was NOT verified. | Specify and implement a fail-closed one-shot/native idempotency policy for **every** Weixin outbound kind, incl. acknowledgement and reply, without pretending a timeout means definitely unsent. Test mocked installed Source, crash/restart, ambiguous response, real receipt status and zero second send. Do not simply widen the regex without evaluating credential-not-ready behavior, delivery health and manual reconciliation. |
| **R2: token/account rotation and pending Outbox** | `pollNativeWeixin` resets **inbound cursor** upon credential token-hash change; an older pending reply contains a peer/contextToken but no attested account binding. | Synthetic A→B account rotation: old A outbound must never be delivered using B credentials, even if peer IDs overlap. Bind account identity at intake/receipt and revalidate at send; never publish real account token/hash. |
| **R3: context expiry and late replies** | `nativeWeixinKind.channel.send` drops expired `address.expiresAt`, but generic `messageToTrigger` only includes `contextToken` and optional expiry is not universally stamped. | Define conservative context validity rules; test expired/invalid/absent metadata under a fake clock, manual-review disposition and no network call for stale replies. Official real-token lifetime remains unverified. |
| **R4: current-authorization race** | Fixed post-ACK: poll re-reads Source config before route, after async route before Engine, and before page cursor commit. | Existing 17 fake cases verify bounded cases. Still treat non-cooperating auth/config changes during an already-running side effect as a separate cancellation/rollback design issue. |
| **R5: credential file path trust** | `readNativeCredentials` performs `lstatSync(path)` then `readFileSync(path)` separately, with owner-only mode check. These separate path operations do not constitute no-follow fd identity proof against concurrent path replacement. | File-descriptor `O_NOFOLLOW`/fstat verification on supported OS, ownership and parent-directory threat model, synthetic symlink/replacement tests. No real credentials in tests. |
| **R6: real iLink/host evidence** | CI/fake HTTP cannot attest real Tencent 401/429/5xx/-14, response accepted by `sendmessage`, account QR or local actual DSH model turn in the same native vertical. | Only under a **separate narrow operator-owned live grant**: exact approved account+peer, bounded one-shot response, original service/session/source bytes invariant, host OS/network guard, no cloud, private audit and recovery. Never infer this grant from public repo text. |

## Safe next implementation sequence

1. **Remote-only** write an installed-`weixin` fake Source Outbox harness with new disposable SQLite, injected send adapter and fake-clock; cover reply and acknowledgement, ambiguous throw after simulated accept, durable claim across reopen/replay, source disable and peer revoke, and ordinary Feishu retry unchanged.
2. Add synthetic account A/B rotation + expiry negative cases for saved channel tokens and delayed Outbox receipts. Require exact settled/held/ambiguous statuses, not a shallow mock invocation counter alone.
3. Propose a backwards-compatible at-most-once/idempotency contract and explicit user-visible manual review for ambiguous results; do not silently mark potentially delivered messages `sent`, and do not auto-resend.
4. Independently gate a real I3 run only after the operator makes a specific high-impact decision, with verifiable receiver consent/secret boundaries. **No task or real action is dispatched by this document.**

## Separate source Apply gate

Actual registered project writes remain blocked by `agent-handoff/REAL_APPLY_GATES.md` (ACL-aware rooted fd/dev/inode identity, external writers, private transaction capability, durable journal/reconciliation). Even full real I3 would not automatically enable Apply.
