# T-0186 mutation-oracle assertion correction

The clean committed-tree sweep at `f7e529d0` did not kill
`m1-drop-reader-error-from-header`. It reported `ERROR (infrastructure)`:
the component test calls `screen.getByRole("alert")`, which throws before
Jest records a structured matcher failure when the mutant removes the
banner. The sweep must not count a launch or unstructured failure as a kill.

Request an independent R2 reviewer ruling for a distinct ORACLE author to
amend only `tests/unit/story-reader-error-banner.test.tsx`. Replace the
throwing alert lookup with `queryByRole` and an explicit Jest presence
assertion, then keep the existing text, header-containment and dismiss
assertions. Preserve the test name and all fixture values. Do not change the
mutant, sweep classifier, app source, or any other test.

Record the before and after SHA-256 and test-name identity. Prove the normal
Jest control passes, the clean-tree sweep records `KILLED` with executed
assertion evidence and restoration, and the complete gate passes. The
coordinator owns the commits and records; the ORACLE author does not commit
or push.
