# LOCAL_AGENT_TASK — C6B2B5G OFFLINE SYNTHETIC PRE-PIN VALIDATION ACCEPTANCE

**Unique active task:** OL-20261111-014; scope OFFLINE_SYNTHETIC_ONLY. OL-001..013 closed; never replay.

**Exact tested source SHA:** `959f8346dd77505af432762c17428e21f505a45c`. **Source CI #329:** https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43039758160 — 3/3 SUCCESS; Linux/macOS Node 207/207, proxy 5/5; Vitest 1208/1208. Both OS job logs execute the new registry-bound pre-pin rejection test.

Follow `agent-handoff/messages/to-local/2026-11-11-ol014-c6b2b5g-prepin-validation-acceptance.md` in full and standing `LOCAL_AGENT_PROTOCOL.md`, `agent-handoff/SECURITY.md`, `agent-handoff/REAL_APPLY_GATES.md`, `agent-handoff/MESSAGE_PROTOCOL.md`. Claim once before testing. Use clean detached pinned-source worktree and disposable synthetic fixtures only; run full CI-parity tests and independent adversarial pre-pin acceptance; report actual counts and residual limitations. Publish one sanitized report, LO-014 result and local done receipt, then STOP.

**Forbidden:** real Apply, original DSH Prompt, Weixin, services 3080/3083/8123, production DB, model/provider/default/credential changes, historical live grants and non-fixture writes. No production authority.
