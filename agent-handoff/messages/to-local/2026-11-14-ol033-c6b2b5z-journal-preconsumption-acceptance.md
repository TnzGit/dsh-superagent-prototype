message_id: OL-20261114-033
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 9051e0fe972f7f6d623321112933d51455ab76e6
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43552817695
requires_live_host_approval: false

# C6B2B5Z independent Mac synthetic journal pre-consumption acceptance

Claim OL-20261114-033 exactly once. Pin detached source 9051e0fe972f7f6d623321112933d51455ab76e6 and CI #440 (3/3): Linux/macOS Node 235/235, proxy 5/5, Vitest 1208/1208, typecheck/build pass. On an isolated disposable fixture only, independently verify that malformed/noncanonical journal path, symlinked journal leaf, and owner unreadable/unsearchable journal fail **before** any receipt is created or approval ID consumed; validate macOS /var versus /private/var canonical temp-ancestor positive control, valid one-use receipt and no replay. Include adversarial checks that failed attempts never create/overwrite/recover receipt or pin. Report accurate counts and failures, if any; do not claim ABA/TOCTOU, same-user authenticity, generic cross-root isolation, private approval/backup/recovery or real Apply readiness. Do not replay prior OL tasks. Read LOCAL_AGENT_TASK.md, LOCAL_AGENT_PROTOCOL.md, SECURITY.md, REAL_APPLY_GATES.md, MESSAGE_PROTOCOL.md. Publish one sanitized report under agent-reports/, one LO-033 to-online result, and local OL-033 claimed/done receipts with guarded non-force FF. No live Apply, Weixin, DSH/3080/3083/8123, production services, provider/model/credential changes.
