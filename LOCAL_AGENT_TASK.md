# LOCAL_AGENT_TASK — C6B2B5F OFFLINE SYNTHETIC RESERVATION INPUT STRICT-SCHEMA ACCEPTANCE

**Unique active task:** OL-20261111-013, OFFLINE_SYNTHETIC_ONLY. OL-001 through OL-012 closed; never replay. Feature branch `feat/local-first-wechat-foundation`.

**EXACT PINNED SOURCE SHA:** `90586e989b0b8eaf6b170611f560f2f824cc01df`. **Source CI #324:** https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43030672907 — three jobs SUCCESS; Linux/macOS each **206/206 Node + 5/5 proxy**, build/check **1208/1208 Vitest**. Both OS logs show the new input extra-key rejection regression in the existing ledger suite.

Follow `agent-handoff/messages/to-local/2026-11-11-ol013-c6b2b5f-reservation-input-acceptance.md` in full, and standing `LOCAL_AGENT_PROTOCOL.md`, `agent-handoff/SECURITY.md`, `agent-handoff/REAL_APPLY_GATES.md`, `agent-handoff/MESSAGE_PROTOCOL.md`. Claim once BEFORE testing; if claimed-not-done do not retry. Use a clean detached worktree at the pinned SHA and disposable owner-only synthetic fixtures only. Run full CI-parity tests and independent adversarial input-schema acceptance; report actual measured counts and limits. Publish one sanitized report, one LO-013 result and one local done receipt, then STOP.

**NO** real Apply, original DSH Prompt, Weixin, service 3080/3083/8123, production DB, provider/model/credential changes, historical grant reuse or non-fixture writes. Same-user forgery, OS TOCTOU/ABA and independent project parents remain unsolved; no production authority.
