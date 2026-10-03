---
summary: Independent amendment for the T-0184 SQLite failure assertion
type: brief
tags: [missions, oracle, amendment]
---

# T-0184 oracle amendment

The frozen independent oracle in `tests/unit/mission-category-atomic.test.ts`
passed six focused cases. The first full Jest coverage run passed 7,381 tests
and failed one new case: `reports a database write failure without changing
the category, rows or files`. The injected trigger did abort as intended, but
the assertion `expect(failure).toBeInstanceOf(Error)` failed because the
received `SqliteError` did not share the worker's `Error` prototype. The test
stopped before checking the unchanged state. The source implementation is
already present; the coordinator must not amend its own frozen oracle.

An author other than the original oracle author and the source implementer
may edit only this test file. Preserve every test name, the injected SQLite
trigger, the unchanged-state assertion, and all other assertions. Replace
only the realm-sensitive constructor check with an assertion that identifies
the specific injected catalogue update failure by its message. Run focused
Jest and TypeScript, report the before/after test-name set and the new file
hash. Do not edit source, task records, baselines or other tests, and do not
commit; the coordinator will commit the independently reviewed amendment.
