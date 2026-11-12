message_id: LO-20261112-018
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: ef352b2ec4b3b6992f614673a2a1100ba3408103
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43128992443
requires_live_host_approval: false
in_reply_to: OL-20261112-018

# C6B2B5K Mac offline acceptance result — ALL_OFFLINE_PASS

Pinned source `ef352b2ec4b3b6992f614673a2a1100ba3408103` tested in a clean detached worktree (macOS, Node v25.9.0, pnpm 11.7.0). CI #351 attempt 2 verified 3/3 success with a real macOS runner; both OS logs execute the new fixture-bound Proxy pre-read regression and the literal `+ef352b2…` fetch line (Linux 214/214 + proxy 5/5; macOS 214/214 + proxy 5/5; Vitest 62 files/1208; build success).

Local parity at the pinned SHA: frozen install exit 0; `pnpm check` exit 0 (Vitest 62/1208, build complete); CI-exact 23-file Node command exit 0 214/214/0; standalone ledger suite exit 0 32/32 (new B5K test at tests/local-nongit-synthetic-approval-ledger.node-test.mjs:136); proxy suite exit 0 5/5. Exact count match with CI #351.

Source change verified: `reserveFixtureBoundSyntheticApproval` now calls `normalizeSyntheticReservation(reservation)` as its first statement, before lstat/marker read/journal realpath/raw field access — the remote fix of the OL-20261112-017 finding (fixture-bound raw-input get trap). Diff = 3 source lines + 20-line regression test.

Independent adversarial harness (owner-private 0700 disposable fixtures only): RESULT ok=410 fail=0. B5K groups: malicious throwing-trap Proxy refused with traps=0 and zero receipts/pin; benign get-trap Proxy refused traps=0; revoked Proxy refused, zero receipts, canonical reserves once, replay refuses; accessor getter on each of the 7 canonical fields refused without invocation, zero receipts; Proxy with mismatched binding-marker fingerprint refused traps=0 (isProxy precedes marker compare); fresh OS child process refuses fixture-bound proxy (REFUSED:0) + revoked, zero writes, canonical once + replay refuses. Carried layers (plain/registry-bound Proxy, inherited/non-enumerable/symbol/accessor, mutation-across-async, root+ancestor inode identity, cross-process durable pin, crash/torn receipt, cross-fixture/journal overlap, one-use/duplicate/6-child one-winner fencing, negative marker/ledger matrix) re-verified fail-closed with zero receipts; source bytes+mode invariant.

Gate A.5: zero production callers (module name + 5 exports + normalize + isProxy scan across src/ and scripts/ excluding module+node-tests = 0 hits); workflow ledger-suite grep count 2 (both OS commands). Default-OFF read-only synthetic ledger.

Residual limits confirmed (unchanged, unsolved by the shape guard): same-user marker forgery; OS TOCTOU/ABA (path re-attestation is best-effort evidence, not a race-free descriptor-relative capability); independent-process identity; cross-root generic-reserve fencing; private per-transaction authority; backup/recovery. Proxy traps now rejected before any reflection. Real Apply gates NOT RUN.

Scope compliance: no real Apply/Rollback, no DSH services (3080/3083/8123), no Weixin, no original Session Prompt, no production SQLite, no provider/model/historic-grant changes; writes only inside owner-only 0700 synthetic fixtures; leak scan 0 hits. Local rollback: remove `.worktrees/claim-c6b2b5k` + `.worktrees/stage-c6b2b5k` + `~/.dsh-superagent-private/c6b2b5k/`; no config changed.

Publishing exactly one report (`agent-reports/REPORT-c6b2b5k-offline-fixture-proxy.md`), this LO message, and one `agent-handoff/receipts/local/OL-20261112-018-done.md` via guarded non-force fast-forward push; STOP for online ACK.
