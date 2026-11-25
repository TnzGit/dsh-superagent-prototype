message_id: LO-20261125-053
from: local
to: online
type: message
verdict: LIVE_BOTH_PASS

# OL-20261125-053 result — controlled real I3 + real registered Apply: LIVE_BOTH_PASS

Local completed the operator-authorized controlled live batch. Sanitized report:
`agent-reports/REPORT-ol053-controlled-live-i3-and-real-apply.md`. Final implementation SHA
`7cb84058148c0f438e9b954bed23f7a452007373` (pushed FF `8782db4..7cb8405`; SubA `cc33d87` +
SubB `5eac3c8` + SubC `833db8d` merged by the lead).

Real I3 proven end-to-end on a fresh Seatbelt-isolated disposable staging guest (matrix proves
read AND write denied, child inheritance, network default-deny except the local model route + 443):
the operator personally sent one real WeChat message from the consented self-peer; the guest's live
iLink long-poll ingested it as a genuine Trigger (real account binding, gate strength explicit);
trusted pre-inference controller created exactly ONE Ticket + Worker Session with the tool binding
attested BEFORE any model step (`HEADER_PROOF bound=true`, 11 attested tools in the first worker
header); ONE genuine local model turn ran the REAL native `edit` in the isolated snapshot copy
(6 tools: glob/read/ack/edit/read/report), ticket ended `completed` with a real report containing the
diff; BOTH the acknowledgement and the correlated result were really SENT through the real iLink
`sendMessage` API (durable receipts `status=sent`, 2 of ≤3 outbound, unique IDs, zero auto-retry).
Budgets enforced: 2 model requests, 6 tool calls, ~29s live, one inference boot (host-side latch).
Boot 1 died on an upstream 502 (test proxy's upstream inference host went offline before any token);
operator granted a re-run; boot 2 passed as above.

Real registered Apply proven on an operator-chosen fresh REAL registered project (operand: new
dedicated real test project): preimage observed through the helper's own fd-pinned inspect; private
backup fsynced + digest-verified BEFORE mutation; ONE one-use transaction capability (principal uid,
project identity, exact file list, plan digest, nonce, expiry) consumed once — second use refused
with the consumed-marker error; the audited fd-relative helper invoked ONCE → `APPLIED` (journal
fsynced, mode unchanged, content==after image); SEPARATE rollback capability restored byte-exact
original (digest==backup==preimage, mode 0600); recovery classified read-only (apply tx
`PREPARED_CRASH` given the later rollback, rollback tx `APPLIED`; never repaired); second file
untouched, git CLEAN after the round-trip.

Offline verification at merge HEAD on the operator macOS: CI-exact 29-file node list 310/310, focus
Vitest 156/156, FULL Vitest 71 files 1357/1357, `pnpm check` exit 0, proxy 5/5; helper compiled
`-Werror` clean; 24 new adversarial tests in CI lists.

Environment: model default untouched; production SQLite untouched; live 3083 restored to its
baseline binary/env with executor pause preserved (honest drift recorded: live trigger count 11→12 —
the pilot's real message was re-ingested by the restored live poller while paused, zero tickets,
zero new sends); 8123 test proxy re-pointed once under the operator grant; disposable task-owned
trees cleaned after publication; raw evidence private-vault only.

Blocks/gaps for remote (technical, not consent): runbook line for the new fail-closed registered-root
identity gate (operators must re-register after external directory replacement) is not updated;
`reviewResolveDryRun` still test-only (docs/018 gate); live 3083's own send/receive integration
against the new hardening remains remote-side; Apply helper residual races documented (writer
quiescence external; ancestor swap above pinned root; kill-injection ≠ power-loss; same-user
forgery; frozen approvals trust registration at issue). No OL-054 dispatch requested; local stops
after this one completion.
