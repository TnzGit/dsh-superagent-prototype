/**
 * OS-backed per-account poll/cursor owner lease for the native Weixin Source.
 * The lease is a live SQLite `BEGIN IMMEDIATE` transaction on a dedicated connection: SQLite takes the
 * RESERVED write lock through the OS file lock (fcntl/POSIX record locks on macOS and Linux), so exactly one
 * process can hold it per account at a time. The transaction is held for the whole long-poll -> Engine intake ->
 * cursor-commit boundary; a second owner fails closed with `database is locked`. A crashed owner's lock is
 * recovered by SQLite on the next open, so takeover is bounded. The fencing generation lives durably in the
 * same lease database: every acquisition bumps it under the exclusive lock, and a holder that lost the lease
 * (released or taken over) sees a generation newer than its own and must not route, receive, or commit a cursor.
 * The lease lives next to the operator credentials file, NOT under the state directory: two orchestrator
 * instances can share one credentials file while having different state directories (the OL-053 replay), and
 * only the shared credentials path fences them against each other.
 */
import { chmodSync, closeSync, constants as fsConstants, fstatSync, mkdirSync, openSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** Process-lifetime owner lease: generation is this holder's durable fencing number; release() drops the held lock. */
export interface WeixinPollOwnerLease {
  readonly generation: number
  /** True only while the durable generation still matches this holder's; false means the lease was taken over. */
  fenceCurrent(): boolean
  /** End the held transaction and close the connection, releasing the OS lock for a bounded takeover. */
  release(): void
}

/** Owner-only protected directory holding one lease database per account fingerprint, next to the credentials file. */
export function weixinPollLeaseDirectory(credentialsFile: string): string {
  if (!isAbsolute(credentialsFile)) throw Error('Weixin lease credentials path must be absolute')
  let parent: string
  try { parent = dirname(realpathSync(credentialsFile)) }
  catch { throw Error('Weixin lease credentials directory cannot be resolved') }
  return join(parent, '.dsh-weixin-poll-lease')
}

/** The lease directory must be a real, current-uid-owned, owner-only (no group/world write) directory; fail closed. */
function assertLeaseDirectory(dir: string): void {
  let fd: number
  try { fd = openSync(dir, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_DIRECTORY ?? 0)) }
  catch { throw Error('Weixin poll lease directory cannot be opened without following symlinks: ' + dir) }
  try {
    const stat = fstatSync(fd)
    if (!stat.isDirectory() || (typeof process.getuid === 'function' && stat.uid !== process.getuid()) ||
      (stat.mode & (fsConstants.S_IWGRP | fsConstants.S_IWOTH)) !== 0)
      throw Error('Weixin poll lease directory must be a current-owner-only directory')
  } finally { closeSync(fd) }
}

/**
 * Acquire the exclusive poll/cursor owner lease for one account fingerprint.
 * @throws when another live owner holds it (`database is locked`) or the protected directory is unsafe.
 */
export function acquireWeixinPollOwnerLease(credentialsFile: string, accountHash: string): WeixinPollOwnerLease {
  const dir = weixinPollLeaseDirectory(credentialsFile)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  assertLeaseDirectory(dir)
  const file = join(dir, `account-${accountHash}.sqlite`)
  const db = new DatabaseSync(file)
  let held = false, generation = 0
  try {
    db.exec('PRAGMA journal_mode=WAL')
    db.exec('CREATE TABLE IF NOT EXISTS fence (gen INTEGER NOT NULL)')
    db.exec('BEGIN IMMEDIATE') // OS-exclusive write lock; a second live owner throws here
    db.exec('INSERT OR IGNORE INTO fence VALUES (0)')
    db.exec('UPDATE fence SET gen = gen + 1')
    generation = Number(db.prepare('SELECT gen FROM fence').get()!.gen)
    db.exec('COMMIT') // make the fencing generation durable BEFORE the hold begins
    chmodSync(file, 0o600)
    db.exec('BEGIN IMMEDIATE') // hold the lease for the whole poll -> intake -> cursor-commit boundary
    held = true
  } catch (error) {
    try { db.close() } catch { /* connection already dead */ }
    throw error
  }
  return {
    generation,
    fenceCurrent: () => {
      // A read-only peek never blocks on the RESERVED lock the live holder keeps.
      let reader: DatabaseSync | undefined
      try {
        reader = new DatabaseSync(file)
        const row = reader.prepare('SELECT gen FROM fence').get()
        return !!row && Number(row.gen) === generation
      } catch { return false }
      finally { if (reader) try { reader.close() } catch { /* ignore */ } }
    },
    release: () => {
      if (!held) return
      held = false
      try { db.exec('ROLLBACK') } catch { /* txn already gone */ }
      try { db.close() } catch { /* connection already dead */ }
    },
  }
}
