# REPORT — C5.4A offline strict-literal hash / fail-closed audit

Code-under-test SHA: `4eb8b432dc8b6b35ef4a240c40411f353d464302` (fresh clean worktree at this exact SHA; includes the remote fix `86edb85 fix(relay): explicit dual-hash literal grant and quarantine mismatched approved selectors`).
**Verdict: `ALL_OFFLINE_PASS` — C5.4B real one-shot remains `AWAITING_NEW_ONE_SHOT_AUTHORIZATION`.** Zero live writes: no restarts, no real Weixin message, no `session/prompt`, no grant creation, no model/profile edits.

## Gate A.1 — exact-SHA offline acceptance: PASS

- GitHub CI on the EXACT code SHA `4eb8b43`: run **42588079717** (`Local-first core tests`, push, 2026-11-09T08:43:59Z) conclusion **success** — jobs `local-first-core`, `dsh-typecheck-and-build`, `macos-portability` all **success**. The fix commit itself (run 42587833456) is likewise green.
- `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (typecheck clean, build ok, Vitest **62 files / 1208 tests passed**, incl. `tests/outbox.spec.ts` at-most-once coverage).
- All relevant standalone Node suites at correct filenames (17 files in one combined run): **115/115 PASS, exit 0** — bridge 14, relay-store 12 (new mismatch-terminal test), relay-routing 9 (3 new V2/quarantine tests), relay-coordinator 7 (2 new near-miss tests), operator-rpc, output, probe, new-workspace, model-gate, operator-provision, projects, project-workspaces 6, weixin-native 6, model-queue 6, existing-dsh-projects, weixin-qr, probe-local-llm script-test 3. Independent HTTP proxy suite: **5/5 PASS**. No failures → `BLOCKED_CODE` not triggered; no local source repair.

## Gate A.2 — V1/V2 grant contract: PASS

Source review + 12 independent synthetic loader checks (owner-only private script, all against the tested SHA's code):
- V1: exactly one `textSha256`; loads with `alternateTextSha256 === undefined`; V1 stays exact (rejects the curly alternate — proven: `V1 rejects curly: true`).
- V2: `textSha256` + exactly one distinct `alternateTextSha256`; both are separately-approved COMPLETE literals — no Unicode normalization, no substring/fuzzy match (`approvedRelayTextMatches` compares full-message SHA256 only). Accepts both preapproved literals; rejects every third variant (changed word, trailing space, changed selector/session, U+2005 space substitution).
- Rejections all enforced by `readNativeRelayApproval`: duplicate alternate hash, malformed (non-64-hex) alternate, missing alternate on V2, non-prompt V2 (`bind`), unsupported version (3), non-0600 file mode, missing `operatorApproved:true`. `messageToTrigger` preserves actual incoming text verbatim (`text` = received string, no normalization).

## Gate A.3 — literal quote pair: PASS

Synthetic two-line input with ASCII `"` and the matching curly `“…”` pair: V2 accepts exactly these two full literals, nothing else; V1 rejects the alternate. Changed task word, selector, Session, suffix, Unicode space, unauthorized peer all non-dispatching (routing suite + synthetic run).

## Gate A.4 — near-miss quarantine: PASS

`isApprovedRelayTextMismatch` quarantines ONLY an active approved peer's exact `/project <approved-alias>` selector attempt with fresh grant and catalog-bound session; on mismatch the coordinator persists one-shot consumed approval + durable `not-submitted:text-hash-mismatch` terminal (sanitized, replay-protected: a reserved pre-prompt receipt cannot be marked, a terminated grant cannot be re-reserved), sets `fanout:[]`, enqueues nothing (no Ticket), queues no effect, sends no Outbox reply — no false-success acknowledgement; a follow-on message under the same grant does NOT re-arm. Unrelated normal user messages and other peers return `false` → unchanged Engine routing. Duplicate inbound and restart persistence covered by the store test (durable SQLite). Absent catalog ⇒ no quarantine. No fuzzy similarity anywhere. The C5.3 misleading-reply hazard is closed: the quarantined message never reaches the Engine.

## Gate A.5 — regression: PASS

C5.3 guarded Outbox at-most-once claim: `claimOneShotSend` persists `singleSendAttemptAt` in durable SQLite BEFORE `sources.send` for guarded `dsh-3080-reply-<40hex>` ids; consumed claim returns silently (no resend across retry/restart); outbox.spec.ts regression tests pass in the 1208. 3080 bridge unchanged: page preflight (`throughSeq` safe-integer bounded cut), `requestId` correlation, local-only route, mandatory pre-send receipt persistence (`receipt_persistence_required`) all intact and green in the 14-suite bridge tests.

## Gate B — read-only host invariants: PASS (reconciled by identity, not totals)

- Listeners/pids unchanged since before C5.3: 3080 pid 1482 (`*:3080`), 3083 pid 34295 (`127.0.0.1:3083`) launched from the ORIGINAL dsh checkout with ZERO `DSH_SUPERAGENT_*` env vars (relay default-OFF), 8123 pid 90215 (`127.0.0.1:8123`).
- Original global default unchanged: `agent-default-model` rev **17** = `cmp170hx / Qwen3.8-Flash-Next / xhigh`.
- Disposable Workspace→Session identity verified: cursor 3, idle, `queue:[]`, `pendingInput:[]` — gained nothing; its sequenced `next` selection was verified in C5.3 (`llm-local-proxy/Qwen3.8-Flash-Next/high`) and no new grant exists.
- Durable relay state: `dsh_relay_approval` holds ONLY the old consumed C5.3 row (trigger `ba83f806…`); receipts 0, terminals 0, effects 0, outbox 4 (3 historical `sent` + the 1 Engine-path reply from C5.3), triggers 9. C5.3's session-total increase was attributed to unrelated operator activity by identity; no anomaly found.

## REAL 3080 PROMPT / REAL RELAY INFERENCE / REAL WEIXIN RETURN: NOT RUN

No live grant was created (C5.3's grant is consumed/finished and may never be reused); C5.4B requires a NEW independent human one-shot authorization (preferred: short quote-free message with explicit private alias + alphanumeric confirmation marker, verify clipboard/Weixin-rendered bytes before grant creation; V2 dual-exact-hash allowed only if the device is proven to change quote glyphs; never canonicalization/fuzzy hashing).

## Zero-write proof

No restart (pid set identical to pre-C5.3 restoration), no `session/prompt`, no model selection change, no profile/default edit, no SQLite write from this agent (all live reads via private 0600 read-only scripts), no Weixin message sent or received by the agent, no new grant/pairing. Offline work occurred only in the fresh worktree's own `node_modules`/tmp.

Sanitized: no raw chat content, IDs, credentials, tokens, or private paths published; synthetic example hashes above are owner-only examples, not real grants.
