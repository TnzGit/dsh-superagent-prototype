message_id: LO-20261125-054
from: local
to: online
type: message
verdict: INSTALLED_I3_AND_APPLY_PASS

# OL-20261125-054 result — installed runtime I3 + operator-private real Apply: INSTALLED_I3_AND_APPLY_PASS

Local completed the operator-authorized installed-runtime batch (M0–M6, continuous grant, no
per-stage consent). Sanitized report: `agent-reports/REPORT-ol054-installed-runtime-private-apply.md`.
Final implementation SHA `d9d7e3e488fab500a5f57cc64952455ce1cbd0f5` (SubA `b2e9afb` poll-owner
lease + replay suppression, SubB `dad0474` operator-private reconciliation + trigger terminal
classification, SubC `402cffd` fd-relative native Apply helper + one-use capability connector,
merged by the lead at the claim-anchored chain).

M2 cutover proven: the installed 3083 listener now runs the merge-HEAD bundle with the private
registry env binding, the operator-token env and the model-route key env; manifest CAS records the
old→stopped→new transitions; preflight on the new listener verified listener identity + env bindings
+ DB held, state runtime ready + real iLink long-poll connected + paused True, zero-drift DB counts
vs the M0 baseline, per-account 0700 lease directory active, proxy/GUI untouched. Rollback path
preserved (original bundle link + original profile patch) but not executed.

M3 real closed loop proven on the updated installed runtime: the operator sent a real WeChat message
from the consented self-peer; the live iLink long-poll ingested a genuine Trigger; the accepted
Ticket bound to the operator-registered real project, the Worker session ran a genuine local model
turn with the real native edit in the isolated snapshot (source write forbidden), ended
`completed` with a real report, and BOTH the acknowledgement and the correlated result were really
delivered through the real iLink `sendMessage` API (durable receipts `sent`; outbound 3/3 cap
reached with unique immutable IDs, zero auto-retry, zero review holds). First-attempt format failure
(selector not alone on the first line) recorded honestly: real Router turn happened, ticket stopped
with zero further egress, its ack consumed one outbound unit.

M4 proven live: operator routes respond on the installed listener (401 without the private token,
sanitized ledger with it); the historical OL-053 pending trigger was terminal-classified through
the operator route — durable ignore Decision, thread pending cleared, trigger row + receipts
preserved, journal fsynced before the transition — so an unpause can no longer re-execute a consumed
operation without disabling any guard.

M5 proven genuine: connector rehearsal on synthetic registered projects first, then ONE bounded
registered Apply on the operator-chosen real test project (1 ordinary text file, 79B after, no
deletions): preview bound to current registered root+ancestor identity, durable review seal of the
exact plan digest, one-use capability (nonce + 300s expiry + quiescence/stale-rebind gates), journal
`applied`, post-write bytes+mode verified, second execute refused (`already consumed; no silent
retry`), then a SEPARATE one-use rollback capability restored the byte+mode-exact original;
read-only recovery classification never repairs. Final real-project state = baseline (README 80B
original hash, notes.txt untouched, git status clean) — reversibility proven end-to-end.

M6: zero-drift sweep clean (3080 GUI 200, 8123 proxy 401, 3083 paused+ready+long-poll connected,
model default untouched, no production schema mutation); honest drift recorded (triggers 12→14,
tickets 0→2 both ended, outbox 5→8 all terminal `sent` within cap, kv 18→22 lease/generation/
seen-set/review keys). Budget ledger: 3/3 outbound terminal, 2/2 model sessions, 1/1 Apply +
1/1 rollback, 1/1 supervised cutover; OL-053 consumed budgets never replayed.

Honest residuals (documented in the report): same-UID writer window between final preimage re-verify
and `renameat` (narrowed, not eliminated; writer quiescence external); ancestor swap above the pinned
root is read-only evidence; mounts; SIGKILL≠power-loss; same-UID capability/marker forgery accepted;
operator token = bearer auth not identity; crash window between trigger-classification commit and
journal fsync (detection-only freeze); replay seen-set FIFO 2000 with Engine dedup backstop;
real-peer reconciliation remains GATED (offline proof + this live classification only).

Done receipt: `agent-handoff/receipts/local/OL-20261125-054-done.md`. No OL-055 auto-dispatch;
PR #1 remains Draft; rollback of the installed runtime remains available and un-executed.
