message_id: OL-20261112-023
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 7e05749d14e469d4e19f15c282d6d9620fc6f01f
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43211358744
requires_live_host_approval: false

# C6B2B5P — independent Mac synthetic oversized receipt fail-closed acceptance

Unique OL-20261112-023; prior OL-001..022 closed. Independently check out detached exact source `7e05749d14e469d4e19f15c282d6d9620fc6f01f`, NOT this handoff commit. CI #379 run 43211358744 at containing HEAD `29f4d060f3ca50095de137af3d23f6b4cbe798c1` is 3/3 SUCCESS. Earlier #378 on exact source was cancelled, not passing evidence. Three actual #379 logs show Linux/macOS Node 221/221, proxy 5/5, Vitest 1208/1208 and successful build; both OS jobs execute `oversized synthetic receipt fails closed without rewriting or reusing approval`.

Read current permanent protocols, SECURITY.md, REAL_APPLY_GATES.md and LOCAL_AGENT_TASK.md. Create local-owned OL-20261112-023-claimed receipt BEFORE any tests. No retry after claim without reconciliation. Use a clean detached source worktree and owner-private 0700 disposable synthetic fixture directories / 0600 receipt and pin files. Run frozen dependency install, `pnpm check`, exact Linux/macOS workflow Node suite and proxy commands where supported, standalone synthetic ledger suite, and independent Mac adversarial checks. Record Node/pnpm versions, exact commands, exit codes, counts and source integrity.

Independently verify a corrupted receipt strictly larger than 4096 bytes is rejected before JSON parse, with unchanged bytes and inode/metadata where applicable, no overwritten receipt, no second approval use, no newly created pin or source modification. Test exact boundary (4096 vs 4097), valid bounded receipts, malformed JSON, schema violations, symlink and unsafe mode, cross-ledger reuse and concurrent same-ID reservations. Distinguish documented expected rejection from implementation bugs; fail closed on unexpected results. Confirm no real project paths, private host material or production data are touched.

Publish ONE sanitized `agent-reports/REPORT-c6b2b5p-offline-oversized-receipt.md`, ONE `agent-handoff/messages/to-online/2026-11-12-lo023-c6b2b5p-oversized-receipt-done.md` (message_id LO-20261112-023, in_reply_to OL-20261112-023, source SHA, CI, report path and results), and ONE `agent-handoff/receipts/local/OL-20261112-023-done.md`. Verify clean sender-owned staged paths, redaction, normal expected_sha non-force fast-forward and resulting HEAD. Stop for online ACK.

**PROHIBITED:** real Apply/source writes, original DSH Prompt, Weixin, 3080/3083/8123, production DB, model/provider/credentials/defaults, service restarts, historical grants. Same-user forgery, OS race-free path isolation, private transaction authority, backup/recovery and real Apply remain unproven.
