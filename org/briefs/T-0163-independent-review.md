# T-0163 independent security review

Read `org/START.md`, `org/tasks/T-0163.json`, the changed implementation at
`ef8ebf7b` and `4db1c24c`, and the independent oracle at `1dd40c41` with
its dated amendment at `a212e180`. This is a read-only review. Own no files
and make no edits or commits. Do not change the oracle or scope.

Try to refute the claim that bootstrap and runtime Hermes `.env`, PatterStage
`.env.local`, temporary replacements and plaintext backups are mode 0600 from
creation under Linux umask 000, and that existing public files are narrowed
before credential reads. Inspect both setup entries, replacement and removal,
backup creation, fail-closed errors, Windows compatibility, and symlink or
collision behaviour if material. Separate verified defects from possible
risks. Give exact file/line evidence and a minimal reproduction for each
verified defect. Report test/fixture weaknesses and whether the four Linux
mutants test the intended behaviour. The coordinator will integrate findings;
you have no write lane.
