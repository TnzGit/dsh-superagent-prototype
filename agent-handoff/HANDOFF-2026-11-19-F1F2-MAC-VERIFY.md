# OL-20261119-043 — F1/F2 focused operator-Mac verification (MANUAL OFFLINE TASK)

**Prepared by remote ChatGPT on 2026-11-19. This PUBLIC runbook is NOT an authorization to call live DSH Sessions, modify original source, send native Weixin messages, use inference providers, or execute Apply.** The operator must manually hand off the exact task ID. Online automation stays PAUSED; Mac scheduler must not auto-dispatch. This is ONE at-most-once OFFLINE_SYNTHETIC_ONLY + host READ_ONLY task; previous OL-042 is closed.

## 1. Immutable code and expected source CI

Repo: \`TnzGit/dsh-superagent-prototype\`. Feature branch: \`feat/local-first-wechat-foundation\`.

**Freeze the tested source as detached worktree SHA: \`6c75c43f43b9133f8796b628155cc278c2025838\`.** Do NOT quietly test a later moving feature HEAD. Source CI [#584](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44461402757) independently verified **3/3 SUCCESS**, Linux Node 254/254, hosted macOS Node 254/254, Linux/macOS 35/35 focused Vitest, proxy 5/5, full Vitest 1243/1243 with TS typecheck/build pass. Check real job logs and code_sha, not a 3/3 headline alone.

Previous OL-042 report documented operator macOS 26.3 Node **249/253**, four positive \`os-path-inspector\` checks rejected due to macOS \`com.apple.provenance\`; that historical result remains a recorded failure, not retrospectively green. The new F1 code handles only the exactly named provenance stamp. New native synthetic test adds an UNKNOWN xattr and must still be REJECTed.

Previous OL-042 CF1 proved DSH \`resolveAgent\` can reuse a foreign restored Session. New F2 code \`src/app/sessions.ts\` now verifies active Ticket, exact requested registered-project directory, recovered Session \`header.cwd\`, read-only \`workspaceRegistry.resolveByPath\`, exact canonical Workspace path, and filtered \`workspace.sessionIds\` membership before role-model/permission/rename; \`prompt\` and \`holds\` revalidate. Registered-project worker auto-decoration is deferred until \`ensure\` attests the owner; the tool-use guard synchronously checks its current Workspace membership. This closes the source-level ID-reuse path but DOES NOT establish dev/inode, OS-level writer quiescence, full real DSH SessionController or a production Apply helper.

## 2. Claim once / stop and privacy rules

Read root \`LOCAL_AGENT_TASK.md\`, \`LOCAL_AGENT_PROTOCOL.md\`, \`agent-handoff/STATE.json\`, this runbook and \`agent-handoff/messages/to-local/2026-11-19-ol043-f1f2-mac-verify.md\` before running. Verify unique unused task ID and ONE currently active task, previous LO-042 ACK present, code_sha/CI pinned. The operator's manual chat handoff is required. Commit exactly one claimed receipt before test execution; a second claim or stale/different SHA is STOP/BLOCKED.

Private evidence stays under a newly-created owner-only (0700) root outside the repo and actual registered projects. Publish to PUBLIC GitHub only aggregate tests/stage verdicts, sanitized fixture identities, exact SOURCE code SHA, CI links, failure classes, and remediation. NEVER upload original DSH Session/Workspace IDs, original production paths, private IPs, listener PIDs, Weixin peer/message IDs, context tokens, provider credentials, production hash listings, raw host logs or original project contents.

Do NOT modify or restart 3080/3083/8123, production settings, macOS launchd/DSH schedulers, existing Workspace/Session/history/SQLite, model/provider default, native Weixin or registered project source. The 3080 LAN owner-access configuration is an intentional invariant and must not be adjusted. I2/I3, real 3080/3083 DSH prompts, actual model inference and any real Apply remain **NOT AUTHORIZED**. No privilege escalation, system security change, scheduler enabling, background jobs or writes to any non-disposable root. Stop, preserve PRIVATE evidence and report if any original-host identity/config/source drifts.

## 3. Stage A — immutable source and private read-only baseline

1. Independently fetch and verify \`6c75c43f43b9133f8796b628155cc278c2025838\` is ancestor of dispatch, CI #584 3/3 at that exact source SHA, actual named macOS/Linux test counts, OL-043 has no old claimed/done receipt, OL-042's online ACK exists.
2. Create a BRAND NEW isolated 0700 temp worktree at the SOURCE SHA with clean index; record private Git/Node/pnpm/clang/OS/DSH versions, no original data copy.
3. READ ONLY: capture original 3080/3083/8123 listener/process identities, published health probe classifications, original DSH Workspace/Session aggregate counts, model/provider defaults and relay-OFF state. Do not expose sensitive raw values. Check online automation remains PAUSED and local DSH/launchd scheduling status read-only; do not change either.

## 4. Stage B — focused F1/F2 macOS regression + CI-equivalent safety

From the immutable detached fixture checkout, run:

\`\`\`sh
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm check
pnpm exec vitest run tests/local-ticket-worker-preview.spec.ts tests/local-ticket-worker-session.spec.ts tests/real-apply-contract.spec.ts tests/local-agent-delivery-session.spec.ts tests/local-sessions-worker-boundary.spec.ts tests/local-vertical-real-sessions.spec.ts
node --experimental-strip-types --test tests/os-path-inspector.node-test.mjs
\`\`\`

- Run the six-file focused Vitest 35/35 at least **3 consecutive times**. Run the native OS path-inspector Node 6/6 at least **3 consecutive times** to establish the macOS 26.3 provenance issue is FIXED (unless a documented new environment deviation appears).
- Execute the EXACT workflow Node command in \`.github/workflows/local-first-core.yml\` (25 Node files with 254/254 expected), proxy 5/5, \`pnpm exec vitest run\` full 1243/1243, typecheck and build. Record actual counts, exit codes, durations, repeat breakdown, no silent skips; if counts differ report rather than invent.
- F1: on NEW scratch ordinary files verify auto-provenance alone yields \`OK\`, unknown additional xattrs yield \`REJECT\`, unsafe mode/links/FIFO/hidden/traversal remain \`REJECT\`. Tests MUST mutate only disposable synthetic fixture files. Do not clear provenance, alter OS security policy, target user projects or infer xattr provenance content is authenticated.
- F2: run existing 11-case \`local-sessions-worker-boundary.spec.ts\` and verify foreign restored Session header, missing registry membership, failed registration, invalid/ended Ticket, misbound cwd, replay, role-model/default invariance, early agent/created decoration refusal and post-attestation Workspace membership loss. Verify actual \`src/app/sessions.ts\` source and installed \`@deepseek-ai/dsh-workspace\`/SessionController API types **READ ONLY** (resolveByPath, path/sessionIds account, header.cwd). Do not create or manipulate a real 3080 Session.

## 5. Stage C — narrow APFS compatibility / remaining OS caveats

On disposable 0700 temp roots ONLY, optionally repeat isolated tests for casefold aliases, \`com.apple.provenance\` exactly-named system xattr vs synthetic nontrivial xattrs, \`uchg\`, ACL visibility and symlink/hardlink/path-ABA. Record how many F1 pre-fix cases now pass. macOS 26.3 provenance may be present on directory entries as well, but the current inspector only checks final ordinary-file xattrs; report other metadata if discovered, do not relax code or permission on the host. Probing \`fsetxattr\` in the separate TEST FIXTURE is allowed only on fresh scratch files, never the research inspector executable's production use.

F2 remaining limitations are important: DSH registry identity is canonical realpath string, not stable \`st_dev/st_ino\` or trusted dirfd; the new guard does not stop non-cooperating writers/path replacement, so this is a **source-level restored-Session reattachment guard**, not an OS security boundary. If the installed DSH release lacks \`resolveByPath\` or filtered membership semantics, report \`F2_HOST_API_INCOMPATIBLE\`, STOP before any host activity, provide sanitized API version, source location and precise remote patch suggestion.

## 6. Stage D — genuine live host: NOT AUTHORIZED

**DEFAULT STOP** before real SessionController.create/resolveAgent on original 3080/3083, any actual Agent turn/model route, Weixin, I2 or I3. A later real staging attempt requires a NEW separately private operator grant binding exact disposable target/profile, permitted commands, provider/port, time, rollback and one-shot correlation after remote review. Historic C5.5B/OL-041/OL-042 permissions cannot be reused. Real registered-source Apply is forbidden even if a future I2 stage is approved.

## 7. Stage E — invariant comparison / sanitized publication / handback

- Compare private pre/post all real 3080/3083/8123 listener/process/settings/probe, original Session/Workspace aggregate, production database identity, model default and original source invariants. Any drift causes STOP/BLOCKED; never auto-repair original host. Cleanup ONLY this task's disposable worktree/native binaries/fixture roots.
- Publish **one** sanitized \`agent-reports/REPORT-ol043-f1f2-mac-verify.md\`, ONE \`agent-handoff/messages/to-online/2026-11-19-lo043-f1f2-mac-verify-done.md\` and exactly one claimed/done receipt under \`agent-handoff/receipts/local/OL-20261119-043-{claimed,done}.md\`. Use a clean report-only worktree from latest remote feature HEAD, guarded normal fast-forward push, staged diff and privacy review. Do not edit STATE.json, CURRENT_STATE.md, WORK_QUEUE.md, LOCAL_AGENT_TASK.md, product code, CI or main.
- Report must list per-stage PASS/FAIL/BLOCKED/NOT_TESTED, actual whole Node/Vitest/proxy counts, 3x F1 and F2 repeat results, provenance auto-stamp positive and unknown-xattr rejection, real installed DSH API signature compatibility, fail-closed foreign restored Session and tool guard, no source mutation, zero drift, cleanup and rollback, exact next remote-owned issue list. Do not claim a real DSH E2E or source Apply pass.

Offline acceptance requires the operator-mac F1 native tests to be **6/6**, all Node 254/254, focus 35/35, full 1243/1243, proxy 5/5, and no production drift; otherwise report \`ENV_REGRESSION\` or \`BLOCKED\`, not \`ALL_OFFLINE_PASS\`. Unauthorized real Stage D is \`HOST_STAGE_NOT_AUTHORIZED\`, not an offline failure.
