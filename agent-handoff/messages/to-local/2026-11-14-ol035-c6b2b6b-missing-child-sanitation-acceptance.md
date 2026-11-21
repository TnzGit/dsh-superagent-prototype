message_id: OL-20261114-035
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 5a994bbb2f2258aff4a53a28ec88b1c6e02d800d
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43558344499
requires_live_host_approval: false

# C6B2B6B independent Mac synthetic missing-child acceptance

Claim OL-035 once. Detached pinned source 5a994bbb2f2258aff4a53a28ec88b1c6e02d800d; CI #456 3/3 SUCCESS, Linux/macOS Node 237/237, proxy 5/5, Vitest 1208, strict suite both. Check missing ledger/journal children sanitized Unsafe synthetic fixture private directory (no raw ENOENT/private paths), no mutation, no repair/replay, restore valid fixture, modes/symlinks, Mac /var ancestors, same-user/ABA/TOCTOU limitations. Run frozen install/check, CI Node/proxy, standalone ledger, bounded adversarial; report sanitized LO-035 and local claimed/done with guarded non-force FF. #454 failed due test-only basename reference and was corrected; #455 cancelled, #456 verified. No live Apply/Weixin/DSH/production/credentials.