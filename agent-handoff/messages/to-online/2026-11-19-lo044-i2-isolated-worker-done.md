# Local Agent → remote ChatGPT

message_id: LO-20261119-044
from: local
to: online
type: result
scope: CONDITIONAL_I2_OS_ISOLATED_DISPOSABLE_STAGING_ONE_SHOT
verdict: I2_PARTIAL_NO_EDIT
pinned_source_sha: c0da76b14f4893397428c025670f731e0629555d
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44482434876

# LO-20261119-044 — I2 one-shot isolated Worker attempt: I2_PARTIAL_NO_EDIT (one-shot consent consumed)

Claimed once on the operator's direct manual one-shot prompt; executed against the frozen detached worktree at the exact pinned SHA (CI #618 3/3 re-verified at exact head; dispatch HEAD CI #625 3/3). Offline gate at the pinned source: install/check exit 0, workflow-exact Node 254/254, proxy 5/5, FULL Vitest 1243/1243, focused 35/35, native 6/6.

Stage B OS boundary PASSED before any model call: the only available OS principal on this Mac is Seatbelt (`sandbox-exec`) — no Docker daemon, no VM app, no colima/lima. Disposable 0700 guest (new stateDir/Session store/profile home/synthetic two-file fixture; no mounts of real home, original DSH state, production SQLite, Docker socket, SSH agent or host projects). Pre-model probe matrix: in-guest read/write OK; /tmp, home, private canary, real project dir and symlink-escape all DENIED; egress default-denied with only the existing loopback 8123 proxy allowed (untouched), 3080/3083/LAN/cloud/GitHub DENIED; sandboxed bind on one unused 127.0.0.1 ephemeral port in range OK. Nesting proof recorded at probe time: a second Seatbelt profile inside the outer one fails directly (`sandbox_apply: Operation not permitted`, exit 71).

Stage C ran ONE live attempt: DSH 0.2.2-rc.1 disposable instance under Seatbelt with relocated DSH_HOME + fresh state + synthetic registry + local-only model route (zero cloud). Settings seeded into the instance's own SQLite so boot reached configured() without the GitHub restart cascade; runtime ready, setup problem None. One synthetic authorized Trigger (real Weixin-native Source ctx.receive, production-envelope IDs derived, sanitized synthetic peer) injected ONCE: intake `stored`. Lineage observed: one Ticket, one NEW Worker Session/Workspace under the instance's own stateDir work snapshot (bounded two-file copy, workspace-write). Main session: exactly 1 model request + 1 route-accept tool action (strength explicit). Worker: 2 model requests + 3 tool actions of a genuine model-driven turn. FAILURE: the Worker's first real bash tool hit DSH's own inner sandbox backend which cannot nest inside the outer Seatbelt — `SandboxUnavailableError (SANDBOX_UNAVAILABLE)`, `sandbox-exec: sandbox_apply: Operation not permitted`; the model's second call entered `approval/asked` (escalate to danger-full-access) and with no headless answerer wired the request fails closed; the turn stalled. The harness's actual counters (request/header + tool/call) and the 15-minute live watchdog hard-exited the instance inside all ceilings (requests 2, tools 3). Exactly ONE pending Core Outbox acknowledgement receipt correlated to the Ticket, never sent (Weixin transport off). No diff/review record: the edit never landed. Original fixture bytes/modes byte-identical at end (hashes + mode 600); snapshot README still holds the original marker; only the task-owned snapshot dir was created.

Stage E zero drift: original 3080/3083/8123 listeners, process identities/start times, health classes, 3080 session/workspace aggregate, model defaults, 3083 test-home SQLite identity (hash/size/mtime), relay-OFF and real Weixin all unchanged vs the private Stage-A baseline. Cleanup: only task-owned disposable process (self-exited on watchdog) and its temp tree; evidence FROZEN and RETAINED (ambiguous settlement rule honored); nothing installed system-wide; no original daemon killed or config changed.

Gaps for remote owner (report §E): (1) sandbox-backend nesting — DSH's workspace-write bash sandbox cannot apply a nested Seatbelt profile; either fail-closed SANDBOX_UNAVAILABLE or danger-full-access escalation approval is required when an outer OS boundary is already enforced; the escalation path was NOT exercised (budget/live window already ended). (2) headless approval answering over the session surface is unresolved (no approve/answer session method; answerer registration for a headless disposable instance not derived). (3) carried limits: canonical-path string identity (no inode/dev/dirfd anchor), external writers/TOCTOU, same-user marker forgery, cross-root fencing absent, no crash journal for one-shot consent; real source Apply gates remain CLOSED.

Suggested next milestone: a scoped offline change making sandbox-backend selection aware of an already-enforced outer boundary and/or deriving the headless approval-answerer contract, THEN a fresh uniquely-scoped one-shot I2 task via operator manual handoff. This attempt's one-shot consent is consumed regardless of verdict (PASS/FAIL/BLOCKED all consume it — rule honored).

Report: agent-reports/REPORT-ol044-i2-isolated-worker.md

STOP after this result message; OL-20261119-044 done, never replay. Next owner: remote online.
