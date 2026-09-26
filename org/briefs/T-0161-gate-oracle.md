# T-0161 independent K2 oracle amendment

Role: ORACLE. Own only `tests/unit/k2-the-discipline-is-in-the-repo.test.ts` and `tests/integration/t0161-build-purity.mjs` in your fork. The coordinator owns the gate runner and all other implementation. The T-0161 build-purity oracle is already frozen; the new gate step is named `build-purity` and runs after `build`.

Amend the closed K2 ordered-step contract to require that step. Preserve the number and meaning of existing tests. Correct its stale test name if needed, and report the exact test-name change as an identity exception. Confirm the old test-name set and the new set, run the amended suite against the old nine-step gate to prove it red, and report the red assertion. Do not amend implementation or weaken an assertion. Commit the test-only change in your fork and report its commit and LF-normalised SHA-256.

Also make the build-purity fixture work on the repository's supported Node 20 CI runtime: `node:sqlite` is unavailable there. Use the installed `better-sqlite3` driver to create the populated WAL fixture. Preserve both build cases and every byte/mode comparison. Report the independent oracle amendment and run it on Node 20 when possible. This is a test portability correction, not a reason to relax the purity contract.
