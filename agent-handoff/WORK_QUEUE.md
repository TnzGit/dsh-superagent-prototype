# Active work queue — 2026-11-11 (remote-owned)

| Milestone | State | Owner | Next operation |
| --- | --- | --- | --- |
| C6B2B4D | ACCEPTED_ACKED | none | LO-005 closed, no replay |
| C6B2B4E | ACCEPTED_ACKED | none | LO-006 closed, no replay |
| C6B2B4F | CODE_CI_3_OF_3_GREEN / MAC_OFFLINE_ACCEPTANCE_PENDING | local | OL-20261111-007 tests exact code `cc59686b23af13bc33883605ca4950d7201ee72b`, CI #278, registers local claimed/done and one sanitized report |
| C6B2B4G | REMOTE_OWNED_AFTER_F | remote | Additional synthetic read-only identity/ABA/external-writer adversarial design and regression tests; no production writer |
| REAL_NON_GIT_APPLY | STANDING_INTENT / EXACT_SCOPE_AND_OS_GATES_UNMET | operator + remote | Specific registered project and diff, path/quiescence proof, private grant, backup and recovery before any real write |

## Verified code/CI gate

- Read-only C6B2B4F path/inode hardening commit `3613336bd9093f28b4e81d81f6fa88d57938bf86`, test error expectation adjustment `cc59686b23af13bc33883605ca4950d7201ee72b`.
- [CI #278](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42931128906) jobs `local-first-core`, `macos-portability`, `dsh-typecheck-and-build` **3/3 success**. Actual logs: Linux and macOS Node **197/197** each, proxy **5/5** each; Vitest **1208/1208**, build success. Both OS commands enroll `tests/local-nongit-synthetic-approval-ledger.node-test.mjs`; new same-path directory test visibly executed.
- Dev/inode guard rechecks registration-time root identity before and after async preflight. It is a non-atomic, synthetic-only read-only check; same-user forgery, generic alternate ledgers and OS race conditions remain unsolved. No real Apply enabled.
- **Next owner local:** OL-007 single bounded Mac acceptance. **After** local report, remote ACK then continue B4G. Do not reuse OL-006, issue a competing task or alter the pinned SHA. CI cancellation is not proof of code failure or full success.
