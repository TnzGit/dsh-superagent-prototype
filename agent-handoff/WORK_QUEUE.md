# Work queue — 2026-11-10

| Work | Status | Owner | Next action |
| --- | --- | --- | --- |
| C6B2B4B | ACCEPTED | none | C6B2B4B design report + ACK closed |
| C6B2B4C | LOCAL_ACCEPTANCE_PENDING_CI_GATED | local | OL-20261110-004 tests exact code c9558920 only AFTER CI #250 three jobs success; publish sanitized report and receipts |
| C6B2B4D | NEXT_AFTER_C | remote | Continue synthetic-only native filesystem race/adversarial evidence and blockers, not real Apply |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / SAFETY_AND_SCOPE_GATE | remote + local | Human gave broad go-ahead in principle; select/verify an actual registered project and exact diff, implement OS-level safe operation + quiescence + private per-transaction grant, backups, bounded rollback and audit **before** any real write |

Online agent MUST check this queue hourly even if no incoming messages. No duplicate local tasks while OL-004 pending or claimed. Never auto-retry an ambiguous claim. Do not treat a runner queue or no new messages as completed project. No heartbeats.

## MacOS runner stall escape hatch

Do not hold OL-004 hostage to an indefinitely missing GitHub-hosted macOS runner: if CI #250/#251 macOS does not allocate a runner, permit LOCAL SYNTHETIC-ONLY independent macOS install/check and full regression acceptance with explicit `GH_MACOS_CI_INFRA_NOT_COVERED`, leaving GitHub CI technically incomplete. Actual code/macOS test failure remains `BLOCKED_CODE`. This does not authorize real registered project writes. Owner must keep CI infra blocker recorded separately from code.
