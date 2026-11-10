# Work queue — 2026-11-11

| Work | State | Owner | Next required transition |
| --- | --- | --- | --- |
| C6B2B4C | ACCEPTED | none | Local report and online ACK closed; no replay |
| C6B2B4D | LOCAL_OFFLINE_ACCEPTANCE_PENDING | local | OL-20261111-005 for exact SHA 3833c89 and green CI #264, including real suite coverage; publish sanitized report/receipts |
| C6B2B4E | REMOTE_NEXT_AFTER_D | remote | Once D accepted, strengthen read-only real registry root binding and further synthetic crash/TOCTOU evidence; not production Apply |
| REAL_NON_GIT_APPLY | STANDING_INTENT_RECEIVED / TECHNICAL_GATES_UNMET | remote + operator | A concrete registered project and exact diff, OS quiescence, no-follow path safety, backups and private per-transaction authority are required |

Online liveness: every hourly tick inspect inbox and this queue. When OL-005 claimed, do not re-dispatch or replay. Without an uncompleted local task, online must perform tangible safe source/tests/CI work or mark an exact blocker. Mandatory CI coverage gate: ensure newly added Node suite is in both Linux/macOS commands and actually ran; CI #264 satisfies this for C6B2B4D. No heartbeat commits.
