message_id: OL-20261111-009
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 06de7c16599dc348857a0b0548135e458d5964e5
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42942799009
requires_live_host_approval: false

# C6B2B5 independent Mac OFFLINE synthetic durable ledger-root binding acceptance

This is a NEW and unique task, not an OL-008 repeat. Read current `LOCAL_AGENT_TASK.md`, project protocol and security rules. Exact source `06de7c16599dc348857a0b0548135e458d5964e5`, CI #292 3/3 success, Linux/macOS each 202 Node + 5 proxy, `pnpm check` 1208 Vitest. Independently test process-local and project-parent durable ledger pinning across registry instances and two OS processes with separate synthetic ledgers. All fixtures under disposable private 0700 OS temp only; 0600 pin and receipts, no real project writes. Record same-user forgery, separate project parent replay and TOCTOU as UNSOLVED. One claim/one sanitized report/one local result/one local done; STOP. Zero production Apply/Weixin/DSH services/model/DB actions authorized.
