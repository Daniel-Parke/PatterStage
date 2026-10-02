# T-0189 independent oracle brief, 2 October 2026

Adopt ORACLE. Read T-0189's ruled R2 record. No implementation exists yet.
Write only the three assigned `tests/unit/data-transaction-*.test.ts` files
after your disjoint lane is committed and the coordinator releases authorship.
Do not edit an existing test, helper, configuration, source or historical file.
Record evidence and hashes under ignored `tmp/t0189-oracle/`. Return exact test
names, executed pass/fail/skip/runtime counts and SHA256 hashes, then stop writing.

Use clean-context authorship plus parser metamorphic/property cases. Read public
types, historical fixture SQL and existing test setup as needed; do not inspect
the target implementation bodies. Use real in-memory better-sqlite3 with the
existing singleton fixture pattern. Never open the operator's database or launch
provider calls. The coordinator supplies an isolated checkout, Node24.21.0,
matching native dependencies and private environment/data. Missing imports,
configuration or bootstrap are infrastructure failures, not red evidence.

## Usage oracle

Proposed pure internal interface: `parseStoredUsage(raw: string | null |
undefined): RunUsage | null` from `src/lib/runs/parse-stored-usage.ts`.
Before that module exists, record missing-module infrastructure separately;
behavioural red evidence must also exercise existing public consumers. Pin
getRun/list behaviour, model/mission aggregates and spend-window observations.

The lib-data-13 ruling adopts input+output as the fallback. Explicit finite totals,
including zero and totals different from that sum, remain authoritative. Exercise
missing/empty/malformed JSON, null, scalars, arrays, empty object, numeric strings,
invalid and non-finite numeric fields, explicit zero and omitted total. Preserve
callers' null/zero/skip contracts for unavailable usage. Provider-vocabulary
normaliseUsage remains separate. Unknown models must retain estimated provenance;
Deep Research unrecorded usage stays distinct from free usage. Preserve existing
hard-stop refusal on SQL failure. Generate finite-count cases and check that
omitting only total gives input+output, while adding explicit finite total keeps
that total. Do not introduce a new negative-token/provider accounting policy.

Numeric strings become numbers. Missing or invalid/non-finite individual counts
default to zero while preserving valid fields; absent/invalid total uses the sum.
Missing/malformed/null/scalar/array roots return null; an empty object is a valid
zero-count object. Preserve finite negative values under the existing policy.

## Story oracle

Use existing getStory/listStories/createStory/updateStory/deleteStory and
reconcileStoriesOnBoot boundaries. Valid fields round-trip, deleted rows remain
excluded and premise derives from config. Malformed or wrong-shaped object/array
fields must not crash reads or restart recovery. Object fields use display `{}`,
chapters `[]`, unusable optional arc `undefined`; usable existing fields survive.
Test null chapter elements as well as malformed JSON and outer shape mismatches.
Reads do not mutate the raw stored bytes. A title-only update does not replace
damaged JSON with those display defaults. An explicit valid repair updates the
requested field. Recovery changes only valid writing chapters, preserves valid
other content and unusable raw documents, and rolls back related writes after
injected failure. Distinguish this from the provider generation workflow.

A valid chapter has finite numeric number/wordCount, string title and one of the
four declared statuses. A valid writing chapter retains every other field when
recovered. Display can omit invalid array elements, but recovery must preserve
them in the stored array while changing only valid writing chapters. With no
usable writing chapters, leave the original raw JSON bytes untouched. Optional
fields and unknown extension metadata on valid chapters remain intact.

## Sync oracle

Exercise actual ProcessSync with controlled ps/filesystem inputs and real SQLite.
Fail the second new insert with a SQLite trigger: all previous process rows must
remain. Success replaces stale rows; a successful empty scan clears them. Keep
timestamps/result reporting, no false success and no actual operating-system
process enumeration. Platform-token consistency is a later oracle slice until
its additional source claims and criteria are registered.

Error identity is `(source, timestamp, full message)`. Repeated ticks must not
append the same identity; different source/time/message tails survive. Severity
does not change identity and the earliest stored representative survives. Read
historical duplicates as one MIN(id) representative before LIMIT10 while retaining
their stored rows. Include more than ten duplicates before a distinct error,
empty timestamps and genuine repeats at different times. Exercise LogSync with
owned log files or controlled reader dependencies. An insertion/pruning failure
rolls back the entire tick; preserve existing 500-row retention. No new schema,
index, migration or one-off duplicate deletion is authorised.

## Freeze and limits

These three suites cover the first coherent slice, not all T-0189 ownership.
Additional independently authored controls must precede any later implementation
slice. Existing historical oracles stay unchanged; report any conflict for a
different author's Q-015 amendment. Prove actual assertion failures independently
from infrastructure errors. Do not loosen checks or edit production code to run
the oracle. After freezing, only a separately authorised author may amend it.
