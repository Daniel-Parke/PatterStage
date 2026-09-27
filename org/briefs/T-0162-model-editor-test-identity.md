# T-0162 model editor test identity amendment

The independent ORACLE lane owns only `tests/unit/model-editor-modal.test.tsx`
and `tests/unit/b6-keyless-providers.test.tsx` for this amendment. Read
`org/START.md`, `org/tasks/T-0162.json`, `org/roles/ORACLE.md`, and the
existing independent amendment brief. Do not change source, tooling, task
records, claims, or other tests. The two file claims are recorded in
`org/claims.json` and remain disjoint from the implementer.

T-0162 named the Credential Label input in `src/components/models/ModelEditor.tsx`.
Three old `getByLabelText(/Credential/i)` queries now match both the picker
button named Credential and the distinct input named Credential Label. Retain
both accessible names. Change the affected test queries to identify the
picker by exact accessible name and role. Preserve every named test and its
behaviour assertions. If a source comment describes the old broad-query
behaviour, correct the comment. Do not loosen the assertions.

Prove the two suites pass on the current source, and capture before/after
test-name sets and file hashes. Commit only the two owned files, and report
the commit and evidence. Any unrelated failure must be reported separately.
