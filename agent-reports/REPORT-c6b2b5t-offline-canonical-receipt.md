# REPORT-c6b2b5t — OL-20261113-027 independent Mac canonical synthetic receipt acceptance

Verdict: **ALL_OFFLINE_PASS**

## A. Environment
- macOS 26.3 arm64 (Darwin 25.3.0), Node v25.9.0, pnpm 11.7.0 (host toolchain, matches CI macOS leg Node 25).
- Independent detached disposable worktree at pinned source `bc2d87c143dcbd8c4f96014888e536fff5fa2ef2` (NOT the installed/live DSH). Claimed once at dispatch HEAD `4f4da35ef140f09ac6ef633785ab7ebfabb817bd` (claim commit `da5ca0e`).
- All writes confined to owner-private 0700 synthetic tmp fixtures (`dsh-project-synthetic-*`, `dsh-ledger-synthetic-*`). Live host untouched: 3080/3083/8123, Weixin, original DSH Session Prompt, production SQLite, provider/model/credentials, historical grants, real registered projects' Apply/Rollback.

## B. Independent local runs (sanitized; exact commands = CI workflow commands)
| Step | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Done in 1.2s |
| `pnpm check` | 0 | Build complete (1600ms) |
| CI-exact 23-file Node suite (incl. `tests/local-nongit-synthetic-approval-ledger.node-test.mjs`) | 0 | **227 tests / 227 pass / 0 fail** (~5.6s) |
| `tests/local-openai-queue-proxy.node-test.mjs` | 0 | **5 / 5 pass** |
| standalone ledger suite | 0 | **45 / 45 pass** incl. ✔ `synthetic inspection rejects duplicate JSON keys without rewriting receipt` |
| `pnpm vitest run` | 0 | **62 files / 1208 tests pass** |
| bounded adversarial harness (`preflight_acceptance.mts` at pinned SHA) | 0 | **ok=833 fail=0** (independent count; carried B4C–B5S + R1–R7 + S1–S11 + new T1–T12) |

## C. Source CI cross-check (read-only)
CI #401 run 43418593496: conclusion success, head_sha == pinned `bc2d87c` exactly, 3/3 jobs success (local-first-core, macos-portability, dsh-typecheck-and-build). Job logs independently inspected: Linux leg (ubuntu-26.04) `# tests 227 / # pass 227 / # fail 0`, proxy `# tests 5 / # pass 5`; macOS leg genuinely allocated (Image: macos-15) `ℹ tests 227` + `ℹ tests 5`, and the duplicate-key regression ✔ executed on BOTH legs. Dispatch-vs-pinned diff = 4 handoff/docs files only (LOCAL_AGENT_TASK.md, CURRENT_STATE.md, WORK_QUEUE.md, OL-027 message) → CI evidence valid for the pinned source. Gate A.5: no production callers of the ledger module (scan over src/ + scripts/, excluding module and tests → zero hits).

## D. What bc2d87c adds (source review)
1. Module-private `readPrivateSyntheticJson(file)`: `open(O_RDONLY|O_NOFOLLOW|O_NONBLOCK)` → before-stat guard (`isFile && nlink===1 && (mode&0o777)===0o600 && size<=4096`) → read → after-stat same-descriptor compare (dev/ino/size/mtimeMs/ctimeMs + raw.byteLength) → parse → finally close. Adopted at all three private-JSON marker/pin call sites (fixture binding marker, durable pin, registry binding marker); receipt path unchanged in structure; journal not JSON-read here.
2. `inspectSyntheticApproval` gains a post-parse canonical-text guard: `if(serialized!==JSON.stringify(value)+'\n') throw Error('Noncanonical synthetic reservation')`, inside the blanket catch → user-visible error is `Corrupt synthetic reservation; human reconciliation required`.
3. Canonical writer fact (audited): `reserveSyntheticApproval` runs `normalizeSyntheticReservation` and writes `JSON.stringify({...reservation, journalRoot})+'\n'` with keys in SORTED (alphabetical) order — the canonical reference the guard compares against.

## E. Canonical-acceptance matrix exercised (T-groups, all 0700 synthetic)
- T1 valid canonical receipt ACCEPTED; receipt byte-identical after inspection (read-only); writer serialization verified key-by-key in sorted order.
- T2 duplicate key with trailing same-value `version` (remote's exact regression shape): refused by canonical-text guard; receipt intact (no rewrite, no repair); approval NOT consumed, NOT reusable (`already reserved`); zero new ledger entries.
- T3 duplicate key with differing last-wins value: refused (both canonical-text guard and post-parse version check fire).
- T4 **AUDITED FACT**: key-ORDER permutation is ACCEPTED — JSON.parse preserves insertion order and JSON.stringify round-trips identically, so the guard is order-insensitive; it catches duplicate keys, alternate whitespace, noncanonical numbers — set equality remains the real invariant.
- T5 pretty-printed (alternate whitespace): refused; intact; approval not reusable.
- T6 missing trailing newline AND double trailing newline: both refused; restored canonical form inspects OK on the same inode.
- T7 torn/malformed JSON: refused without rewrite; approval not consumed.
- T8 noncanonical number (`version:1.0` parses valid, canonical `1` differs): refused; raw NUL control char in string (canonical form escapes `\u0000`): refused.
- T9 carried descriptor refusals at bc2d87c: hardlink alias (nlink=2), symlinked hash path (O_NOFOLLOW/ELOOP), weak mode 0644 (exact 0600 required), oversized 4097 (refused before parse) — all without rewrite/repair, target untouched.
- T10 fresh OS child (no cross-process state): duplicate-key receipt refused across the process boundary; restored canonical receipt accepted (`CHILD_REFUSED` / `CHILD_OK`).
- T11 registered synthetic project SOURCE bytes+mode unchanged across canonical refusals (read-only inspection; no Apply semantics).
- T12 **AUDITED DESIGN ASYMMETRY**: the canonical-text guard lives ONLY on the receipt path (`inspectSyntheticApproval`). Marker/pin readers via `readPrivateSyntheticJson` have no canonical-text check — a pretty-printed fixture marker is accepted. Documented as a design fact, not a defect.
- NOT_TESTED (recorded, not PASS): real Weixin/production paths, live DSH integration, 400K-context pressure, real Apply/Rollback flows — out of scope for this synthetic-only dispatch.

## F. Canonical serialization integrity vs cryptographic authenticity
The guard proves the bytes are exactly the canonical serialization of the parsed value (a corruption-detection / duplicate-key defense), NOT an authenticity or signature guarantee. Unresolved residual limits (carried, remote-owned): same-user cooperating in-place forgery (byte-identical or size-preserving rewrite within the inspection window; R4/S8 layers still pass), path ABA (R7), no descriptor-relative root isolation, lstat→open TOCTOU, cross-root generic-reserve fencing absent, markers are integrity evidence not signatures, Proxy traps run user code, no private transaction authority or backup/recovery story, tmpdir is not a sandbox, real Apply gates unproven.

## G. Changes made to the local host this round
None beyond the new worktrees, the GitHub claim/done receipts, the private claim/state files, and `last_head` tracking. Rollback = remove the two worktrees + stop using the report branch artifacts; nothing touched services, credentials, or configuration.
