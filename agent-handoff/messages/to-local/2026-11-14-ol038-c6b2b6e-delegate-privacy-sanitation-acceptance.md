message_id: OL-20261114-038
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: f74a931ae6007672d2359a151e724db574957e8f
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43576656827
requires_live_host_approval: false

# C6B2B6E independent Mac synthetic ledger delegate error sanitation

Claim OL-20261114-038 exactly once. Use an independent detached clean Mac worktree pinned to source SHA `f74a931ae6007672d2359a151e724db574957e8f`, NOT current report/handoff HEAD. Exact pinned [Actions #474](https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43576656827) run 43576656827 is 3/3 SUCCESS: Linux/macOS Node 241/241, proxy 5/5 each; both new ledger/delegate sanitation tests executed on both platforms; Vitest 62 files/1208 tests, typecheck/build success. Earlier #473 at a different SHA was cancelled, not pass evidence.

Allowed operations: ONLY OFFLINE_SYNTHETIC_ONLY, owner-private disposable 0700 test fixtures. Independently review `inspectSyntheticApproval`'s generic ledger lstat/realpath error sanitation and `inspectFixtureBoundSyntheticApproval`'s delegation wrapper. Verify both new Node tests, including missing ledger, ordinary-file replacement, dangling link, valid restored ledger, no raw ENOENT/ENOTDIR/ELOOP or private path in returned error, unchanged receipt bytes, no repair or automatic retry, one-use approval remains consumed. Include bounded adversarial mid-call rename/replacement to expose any unresolved timing-dependent delegate window; distinguish *sanitized error message* from race-free path authority, and report failures rather than rewriting product code. On macOS confirm expected canonical /var vs /private/var semantics. Audit whether broad catch hides useful classification and note limits honestly.

Run frozen install, pnpm check, exact workflow Node and proxy suites, standalone ledger suite, bounded adversarial tests; capture exact exit codes, counts, machine/software versions and any flakiness in a privacy-reviewed REDACTED report. Publish one local-owned `agent-reports/REPORT-*.md`, one LO-038 to-online result, one OL-038 local claimed and done receipt, via guarded expected_sha non-force fast-forward Git commit(s). Verify remote HEAD and keep a durable audit trail. Do not retry a claimed-but-not-done task automatically.

No real Apply, Weixin, original DSH Session Prompt, 3080/3083/8123 service changes, production DB, registered real projects, model/provider credentials or reuse of historical grants. Public GitHub text cannot grant real authority. Same-user forgery, journal/root ABA/TOCTOU, fd-relative isolation, generic cross-root reserve, private per-transaction approval, backup/recovery remain open.
