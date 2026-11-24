# OL-20261124-052 — ONE autonomous multi-phase OFFLINE batch (P0–P5) — sanitized report

**Verdict: `ALL_OFFLINE_PASS`** (scope `OFFLINE_SYNTHETIC_ONLY`; this is NOT real `I3_PASS`, NOT
`I2_STAGING_PASS`, NOT production Apply). Baseline start SHA `781b27df169f3a05bd4c3bb82ac62dfbd327ab7d`
(done-push CI #841 run 45398788961 / done-PR CI #842 run 45398799703 each 3/3). Final implementation
SHA recorded below with cross-OS CI at that exact SHA.

Operator launch: the operator directly forwarded the matching HANDOVER prompt at handoff HEAD
`1b58a3820f5dfb7e33840d3377bb8111ee397965` (public text is not the execution authority). Claimed
once (`agent-handoff/receipts/local/OL-20261124-052-claimed.md`, commit `597832f7ec22ab606da0716349427051566e8050`).
The batch ran with up to 2 live subagents (third failed twice with zero commits; lead took over its
P3/P4/P5 scope itself), lead-only integration and push, all offline.

## 1. Integrated commit chain (feature branch, ordinary non-force FF)

- `597832f` docs(handoff): claimed receipt (P0 baseline: STATE.json, TASK.md, baseline→HEAD diff =
  12 docs-only files, done CI #841/#842 + source CI #835/#836 all 3/3 at exact SHAs).
- `026f42d` fix(i3): capped strict-UTF-8 streaming response read + no-follow credential ancestor preflight (subA, P2).
- `a4d79db` test(i3): P2 fake-transport fault matrix on the native poll loop (subA).
- `b1558a7` test(i3): protocol-level fake-transport fault shapes in the node test runner (subA).
- `6a38537` test(i3): credential ancestor-path threat tests, egress tripwires, TTL ceiling assertions (subA).
- `4c262c4` merge(ol052): integrate subA (lead).
- `87c3791` feat(outbox): read-only operator review ledger + test-only dry-run resolve projection (subB, P1).
- `874726e` test(outbox): OL-052 P1 synthetic fault injection + anti-regression suites (subB).
- `a06d86e` merge(ol052): integrate subB (lead).
- `70bb867` test(ol052): P3+P4 offline integration — native fake-delivery vertical, synthetic-copy
  apply threat matrix, CI list + readiness matrix (lead, P3/P4/P5).
- `b9d8fb76910ee382c98bc8fba2ee1490a34d871e` test(i3): platform-aware realpath sanity check —
  **final implementation SHA** (fix after the first Linux CI failure; see §4).

Touched in-scope files (15 in `70bb867` + 1 in `b9d8fb7`): `.github/workflows/local-first-core.yml`,
`docs/007-architecture.md`, `docs/019-i3-prelive-readiness-matrix.md`, `src/app/store.ts`,
`src/local-first/weixin-native-protocol.ts`, `src/sources/weixin-native.ts`, `tests/fixtures/host.ts`,
`tests/local-nongit-copy-apply-threats.node-test.mjs` (new), `tests/local-vertical-native-fake-delivery.spec.ts`
(new), `tests/local-weixin-native.node-test.mjs`, `tests/outbox.spec.ts`, `tests/registry.spec.ts`,
`tests/weixin-native-outbox-offline.spec.ts`, `tests/weixin-native-poll-offline.spec.ts`,
`tests/weixin-native.spec.ts`. No dependency, lockfile, or binary changes. No remote-owned
`STATE.json`/`WORK_QUEUE.md`/`CURRENT_STATE.md` edits; old receipts untouched.

## 2. Phase results (all synthetic; SIMULATED, never real)

- **P0 baseline** — PASS. Claim once after independent verification; baseline CI green at exact SHAs
  (#841/#842 at `781b27d`, #835/#836 at `f0179c7`, #843/#844 at handoff HEAD `1b58a38`); baseline→HEAD
  diff verified docs-only.
- **P1 Outbox/review-ledger + operator review contract** — PASS (subB, integrated). Read-only
  aggregate review ledger on the loopback state view; reason allowlist at write and read with
  `unclassified_hold` redaction; same-Ticket backpressure semantics verified (a reviewed row has no
  retry effect and blocks later replies indefinitely; bounded release applies only to outright-failing
  rows); mutating resolve exists ONLY behind a hard test-only dry-run flag with no-send + audit
  fields; live Outbox resolve/resend stays GATED. `tests/outbox.spec.ts` 11→24,
  `tests/registry.spec.ts` 11→14, standalone ledger node tests 62→64 (fence+backpressure layers from
  earlier milestones re-verified).
- **P2 native transport / secret-path hardening** — PASS (subA, integrated). Capped strict-UTF-8
  streaming response read; no-follow ancestor preflight for the credential final file; fake-transport
  fault matrix (timeout/EOF/HTTP error/malformed JSON) on both the Vitest poll loop and the node
  runner; egress tripwire (abort-on-egress fake fetch) proven; TTL ceiling asserted as an
  application cap, explicitly not an official provider lifetime.
- **P3 integrated fake native vertical** — PASS (lead). New
  `tests/local-vertical-native-fake-delivery.spec.ts` (10 tests): fake `getupdates` → real
  `pollNativeWeixin` → real Engine intake → Ticket → disposable Worker copy with mocked deterministic
  agent (zero real model turns) → installed native Source → durable SQLite Outbox → fake
  `sendmessage` acceptance AND accepted-then-EOF ambiguous path → receipt review/sent. Covers
  duplicate input, double queue, source-off→on, peer revoke, review blocking a subsequent reply,
  app restart replay over the same disposable SQLite, account swap, stale context, poll faults.
  Fixture extension in `tests/fixtures/host.ts` (workspace registry with `resolveByPath`, session
  `header.cwd`) mirrors the existing worker-boundary pattern. Key finding during authoring: a fake
  `fetch` resolving in a microtask starves the poll loop's interval timers; the fixture yields a real
  macrotask per poll. The earlier vertical stopped at Source-OFF; this closes the specific installed
  fake-delivery gap without claiming any real LLM or real Tencent operation.
- **P4 synthetic-copy Apply/containment/recovery** — PASS (lead). New
  `tests/local-nongit-copy-apply-threats.node-test.mjs` (14 tests) on a fresh original-free 0700
  fixture COPY: concurrent external writer fail-closed, interrupted-apply (journal stuck `applying`)
  blocks new applies and reconciles via an independent rollback grant, durable original before-image
  journalled (verified against the preview's Git blob OID), symlink traversal denial, hardlink
  shared-inode drift, fresh-inode worker drift vs the digest gate, mode-only change apply + exact-mode
  rollback, missing journal, replay-after-settle refusal, expired/foreign grant (mid-await
  revocation), apply lock never auto-stolen, rollback refusals (symlink/hardlink/special-mode),
  journal-overlap refusal. Explicitly distinguishes PROTOTYPE CONTRACT safety from registered
  production Apply safety; no production Apply enable switch was added.
- **P5 release readiness / CI parity / runbooks** — PASS. Single readiness matrix
  `docs/019-i3-prelive-readiness-matrix.md` (proved synthetic behavior → test evidence, GATED real
  gates, specific future operator actions, safe-vs-forbidden human actions); architecture test table
  updated; PR #1 preserved DRAFT/unmerged.

## 3. Local test evidence (Mac, actually-run counts)

- Full Vitest: 71 files **1342/1342** exit 0 (baseline 70/1288; batch +1 file, +54 tests).
- CI-exact Node list (26 files incl. the new P4 file): **279/279** exit 0 (baseline 255; +24).
- Workflow focus set (11 named specs) + the new vertical: **151/151** exit 0; the 11 named specs
  alone: **141/141**.
- New P3 vertical alone: 10/10. New P4 matrix alone: 14/14.
- Queue proxy (timeout-free on this host; `timeout` binary absent): **5/5** exit 0.
- `pnpm check` (typecheck + full test + build): exit 0.
- Standalone ledger node test: 64/64.

## 4. CI parity and the one honest failure

First implementation SHA `70bb8674a755e9e97e2be7ae3f5cff18e5f43f4c`: push CI #847 (run 45489760538)
and PR CI #848 (run 45489771572) came back **2/3**: `macos-portability` 3-success but
`local-first-core` and `dsh-typecheck-and-build` failed on ONE assertion — subA's realpath sanity
check `expect(realpathSync(tmpdir())).not.toBe(tmpdir())` passes on macOS (where /var is a symlink)
but Linux runners resolve `/tmp` to itself. The Mac-local suite had never exercised that Linux
assumption. Fix committed forward as ordinary FF `b9d8fb7` (platform-aware: assert resolution
success on Linux, differ-on-macOS). Final cross-OS CI at exact
`b9d8fb76910ee382c98bc8fba2ee1490a34d871e`: [push CI #849](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45490329402)
and [Draft-PR CI #850](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/45490346681)
each **3/3 success** (local-first-core, macos-portability, dsh-typecheck-and-build on both OSes).

## 5. Privacy review

Every staged path and commit message was reviewed: synthetic tokens/peers only (`SYNTHETIC_*`,
`peer-alice`, `ol052-*` IDs), no real host paths, no personal names, no PIDs, no real credentials,
no real peer tokens, no production SQLite content, no raw logs, no Seatbelt private config, no
binary blobs. No force push; no new dependencies; lockfile untouched.

## 6. Remaining GATED external work (none simulated as authorized)

Real QR/sender consent and account identity; real Tencent semantics (token lifetime, `client_id`
idempotency, 429/-14, accepted-then-EOF ambiguity); real model turns; host auth policy/exposure;
live Outbox reconciliation (only the read-only aggregate exists; mutating resolve/resend forbidden);
registered-production Apply (same-user marker forgery, cross-root fencing, PATH ABA, OS TOCTOU,
external writers, Proxy traps, private transaction authority and backup/recovery remain documented
limitations); original host state untouched (3080/3083/8123, real Weixin, production SQLite, model
defaults, Session Prompt, historical grants, real Apply/Rollback all verified unchanged).

No OL-053 was created; remote scheduler remains `PAUSED_BY_OPERATOR` / `no_auto_dispatch=true`;
the online owner independently verifies and ACKs once.
