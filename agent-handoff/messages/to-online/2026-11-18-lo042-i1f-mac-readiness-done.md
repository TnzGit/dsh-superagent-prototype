---
message_id: LO-20261118-042
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
verdict: ALL_OFFLINE_PASS
pinned_source_sha: ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead
---

# LO-20261118-042 — I1F Mac readiness batch complete (ALL_OFFLINE_PASS)

Task OL-20261118-042 claimed once on operator manual handoff, executed fully offline in a fresh detached worktree at the exact pinned SHA (clean before/after).

Stage A PASS (read-only baseline + isolated worktree). Stage B PASS: frozen install/check exit 0; focused 6-spec Vitest 30/30 × 3 consecutive repeats; proxy 5/5; FULL Vitest 1238/1238; workflow-exact 25-file Node list 249/253 on this host — the 4 failures are all the NEW tests/os-path-inspector.node-test.mjs OK-expecting cases, caused by finding F1 (operator macOS 26.3 stamps com.apple.provenance on every fresh file; flistxattr byte-size>0 => REJECT; CI macos-15-intel runner does NOT stamp and shows 5/5 PASS — measured env-specific divergence, not source drift; CI #550 remains 3/3 at the pinned SHA). Stage C PASS: native prototype probes 9/9 on fresh 0700 APFS roots (provenance REJECT demonstrated, symlink/hardlink/FIFO/mode/flag/ABA/read-only covered; ACL-blindness demonstrated); installed DSH read-only investigation: WorkspaceRegistry identity = realpath-canonicalized path string equality (no inode/dev recorded anywhere; path-ABA applies); Sessions.ensure trusts a restored (resolveAgent-success) Session WITHOUT re-validating its workspace against the ticket snapshot — the docs/013:77 gate CONFIRMED with source evidence + fake-controller fail-closed specs 4/4 (CF1 foreign-restored reuse gap; CF2/CF3 already covered remotely; CF4 registration-failure class missing from the remote suite). Restored-Workspace attestation classified BLOCKED (known gate, no guessed bypass); remote patch idea recorded in the report §4. Stage D: HOST_STAGE_NOT_AUTHORIZED (no real turns, no new DSH instance, no inference, no I2/I3, no real registered source, no real Apply). Stage E PASS: zero drift (listener PIDs, probe codes, catalog aggregate 27, model defaults, production SQLite, historical Sessions/Workspaces, Weixin, relay-OFF all unchanged); only this batch's disposable resources cleaned.

Report: agent-reports/REPORT-ol042-i1f-mac-readiness.md

Next owner: remote online — (1) restored-Session workspace attestation + CF1/CF4 tests (resolves docs/013:77 before I2); (2) F1 OS-specific xattr policy (allowlist com.apple.provenance; macOS ACLs invisible to flistxattr — helper needs an ACL inspection path); (3) apply helper per docs/014 (matrix all PENDING); (4) then propose operator-granted I2 separately; (5) state-sync commit after ACK (convergence guards will be red mid-sync on the report HEAD, OL-041 precedent — expected, not reclassified).

STOP after this result message; OL-20261118-042 done, never replay.
