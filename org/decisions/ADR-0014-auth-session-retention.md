---
summary: Bound browser-session metadata with a 30-day post-use retention window
type: decision
tags: [security, auth, retention]
status: accepted
---

# ADR-0014: prune unusable browser sessions after 30 days

**Status:** accepted by Daniel Parke (operator), 2026-09-28, after reviewing
`org/reviews/2026-09-t0158-session-retention-adr-proposal.md` and selecting
“Accept as drafted”. **Owner:** T-0158. **Inspected revision:**
`dev@7d739435` with uncommitted T-0158 implementation. This decision adds a
retention rule to ADR-0012 and ADR-0013; their other decisions remain in force.

## Context

The new `auth_sessions` table has an insert on each browser sign-in and a
revocation update, but no deletion. Idle expiry, absolute expiry and boot
invalidation prevent authentication; they do not bound retained rows. That
conflicts with `org/LOCKBOOK.md`'s “No table grows without bound” ruling.
The existing `retention_policy` and `retention-prune` command govern two
readings tables and explicitly exclude a third table. Browser sessions are
short-lived authentication state, so their cleanup has its own narrow rule.
This decision does not alter those readings policies or their ledgers.

## Decision

1. A row first becomes unusable at the earliest of `idle_expires_at_ms`,
   `absolute_expires_at_ms` and a non-null `revoked_at_ms`. A row is eligible
   for deletion when that instant is **at least 30 days old**. A row that is
   valid at the pruning instant is never eligible, regardless of its age.
2. Prune eligible rows when a new browser session is created. Run the prune
   and the new insert in one SQLite transaction. If either operation fails,
   roll both back and issue no browser cookie. No timer or request merely
   reading application data performs a deletion. A quiet installation can
   retain old unusable rows until its next sign-in; it cannot accumulate new
   rows during that interval.
3. Use a single server clock value and a parameterised cutoff in the SQL
   predicate. Concurrent validation or renewal cannot revive an expired or
   revoked row. The deletion never touches the root Bearer token, active
   sessions, application records, backups or the append-only retention ledger.
   Do not log session secrets, hashes or individual identifiers during prune.
4. This automatic cleanup of unusable authentication credentials is separate
   from the opt-in destructive prune of user-authored readings. Document the
   distinction and retain the existing `retention_policy` schema and command
   unchanged.

## Acceptance and rollback

An independent oracle must fail before implementation and prove exact
30-day-minus-one-millisecond survival, equality-boundary deletion, active-row
preservation, revoked and idle/absolute expiry cases, transaction rollback on
failure, and no cookie if cleanup fails. Exercise real SQLite and session
creation. Preserve the existing T-0158 frozen test identities and use its R3
amendment procedure for any change to them. Then run the full unchanged-tree
gate, committed-tree sweep and hosted jobs.

If cleanup causes a production problem, a forward change can stop future
prunes while preserving active rows. Deleted unusable rows can only be
recovered from a backup; restoring a row never restores browser access across
a restart because the boot generation changes. Do not reverse migration 43 or
drop the table to roll this back.
