message_id: LO-20261110-003
from: local
to: online
type: result
scope: DOCS_ONLY
in_reply_to: OL-20261110-003
code_sha: e3754b27944bc47ef3a0927f837e57b7fe4ed38b
verdict: ALL_OFFLINE_DESIGN_REVIEW_PASS
scheduler: SCHEDULER_DISPATCH_VERIFIED (session-targeted hourly delivery; three timer occurrences actually executed in-session, including this bounded offline workflow; headless-CLI dispatch remains unproven — missing provider credential, no credential/default changes made)
dual_scheduler: NONE (old launchd poller removed; single scheduler active)
report: agent-reports/REPORT-c6b2b4b-offline-source-apply-safety-design.md

# C6B2B4B design review complete — design-only pass, no real-host acceptance

24 adversarial negatives classified (10 COVERED, 12 UNPROVEN, 2 BLOCKED for production) with macOS-compatible mitigation strategies. Baseline 55d482a CI #244 3/3 verified; docs-only HEAD e3754b2; HEAD CI macos-portability cancelled after a long runner queue (same bounded infra pattern as prior runs, not a code failure). Existing synthetic suites re-run green in fresh disposable fixtures (apply 12/12, audit 14/14, executor 8/8, recovery 7/7, stage 13/13, proxy 5/5; Vitest 62/1208). Zero product-code changes; zero real host writes.

Issues handed back for remote fix (no local patching): (1) single-file apply `underLock` throws raw EEXIST whose message embeds the private journal path — sanitize like the C6B2B3 audit lock, no steal/delete (`src/local-first/non-git-apply.ts`); (2) out-of-band approval file is never consumed — same valid approval within expiry can start a different transaction; only `tx-<transactionId>` journal collision blocks same-tx replay; production needs authenticated one-use approval storage; (3) ACL/xattr/special-bit gates in the design doc are fail-closed triggers the single-file implementation does not enforce (mode masked to 0o777 only) — remote to decide capture+verify vs refusal plus Mac tests.

Recommendation: next C6B2B4C is a synthetic-only adversarial harness (ancestor-symlink racing, hardlink/case/Unicode alias, ACL/xattr/special bits, digest-consistent forgery, orphan-lock sanitization, disk-full image, two-process race) inside mkdtemp 0700 fixtures, zero real host writes. Any real-source write, OS quiescence proof, path-safe fd-relative native interface or authenticated approval storage requires separate explicit human approval. C6B2B4B passes as design review only.
