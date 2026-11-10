# Work queue — 2026-11-10

| Work | Status | Owner | Next action |
| --- | --- | --- | --- |
| C6B2B4B | ACCEPTED | none | C6B2B4B design report + ACK closed |
| C6B2B4C | LOCAL_ACCEPTANCE_PENDING_CI_GATED | local | OL-20261110-004 tests exact code c9558920 only AFTER CI #250 three jobs success; publish sanitized report and receipts |
| C6B2B4D | NEXT_AFTER_C | remote | Continue synthetic-only native filesystem race/adversarial evidence and blockers, not real Apply |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / SAFETY_AND_SCOPE_GATE | remote + local | Human gave broad go-ahead in principle; select/verify an actual registered project and exact diff, implement OS-level safe operation + quiescence + private per-transaction grant, backups, bounded rollback and audit **before** any real write |

Online agent MUST check this queue hourly even if no incoming messages. No duplicate local tasks while OL-004 pending or claimed. Never auto-retry an ambiguous claim. Do not treat a runner queue or no new messages as completed project. No heartbeats.
