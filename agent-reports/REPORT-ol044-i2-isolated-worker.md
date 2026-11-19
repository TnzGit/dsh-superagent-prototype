# OL-20261119-044 — I2 real DSH Worker one-shot isolated staging (verdict: I2_PARTIAL_NO_EDIT)

**Date:** 2026-11-19/20 (local). **Task:** OL-20261119-044 / response LO-20261119-044. **One-shot manual operator consent — consumed by this attempt.**

## Verdict

`I2_PARTIAL_NO_EDIT` — the OS boundary, offline gate, startup, admission and trigger lineage all PASSED, and one genuine model-driven Worker tool turn occurred, but the edit never completed: DSH's own inner bash sandbox cannot be nested inside the outer macOS Seatbelt confinement, so the Worker's first real file-tool command failed with `SANDBOX_UNAVAILABLE`, asked for a sandbox escalation approval (a headless answerer is not wired), and the live window ended on the bounded watchdog before any edit. No diff/review record was produced. The one-shot consent was NOT retried and no second Worker was started.

## A. Source and gate validation

- Frozen source SHA `c0da76b14f4893397428c025670f731e0629555d`; GitHub Actions #618 (run 44482434876) 3/3 SUCCESS at that exact SHA; dispatch HEAD `c6f1d785167c3ef296ee8f322b832e8bbb942f8b` CI #625 3/3. Claim receipt at `a28587b` (CI #628/#629 green).
- Detached worktree exactly at the frozen SHA; product source and tests unchanged between it and dispatch HEAD.
- Offline gate at the frozen source: `pnpm install --frozen-lockfile` and `pnpm check` exit 0; workflow-exact 25-file Node list 254/254; proxy suite 5/5; full Vitest 68 files 1243/1243; focused 6-spec 35/35; native inspector 6/6.

## B. OS boundary (verified BEFORE any model call)

- Environment category: **genuinely restricted OS principal = macOS Seatbelt (`/usr/bin/sandbox-exec`)**. Inventory: Docker CLI 29.6.0 present but **no daemon socket**, no Docker.app, no UTM/Parallels/VMware/OrbStack, no colima/lima, no VM. Seatbelt is the only real OS permission boundary available on this host.
- Disposable guest: one owner-only `0700` temporary tree under the system temp volume (new stateDir, new Session store, new synthetic project + two fixture files, new profile home). No mounts of the real home, original DSH state, production SQLite, Docker socket, SSH agent or host project directories.
- Pre-model probe matrix (harmless synthetic programs run under exactly the guest's effective restrictions): writes/reads **inside** the guest succeed; writes to system `/tmp` and the user home **DENIED**; the private canary outside the guest **read DENIED**; the real project directory **read DENIED**; a symlink escape out of the guest **read DENIED**; egress default-denied: only `localhost:8123` allowed (HTTP 401 = reachable through the bounded proxy; original 8123 config untouched), while the original 3080, 3083, LAN model host, cloud API and GitHub API were all **DENIED** (curl exit 7/6). Sandboxed listener bind on one unused `127.0.0.1` ephemeral port inside the required range succeeded.
- Nesting proof (run at probe time, and again at the failure): applying a *second* Seatbelt profile inside the outer one fails directly — `sandbox-exec: sandbox_apply: Operation not permitted` (exit 71). This is the exact mechanism that later blocked the Worker.

## C. Live disposable DSH run (one attempt)

- Installed runtime: DSH CLI `0.2.2-rc.1` (macOS 26.3, Node v25.9.0). Startup derived from the installed package: profile mount verified with `--dump-config` before booting; the disposable instance was launched under the Seatbelt profile with a relocated `DSH_HOME`, fresh `stateDir`, the synthetic project registry file (0600) and the local-only model route (existing local proxy on loopback, zero cloud fallback).
- Settings were seeded into the fresh instance's own SQLite (revision 1, github source disabled, weixin allowlisted synthetic peer, policy allowlist) so the boot reached `configured()` without the GitHub restart cascade; runtime health went `ready`, setup problem `None`.
- One synthetic authorized Trigger with explicit `/project` selector was injected **once** through the real Weixin-native Source context (`ctx.receive`) by a task-owned harness plugin; intake result `stored`; trigger identity derived exactly like the production `messageToTrigger` envelope (sanitized synthetic peer/message IDs).
- Lineage observed: one Ticket, one NEW Worker Session and Workspace under the instance's own `stateDir/work/<project>/<ticket>` snapshot directory (bounded copy of the two-file fixture, git-init'd copy, `workspace-write` preset on the Worker). The main Session made exactly **1 model request + 1 tool action** (route accept, strength `explicit`). The Worker made **2 model requests** and **3 tool actions** in its genuine turn (first bash `ls -la && pwd` executed via the real tool pipeline).
- **The failure:** the Worker's first bash tool returned `SandboxUnavailableError` (`SANDBOX_UNAVAILABLE`): `sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host … Runner failure: sandbox-exec: sandbox_apply: Operation not permitted` — DSH's inner sandbox backend cannot nest inside the outer Seatbelt. The model then issued a second bash call which entered `approval/asked` (escalate to danger-full-access); with no headless answerer wired, the request fails closed and the turn stalled.
- Hard ceilings were enforced by actual counters, not promises: the harness counted `request/header` (model requests) and `tool/call` (tool actions) session events with caps 6/10 and a 15-minute live timer; the timer fired first and the process hard-exited (`live_time_exceeded requests=2 tools=3`) — well inside all ceilings. No out-of-scope path, provider, port or file access was observed during the run.
- Correlated Core Outbox record: exactly **one** pending `acknowledgement` receipt bound to the Ticket, never sent (Weixin transport OFF; delivery stays queued). No reply/diff record was produced because the edit never happened.
- Fixture invariants: original two-file disposable fixture source bytes and POSIX modes **byte-identical** (verified by hashes and mode 600 at end of run); the Worker snapshot README still holds the original marker (no edit landed); only the task-owned snapshot directory was created.
- Optional negative case (invalid selector): exercised inside the offline Gate I1/I1B suite at the frozen source, not re-run live with extra inference.

## D. Zero drift + cleanup

- Original host: listeners and process identities for 3080/3083/8123 unchanged (same PIDs and start times as the private Stage-A baseline); health classes unchanged (8123 unauthenticated `/v1/models` → 401, 3083 orchestrator state → 403, 3080 aggregate unchanged); 3080 historical Session/Workspace aggregate identical; model defaults unchanged (same provider/model/effort, provider base URL and key env untouched, exact values kept in the private baseline only); the 3083 test-home production SQLite identity unchanged (same hash, size and mtime as the private baseline); relay remains OFF; real Weixin untouched.
- Cleanup: only the task-owned disposable DSH process (exited on its own watchdog) and its temp tree were touched; the guest evidence was **frozen and retained** for human reconciliation (ambiguous settlement rule), and this report/publication is the only external output. No original daemon was killed, no config of any original service was changed, nothing was installed system-wide.

## E. Remaining OS/safety gaps (for the remote owner)

1. **Sandbox nesting:** on a host whose only OS boundary is Seatbelt, DSH's `workspace-write` bash sandbox backend cannot apply a nested profile; the tool either fails closed (`SANDBOX_UNAVAILABLE`) or requires a danger-full-access escalation approval. The escalation path was **not exercised** in this attempt because answering it would have consumed more of the one-shot budget and the live window had already ended. Outer-boundary confinement remained in force throughout.
2. **Headless approval answering:** the `approval/asked` → answerer contract over the session surface is unresolved (no `approve`/`answer` session method exists; answerer registration for a headless disposable instance is not derived). Remote should derive/fix this before the next I2 attempt.
3. Carried limits: canonical-path-string identity (no inode/dev/dirfd), external writers/TOCTOU, same-user marker forgery (integrity evidence, not a signature), cross-root fencing absent, no crash journal for one-shot consent, real source Apply gates remain CLOSED.

## F. Suggested next remote task

A new uniquely-scoped milestone that (a) makes the runtime sandbox backend selection aware of an already-enforced outer boundary (or provides a headless approval answerer path), and only then (b) dispatches a fresh one-shot I2 staging task. This attempt's one-shot consent is consumed regardless of verdict.
