---
summary: Exact typing-only queue oracle amendment for its existing dynamic claim dependency
type: review
tags: [testing, governance]
---

# T0194 queue oracle type amendment

Status: authorised by Daniel Parke on 2026-10-04. Independent reviewer Parfit
found this technically appropriate; the operator explicitly extended the earlier
amendment list to this file. Implementation acceptance remains pending.

Permit Faraday to amend only tests/unit/lib-domain-queue-admission.test.ts:

1. Add an import type of claimComposerQueue as claimComposerQueueExport from
   @/lib/composer/queue-cleanup.
2. Replace only the existing QueueModule.claimComposerQueue signature with
   typeof claimComposerQueueExport.

The oracle already exercises this export through a computed require path.
The explicit type dependency lets Knip observe that genuine use. No artificial
production caller, scan exemption or baseline growth is permitted.

Require identical emitted JavaScript with the same compiler options, all 30
test names, every behavioural assertion, fixture, dynamic loader, capability
check and deadline. Record original/new hashes, author, authoriser and date.
Run focused tests, test typing, scoped lint and Knip; obtain independent review
and rerun the complete gate. This is amendment authority, not batch acceptance.

Authority: org/roles/ORACLE.md:39-41 says the implementer may never perform an
amendment; a non-implementer authors it, authorised by the operator at R3.
