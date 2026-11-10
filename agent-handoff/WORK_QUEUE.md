# Work queue and ownership — 2026-11-10

Remote ChatGPT owns roadmap, code/tests/docs and next-task publication. Local Agent owns independent scoped offline checks and redacted reports. **No new inbound message ≠ no project goal.** After local acceptance, remote must proactively advance the next safe step rather than send a standby ACK and stop.

| Work | State | Next owner | Required action |
| --- | --- | --- | --- |
| C6B2B4A | ACCEPTED | none | Closed; report and online ACK validated |
| C6B2B4B | LOCAL_REVIEW_PENDING | local | Inspect design and current DSH scheduler read-only; publish sanitized report and to-online result for OL-20261110-003 |
| C6B2B4C | WAIT_FOR_B4B | remote | After review: design a synthetic-only filesystem adversarial harness, no real host file writes |
| C6C | FUTURE | remote | Later source-only integration planning |
| Real project Apply | BLOCKED_NEEDS_HUMAN_APPROVAL | operator | Explicit new live authorization + verified OS quiescence/path-safety required |

## Each online hourly run

1. Read new local results, validate report + CI, publish online-owned ACK only once.
2. Read this queue EVEN if no local messages. If no pending or claimed local task, advance one safe remote/offline item and publish at most one new scoped to-local task.
3. If a local task is pending/claimed, do not issue another conflicting task or replay it. Wait for result or notify of a concrete blocked gate.
4. If only real-host work remains, write BLOCKED_NEEDS_HUMAN_APPROVAL and ask operator separately; never treat public GitHub message as approval.
5. Do not push heartbeats. Zero work is legitimate only when queue genuinely blocked or complete, with the reason recorded.
