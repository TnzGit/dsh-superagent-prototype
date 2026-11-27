# 022 Real Apply trust threat model (OL-055 S4)

This document is the honest security model behind the native Apply path. It replaces
"descriptor-relative `openat` is race-free" marketing with a measured statement of what
the mechanism does, what a non-cooperating same-UID writer can still do, and which
mitigations are actually available on real macOS. Nothing here is an authenticated OS
capability claim; the product path stays default OFF behind
`DSH_SUPERAGENT_REAL_APPLY_ENABLED` and the durable owner-only opt-in record. The operator
procedure lives in [020 Post-live I3 and Apply operator runbook](020-postlive-i3-and-apply-operator-runbook.md)
and the stabilization notes in [021 Installed I3 operator Apply stabilization](021-installed-i3-operator-apply-stabilization.md);
the mechanism itself is `research/real-apply-helper.c`.

## 1. Adversary model

The assumed adversary is a **non-cooperating process with the same effective UID** as the
operator (uid 501 on this host). Same-UID means it can:

- read and write every file in the owner-only `0700` journal and every `0600` marker
  (preview, review, capability, consumed, freeze, receipt, opt-in);
- forge or rewrite those markers' JSON content and set their mode back to `0600`;
- open, create, unlink, rename, hardlink, `chmod`, `chflags`, `setxattr` and `acl` any
  path inside the project tree it can reach;
- replace a directory above the pinned root (an ancestor swap) or change the mount a path
  lives on.

It cannot (without help from the operator) forge another UID's files, read another UID's
`0600` files, or bypass a sealed read-only system volume.

The adversary we must survive is the *accidental/parallel* writer — an editor, sync agent,
Spotlight/indexer, or another app the operator also runs. The adversary we CANNOT survive
by ourselves is a *deliberate* same-UID attacker: with the same uid it holds the same file
permissions, so the `0600`/`0700` journal and its markers are integrity-limited, not
authenticated.

## 2. What the pinned `openat` chain actually proves

The helper (`research/real-apply-helper.c`) binds the project root fd to the registered
`dev`/`ino`, then walks each component with `openat` + `O_NOFOLLOW`, verifying the leaf's
preimage through the same fd before the `renameat`. This proves:

- a **same-name path ABA on intermediate components** cannot silently redirect the write:
  the pinned fd chain is held across the whole operation, so replacing a directory with a
  new directory of the same name (the classic ABA) does not move the leaf we are writing;
- the leaf's **inode identity** (dev/ino, nlink, uid, mode, bytes, ns mtime) is verified
  against the approved preimage immediately before the `renameat`, so an ABA that unlinks
  and recreates the same name with different bytes/size/mode/inode is caught;
- **symlink, hardlink, setuid, group/world-writable, special flags, ACL and extended
  attributes** targets are refused before the capability is issued and again before the
  write and after the write (post-verify).

This does **not** prove:

- **quiescence between the final preimage check and the `renameat`.** A same-UID writer
  that opens the same leaf concurrently can `open`+`write`+`close` or `rename` the leaf in
  the window after our last `fstat`/`hash` and before our `renameat`. A `rename` into the
  leaf clobbers it and we cannot see the difference after the fact except by post-verify;
  a plain `write` through its own fd modifies the inode we hold and the post-verify hash
  then fails. So the race is winnable by a same-UID writer — the pinned fd narrows it but
  does not close it. **Never advertise `openat` alone as race-free.**
- **full power-loss durability.** The journal fsyncs the file and its parent directory, and
  the stage fsyncs and dir-fsyncs, but APFS `fsync` does not guarantee the whole write
  ordering across an unexpected power loss the way a `SIGKILL` test does not either. A
  `SIGKILL` matrix proves the crash-atomicity we test; it does not prove power-loss
  atomicity. Treat "crash after any `renameat` and before the audit fsync" as a
  classification case, never an auto-repair case.

## 3. OS-isolated approval identity: measured feasibility

To defeat same-UID forgery of the capability and review markers, the approval helper must
run under a **different OS UID** than the operator's writing processes (root, or a dedicated
unprivileged `_apply_approver` uid), or an authenticated user-presence primitive must bind
the approval to a named human.

Measured on this host (macOS, uid 501, admin member):

- `sudo -n` returns `a password is required` → a distinct-UID helper is **not runnable in
  this offline session** and is **not available without operator credential entry**. It is
  the only thing that defeats same-UID cap forgery.
- No Touch ID / SecureInput hook is available to the offline test harness, so a named-human
  approval cannot be proven here — only possession of the `0600` journal plus the flag.

Conclusion: **distinct-UID OS-isolated approval is feasible in principle** (a root-owned
approver, or a dedicated uid) **but not available in this session and not available without
operator credentials.** Until that exists, same-UID forgery remains an integrity limit, and
the `0600` journal + unguessable nonce + consume marker narrow but do not remove it.

## 4. Pinned mount / writer exclusion: measured feasibility (seatbelt)

macOS ships `/usr/bin/sandbox-exec` (seatbelt). Measured with a profile that denies
`file-write*` over an exact subpath (`deny file-write* (subpath ".../proj")`):

- DENIED for a confined same-UID process: overwrite an existing file, create a new file,
  `unlink`, `rename` within the tree, create a hardlink, `chmod`, write an xattr,
  `chflags uchg`, `mkdir`, recursive delete.
- ALLOWED: reads, and writes outside the denied subtree.
- A helper confined with `deny file-write* (subpath ...)` + `allow file-write* (subpath
  .../proj) (subpath .../journal)` successfully wrote the project and the journal and was
  DENIED writing `/etc/hosts` — a small sandboxed Apply helper with an exact allowlist is
  feasible.

So **seatbelt writer-exclusion IS feasible on real macOS** and blocks every mutation class
the threat model cares about over an exact subpath. The limit: it is a policy the operator
imposes on the writer's own launch. It cannot bind an already-running independent same-UID
process, and a hostile same-UID process can simply decline to be confined. Therefore it
**narrows** (excludes cooperative/confined writers) the non-cooperating same-UID writer, it
does **not eliminate** it.

## 5. Ancestors and mounts

An ancestor swap above the pinned root (replacing `/parent` with a different directory and
moving the project inode back into it) is caught at preview, at issue, and now at
verification: every freshly issued capability carries the canonical ancestor chain
(`path`+`dev`+`ino`) captured at issuance, and verification re-`lstat`s each ancestor and
refuses on any `dev`/`ino` change or on an ancestor that became a symlink or non-directory.
Mounts are class-limited residual risk: a same-UID adversary can remount or redirect a
volume, and the helper's per-mount `dev` check catches a `dev` change on the pinned root
but cannot prove the mount table was not changed by a process the operator does not control.

## 6. What remains unfixable without a distinct OS UID or user-presence primitive

These are reported honestly as **not** fixable by the current mechanism alone:

1. Same-UID deliberate forgery of the capability, review, preview, receipt, freeze or opt-in
   markers (same-uid ⇒ same file perms). Only a distinct approver uid defeats this.
2. Same-UID non-cooperating writer racing the window between the final preimage check and
   the `renameat`. Only a confined writer (seatbelt imposed by the operator's own launch)
   narrows it; nothing eliminates it.
3. Power-loss durability beyond what `fsync`-and-`SIGKILL` tests prove.
4. A named-human approval binding (no authenticated user-presence primitive available).

## 7. Enforced running mode, not weakened guards

The enforced mode is restrictive: preview/review/capability/execute/rollback are one-use,
consumed-on-use with a durable marker before the helper spawns, ambiguity freezes the
transaction until a human reconciles, no automatic replay/retry/cleanup, post-apply
re-observation through the helper's own pinned fd chain refuses a leaf that was swapped
after the `renameat`, the Worker session (`DSH_SUPERAGENT_TICKET`) must never execute Apply,
and the product path stays default OFF after restart unless the protected operator config
(the durable owner-only `apply-opt-in` record) opts in. When a residual risk is reached, the
correct action is to report it and keep the guard — not to weaken the guard to make the test
pass.

## 8. Recovery story for the operator

After a crash the operator runs the read-only classifier. `PREPARED_CRASH` means the stage
exists but the `renameat` never happened (safe to reconcile manually), `APPLIED` means the
target already matches the after-image (journal may lag, do not re-apply), and `AMBIGUOUS`
writes a durable `freeze-<txid>` that blocks every later operation on that transaction until
a human reconciles. There is no automatic retry. The rollback path is a **separate** one-use
capability that verifies exact bytes+mode of the applied after-image and restores the
fsync'd `before.bin`.
