# OL-20261119-043 — F1/F2 targeted Mac verification (sanitized)

Verdict: **ALL_OFFLINE_PASS** (F1 fixed and verified on the operator Mac; F2 attestation verified on the real Mac with synthetic controllers; installed-DSH API compatible; zero host drift).

## 1. Handoff validation

- Claimed ONCE on operator manual handoff: private claim + GitHub claimed receipt commit `3150397956a2d9595e3e072a5a87294cf08d464b`, FF `e20a0fb..3150397` (ls-remote verified).
- Dispatch HEAD `e20a0fb9f4eabdcf10d288351d1369a0d3af1e18`; pinned source `6c75c43f43b9133f8796b628155cc278c2025838` IS an ancestor of dispatch; pinned→dispatch diff = 12 files, handoff/docs/protocol only (zero src/test changes).
- Message schema valid (`message_id: OL-20261119-043`, from online, to local, type task, scope OFFLINE_SYNTHETIC_ONLY, exact 40-hex `code_sha` verbatim in current `LOCAL_AGENT_TASK.md`, single matching to-local message). No prior claimed/done receipt; OL-042 online ACK exists (`agent-handoff/receipts/online/LO-20261118-042-done.md`).
- Source CI #584 run 44461402757 independently re-verified via gh API: conclusion success at exact `head_sha 6c75c43f` (local-first-core, macos-portability, dsh-typecheck-and-build). Job-log counts match the runbook: Node 254/254 both OS, focused 35/35 both OS, proxy 5/5, full Vitest 1243/1243.

## 2. Stage A — baseline + isolated worktree (PASS)

Host (sanitized): macOS 26.3 (25D125) arm64; node v25.9.0; pnpm 11.7.0; git 2.50.1; installed dsh 0.2.2-rc.1. Listeners: three node processes on `*:3080` (LAN owner-access, unchanged), `127.0.0.1:3083`, `127.0.0.1:8123` (process identities recorded privately, not published). Probes: 3080 `/`→200, 8123 `/v1/models`→401 (client-key), 3083 `/health`→404-alive. Workspace aggregate 27 (private catalog snapshot, count only). Relay env absent → relay-OFF holds.

Stage worktree: fresh 0700 parent under OS temp, detached at exact `6c75c43f`, `git status` clean before and after. No product-source edits anywhere in this batch.

## 3. Stage B — CI-equivalent regression on the operator Mac (PASS, all targets met)

| Check (at pinned SHA) | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 (729ms) |
| `pnpm check` (typecheck + test + build) | exit 0 (build 1436ms) |
| Workflow-exact 25-file Node list | **254/254 pass, exit 0** (5644ms) — includes `tests/os-path-inspector.node-test.mjs` 6/6 on this Mac |
| Focused 6-spec Vitest (CI #584 command) | run1 35/35 exit 0, run2 35/35 exit 0, run3 35/35 exit 0 (three consecutive) |
| Native `node --test tests/os-path-inspector.node-test.mjs` | run1 6/6, run2 6/6, run3 6/6 (three consecutive) |
| Proxy suite | 5/5 exit 0 |
| FULL Vitest (68 files) | **1243/1243 exit 0** (18.3s) |

The OL-042 local 249/253 failure is now closed on the operator Mac: 254/254 with all four previously-failing provenance cases positive (historical OL-042 record remains a recorded failure, unchanged).

## 4. F1 — provenance fix verification (PASS)

Fix commit `72e30e193a9958ea2f78e4ad75a1f2b3ee6362fb`: `no_extended_attributes()` now reads the actual name list twice (bounded second read rejects list races; >8192 or malformed names rejected) and accepts ONLY the exactly-named `com.apple.provenance`, on Darwin only (Linux has no exception). New test `rejects unknown user xattrs, even if macOS has system provenance` (synthetic xattr maker `tests/fixtures/os-xattr-fixture.c`). Provenance content is NOT treated as authenticated — name-only allowance, per the fix's own comment.

Direct probes with the compiled inspector on fresh 0700 scratch roots (§6) confirm the same verdicts out-of-suite.

## 5. F2 — restored-Session Workspace attestation (PASS, gaps closed at source level)

Fix commits `1508059` (attest), `5c7ed00` (simulate ownership), `21e234a`/`54e1d29` (defer decoration + tool guard), `61f415e`/`6c75c43` (strict typing/import). `src/app/sessions.ts`: new `assertProjectWorkerWorkspace(sessionId, agent)` (:158) checks active Ticket, snapshot directory, `workspaceRegistry.resolveByPath(expected)` (read-only, same realpath canon), `workspace.path === expected`, `agent.session.header.cwd === expected`, and filtered `workspace.sessionIds.includes(sessionId)` — called in `ensure` after `resolveAgent` (:197, before model init/permission/rename) and re-validated in `holds` (:210) and `prompt` (:218). `agent/created` decoration deferred until attestation; `workOnly` tool guard (:342-361) re-checks Workspace path + membership synchronously on every tool execution.

All six new I1F cases pass 3× on the real Mac (inside the 35/35 focused runs): restored foreign Session fails before model init/tools/permissions/rename; matching-cwd-without-membership fails closed; registration failure refuses without create/permissions; early `agent/created` never decorates before attestation; membership deleted after `ensure` → tool guard fails closed; replay/role-model invariance intact.

Installed DSH API read-only compatibility (dsh 0.2.2-rc.1 host; workspace/session/session-controller packages 0.2.1-alpha.2): `WorkspaceRegistry.resolveByPath(path): Promise<Workspace|undefined>` present in installed `lib/index.js:635` + `types/index.d.ts:264`; `Workspace.path` getter (:90); filtered `get sessionIds()` = `record.sessionIds.filter(id => host.sessionPath(id) === record.path)` (:102-103) — same membership-filter semantics the remote fix relies on; `SessionController.resolveAgent` (:210); session header `cwd` is validated absolute creation metadata (`dsh-session` types). **F2_HOST_API_COMPATIBLE** — no patch needed for installed-release compatibility.

## 6. Stage C — narrow APFS probes on fresh 0700 roots (PASS, synthetic only)

Compiled pinned inspector, fresh scratch root: final ordinary file with auto-provenance alone → **OK**; casefold alias `SAFE/f.txt` → OK (alias walk lands on same inode); `uchg` → REJECT (st_flags); **ACL attached → still OK — macOS ACLs are invisible to `flistxattr`** (documented blind spot remains); unknown user xattr (`user.test`) → REJECT (with provenance also present); hardlink → REJECT; symlink → REJECT; world-writable → REJECT. Directory entries carry `com.apple.provenance` too (measured on `root/safe`), but the inspector checks directory entries only for mode/flags, not xattrs — reported as-is, no relaxation.

## 7. Stage D — real host

NOT AUTHORIZED. `HOST_STAGE_NOT_AUTHORIZED`: no real 3080/3083 Session prompt or Agent turn, no new DSH instance, no live inference, no Weixin, no I2/I3, no real registered source, no Apply. A future live stage needs a fresh exact private one-shot grant (target/profile/port/model/time/rollback); C5.5B/OL-041/OL-042 grants are consumed and never reused.

## 8. Stage E — invariant comparison (PASS, zero drift)

Post-run vs baseline identical: the three listener processes on 3080/3083/8123 unchanged (same PIDs, recorded privately); probes 200/401/404-alive; workspace aggregate 27; model/provider defaults, production SQLite, historical Sessions/Workspaces, native Weixin config, relay-OFF, 3080 LAN owner-access — all untouched. Cleanup: disposable worktree parent + compiled inspector + scratch roots removed (fixtures self-remove); private evidence outside the repo.

## 9. Remaining open OS/security limitations (carried, unchanged)

1. DSH Workspace identity = canonical realpath **string equality**, no `st_dev/st_ino`/dirfd anchor → path ABA and same-path directory swap are invisible to the registry; the F2 guard is a source-level reattachment guard, NOT an OS security boundary.
2. Non-cooperating writers / TOCTOU remain unmitigated (no exclusive writer domain).
3. macOS ACLs invisible to `flistxattr` — a real apply helper needs an ACL inspection path; ACL/xattr/flags/hardlink/symlink metadata must be rejected or fully preserved+verified (docs/014 matrix all PENDING).
4. Provenance name-allowlist is name-only; content not authenticated; same-user marker forgery still integrity-evidence-not-signature.
5. No crash journal / recovery / one-shot private write capability yet; power-loss durability unproven.

## 10. Exact next remote tasks

1. OS-isolated apply helper (trusted root fd + inode identity, exclusive writer domain, ACL inspection path, crash journal, one-shot capability) per docs/014 — F2 guard is not a substitute.
2. Consider extending the provenance-name policy decision for directory entries + ACL-bearing files BEFORE real Apply (measured here: dirs carry provenance; ACLs invisible to flistxattr).
3. After 1–2 land with own CI 3/3, propose operator-granted I2 (isolated disposable copy, STOP BEFORE source Apply) as a separate manual handoff; then separately I3.
4. State-sync commit after ACKing LO-043 (per OL-041/042 precedent, convergence guards may be red mid-sync on the report HEAD — expected class, not reclassified).
