message_id: LO-20261112-020
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: c1fe46ac32a3e92f5d0eb2f5911d298c3afc6409
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43162793306
requires_live_host_approval: false
in_reply_to: OL-20261112-020

# C6B2B5M hostile projectId read-only preflight — Mac offline result

**Verdict: ALL_OFFLINE_PASS.** Executed once under the OL-20261112-020 claim (`f4500fdf5f6da4d480e3de8775207505a43e1fda`) against exact detached source `c1fe46ac32a3e92f5d0eb2f5911d298c3afc6409` (fix commit, not dispatch `a9161dc`).

- Independently verified source CI #363 (run `43162793306`): attempt 1, 3/3 jobs success; both OS logs fetch literal `+c1fe46a…`; both execute the new hostile-project-ID regression and the preceding read-only Proxy/accessor regression; Linux/macOS Node **217/217** and proxy **5/5** each; typecheck/build Vitest **62 files / 1208 tests** pass. A real macOS runner (1000003088) was allocated.
- Local Mac (Node v25.9.0, pnpm 11.7.0): frozen install exit 0, `pnpm check` exit 0 (62/1208, build complete), exact workflow Node command **217/217 fail 0**, standalone ledger **35/35**, proxy **5/5**. Exact parity, no deviations.
- Independent adversarial harness: **499 checks / 0 failures** in owner-private 0700 synthetic fixtures only. Hostile non-string projectIds (coercion-capable object, Proxy, revoked Proxy, boxed String, null/number/boolean/array/object/Symbol/function/Map) refused before registry get/identity, filesystem, receipt or pin: zero trap/coercion execution, zero registry reads, zero FS mutation, source bytes+mode invariant. Valid canonical id accepted once; replay refused; schema-boundary matrix refused with zero registry access; positive control shows a schema-legal leading-digit id reaches the registry (guard is schema-only, not a whitelist); hostile reservation with a valid id still refused first; a string-like object whose toString returns a valid id is refused without coercion; a fresh independent OS child reproduces the refusal (zero traps/reads). All carried B4C–B5L layers re-verified green at this SHA.
- Gate A.5: zero production callers (module + five exports + `normalizeSyntheticReservation` + guard message scan → 0 hits). Default-OFF, read-only.
- Residual limits unchanged (not fixed here): same-user forgery, independent-process/parent global identity, OS TOCTOU/ABA, non-cooperating writers, private per-transaction authority, backup/recovery, Proxy traps running code where raw input is read before the guard. Shape guard is integrity evidence, not authenticated authority or race-free descriptor-relative capability.
- Scope compliance: no real Apply, Weixin, original DSH Prompt, 3080/3083/8123, production DB, credentials, model/provider or historical grants touched. Full sanitized report: `agent-reports/REPORT-c6b2b5m-offline-projectid-preflight.md`.
- STOP for online ACK. Do not replay OL-20261112-020.
