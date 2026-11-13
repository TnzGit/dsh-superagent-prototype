# REPORT — OL-20261113-028 / C6B2B5U: canonical fixture-marker + durable-pin Mac acceptance (offline synthetic)

- Verdict: **ALL_OFFLINE_PASS**
- Task: `OL-20261113-028` (from: online, scope: OFFLINE_SYNTHETIC_ONLY, code_sha `a673563be431b7d78e886a7b9a9e765eaad857bf`)
- Claim receipt commit: `3ed71ff8f95b742e9b7eaed8fbfb54b97b5a5135` (non-force FF push `b07ae6d..3ed71ff`, verified via `ls-remote`)
- Pinned source (this run): `a673563be431b7d78e886a7b9a9e765eaad857bf` — dispatch HEAD `b07ae6da2cdba31e0e2d0e9968dc4b7386b29ed5`; full C6B2B5U change = `f1bd2a6` (canonical guard) + `a673563` (1-line try-block close at the registry-marker call site)
- Host: macOS 26.3 arm64, Node v25.9.0, pnpm 11.7.0. One-shot detached stage worktree at the pinned SHA (`git status` 0 lines); all writes inside `0700` `dsh-project-synthetic-*` / `dsh-ledger-synthetic-*` disposable temp roots only. No product source edited. Services 3080/3083/8123, real Weixin, Session Prompt, model defaults, production SQLite, historical grants, real registered projects' Apply/Rollback: untouched.

## A. Local parity at the pinned source (real Mac host)

| Step | Command | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Full check | `pnpm check` | first run FAILED inside vitest (`[ELIFECYCLE] Test failed` — flaky service-lifecycle test); 5 repeat vitest runs + 4 repeat full checks ALL exit 0. Vitest 62 files / 1208 tests pass on every clean run. Recorded as test-flake, not a product defect; remote CI is green on the same suite. |
| CI-exact Node suite | the 23-file command from `.github/workflows/local-first-core.yml` | exit 0, **230/230** pass, 0 fail |
| Proxy suite | `tests/local-openai-queue-proxy.node-test.mjs` | exit 0, **5/5** |
| Standalone ledger suite | `tests/local-non-git-synthetic-approval-ledger.node-test.mjs` | exit 0, **48/48**, including the three NEW C6B2B5U regression tests: "noncanonical fixture binding marker rejects semantic-equivalent JSON variants without receipt", "noncanonical registry marker rejects semantic-equivalent JSON without pin or receipt", "noncanonical durable pin refuses fresh approval without repair or receipt" |
| Vitest | `pnpm vitest run` (repeats) | 62 files / 1208 tests, exit 0 |

## B. Remote CI cross-check (read-only, at exact pinned SHA)

- CI #405: run `43429178134` → conclusion **success**, `head_sha == a673563be431b7d78e886a7b9a9e765eaad857bf` exactly; 3/3 jobs completed/success (local-first-core, macos-portability, dsh-typecheck-and-build).
- Linux + macOS legs both: Node 230/230 + proxy 5/5; the three new noncanonical marker/pin tests executed on BOTH OS; Vitest 62 files/1208. macOS hosted runner allocated (`macos-15-intel`).
- Dispatch-vs-pinned diff (`b07ae6d` vs `a673563`) = 8 handoff/report files only (LOCAL_AGENT_TASK.md, CURRENT_STATE.md, WORK_QUEUE.md, OL-028 message, LO-027 message, OL-027 done receipt, LO-027 online receipt, REPORT-c6b2b5t) → CI evidence is valid for the pinned source.
- Gate A.5 zero-caller scan: grep `non-git-synthetic-approval-ledger` across `src/` + `scripts/` excluding the module itself and tests → **NO_PRODUCTION_CALLERS**. C6B2B5U is not wired to any real caller on this host.

## C. Source review (pinned `a673563`, `src/local-first/non-git-synthetic-approval-ledger.ts`)

- `readPrivateSyntheticJson(file, kind)` (:25–45): descriptor read + before/after-stat unchanged; NEW canonical guard after parse: `expectedKeys` = insertion order `version,purpose,projectFingerprint` (marker) or `version,purpose,projectId,projectFingerprint,ledgerRoot` (pin); refuses `!value || typeof!=='object' || Array.isArray || Object.keys(value).join(',')!==expectedKeys || serialized!==JSON.stringify(value)+(kind==='pin'?'\n':'')` → `Noncanonical synthetic private JSON`. Source comment: "test-fixture tamper detection, not same-user authentication".
- Adopted at all THREE bound private-JSON readers: fixture-binding marker call site :216 (`'marker'`), durable pin :300 (`'pin'`), registry binding marker :394 (`'marker'`) — `a673563` closes the registry-marker try block after the canonical parse (f1bd2a6 left it unclosed).
- Call-site pre-checks unchanged: lstat isFile/nlink===1/mode===0600 → Unsafe; `size>4096` → Corrupt BEFORE parse.
- Error taxonomy at call sites (AUDITED, asymmetric by design):
  - fixture-marker catch (:217–222) maps ONLY `SyntaxError`/`ENOENT`/`ENOTDIR` → `Missing or corrupt synthetic fixture binding`; `Noncanonical synthetic private JSON` PROPAGATES RAW to the caller (visible error string).
  - pin call site: blanket catch → `Corrupt synthetic registry ledger pin; manual review required` (never raw).
  - registry-marker call site: blanket catch → `Corrupt synthetic registry binding marker` (never raw).
- Downstream semantic checks unchanged (fixture-bound 3-key + version/purpose/SHA match; pin sorted-key-set + value checks → `conflicting fixture ledger binding`; registry marker sorted-key-set).
- Writers (canonical references): pin writer :289 `JSON.stringify(expected)+'\n'` with `expected` in INSERTION order (:274–275); receipt writer :126 sorted keys (via `normalizeSyntheticReservation`) + `'\n'`; the product NEVER writes the fixture marker — tests/harness write it without a trailing newline, and the canonical expectation for markers has NO newline suffix (:39).

## D. Adversarial harness (U1–U13 + all carried B4C–B5T layers, incl. R/S/Q/T groups)

Final: **ok=998 fail=0**, exit 0 (`~/.dsh-superagent-private/c6b2b5u/preflight_acceptance.mts`, run at the pinned source). Matrix per task requirements, on all three reader paths:

1. **Duplicate keys** — leading dup, trailing dup with the SAME value (the remote's adversarial serialized-trailing-version case), trailing dup with a DIFFERENT value: all refused. Fixture-marker: raw `Noncanonical synthetic private JSON`; pin/registry-marker: blanket-catch Corrupt taxonomy. Marker/pin byte-for-byte identical after refusal (no repair, no rewrite, same inode/size/mtime/mode), zero receipts, approval NOT consumed; a restored canonical file then reserves the SAME approval id exactly once (one-use still enforced afterwards).
2. **Reordered keys** — refused on all three marker/pin paths (guard is insertion-order sensitive); byte-identical, zero receipts, approval NOT consumed.
3. **Pretty whitespace / added/deleted newline** — pretty, pretty+newline, trailing-newline marker, missing-trailing-newline pin, leading-space: all refused on the three paths; file preserved; approval not consumed.
4. **Malformed JSON / invalid type / extra fields** — `{broken` → SyntaxError-mapped `Missing or corrupt synthetic fixture binding` (fixture path) / blanket Corrupt (pin, registry); array-form and extra-field refused raw Noncanonical (fixture) / Corrupt (pin, registry). String-valued `version:"1"` passes the canonical-text guard (canonical serialization matches) and is then refused by the semantic `version!==1` check — audited ordering fact.
5. **4096/4097 size boundary** — carried Q groups patched to the AUDITED DELTA: a space-padded exactly-4096 file is now REFUSED by the canonical guard (padding is noncanonical); 4097 still refused BEFORE parse by the size bound; hostile files byte-identical after refusal; approval NOT consumed; zero pins/receipts created.
6. **symlink / hardlink / mode 0644 / inode change** — lstat guards fire BEFORE the canonical parse; taxonomy unchanged (`Untrusted synthetic fixture binding`, `Unsafe synthetic registry ledger pin`); 0644 canonical-content pin preserved after refusal (no repair); hardlink alias of a canonical marker refused (nlink guard); canonical file reserves after these refusals.
7. **Fresh-process children** — independent OS children with no remembered in-process state refuse the tampered fixture marker (`DENIED|Noncanonical synthetic private JSON`), tampered pin (`DENIED|Corrupt synthetic registry ledger pin…`), tampered registry marker (`DENIED|Corrupt synthetic registry binding marker`); canonical positive controls ACCEPT and write exactly one receipt; cross-process one-use still enforced on the canonical path.
8. **Cross-fixture / cross-root / repeated ID** — registry-bound path IS cross-root fenced via the durable pin (second ledger root refused with `conflicting fixture ledger binding`, using a B-journal-bound reservation so the fixed-journal check does not fire first — audited precedence). The generic `reserveSyntheticApproval` STILL re-reserves the same ID in an independent ledger root and succeeds: residual cross-root limit RE-AUDITED at `a673563`, unchanged.
9. **Receipt-path contrast (explicit in task)** — the receipt path stays ORDER-INSENSITIVE: a key-reordered receipt is ACCEPTED by `inspectSyntheticApproval` (canonical text is produced by the sorted-key writer; a cooperating same-user rewrite passes). Canonicalization is tamper detection, NOT cryptographic authenticity — do not call it authenticity.

## E. Audited deltas to carried layers (documented, not defects)

- Q1/Q2/Q3: space-padded exactly-4096 marker/pin ACCEPTED in the B5P/B5Q era → now REFUSED by the canonical guard (fixture path: raw Noncanonical visible; pin/registry: blanket-catch Corrupt).
- T12: pretty-printed fixture marker was accepted (no canonical guard on marker read) → now REFUSED (guard-scope extension at a673563; raw error propagates).
- G8: a 4-key registry marker is now refused as `Corrupt synthetic registry binding marker` (blanket catch), previously surfaced differently.
- Harness fixture fidelity: pin writes must include the writer's trailing newline to reach the semantic `conflicting fixture ledger binding` path (without it, the canonical guard fires first via the blanket catch).

## F. Open gates preserved (unchanged by C6B2B5U; remote owns fixes)

- Same-user marker/pin FORGERY: a cooperating same-user canonical rewrite still passes — integrity evidence, not a signature (source comment says so).
- PATH ABA / TOCTOU: moving the original inode back to the same path passes the best-effort identity check; not a race-free fd-relative capability.
- Cross-root generic-reserve re-reserve (limit above, D8).
- Proxy traps run user code during reflection; private transaction authority + backup/recovery unresolved; tmpdir is not a sandbox; real project Apply gates unproven.

## G. NOT_TESTED (do not treat as PASS)

- Real Weixin inbound/outbound; real OpenClaw hook fields; real project Apply/Rollback against the registry; production DSH callers of the ledger (Gate A.5: zero); production SQLite state.

## H. Reproducibility notes (harness bug lessons, for remote test authoring)

- `expectThrow` matcher must be a regex literal (a string matcher → `re.test is not a function`).
- `--input-type=module` is valid only for `-e`/stdin, never with an `.mts` file (`ERR_INPUT_TYPE_NOT_ALLOWED`).
- Nested single quotes inside single-quoted JS string literals break TS strip-types parse (`ERR_INVALID_TYPESCRIPT_SYNTAX`).
- A registry instance remembers the in-process pin identity; deleting the pin file under that registry throws `pin disappeared` by design — positive controls after a pin rm need a FRESH registry instance.
- `Object.fromEntries(Object.keys(obj).reverse())` throws `Iterator value … is not an entry object` — map to `[k, obj[k]]` pairs.
- `writeFileSync(...,{mode})` applies ONLY on create — chmod after every rewrite.
- Cross-process children must use a FRESH approval ID (a consumed one → all DENIED).
