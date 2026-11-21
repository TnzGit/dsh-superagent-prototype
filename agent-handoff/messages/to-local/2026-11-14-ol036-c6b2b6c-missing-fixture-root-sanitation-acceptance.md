message_id: OL-20261114-036
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 6708a1028012ff4492200d13acae5bba5ddf9255
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43562807129
requires_live_host_approval: false

# C6B2B6C independent Mac missing fixture-root sanitation acceptance

Claim OL-036 exactly once; use clean detached exact source `6708a1028012ff4492200d13acae5bba5ddf9255` (Actions #461 run 43562807129, 3/3 SUCCESS; Linux/macOS Node 238/238 and proxy 5/5 each, Vitest 62 files/1208, typecheck/build pass). Inspect the new `strict synthetic fixture inspection sanitizes a missing fixture root without repairing or replaying` regression executed in both OS jobs.

In disposable 0700 private synthetic fixtures, independently verify missing fixture root yields only sanitized refusal, no raw ENOENT or private path leak; rename-away/restore preserves receipt bytes and does not consume/replay approval ID; symlink and missing ledger/journal controls remain fail-closed; canonical macOS /var versus /private/var behavior; no repair or writes on inspection. Run frozen install, pnpm check, workflow-exact Node/proxy suites, standalone ledger and bounded adversarial matrix. Record exact counts, failures and residual same-user forgery, ABA/TOCTOU, fd-relative isolation, cross-root generic reserve and real Apply gates. Publish one sanitized report, LO-036 result and local claimed/done receipts with expected_sha non-force FF; verify HEAD. Do not edit product code, workflow or any live host; no Weixin, original DSH Prompt, 3080/3083/8123, production DB, model/provider/credentials or historical grants.
