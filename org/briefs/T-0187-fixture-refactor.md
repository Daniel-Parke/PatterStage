# T-0187 independent bridge-fixture consolidation

The committed red-first oracles are green after the coordinator repaired the
two loaders. The current census reads 4,844 repeated test-window lines; the
fixed C4 ceiling is 4,800. The two bridge suites repeat process and temporary
fixture setup. Consolidate that real duplication without changing what either
suite proves.

Own only `tests/helpers/legacy-env-loader.ts`,
`tests/unit/legacy-env-bridge-warning.test.ts`, and
`tests/unit/legacy-bridge-precedence.test.ts`. Factor their common
Node/Git Bash invocation and safe `tmp/` fixture into the helper. Preserve
every test name, assertion, intended environment selection, secret-value
check, and independent process boundary. Do not edit a product loader, a
different oracle, census tool or baseline, record, claim, or governance file.

Before editing, capture the complete test-name set from both suites. After
editing, prove the set is byte-identical and every test passes. Run the
line census and confirm repeated test windows are at most 4,800. Report the
before/after count and commands. Do not commit or push. The coordinator owns
integration and final verification.
