# 021 — Installed 3083 acceptance, operator recovery and next stabilization priorities

**CURRENT TASK:** `OL-20261126-055` / root `PLAN-OL055.md` is the new **operator-direct** stabilization/release-candidate handoff. These public paths are informational, not an execution token; 3083 remains paused until a trusted directly initiated bounded run.

**As of 2026-11-26.** OL-054 completed a genuine live round trip on the upgraded **installed operator-owned TEST 3083** and a bounded operator-reviewed REAL registered test-project Apply/rollback. Exact proof classes and private limits are in `agent-reports/REPORT-ol054-installed-runtime-private-apply.md` and `agent-handoff/receipts/online/LO-20261125-054-done.md`. These file paths are written as code spans to preserve numbered docs' no-lateral-link invariant; they are not host authorization.

## Running service and observed deltas

- Installed 3083: merged implementation `d9d7e3e488fab500a5f57cc64952455ce1cbd0f5` bundle, operator-owned launch manifest CAS, native iLink long poll connected, `paused:true`, runtime `ready`, owner-private poll lease. Old bundle link + original profile patch retained for protected `cutover.sh rollback` procedure; **rollback was NOT executed** on original 3083. Keep pause state unless a new deliberately bounded test needs a supervised temporary unpause.
- Original 3080 GUI and 8123 model proxy remain in their prior default configuration according to local attestation; 8123 unauthenticated 401 does not prove provider routing without private checks. No main merge, no general deploy.
- SQLite **intentional** deltas: triggers **12→14**, Tickets **0→2** (both terminal), Outbox **5→8** (all terminal `sent`), KV keys **18→22**. Historic OL-053 pending trigger was terminal-classified by private operator route; row preserved, no automatic re-execution. Never restore M0 backup over active new data without an explicit frozen maintenance/recovery plan; backup is for verified disaster recovery, not silent rewind.
- Old OL-054 message/model/Apply attempt budgets are all CONSUMED (3/3 outbound, 2/2 model sessions, one Apply and one separate rollback). Never treat the former task or server receipt IDs as reusable.

## Private operator-facing controls

- Native Weixin poll owner must be **one per account**. The implemented lease uses an OS-backed SQLite write transaction and fencing generation in a protected account-scoped directory next to the real credentials file. Do not run an overlapping staging guest for that account. Readiness plus a lease directory alone is not proof of exclusivity against same-UID malicious file substitution or mount rebindings.
- The operator reconcile route uses a private `0600` token file and returns a sanitized receipt ledger. It supports terminal `no_resend` or independently evidenced `confirmed_sent`, never claim reset or automatic resend of an ambiguous HTTP response. The token authenticates **possession** only, not a named human. No real ambiguous-send peer outcome was deliberately provoked in OL-054.
- The current 3083 executor should stay paused except for an operator-scoped task. Unexpected new Ticket/outbound while paused is an incident; freeze claim and preserve private evidence rather than auto-retry or erase it. The source account/peer allowlist and immutable claimed receipt must still be enforced at final send.

## Apply boundaries

- `src/local-first/real-apply-operator-connector.ts` creates an exact 2-file / 8KiB no-deletion reviewed plan, with registered dev/inode+ancestor binding, private review marker, separate one-use capability and rollback. Feature gate `DSH_SUPERAGENT_REAL_APPLY_ENABLED` remains OFF by default. The real operator-chosen test project was returned to original bytes and modes; no blanket production project write is enabled.
- A trusted operator must **re-register the target** after intentional root or ancestor replacement and issue an entirely new Ticket/snapshot/preview/capability. Old identity evidence must remain invalid. An unrecognized replacement remains blocked.
- The native helper pins path components with fd-relative `openat`, verifies preimage before `renameat`, and journals steps; it cannot prove non-cooperating same-UID writer quiescence between final verification and rename, or full power-failure durability from SIGKILL tests. Same-UID ability to forge owner-only markers is an integrity limitation. Do not advertise 'race-free' or unconditional production safety.

## Next engineering milestone, not repeat of completed pilot

1. Crash consistency: remove the SQLite commit vs separate file fsync divergence for operator terminal classification and reviewed receipts, or implement deterministically sound startup recovery/repair with authenticated proof and no resend. Fix journal file open modes, fd lifecycle, append-only controls and failure rollback/error handling; test truncated tails and symlink/owner swaps.
2. Long-term replay: demonstrate semantic idempotency after >2000 seen-set evictions, cursor replay, account swap and installed version rollback, with explicit privacy-safe bounded storage and storage growth policy. Make account-scoped poll lease robust against same-UID lease DB substitution or document and enforce a stronger process trust boundary.
3. Operator ergonomics: loopback-private management UI with straightforward pausing, lease holder/paused/executor status, redacted pending/review holds, safe receipt classification, documented installed cutover/rollback dry-run and backups. No arbitrary shell, no generic send/apply without exact target approval.
4. Apply trust: narrow same-UID writer and cap-forgery risk by OS containment or a small separately privileged/sandboxed approval helper with exact allowlists. Test crossing mount/ancestor changes, same UID hostile actors, crash points, and recovery without rewriting personal projects.
5. Product acceptance and release readiness: supervised tiny-canary restart/rollback on a **separate clone** first, optional operator-owned test 3083 health-only rollback, then return to paused+ready with no old message replay. Draft PR review, documented local installation/update path, and explicit pass/fail per risk; no automated main merge/broad deployment.

**Operational priority:** keep the tested 3083 available/paused, do not send again using OL-054 IDs/budget, and preserve the private backups/journals until a verified new scoped recovery plan is completed. Public GitHub text never supplies local execution authority.
