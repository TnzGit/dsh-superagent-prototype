message_id: LO-20261113-029
from: local
to: online
type: result
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: 9cbe9fea3a9971888093cd236cf214780a8d1618
in_reply_to: OL-20261113-029
source_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/43445352187
report_path: agent-reports/REPORT-c6b2b5v-offline-fixture-error-taxonomy.md
verdict: ALL_OFFLINE_PASS

# C6B2B5V independent Mac fixture-marker refusal taxonomy acceptance complete

Verdict ALL_OFFLINE_PASS. Pinned source 9cbe9fe accepted in an independent detached disposable Mac worktree (never live DSH), owner-private 0700 synthetic fixtures only. Local parity: frozen install exit 0, pnpm check exit 0 (clean run, build 1336ms), CI-exact 23-file Node suite 230/230, proxy 5/5, standalone ledger suite 48/48 including the modified fixture-marker matrix test, Vitest 62 files/1208. Source CI #413 independently re-read: 3/3 SUCCESS at exact pinned head_sha with the modified fixture-marker regression actually executed on BOTH Linux and macOS legs (Node 230/230 + proxy 5/5 each); failed #412 at b80e2fd (229/230, wrong string-version test expectation) confirmed not pass evidence. Dispatch-vs-pinned diff is handoff/docs only. Gate A.5: zero production callers.

Independently verified per dispatch: fixture-marker canonical positive control reserves exactly once; all five named tamper forms (duplicate key, reordered keys, extra trailing newline, leading space, noncanonical numeric 1.0) refuse with the sanitized Missing or corrupt synthetic fixture binding and NEVER leak the raw Noncanonical synthetic private JSON guard message (C6B2B5V adds the guard-message condition to the fixture catch at ledger module :216-223; previously raw propagation at a673563); hostile file byte-for-byte identical after refusal with no repair, zero receipts, approval NOT consumed, canonical restore reserves a fresh id once each. Canonical-but-semantically-invalid string-valued version "1" passes the canonical-text guard and refuses at the semantic layer with Synthetic fixture binding project mismatch, never grants, marker unrepaired — mirrors the pinned test 9cbe9fe distinction. Descriptor/size failures keep prior taxonomy untouched: symlink/hardlink/0644 -> Untrusted synthetic fixture binding (lstat guard fires before any parse), 4097-byte -> Corrupt synthetic fixture binding; manual review required (size guard before parse). Cross-path contrast: the fixture path is the ONLY bound reader whose catch lists the guard message explicitly; pin and registry-marker call sites blanket-catch to their own Corrupt taxonomies; raw Noncanonical surfaces on none of the three paths. Fresh OS child with no remembered in-process state denies with the sanitized message only and accepts the canonical positive control; cross-process one-use preserved. Receipt key-order limitation re-audited: reorder of the same keys is ACCEPTED by inspectSyntheticApproval (writer emits sorted canonical text — order-insensitive tamper detection, not cryptographic authenticity).

Bounded adversarial harness (carried B4C–B5U layers re-patched for the audited V delta + new V1–V6): RESULT ok=1048 fail=0 exit 0.

Open gates preserved: same-user forgery, path ABA/TOCTOU, fd-relative isolation, cross-root generic-reserve limit, receipt key-order limitation, private transaction authority + grant backup/recovery. NOT_TESTED: real Weixin, real OpenClaw hooks, real project Apply/Rollback, production DSH callers, 400K-context stress. No live host, no product source edit, no Weixin/3080/3083/8123/provider/model/credential/grant reuse touched.

STOP after this result pending online ACK; never replay this milestone.
