---
summary: T-0181 isolated log symlink and mapped-private URL boundary proof
type: review
tags: [review, security, phase-2]
status: complete
---

# T-0181 boundary evidence, 28 September 2026

At `dev@4e40ef4c`, the committed oracle tested real temporary files. A
Windows directory junction at `logs/x.log` made the lexical
`logFileUnderLogsDir` return true; one of six cases failed, one passed and
four Linux-only cases skipped. Test TypeScript passed. In a disposable
`node:24` Linux container, a local clone of that exact commit failed four of
six cases. GET read the outside sentinel, named DELETE and bulk DELETE
truncated it, and the lexical guard admitted the symlink. The regular-log
positive control and mapped-private listener case passed. The sentinel
contained only a fixed synthetic marker; no operator log or database was
used. The container had its own dependencies and filesystem and was removed
after the run.

Independent review then found two additional aliases. A separate author
committed seven hardlink and dangling-link cases at `7652d393`. Against that
committed tree, Windows failed five of seven cases. The native-Linux clone
failed ten of thirteen cases across both frozen oracles. Copying only the
working `src/lib/fs/log-files.ts` and `src/app/api/logs/route.ts` into that
clone made all thirteen pass. The repaired guard uses `lstat`, rejects
symlinks and files with multiple hardlinks, and admits only a genuinely
missing basename for GET's existing 404. Reads and truncations use one opened
descriptor with bigint device/inode checks; Linux `O_NOFOLLOW` refuses a leaf
symlink swapped in after the initial check. The log listing omits symlinks and
hardlinks. Windows focused tests pass 40 cases, with four Linux-only skips,
across the guard and route suites. The previously mocked route suite retained
all seven test names and nineteen assertions; its fake filesystem was updated
by a different author to model descriptor and bigint metadata.

The direct request to a bounded mapped-loopback listener succeeded, while
`visitPage` returned null without a second listener hit. The existing
`url-guard.ts` already handles the mapped literal and its unit tests cover
the shape. T-0181 records this URL candidate as a confirmed working boundary,
not a source defect needing a cosmetic rewrite. A local listener does not
prove NAT64 transport without a translator. Concurrent replacement of the
whole configured logs directory remains outside the planted-file threat
model; Node does not expose an `openat` directory-handle API here. The identity
check is precise at descriptor open, but cannot promise atomic protection
against a concurrent hardlink added after that check. The oracle covers
planted aliases, not a continuously mutating local adversary.

The first ten-step gate attempt stopped at the generated task view. Rendering
from the canonical task record fixed that input. The second attempt passed
lint and TypeScript but stopped in Jest: the existing cross-file repeated
test-window ceiling is 4,800 and the two frozen real-filesystem fixtures
raised the count to 4,802. A different author reordered independent fixture
setup in the coordinator-authored oracle, preserving its five test names and
fourteen assertions. The count fell to 4,786 without changing the ceiling.
The full gate must run again on that final tree.

The isolated `t0181-gate` checkout passed all ten gate steps with an unchanged
tree. Jest reported 7,344 passes and eight skips; Playwright reported 316
passes and 24 skips on the owned port-3000 server. A byte comparison found
97 otherwise unchanged tracked files with different line endings between
that fresh worktree and the primary checkout. The same full gate then passed
on the exact primary tree with isolated `PS_DATA_DIR` and `HERMES_HOME`, with
no tree movement and hash
`86aa0180d1ce00268cdd91e8b460814f2d262854a77f3437b9d19c664a72c75c`.

The committed `e116f5fc` native-Linux sweep killed all three mutants through
structured assertion failures, restored each edit and passed the final
control. The Windows sweep refused its control because Linux-only cases skip
there; that result was not called a kill. Exact-head push CI
`36467397118`, PR CI `36467405410`, push Gitleaks `36467397002` and PR
Gitleaks `36467405370` all concluded successfully. The PR run's full browser,
real Hermes, install/update, Docker, Ubuntu, macOS and acceptance jobs all
passed. The push run's full browser job was skipped by its existing event
condition. This evidence does not claim a release, production deployment or
concurrent local-adversary atomicity.
