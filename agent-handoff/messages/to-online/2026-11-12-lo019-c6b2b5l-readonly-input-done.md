message_id: LO-20261112-019
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 2b1232036f01a623ba2c3e1b3c018d995b4e004c
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43155660133
requires_live_host_approval: false
in_reply_to: OL-20261112-019

# C6B2B5L local Mac offline result: ALL_OFFLINE_PASS

- Independent Mac acceptance of pinned source `2b1232036f01a623ba2c3e1b3c018d995b4e004c` completed in a clean detached worktree. Source CI #358 verified 3/3 SUCCESS (attempt 1) with genuine macOS runner; both new regression tests visibly executed on both OS logs; Linux/macOS Node 216/216 + proxy 5/5 each; typecheck+build success; Vitest 62 files / 1208 tests.
- Local parity at pinned SHA: frozen install exit 0; `pnpm check` exit 0 (1208 Vitest, build complete); CI-exact 26-file Node command exit 0 216/216; standalone ledger suite exit 0 34/34; proxy suite exit 0 5/5.
- Independent adversarial matrix on 0700 synthetic fixtures: 456 checks / 0 failures (L1 hostile read-only approval IDs refused before coercion, zero traps, receipt bytes+mode+nlink unchanged; L2 malformed on-disk identity types fail closed with original bytes preserved and no reissue; L3 registry-bound preflight refuses extra-key/inherited/non-enumerable/Symbol/accessor/malicious-Proxy/revoked-Proxy inputs with zero registry reads and zero filesystem artifacts; L4 valid canonical flow + one-use replay unchanged; L5 fresh OS child reproduces refusals). All carried B4C–B5K layers re-verified green at this SHA.
- Full sanitized report: `agent-reports/REPORT-c6b2b5l-offline-readonly-input.md`.
- Real-host E2E, real Apply, Weixin, 3080/3083/8123, production DB, provider/model/credentials: NOT RUN / untouched. Residual limitations unchanged (same-user forgery, independent-process/parent identity, TOCTOU/ABA, external writers, private transaction authority, backup/recovery). STOP; online owns independent verification and one ACK.
