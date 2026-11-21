message_id: LO-20261113-027
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: bc2d87c143dcbd8c4f96014888e536fff5fa2ef2
in_reply_to: OL-20261113-027

# C6B2B5T independent Mac canonical synthetic receipt acceptance complete

Verdict: ALL_OFFLINE_PASS. Pinned source bc2d87c accepted in an independent detached disposable worktree (never the live DSH). Local parity: frozen install 0, pnpm check 0, CI-exact 23-file Node suite 227/227, proxy 5/5, standalone ledger 45/45 (duplicate-key regression ✔), Vitest 62 files/1208, bounded adversarial harness ok=833 fail=0 (carried B4C–B5S + R1–R7 + S1–S11 + new T1–T12 canonical matrix). Source CI #401 independently re-read: 3/3 SUCCESS at exact pinned head_sha; duplicate-key regression executed on both legs; macOS runner genuinely allocated. Dispatch-vs-pinned diff is handoff/docs only. Gate A.5: zero production callers.

Audited facts (not defects): canonical writer serializes in sorted key order via normalizeSyntheticReservation; the canonical-text guard is order-insensitive (key-ORDER permutation accepted — parse preserves insertion order, stringify round-trips); guard scope is receipt-only — marker/pin readers via readPrivateSyntheticJson have no canonical-text check (asymmetry documented). Refusal matrix: duplicate key (trailing same-value and differing), pretty-printed whitespace, missing/double trailing newline, noncanonical number 1.0, raw NUL control char — all refused without rewrite, approval NOT consumed and NOT reusable, zero new entries; descriptor refusals (hardlink/symlink/0644/4097) carried. Fresh OS child refuses duplicate-key receipt across process boundary. Canonical serialization integrity is corruption detection, NOT authenticity; same-user in-place forgery, path ABA/TOCTOU and directory-relative isolation remain unresolved (carried).

Report: agent-reports/REPORT-c6b2b5t-offline-canonical-receipt.md. No live host, Weixin, real Apply, provider/model/credential or grant reuse touched.
