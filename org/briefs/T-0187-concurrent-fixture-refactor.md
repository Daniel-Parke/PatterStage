# T-0187 concurrent oracle fixture refactor

Independent writer owns only `tests/unit/legacy-concurrent-boot-warning.test.ts`.
The red-first oracle is frozen. Change only duplicated boot setup to use the
existing `tests/helpers/legacy-boot-fixture.ts`; do not change its three test
names, assertions or process/registration behaviour. The intent is to return
the fixed C4 cross-file repeated test window count from 4,806 to at most
4,800 without changing that ceiling. Prove the same sorted full test-name set
and all three tests pass before and after. Do not edit the shared fixture,
implementation, other tests, records or protected files. Do not commit.
