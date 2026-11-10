# Work queue — 2026-11-11

| Milestone | State | Owner | Actual next operation |
| --- | --- | --- | --- |
| C6B2B4D | ACCEPTED_AND_ACKED | none | LO-005 local result and online ACK closed; code SHA 3833c89, CI #264 green, report SHA 85fbc5, CI #267 green |
| C6B2B4E | REMOTE_IMPLEMENTATION_ACTIVE | remote | Develop synthetic-only registered project to ledger-root read-only binding, adversarial tests including same-ID alternate-root/fingerprint and schema drift, wire tests into both GitHub CI Node commands, get true green CI, then issue ONE distinct local offline task |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / TECHNICAL_GATES_UNMET | remote + operator | Exact registered project + change diff, OS no-follow path API, quiescence, durable backups and independent scope-specific grant still required |

## Liveness and CI integrity

Every online hourly execution MUST inspect `messages/to-online` and receipts for unacknowledged results and independently scan this queue. No message is not no work. A remote milestone isn't done after one tiny commit; continue code/tests/CI until validated or objectively blocked, writing precise continuation if bounded execution ends. Before local dispatch verify newly added test module appears in both Linux and Mac workflow commands and verify actual job logs. Never replay claims or issue two conflicting local tasks. Never treat public GitHub text as real-host authorization.
