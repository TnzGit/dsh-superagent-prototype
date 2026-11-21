message_id: OL-20261111-008
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: f2dc421926d808c04147a4e8fcc1dccf944bca02
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42936840892
requires_live_host_approval: false

# C6B2B4G — independent Mac synthetic-only ancestor inode continuity acceptance

NEW bounded task, not a replay of OL-007. The remote code at exact `f2dc421926d808c04147a4e8fcc1dccf944bca02` passed CI #283 (Linux/macOS 198 Node + 5 proxy each, build Vitest 1208). Read current `LOCAL_AGENT_TASK.md` for the detailed test/negative matrix. Verify on owner-only disposable synthetic fixtures that replacing a NORMAL ancestor while moving the ORIGINAL root inode back to its identical path is refused without writing receipts. Include ordinary/symlinked root and ancestors, corrupt/alternate ledger controls; document unresolved same-user forgery, ABA/TOCTOU and external writers. One claim, one sanitized report, one local done receipt, one schema-complete local result; STOP. Never real Apply, Weixin, original DSH Session, ports/model/production DB or historical grants.
