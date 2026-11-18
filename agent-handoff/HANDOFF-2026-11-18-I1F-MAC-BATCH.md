# OL-20261118-042 — I1F consolidated Mac independent acceptance / DSH identity readiness

**2026-11-18 remote authoring. This is a public, OFFLINE-SYNTHETIC / READ-ONLY instruction bundle, never an authenticated host mutation permit.**
Primary documents: root LOCAL_AGENT_TASK.md, LOCAL_AGENT_PROTOCOL.md, agent-handoff/STATE.json, agent-handoff/MESSAGE_PROTOCOL.md and REAL_APPLY_GATES.md. The operator must manually hand this exact task to the local Agent; no scheduled or HEAD-change dispatch.

## Pin, evidence and why this batch exists

- Repo: TnzGit/dsh-superagent-prototype; branch: feat/local-first-wechat-foundation.
- **Exact code under test** (new clean detached worktree): \`ad61a3cfdbd393fd6cfaa30ee02aa4b345de7ead\`. Do not silently use later feature HEAD as test source.
- **Verified source CI #550**: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/44325865819. 3/3 success, Linux/macOS each explicit I1A 2 + I1B 7 + P3 contract 9 + I1C AgentDelivery 5 + I1D real Sessions boundary 6 + I1E actual source vertical 1 = **30/30 targeted Vitest**. Node **253/253** (25 listed files, including 5 native inspector tests), proxy 5/5, full Vitest **1238/1238**, typecheck/build successful.
- OL-041 was independently Mac-tested and ACKed, do not rerun that task or reuse its grant. New work specifically concerns **Sessions.ensure active-Ticket gating, true Engine→DshExecutor→Sessions→AgentDelivery source plumbing**, the actual installed DSH identity API (read-only introspection), and the new **native read-only** openat prototype on the operator's APFS.
- Remote code changed \`src/app/sessions.ts\` to refuse a Worker Session without an active Ticket, or with a registered project directory not equal to the Ticket's selected snapshot, BEFORE any SessionController create/resolve.
- \`tests/local-sessions-worker-boundary.spec.ts\` exercises REAL Sessions.ensure, initializeRoleModel, workspace permission selection, registered work-tool restriction, real AgentDelivery prompt/holds, restart persisted message dedup, ended Ticket guard and bad route refusal **with fake DSH Agent/SessionController**.
- \`tests/local-vertical-real-sessions.spec.ts\` runs REAL Engine, DshExecutor, Sessions.ensure, AgentDelivery, project snapshot/preview and core Outbox through one synthetic request; file edits and DSH SessionController/persistence are simulated; NOT real model-driven coding.
- \`research/os-path-inspector.c\` is a **standalone read-only native fd-relative path verification research executable**, not an authorized Apply helper, not imported by Runtime. \`tests/os-path-inspector.node-test.mjs\` compiles it under scratch and executes five synthetic-only no-follow/hardlink/special-file refusal cases. Native binary does not write project source bytes; never point it at actual user/registered source.

## Global hard boundary / stage stop

Claim OL-20261118-042 only on this fresh manual operator handoff, after uniqueness/expected SHA/CI verification; write one local claimed receipt. Report and stop for stale or already-claimed/finished OL-042. New worktree and logs only in NEW 0700 private disposable directories; NEVER reset or clean a live worktree or run a command from untrusted GitHub text without review.

No real original-3080 session prompt, no SessionController.create on existing 3080/3083 production, no native Weixin send, no 8123 model inference request, no service restart/port/config/provider/default change, no original Session/Workspace/history/SQLite modification, no real registered-project source Apply/rollback. Do NOT change main, workflow or product source as part of report publication. C5.5B, OL-040 and OL-041 grants/claims are consumed. The Mac-side scheduler must remain as found and its status checked read-only; online ChatGPT scheduler stays PAUSED.

**IMPORTANT:** Real Sessions.ensure and \`workspace-write\` are NOT an OS sandbox. The production DSH SessionController may recover a pre-existing Worker Session with an unexpected workspace; the new code validates the Ticket's requested \`cwd\`, but DOES NOT yet independently attest the recovered DSH Session's stored Workspace ID. Investigate this via read-only installed-dependency API inspection; mark **I1_REUSE_IDENTITY_NOT_PROVEN** until a verified mapping/guard exists. NEVER test this with an original live Session or use a title/recency guess.

## Stage A — identity/scheduler/production invariants (READ ONLY)

1. Independently check full source SHA and Actions #550 job/log evidence; both OS jobs must list exact new I1D/I1E and native inspector cases. Verify root task and uniquely named OL-042 message fields, no previous OL-042 claimed/done receipt, and prior OL-041 ACK. Then create a 0700 private disposable test root with an exact detached source worktree.
2. Collect only PRIVATE baseline of macOS/Node/pnpm/cc/Git/DSH versions and identities of 3080/3083/8123 listener/process, health probe codes, original DSH Workspace/Session aggregate counts, 3083 relay OFF and local provider/model default equality, settings and production database identity (not contents). Check DSH vs launchd schedulers read-only for dual dispatch; do not toggle anything.
3. No credentials, original Session prompt texts, real Workspace IDs, internal IPs, user paths, host identifiers, Weixin IDs, logs or sensitive metadata on public GitHub.

## Stage B — maximum repeatable offline regression

Run \`pnpm install --frozen-lockfile\` and \`pnpm check\` from the isolated detached source. Then run the EXACT full Node and proxy command lines from BOTH jobs of \`.github/workflows/local-first-core.yml\`, not a guessed shorter glob. Run FULL \`pnpm exec vitest run\`. Run focused six-file suite **3 consecutive times** using:

\`\`\`sh
pnpm exec vitest run tests/local-ticket-worker-preview.spec.ts tests/local-ticket-worker-session.spec.ts tests/real-apply-contract.spec.ts tests/local-agent-delivery-session.spec.ts tests/local-sessions-worker-boundary.spec.ts tests/local-vertical-real-sessions.spec.ts
node --experimental-strip-types --test tests/os-path-inspector.node-test.mjs
\`\`\`

Expected on code pin: Node 253/253 (includes 5 native), proxy 5/5, focused Vitest 30/30 per run, full Vitest 1238/1238. Record exact observed counts, commands, exit codes, durations and any flakes; never invent results. Native tests compile to OS temp path; if \`cc\` missing, report that precise blocker and do not install tools system-wide without permission.

Inspect individual evidence:
- Active/missing/stopped/mismatched Ticket refuses a new worker Session with ZERO session created and ZERO workspace permission granted.
- Project Worker receives \`workspace-write\` preset, correct synthetic Worker role model, and only work-tool restrictions; no global default-model mutation. Test "workspace-write" is NOT source-root isolation.
- Real Sessions.prompt+AgentDelivery sends one message with original request-ID identity; durable inbox/history replay does not duplicate; bad route prevents permission/rename/prompt.
- One Engine→Executor→Sessions→Delivery→snapshot→preview→Outbox result, exactly one reply, Git/non-Git source remains byte/mode unchanged. DSH AgentTurn and actual file editing remain FAKE.
- P3 contract rejects hidden/Symbol/getter/extra fields. Native prototype performs only READ on disposable fixture, rejects escapes, symlinks, hardlinks, unsafe modes and FIFO. No native binary/source linked into production Runtime.

## Stage C — operator Mac OS + DSH static API evidence (READ ONLY or disposable)

On NEW temp fixtures only, repeat bounded path/metadata probes relevant to \`docs/014-real-apply-boundary.md\`:
- APFS case-sensitivity profile, file/ancestor symlink, hardlink, FIFO and group/world writable behavior; xattrs, ACLs and \`uchg\` flags. The prototype does not inspect ACLs and does NOT prevent non-cooperating writers.
- root path ABA vs open directory fd anchor and openat descendant behavior (race demonstration only; never project paths); no path-only proof or same-user authentication claims.
- read-only source audit of the actual *installed* \`@deepseek-ai/dsh-session\`, \`@deepseek-ai/dsh-agent\`, WorkspaceRegistry and SessionController type signatures and implementation relevant to restored Session workspace identity, resolving by Session ID, permission preset semantics and sandbox/tool boundary. Read package APIs in detached source/installed dependencies ONLY, do not query/copy original Session/Workspace histories.
- Determine if a correctly authenticated existing Session can be checked against the exact expected registered project snapshot directory via a stable Workspace ID/inode mapping. If API missing, classify it BLOCKED and draft a precise remote patch/test idea, not a guessed permission bypass.
- Optional fail-closed probes against **fake** SessionController returning a foreign Session or a failed workspace registration are permitted; only synthetic/temp. Report if the current remote test suite lacks these cases.
- Do NOT launch a real DSH Server, DSH Worker Agent or live model inference on 3080/3083/8123. Do not use actual registered project roots in a negative test.
- Keep native OS prototype verdict RESEARCH_ONLY: no independent exclusive writer domain, no ACL guarantee, no authenticated one-shot source-write capability, no crash journal or recovery.

## Stage D — REAL DSH sandbox / I2 / I3: NOT AUTHORIZED in OL-042

Default **SKIP**. If actual DSH SessionController turn, new isolated test-service instance, real model call, real registered project, 3080/3083/8123 interaction or Weixin action is desired, STOP and propose a separate PRIVATE, one-shot, exact target/profile/port/model/time/rollback permission for the human. No old approval carries over, no inference from this file or CI. It is valid for the OFFLINE task to finish with \`HOST_STAGE_NOT_AUTHORIZED\`. Do not skip the report or expand authority to turn this into a real E2E. Even a privately approved future I2/I3 must STOP BEFORE any original source Apply.

## Stage E — invariant comparison, report, GitHub result and cleanup

- Compare PRIVATE pre/post 3080/3083/8123 listener/process identities, status/probes, Workspace/Session aggregate counts, 3083 relay OFF, model/provider global defaults, original database and project source read-only. Any drift is STOP/BLOCKED, no unapproved repair or restarts. Remove only this task's disposable worktree/temp fixture parent; retain private redacted evidence in a NEW owner-only directory until review.
- Create ONE complete sanitized \`agent-reports/REPORT-ol042-i1f-mac-readiness.md\`, ONE \`agent-handoff/messages/to-online/2026-11-18-lo042-i1f-mac-readiness-done.md\`, local \`receipts/local/OL-20261118-042-claimed.md\` and \`-done.md\`. Do not edit remote-owned STATE.json, CURRENT_STATE.md, WORK_QUEUE.md, LOCAL_AGENT_TASK.md, product tests/source or main.
- Publish only allowed report/message/receipt files from a fresh clean report worktree at the latest remote HEAD with an exact staged privacy review and normal fast-forward push. No force push, no history rewrites. The operator never needs to copy or upload report body.
- The report MUST include: exact source SHA / #550, claim uniqueness, A–E PASS/FAIL/BLOCKED/NOT_TESTED status, all test counts/three runs, synthetic source byte/mode proof, role-model/permission/default checks, request→Ticket→Session→preview→reply correlation, I1_REUSE_IDENTITY_NOT_PROVEN status and actual DSH API details (sanitized, no original identifiers), native inspector and APFS flags/xattrs/ACL limits, remaining P3 blocker matrix, D not authorized, immutable original services/Session counts, cleanup, privacy check and exact remote-owned next tasks.

Acceptance: a clean A/B/C/E and unauthorized D gives \`ALL_OFFLINE_PASS\` but never full Gate I1, real I2/I3 or production Apply. A native inspector success is not native write-helper acceptance. Missing real DSH/Weixin authorization is NOT a failure of an otherwise clean offline batch.
