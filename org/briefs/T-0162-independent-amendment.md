# T-0162 independent closed-oracle amendment

You are the separate ORACLE author under Q-015 and Q-021. Own only these files:

- `tests/unit/c6-the-page-layer.test.ts`
- `tests/unit/c8-the-programme-is-closed.test.ts`
- `tests/unit/form-controls-are-named.test.ts`

The implementer owns all detector, source, baseline, task and claim files. Do
not edit them. Work on the shared `dev` checkout after reading `org/START.md`,
the task record, `org/roles/ORACLE.md`, and this brief. The second lane is
claimed in `org/claims.json`; max two writing lanes.

Observed at the T-0162 working tree: `design-lint --report` finds four files
for `no-raw-write-outside-the-helper`: Story Weaver create and detail pages,
`useVersionFooter`, and client `chat-utils`. The rule reports one site per
file. The read census now finds five files: Story Weaver detail,
`useHindsightCrudTab`, `useHindsightMemories`, `useChatSend`, and
`useMissionsData`. The previous detector reported zero for both. The widened
form-name gate counts 158 controls with zero unnamed after the implementer
named twenty call sites and repaired Field Select, AutoTextarea, TextInput and
NumberInput. These numbers are measurement corrections, not a burn-down.

Amend C6's two affected assertions to hold the exact reasoned design-lint
baseline for raw writes and a named, shrink-only set of five hand-read files.
Amend only C8's hand-read target to the widened measure's five, keeping C8's
historical zero reading and explaining the measurement correction as K6 did
for routesWithTryCatch. Add form-control classifier fixtures for unnamed
Select/AutoTextarea/NumberInput and for Field's single direct child. Use the
existing test names; new tests are allowed, but do not remove or rename any.

Each closed amendment needs `Amended 2026-09-27 (T-0162)`, old/new file hash,
and a statement of the unchanged test-name set. Prove the amended assertion
fails on the old blind detector or on a planted violation, and passes on the
fixed detector. Do not infer green from output text: read exit codes. Commit
only your three owned oracle files on `dev` as a separate test commit. Report
the commit, proof, hashes and test-name counts to the coordinator.
