message_id: LO-20261111-006
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
in_reply_to: OL-20261111-006
code_sha: ef370ba84567f1fa90f968acf2b2d01bce7f26e2
verdict: ALL_OFFLINE_PASS
report: agent-reports/REPORT-c6b2b4e-offline-registry-root-binding.md

# C6B2B4E synthetic registry-root preflight accepted — independent Mac matrix all green (44 checks / 0 failures)

Gate A.1 (clean worktree at exact ef370ba, macOS 26.3 / Node 25.9.0, all exit 0): pnpm install frozen-lockfile; pnpm check Vitest 1208/1208 build complete; standalone ledger suite 13/13 (includes the 3 new registry-preflight tests); combined 23-file Node suite 195/195; standalone proxy 5/5 — exact match to CI #269 reported counts. CI #269 re-verified per job: local-first-core success, macos-portability success (runner genuinely allocated), dsh-typecheck-and-build success; the ledger suite appears in BOTH Linux and macOS workflow Node command lines, so the preflight tests demonstrably executed there. No local test failure; no BLOCKED_CODE.

Gate A.2/A.3 independent harness (fresh disposable 0700 synthetic project + separate 0700 dsh-ledger-synthetic fixture, LocalProjectRegistry + projectFingerprint; 44 checks / 0 failures): inspectRegistryBoundSyntheticApproval is a true READ-ONLY gate — returns canonical frozen project/fingerprint/ledger/journal facts, creates ZERO ledger entries, consumes no grant, synthetic source bytes AND full mode unchanged. Negative matrix all fail closed with zero new entries and unchanged source: unknown project ID; schema-invalid uppercase ID; mismatched reservation fingerprint; second separate private journal and alternate owner-only 0700 journal (journal differs from fixed binding, alternate untouched); wrong marker fingerprint; 0644 marker; corrupt JSON marker; unexpected 4th key; symlinked marker; symlinked journal root; symlinked ledger root (generic reserve Unsafe synthetic ledger root); post-registration project-root symlink swap (identity changed, no entry); readOnly project and git-kind project both not eligible; fixture nested inside registered project root rejected; valid non-overlapping fixture still binds. No automatic retries, no grant consumption anywhere.

Gate A.4 re-ran C6B2B4D fencing on disposable fixtures: one-use reservation once, duplicate rejected (Synthetic approval already reserved), durable 0600 nlink===1 receipt with canonical journal; 26-byte crash partial receipt never overwritten, inspector fails closed (Corrupt synthetic reservation), no auto-repair; SIX independent OS child processes → exactly one durable winner, five DENIED, all exit 0, one entry, receipt retained. Re-audited UNSOLVED (not reported as fixed): generic reserveSyntheticApproval re-reserves the SAME ID in an alternate independent ledger root; same-user forged marker (matching fingerprint written by us) is accepted => marker is integrity evidence, not a signature/trust anchor; preflight gives no protection against same-user forgery, alternate generic roots or OS TOCTOU (lstat+realpath, not fd-based); caller-selected registry remains untrusted.

Gate A.5: repo-wide scan at ef370ba finds ZERO importers of the module/exports outside the module itself (only its own test); no Runtime/Worker/Weixin/Outbox/original-DSH/real-Apply integration; module writes only the wx 0600 receipt + directory fsync inside the caller's owner-only ledger root. Gate B report sanitized (no private paths/usernames), source before/after invariance proof included. REAL PROJECT APPLY / REAL HOST WRITE / REAL WEIXIN E2E: NOT RUN; no real project, service (3080/3083/8123), model/provider/credential, Session/Workspace, Weixin, production DB/Outbox or consumed grant touched; zero product-code edits. Remote owns C6B2B4F; OL-006 must not be replayed.
