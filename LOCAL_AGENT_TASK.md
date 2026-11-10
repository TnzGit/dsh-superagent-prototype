# LOCAL_AGENT_TASK — CURRENT: C6B2B4E OFFLINE SYNTHETIC REGISTRY-BINDING PREFLIGHT

New OL-20261111-006 is a `type: task`, `scope: OFFLINE_SYNTHETIC_ONLY`. All OL-001/003/004/005 are closed and must never be replayed.
Repository TnzGit/dsh-superagent-prototype branch feat/local-first-wechat-foundation.
**Exact source SHA:** `ef370ba84567f1fa90f968acf2b2d01bce7f26e2`.
**Source CI:** #269 https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42914176248 — independently verified 3/3 success (Linux core, macOS portability and typecheck/build). Linux Node 195/195, proxy 5/5, Vitest 1208/1208. The amended ledger suite with 3 new preflight tests was actually executed in both Linux and macOS jobs.

## Gate 0 — claim, exact SHA, privacy

Read latest agent-handoff/README.md, PROJECT_CONTEXT.md, CURRENT_STATE.md, WORK_QUEUE.md, SECURITY.md, MESSAGE_PROTOCOL.md, REAL_APPLY_GATES.md, LOCAL_AGENT_PROTOCOL.md, this task, and to-local OL-20261111-006. Also inspect source `src/local-first/non-git-synthetic-approval-ledger.ts`, registry `src/local-first/project-registry.ts` and projectFingerprint in project-workspaces.ts. Claim once BEFORE any substantial work: append local-owned `agent-handoff/receipts/local/OL-20261111-006-claimed.md` and private exclusive state; claimed-without-done is never auto-replayed. Only normal fast-forward report/document pushes; never alter product code locally.

## Gate A — independent Mac offline acceptance

1. Fresh clean detached worktree at exact SHA. Independently verify each CI #269 job success and that `tests/local-nongit-synthetic-approval-ledger.node-test.mjs` actually appears in both Linux and macOS workflow commands. Run `pnpm install --frozen-lockfile`, `pnpm check`, full Node file suite, standalone ledger suite and proxy suite; report every exit code and exact count.
2. Create ONLY disposable owner-only `0700` synthetic project & allowed root in a separate OS temp fixture, plus a distinct `0700` `dsh-ledger-synthetic-*` root with owner-only `0600` marker, private ledger and journal. Build `LocalProjectRegistry` from synthetic project, compute `projectFingerprint`. Inspect `inspectRegistryBoundSyntheticApproval` as a READ-ONLY gate: correct project ID/fingerprint/marker/journal returns canonical bound facts without creating any approval record.
3. Negative matrix, always zero new ledger entries and unchanged synthetic source bytes/modes: unknown project ID, mismatched reservation fingerprint, wrong marker fingerprint, 0644/corrupt/symlink marker, marker unexpected keys, second separate private journal, symlinked/journal or registered project root swapping after registry creation, and readOnly project. Verify no automatic retries or grant consumption in this preflight.
4. Re-run C6B2B4D one-use reservation, partial-record crash, and separate OS-process one-winner checks on disposable fixtures. Confirm the generic `reserveSyntheticApproval` can still be bypassed via different independent ledger root and that a same-user forged marker remains untrusted. Do NOT report those risks as fixed.
5. Static repo-wide zero-caller scan: new preflight and synthetic ledger have NO Runtime/Worker/Weixin/Outbox/original DSH/real Apply integration. Review active host state read-only only if necessary; do not touch actual registered projects, model/provider, DSH ports, Weixin, DB or historical grants. Real project Apply remains restricted by REAL_APPLY_GATES.

## Gate B — report, STOP

Publish exactly one sanitized local report `agent-reports/REPORT-c6b2b4e-offline-registry-root-binding.md`, one sender-owned `agent-handoff/messages/to-online/<unique-id>.md` result, and `agent-handoff/receipts/local/OL-20261111-006-done.md`, normal non-force push. Include exact source SHA/CI and local counts, synthetic metadata, fail-closed matrix, hidden code gaps, source tree before/after proof and `REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN`. No real source/Workspace/Session modifications or secret/path leaks. If any code fails, `BLOCKED_CODE`; if false security property claimed, `BLOCKED_DESIGN`. Do not modify product source; report to online for fix.

Final single-line message: `ALL_OFFLINE_PASS` or precise blocker + sanitized report GitHub URL + pushed SHA; stop. Remote ChatGPT owns C6B2B4F thereafter, not the user as report courier.
