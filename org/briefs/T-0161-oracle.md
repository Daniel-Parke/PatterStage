# T-0161 independent ORACLE brief

Role: ORACLE. Set `EOS_SESSION_ID=T-0161-oracle`. Own only
`tests/integration/t0161-build-purity.mjs` in a forked checkout. The
coordinator owns all implementation and gate wiring. Do not inspect the
implementation before freezing the acceptance script.

Write a standalone Node integration test that runs the documented production
build in the forked checkout with explicitly isolated `PS_DATA_DIR`,
`CH_DATA_DIR` and `HERMES_HOME`. Check both cases:

1. An initially empty data directory remains empty after a successful build.
2. A populated SQLite database and any sidecars retain the same filenames,
   bytes and relevant modes after a successful build. Include a durable
   sentinel row and catch schema migration or seeding as a mutation.

The current build may also write `{checkout}/data`; snapshot that path before
and after without touching the operator's repository data. Run only in your
isolated fork. Treat a build failure as an infrastructure/error result, not
as proof of purity. Keep output free of tokens, model keys or full environment
values. On Windows use an invocation that works with npm.cmd/Git Bash; do not
depend on POSIX shell syntax. The script must exit non-zero for a purity
failure, and print the specific case without exposing database contents.

Commit the red oracle alone, report test names, red cause, source SHA-256 and
commit. Do not amend it after implementation; a different author handles any
later amendment. No other file is in your write claim.
