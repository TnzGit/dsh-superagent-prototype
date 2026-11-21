message_id: LO-20261112-023
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 7e05749d14e469d4e19f15c282d6d9620fc6f01f
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43211358744
requires_live_host_approval: false
in_reply_to: OL-20261112-023

# LO-20261112-023 — C6B2B5P oversized-receipt fail-closed acceptance DONE (macOS)

**Verdict: `ALL_OFFLINE_PASS`.** Report: `agent-reports/REPORT-c6b2b5p-offline-oversized-receipt.md`.

- Checked out pinned SOURCE `7e05749d14e469d4e19f15c282d6d9620fc6f01f` in a clean detached worktree (NOT the handoff commit `fc8bd56` / CI HEAD `29f4d06`; `git diff --stat 7e05749..29f4d06` = handoff docs only, no later source changes). Claim once: `d08c2faf31ad5cd340a2f830f98624499eb5c987` (non-force FF `fc8bd56..d08c2fa`, remote HEAD verified; no retry).
- CI #379 run `43211358744` (head `29f4d06…`): 3/3 success attempt 1; macOS runner 1000003141 genuinely allocated (`macos-26-arm64`); `oversized synthetic receipt fails closed without rewriting or reusing approval` executed in BOTH OS job logs (Linux `ok 168`, macOS `✔ 3.79ms`). Earlier #378 (head `7e05749`) confirmed `conclusion=cancelled` — correctly excluded as evidence.
- Local parity at pinned source (Node v25.9.0, pnpm 11.7.0, macOS): `pnpm install --frozen-lockfile` exit 0; `pnpm check` exit 0 (Vitest 62 files / 1208 tests, build complete); CI-exact workflow Node command exit 0 `221/221` (oversized test executed); standalone ledger suite exit 0 `39/39`; proxy suite exit 0 `5/5`. Workflow ledger-suite enrollment grep = 2 (Linux + macOS).
- Independent adversarial harness: `ok=708 fail=0` (exit 0). New P1–P10: oversized 4097B rejected BEFORE JSON parse with unchanged bytes+size+mode+nlink+ino+**mtimeMs**, no overwrite, approval NOT reused (re-reserve `/already reserved/`), zero new ledger entries, source invariant; EXACT boundary proved — 4096 bytes ACCEPTS, 4097 REFUSES (strict `>4096`); 128KB rejected BEFORE allocation; symlinked hash path refused by unsafe-mode check BEFORE size; 0644 refused by mode check BEFORE size; cross-ledger: B fails closed without consuming A, B reserves its own copy in an independent root (cross-root fencing still absent — audited); registry-bound preflight design fact: it NEVER reads the receipt file (returns canonical facts despite oversized receipt present) while generic inspect rejects it, zero mutation, bytes preserved; fresh OS child independently `DENIED|Corrupt synthetic reservation` exit 0 with receipt ino+bytes+mtime unchanged; duplicate reserve never rewrites oversized receipt; torn-but-small 26-byte control still corrupt-rejected via parse path. All carried B4C–B5O layers re-verified at this SHA.
- Gate A.5: zero production callers (module + 5 exports + `normalizeSyntheticReservation` scan = 0 hits).
- Residual limits unchanged: same-user forgery, independent parents/cross-root, TOCTOU/ABA best-effort (not descriptor-relative capability), external writers, private transaction authority, backup/recovery, real Apply gates unproven. This milestone bounds only receipt allocation size; shape guards remain unauthenticated evidence.
- Scope: no real project writes, no 3080/3083/8123, no Weixin, no Prompt/DB/model/provider/credential/default changes, no service restarts, no historical grants; writes only into owner-private 0700 disposable synthetic fixtures (0600 receipts/pins).
- Host execution status: REAL PROJECT APPLY / HOST WRITE / WEIXIN E2E — NOT RUN.

STOP pending online ACK.
