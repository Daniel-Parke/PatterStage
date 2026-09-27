# T-0163 review regression oracle

Read `org/START.md`, `org/roles/ORACLE.md`, `org/tasks/T-0163.json` and this
brief. The read-only security review found three cases outside the first
thirteen-test oracle. You own only
`tests/unit/t0163-review-regressions.test.ts`; the coordinator owns source,
records and baselines. Do not edit them. The implementation is not yet fixed.

Author executable regression tests against disposable Linux fixtures and the
public bootstrap/runtime operations:

1. Under umask 000, fresh and existing permissive `HERMES_HOME` and its backup
   directory must be mode 0700 before credential read or write. Cover both
   setup entries where feasible and runtime replacement. On Windows, keep
   functional assertions and reserve POSIX bits for Linux.
2. If a staging name already exists as a 0666 file or symlink to a public
   file, credential replacement must never write a key into it or turn `.env`
   into the symlink. Instrument the file operation to plant the collision at
   the exact chosen name, so a random suffix alone cannot make the test pass.
3. Two backups of the same source within one frozen millisecond must both
   succeed with distinct private files and intact content. No earlier backup
   may be overwritten.

Keep the existing thirteen oracle names and files untouched. First commit
only your new tests while they are red against current source, report exact
test names and LF SHA-256, and demonstrate that each failure is an assertion
about the defect rather than fixture infrastructure. Do not print secrets.
