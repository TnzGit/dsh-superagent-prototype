---
message_id: LO-20261119-043
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
verdict: ALL_OFFLINE_PASS
pinned_source_sha: 6c75c43f43b9133f8796b628155cc278c2025838
---

# LO-20261119-043 — F1/F2 targeted Mac verification complete (ALL_OFFLINE_PASS)

Task OL-20261119-043 claimed once on operator manual handoff; executed fully offline in a fresh detached worktree at the exact pinned SHA (clean before/after). CI #584 re-verified 3/3 at the exact head with per-job counts (Node 254/254 both OS, focused 35/35, proxy 5/5, Vitest 1243/1243).

F1 PASS on the operator macOS 26.3: workflow-exact Node list **254/254 exit 0** (OL-042's 249/253 is closed on this host); native inspector suite **6/6 three consecutive repeats**; provenance-only file now ACCEPTs, unknown user xattr REJECTs (fix 72e30e1 double-read name-list policy verified out-of-suite on fresh 0700 scratch roots). Stage C probes: casefold alias OK, uchg REJECT, hardlink/symlink/world-writable REJECT, **ACL attached still ACCEPTs (flistxattr blind to macOS ACLs — documented blind spot persists)**; directory entries also carry com.apple.provenance (inspector checks dirs for mode/flags only — reported as-is, no relaxation).

F2 PASS: all six new I1F fail-closed cases green 3× inside the focused 35/35 repeats (foreign restored Session refused before model init/tools/permissions/rename; no-membership refuses; registration failure refuses; early agent/created never decorates; post-ensure membership loss fails the tool guard; replay/role-model invariance intact). assertProjectWorkerWorkspace called in ensure (:197), holds (:210), prompt (:218); workOnly tool guard re-checks path+membership per execution (:342-361). Installed DSH API read-only compatibility CONFIRMED on 0.2.2-rc.1 host (workspace/session/session-controller 0.2.1-alpha.2): resolveByPath present (lib/index.js:635, types/index.d.ts:264), Workspace.path getter, filtered sessionIds membership semantics (index.js:102-103), SessionController.resolveAgent, header.cwd creation metadata — F2_HOST_API_COMPATIBLE, no patch required for the installed release.

Full regression on this Mac: install/check exit 0; focused 35/35 ×3; native 6/6 ×3; proxy 5/5; FULL Vitest 1243/1243 exit 0. Stage D: HOST_STAGE_NOT_AUTHORIZED (no real turns/inference/Weixin/I2/I3/Apply; future live stage needs a fresh private one-shot grant). Stage E: ZERO drift (listener PIDs, probes 200/401/404-alive, workspace aggregate 27, model defaults, production SQLite, Weixin, relay-OFF, 3080 LAN config all unchanged); only this batch's disposable resources cleaned.

Remaining open OS limitations carried: DSH identity is canonical-path string equality (no inode/dev/dirfd anchor => path ABA possible); F2 guard is source-level, not an OS security boundary; non-cooperating writers/TOCTOU unmitigated; ACLs invisible to flistxattr; provenance allowlist is name-only (content not authenticated); no crash journal/one-shot capability yet (docs/014 matrix all PENDING).

Report: agent-reports/REPORT-ol043-f1f2-mac-verify.md

Next owner: remote online — (1) OS-isolated apply helper per docs/014 (trusted root fd + inode identity, exclusive writer domain, ACL inspection, crash journal, one-shot capability); (2) provenance/dir-entry + ACL policy decisions before real Apply; (3) then operator-granted I2 as a separate manual handoff; (4) state-sync commit after ACK (mid-sync convergence-guard RED class expected, per OL-041/042 precedent).

STOP after this result message; OL-20261119-043 done, never replay.
