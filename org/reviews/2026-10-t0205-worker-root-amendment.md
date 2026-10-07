# T-0205 worker-root oracle amendment

Date: 2026-10-02. Separate ORACLE author: session `2026-10-02-worker-root-oracle`,
lane `T-0205-worker-root-oracle`. Authoriser: independent R2 REVIEWER Schrodinger
`01a0f7b7-f68a-79b2-ba74-81cdddf2f3ef`, narrow Q-015 authority in
`org/briefs/T-0205-worker-root-amendment.md`.

## Result and scope

The real Windows directory-junction calibration reproduced the original alias
refusal in both ordinary and coverage modes. Canonicalising the freshly created
owned root corrected both same-directory cases. Both different-directory controls
still failed strict root equality despite successful Jest configuration output.
The focused suite passed all nine original identities, with zero failures, skips
or runtime-error suites. This is amendment evidence, not full-gate or nativeMac acceptance.

Only two lines of `tests/unit/release-jest-worker-budget.test.ts` changed: the filesystem import gains
`realpathSync`, and `owned` becomes
`realpathSync.native(mkdtempSync(join(tmpdir(), "t0205-worker-budget-")))`.
Strict root equality and all other qualification predicates remain unchanged.
The complete source suffix beginning with `beforeAll` is unchanged, including
all nine names, assertions, CLI overrides and invalid-configuration classification.
All fixture, launch, buffer and test bounds remain unchanged. No fallback accepts
an unresolved root. Product implementation, CI, task metadata, shared fixtures,
coverage floors and the shared validation checkout were not edited.

## Source and isolation

Source revision: `a92487c40330a8063c1265d00e48fd0abda5c7d2`.
The primary checkout already had coordinator metadata edits; later context-diagnostic
work belongs to the coordinator. Neither is included in this oracle fixture.
The original oracle is preserved at
`tmp/t0205-worker-root-20261002-DeOPcm/original/release-jest-worker-budget.test.ts`.

- Original raw SHA-256: `66baeb8fee7b038f7950443c65d818e49ac5a8b18a4cb05a1cb56d74c0b8e5d1`.
- Amended raw SHA-256: `fe674903ca731864a9096e65a7e04dda95f7d8770ef2740ea8c6cf51497721eb`.
- Original source Git blob: `d3eee133190cdbaf3226e5f67fb1be4afdf45b2e`.

The eight existing support files were copied opaquely, without inspecting product
implementation. Their LF-normalised Git blob hashes match the stated source
revision, and their bytes match across the red, green and focused fixtures.
`tmp/t0205-worker-root-20261002-DeOPcm/audit.json` records every support hash and source blob.
No CI or task metadata was copied. Junctions target only owned storage or the
existing dependency pool; evidence enumeration uses lstat and does not traverse
junctions. No directory, junction or failed receipt was removed.

Runtime: pinned Node `v24.21.0`, ABI `137`, executable
`tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe`.
Dependencies: `tmp/t0188-green-validation/node_modules`; Jest `30.3.0`.
Resolver SHA-256: `16a71376c1f6b161176dabb95393b09183180063fb89d0bfc749a2fb70a2d3e2`.
Resolution is anchored through the installed Jest CLI; jest-config is nested under
`jest-cli/node_modules`. The installed normaliser calls tryRealpath and then
realpathSync.native. No dependency installation or network operation was used.

## Calibration method and results

The driver exports the actual oracle probe from its exact source prefix before
beforeAll, using the installed TypeScript transpiler. The probe body is unmodified
within each phase. This isolates the infrastructure predicate without substituting
Jest output, CPU receipts or filesystem identity.

Each case creates a real junction named alias pointing to owned storage. lstat
confirms a link; realpath confirms alias and storage identify the same directory,
while their lexical paths differ. The probe receives that alias as its temporary
root and executes real Jest --showConfig with inventory 64. Each phase uses both
ordinary and coverage modes. Different-directory cases use an independently
populated other/project directory and an explicit --rootDir flag.

| Case | Count | CLI result | Oracle result |
| --- | ---: | --- | --- |
| Original, same-directory junction | 2 | Exit 0, valid JSON, correct inventory and coverage | Infrastructure refusal; only rootMatches false |
| Amended, same-directory junction | 2 | Exit 0, valid JSON, correct inventory and coverage | Accepted; all qualification predicates true |
| Amended, different existing directory | 2 | Exit 0, valid JSON, correct inventory and coverage | Infrastructure refusal; only rootMatches false |

The original same-directory failures have equal physical roots but unequal
lexical roots. The amended positives retain the same physical root and satisfy
the original strict equality. The negative controls have genuinely different
canonical roots, although both basenames are project. Every successful calibration
configuration resolved maxWorkers to 2. Failures remain infrastructure refusals;
none is represented as a mutation kill.

Each inner child retains its 20-second timeout and 1 MiB output bound. Calibration
outer children have a 25-second bound. The six calibration launch durations were
569, 510, 538, 491, 493, 493 ms.
There were no retries and no unexpected failures.

## Nine-identity focused run

The unmodified amended test file ran through a private Jest outer runner, with
ts-jest diagnostics enabled, node environment, no cache and --runInBand. This
outer runner selects only this oracle and does not establish corpus scheduling,
coverage-floor or full-gate acceptance. Every inner probe still loads the copied
canonical worker configuration, including its ordinary and coverage cases.
No inner budget, inventory, timeout, assertion or coverage check was overridden.

Result: nine passed, zero failed, zero pending, zero runtime-error suites;
exit 0, no signal, 5560 ms. The nine executed full names
match the original names in order. W07 exercised the removed-budget control;
W08 exercised both explicit CLI overrides; W09 required its exact completed
invalid-maxWorkers validation rejection. The normal run produced ten inner
probe receipts, including the expected W09 exit-1 receipt.

## Commands and evidence

From the primary repository, these commands ran in order. The source amendment
occurred only after the red command succeeded:

```powershell
& './tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe' './tmp/t0205-worker-root-20261002-DeOPcm/calibrate.cjs' red
& './tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe' './tmp/t0205-worker-root-20261002-DeOPcm/calibrate.cjs' green
& './tmp/t0203-node24-runtime/node-v24.21.0-win-x64/node.exe' './tmp/t0205-worker-root-20261002-DeOPcm/calibrate.cjs' normal
```

All three commands exited 0 after checking their expected outcomes. Exact nested
executable paths, argv, cwd, durations and statuses are in each phase summary.
The private runner receives only allowlisted system launch variables and owned
home/data/cache/temp paths. No raw environment or secret values are recorded.
The red and green calibration JSON files retain every individual qualification
predicate, actual root, expected root and inventory. The audit indexes all 16
inner receipts. Raw stdout, stderr and inventory files remain beside each receipt.

Every failed/refused attempt is retained below:

| Receipt | Classification | CLI exit |
| --- | --- | ---: |
| `tmp/t0205-worker-root-20261002-DeOPcm/red/alias-ordinary/storage/t0205-worker-budget-IDSz5h/receipt.json` | same-directory alias infrastructure refusal; intended pre-amendment red | 0 |
| `tmp/t0205-worker-root-20261002-DeOPcm/red/alias-coverage/storage/t0205-worker-budget-k88Qvz/receipt.json` | same-directory alias infrastructure refusal; intended pre-amendment red | 0 |
| `tmp/t0205-worker-root-20261002-DeOPcm/green/different-ordinary/storage/t0205-worker-budget-wQjKjS/receipt.json` | different-directory infrastructure refusal; expected negative | 0 |
| `tmp/t0205-worker-root-20261002-DeOPcm/green/different-coverage/storage/t0205-worker-budget-hK99UB/receipt.json` | different-directory infrastructure refusal; expected negative | 0 |
| `tmp/t0205-worker-root-20261002-DeOPcm/normal/temp/t0205-worker-budget-MwGa92/receipt.json` | W09 genuine invalid maxWorkers validation; expected infrastructure refusal | 1 |

The freeze manifest is `tmp/t0205-worker-root-20261002-DeOPcm/freeze.json`. It records both owned
deliverable hashes, all regular private evidence-file hashes and junction targets.
The finaliser checks the exact two-line amendment and support-source identities.
The original and failed evidence are retained, not rewritten.

## Limits and handoff

This proves a Windows junction alias mechanism and retained different-directory
rejection. It does not prove which combined predicate caused the historical Mac
failures at a92487c4: nativeMac receipt fields were not uploaded. NativeMac exact-head
full-run acceptance remains mandatory. The earlier ten-stage passing gate preceded
this amendment. Whole-gate, required sweeps and independent acceptance remain with
the coordinator and reviewer. The separate HTTP context diagnostic is outside scope.
No commit, push, task closure or acceptance ruling is made here.

At freeze, this author ceases all writes. Only the claimed oracle and this report
are deliverables; every other author-created file is inside the unique private root.
