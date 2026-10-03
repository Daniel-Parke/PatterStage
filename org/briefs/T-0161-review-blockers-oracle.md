# T-0161 final review blockers oracle

The independent reviewer found two cases absent from the current gate. The independent test author owns only `tests/unit/t0161-state-import-completeness.test.ts` and `tests/unit/t0161-shell-seed-selected-dir.test.ts`. Keep every existing test name and assertion. Do not edit implementation or other tests.

1. With Hermes configured and an existing SQLite profile row, clear only the root soul (or skills) so the old import-once predicate is false. Give the existing profile a SQLite-only edit and a different disk version. `--import-missing-profiles` must never pull or overwrite that existing row. It may fail closed on incomplete root/skill state, but must not exit success after an incomplete import. Prove the test reaches the old broad-import path and compare rows.
2. In disposable shell setup, make config.yaml present at initial detection and have the migration stub remove it. Setup must exit nonzero before catalog seed; the configured Hermes import cannot silently become optional. No real user data or credentials.
3. In the state importer, removal of config.yaml after configured setup should make the targeted explicit import fail, rather than return a successful no-op. Add a behaviour oracle with isolated database and Hermes paths.

Run the focused tests against the current candidate, commit them red and report exact failures, unchanged names and test-only file hashes. The implementer will integrate the red commit before fixing either path.
