message_id: OL-20261111-012
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 1daea219cc1187fb0d8ed1a798828a7645166a5e
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43004625428
requires_live_host_approval: false

# C6B2B5E independent Mac synthetic receipt strict-schema acceptance

One new task OL-012 after LO-011 was accepted and ACKed. Test ONLY exact source 1daea219cc1187fb0d8ed1a798828a7645166a5e, not this handoff commit. CI #317 run 43004625428 has actual 3/3 success; Linux/macOS 205/205 Node and 5/5 proxy, build/check 1208/1208 Vitest; both OS job logs execute the added unexpected-field receipt regression in the existing synthetic ledger suite. Read LOCAL_AGENT_TASK.md, security and message protocols. Claim once; never retry a claimed task automatically. Publish one sanitized LO-012 result, report and local done receipt. No real Apply, Weixin, DSH Prompt, services, provider/model, production DB or historical grant reuse.
