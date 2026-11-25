# OL-20261125-053 — Controlled Real I3 + Real Registered Apply (LIVE_BOTH_PASS)

Sanitized local report. No real host paths, peer IDs, message texts, cursor values, account
hashes, tokens, session content, raw logs, or Seatbelt configuration appear here; raw evidence is
held only in the local private vault.

## 1. Handoff validation

- Task `OL-20261125-053`, scope `OPERATOR_AUTHORIZED_CONTROLLED_LIVE_I3_AND_APPLY`,
  `code_sha b6b6fc1ffd40ff4082d8488a2ed68aeb811f6ab3` (ACK HEAD of OL-052), dispatch HEAD
  `6d525b084de8dc4472d7fde1d027da119e00622a`. Sole active task in `STATE.json`; no prior OL-053
  receipts; dispatch diff vs baseline verified docs/test-only (15 files, zero src/.github/package/
  lockfile changes). Dispatch CI #855 (run 45565776497) and #856 (45565788058) independently
  re-read: all three jobs completed/success on both events.
- Claim was unique at `8782db4e359f36bd6ae46207cb03dc1286f79f38` (claimed receipt pushed FF from
  `6d525b0`). Operator authorization recorded in the private vault (`DIRECT_OPERATOR_CHAT_2026_11_25`,
  L0–L5 autonomous, ≤3 concurrent subagents).

## 2. Development track (offline, three subagents, merged by the lead)

- SubA (test-only): iLink adapter classifies HTTP 401/429/5xx and refusal bodies deterministically;
  Engine-intake peer-allowlist boundary; registry send gate; durable ambiguous-send freeze for every
  uncertain response; review-reason sanitization. Commits `93b3d2f`, `cc33d87` (tests only).
- SubB: durable receipt / review-hold / replay invariants (+6 Vitest cases) and a new fail-closed
  registered-root identity gate — `createProjectSnapshot` and `verifyProjectSnapshot` now call
  `registry.assertRegisteredRootIdentity()`, closing the same-path ABA hole where a look-alike
  replacement directory (fresh inode, identical path fingerprint) previously passed the gates.
  New node suite `tests/local-project-snapshot-identity.node-test.mjs` registered in BOTH workflow
  node lists. Commit `5eac3c8`.
- SubC: separate descriptor-relative no-follow native Apply helper (`research/real-apply-helper.c`,
  1130 lines) + one-use capability driver (`src/local-first/real-apply-native-driver.ts`, 506 lines)
  + 24 adversarial tests. Commits `13e986f`, `884818a`, `833db8d`.
- Lead merge (workflow node-test list conflict resolved by union): `324325e` = FINAL IMPLEMENTATION SHA.
- Verification at merge HEAD on the actual operator macOS (macOS 26.3 ARM64, clang 21, Node 25.9.0):
  CI-exact 29-file node list **310/310** (exit 0; both new suites executed: helper 14 + capability 10);
  focus Vitest set **156/156**; FULL Vitest **71 files 1357/1357** (exit 0); `pnpm check` exit 0;
  proxy node test 5/5. Helper compiled with `-std=c11 -Wall -Wextra -Werror -O2` clean.

## 3. Real I3 pilot (L1 + L2) — genuine end-to-end

Fresh disposable staging guest (0700 temp tree, detached checkout of the claim HEAD, own profile +
trusted-controller harness), booted under OS-level sandbox isolation (Seatbelt) with a read/write/
execute/network matrix proving: guest-internal writes allowed; writes outside the guest (system temp
alias, home) DENIED; private-vault and real-workspace reads DENIED; child processes inherit the
confinement; network default-deny with only the local model-route port and 443/TLS + DNS open
(mDNSResponder service lookup required for resolution — recorded). One recorded limit: a symlink
target's CONTENT inside the guest is readable even when the target lives outside (write still denied).

- Boot A (no inference): Router attestation exactly `orchestrator_read` + `orchestrator_route`,
  read-only preset, durable `never` approval policy incl. override; live iLink long-poll connected
  under the sandbox; source configured and the allowlisted peer resolved. `BOOT_A_PREFLIGHT_OK`.
- L1 REAL inbound: the operator personally sent one real WeChat message (agreed command form) from
  their own consented self-peer. The staging guest's live iLink long-poll ingested it as a genuine
  Trigger with real context token and real account binding (discovery verified via the guest DB;
  gate strength `explicit` through the allowlisted addressed sender). Unexpected-inbound guard: none.
- L2 ONE genuine inference boot: trusted pre-inference controller decided exactly ONE Ticket
  (real message → real execution binding → isolated snapshot copy populated BEFORE any launch),
  ensured + attested the Worker Session BEFORE any model step (0 requests, 0 tools pre-release),
  then released. First worker request/header carried exactly the 11 attested tool names
  (`HEADER_PROOF bound=true`). The genuine local model turn (isolated local OpenAI-compatible queue
  proxy → local inference service, same model family as the conversation's own route) ran the REAL
  native `edit` tool in the isolated snapshot copy: 6 tool calls total
  (`glob → read → orchestrator_ack → edit → read → orchestrator_report`), ticket ended
  `outcome=completed by=executor`, worker report contains the real diff swapping the fixture marker
  in the isolated copy only. The disposable source README/notes remained byte-identical (verified
  digests). Budgets enforced host-side: 2 model requests (≤6), 6 tool calls (≤10), live ~29s (≤15m),
  one-boot latch (REQUEST-count ledger across boots; a live boot is refused once any recorded boot
  made a request).
- REAL sends: both the acknowledgement and the correlated result were delivered through the REAL
  iLink `sendMessage` API and durable receipts reached `status=sent` (2 of ≤3 outbound allowed,
  unique immutable client message IDs, zero auto-retry). The operator's device received the
  acknowledgement.
- Boot 1 failure recorded honestly: the first live boot died on an upstream 502 — the test proxy's
  upstream inference host had gone offline (TCP closed) BEFORE any token was produced. The failure
  happened after the real ack send, before any model step completed. The operator explicitly granted
  a re-run (with additional budget) and the second boot passed as above. The frozen first boot's
  counters/evidence remain in the private vault; the latch was re-armed only under the operator grant.

## 4. Real registered Apply (L3 verification + L4 operand) — genuine durable mutation

- L3: the native helper's design closes the path-based TOCTOU windows that the existing Node apply
  primitive cannot: the root fd is bound to the canonical registered project dev/inode; every path
  component is opened via `openat` with `O_NOFOLLOW`, pinning each intermediate inode across a
  same-name ABA rename; the target is verified through its OWN fd and the preimage is re-verified
  through the same fd immediately before the write; the write is staged + `renameat` relative to the
  pinned parent fd with journal fsyncs at each step. Adversarial acceptance (24 tests) proves:
  symlink at every level refused; hardlink/setuid/group-writable/fifo/socket refused before write;
  preimage hash/mode/mtime drift caught immediately before write; leaf-entry ABA refused; external
  non-cooperating concurrent writer → AMBIGUOUS with zero repair; crash injection at EVERY journal
  step via real child SIGKILL classified honestly; stale/forged/expired/wrong-principal capability
  refused; consumed-on-use marker enforced; ambiguity freeze blocks later ops. Honest residuals
  (writer quiescence is external; ancestor swap above the pinned root and mount changes not
  defeated; kill-injection is not power-loss proof; same-user forgery; frozen approvals trust
  registration at issue time) are documented in the helper header and tests.
- L4 operand: ONE bounded genuine Apply on an operator-owned REAL registered project (the operator
  personally chose "new dedicated real test project" as the operand; a fresh git repo with two
  ordinary text files, both ≤8 KiB combined, modify-only, no deletions, no secrets/DB/system paths).
  Registry binding proven through the private registry file (0600, absolute root, mode check).
- Execution (all recorded in the private budget ledger, 8 lines):
  1. Preimage observed through the helper's own read-only `inspect` (fd-pinned view): digest, bytes,
     mode, inode, nlink=1.
  2. Private backup created BEFORE any mutation, fsynced, digest independently verified equal to the
     preimage.
  3. ONE live transaction capability issued (bound to principal uid, project identity, exact sorted
     file list, plan digest, nonce, expiry 300s) and consumed exactly once; a second verification
     attempt refused with the consumed-marker error (no silent retry proven).
  4. The audited helper invoked ONCE: `APPLIED`; journal `status=applied` with the full digest chain;
     target content matches the after image; mode unchanged (0600); inode change is by design
     (atomic rename).
  5. ROLLBACK (separate measurement, SEPARATE one-use capability): restored byte-exact original
     (digest == backup == preimage) with the original mode.
  6. Read-only recovery classification on both transactions: apply tx `PREPARED_CRASH` (its journal
     says applied; classification reflects the target matching the BEFORE image after the later
     rollback), rollback tx `APPLIED`; never repaired, never guessed.
  7. Second file untouched; project git status CLEAN after the full round-trip.

## 5. Zero-drift sweep + environment safety

- Model default untouched (production profile route unchanged); production SQLite untouched (the
  live test-home DB was restored to its baseline cursor value, JSON-quoted storage format — a bare
  string is rejected by the live code).
- Live 3083 test orchestrator: previously stopped by the lead to free the iLink cursor for the
  staging guest, then relaunched with the SAME binary/env shape as its baseline (the newer-checkout
  harness binary; the installed CLI is a v4 log reader and fails on v5 session logs). Executor pause
  preserved (state `paused: true`, `runtime ready`, weixin long-poll connected again, github
  sourceOff, load 0/0/3).
- Recorded honest drift: the live DB trigger count grew 11→12 — the staging pilot's real message was
  re-ingested by the restored live poller (same account, cursor restored to the baseline value),
  stored while paused: zero tickets created, zero new outbound sends. Outbox rows unchanged (5, all
  previously `sent`).
- Services: 3080 GUI untouched (200), 8123 test proxy re-pointed upstream once (offline host →
  current route host) under the operator grant, key from the local proxy client-key file; model
  proxy still localhost-only.
- Disposable trees (staging guest, integration, frozen boot) are task-owned temp and removed after
  publication; raw evidence retained in the private vault only.
- No real WeChat production bot enabled, no cloud model used, no production deploy, no PR merge,
  main branch untouched, PR #1 kept Draft.

## 6. Verdict

`LIVE_BOTH_PASS` — real iLink inbound (genuine trigger with real account binding, gate strength
explicit) + genuine model turn with real native edit + real report + durable human-review evidence
(ack/result both really SENT via the real iLink API within the 2-of-3 budget) AND one bounded genuine
registered-Apply transaction with verified private backup, one-use capability enforcement, and
verified rollback on an operator-registered real project. Budgets honored end-to-end.

## 7. Limits / open technical notes for remote

- Same-path ABA gate (SubB) changes fail-closed behavior: operators must re-register after an
  external directory replacement; the runbook line was not updated (SubB scope).
- `reviewResolveDryRun` remains test-only by design (live reconcile gated by docs/018).
- The pilot proves staging-guest I3 with a disposable DB; the live 3083 instance's own send/receive
  integration against the new hardening is still remote-side work.
- Apply helper residual races (documented): non-cooperating same-user writer between final preimage
  check and `renameat`; ancestor swap above the pinned root; kill-injection ≠ power-loss durability;
  same-user capability forgery; registration-time trust for frozen approvals.
- Real I3 pilot used 2 of 3 outbound; a third message would need fresh operator consent.
- The live-poller re-ingestion drift (12th trigger) shows cursor semantics: long-poll ownership is
  single-holder per account/cursor; concurrent pollers contend (staging guest owned the cursor during
  the pilot).

## 8. Privacy review

Sanitized: no host paths, no peer identity, no message text, no cursor/account hash values, no
tokens, no session content, no raw logs, no sandbox configuration text; digests of synthetic fixtures
only. The dsh web token URL printed at boot was treated as private and never published.
