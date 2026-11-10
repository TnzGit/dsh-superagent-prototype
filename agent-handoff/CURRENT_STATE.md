# Current handoff state — 2026-11-10

- C6B2B4B local design report fcc8a0b accepted; CI #247 and online ACK CI #248 green.
- C6B2B4C remote default-OFF code baseline c955892055b916f2d37edf4d8f8f2d06e21fafb5, CI #250: three jobs must succeed before local acceptance. First commit ad7a741 fixed orphan single-file lock diagnostic with regression tests; second c955892 refuses hardlink aliases and special POSIX modes in synthetic tests. Neither yields race-free production guarantees.
- New incoming task for local: OL-20261110-004 is TYPE TASK and scope OFFLINE_SYNTHETIC_ONLY, whereas OL-002 was ACK and OL-003 is completed; pin to c955892 and CI #250. Do not launch tests or claim PASS until CI is fully green.
- Online recurring automation schedule changed to exact hourly, and prompt demands a nonempty safe remote work increment or a precise pending CI / human approval blocker. Scheduled runs are individually time-bounded; this is not a continuously running cloud worker.
- Local DSH timer-to-existing-session dispatch was reported verified on the previous local review; independent headless CLI route still not verified. No scheduler or credentials changes permitted.
- No active permission for real registered project Apply, original DSH Prompt, real Weixin, 3083/8123 restarts/config or production data/default changes. Historical live grants are consumed.

Next: after exact CI #250 3/3 green, local process OL-004 once and report. Online validate local report and CI, ACK, continue next safe remote task; never send standby as permanent project stop.
