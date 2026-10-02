# T-0189 independent oracle brief, 2 October 2026

Adopt ORACLE. Read T-0189's ruled R2 record. No implementation exists yet.
Write only the assigned `tests/unit/data-transaction-*.test.ts` files
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
process enumeration. Platform labels and EnvSync must use the same token-presence
rule: empty, commented and placeholder `changeme` values are absent; real nonempty
values are present, including quoted values. Preserve Discord/Telegram/Slack
labels and the existing WhatsApp key-or-phone-ID platform rule. Use fake values.
SessionSync must report its underlying result without writing sync_registry;
the table and historical/recovery support remain intact under lib-data-09a.

Error identity is `(source, timestamp, full message)`. Repeated ticks must not
append the same identity; different source/time/message tails survive. Severity
does not change identity and the earliest stored representative survives. Read
historical duplicates as one MIN(id) representative before LIMIT10 while retaining
their stored rows. Include more than ten duplicates before a distinct error,
empty timestamps and genuine repeats at different times. Exercise LogSync with
owned log files or controlled reader dependencies. An insertion/pruning failure
rolls back the entire tick; preserve existing 500-row retention. No new schema,
index, migration or one-off duplicate deletion is authorised.

## Additional data and scheduler controls

The independently reviewed scope includes five more suites: models, scheduler,
migration-parity, schema-health and repository-contracts. Their exact paths are
in the committed claims. A real-source preflight reproduced model creation
leaving one new row and removing the old default after the new default insert
failed. Require one atomic creation/default replacement, including rollback
after clearing an earlier slot and preservation of unrelated defaults. Include
failure on a later slot after an earlier replacement succeeded; roll back the
new model and every touched slot. Preserve validation and explicit API style.

The same preflight reproduced concurrent source execution, repeated execution
after timeout while underlying work was pending, and lost lastError on resolved
`success:false`. Test runOne/runAll/forceSync overlap, timeout, late settlement,
rejection and later retry, while different sources may progress. Coalesce callers
by source name onto the same bounded result. After timeout, return the recorded
timeout promptly to overlapping callers rather than awaiting the underlying
promise indefinitely or starting again. Keep the per-source execution claim
until that underlying work settles. A failed result must retain its error; a
late success/rejection only releases ownership, never clears the timeout or
overwrites a newer observation. Catch late rejections. Timeout cannot pre-empt
synchronous JavaScript; no test or comment may claim that it can.
Preserve ConfigSync's deliberate nonfatal malformed-YAML result. Fake timers
may pin timeout boundaries, but settle all owned promises and restore timers.

Migration parity is an observation/control obligation: compare actual final
fresh and synthetic degraded-v2 schemas, columns and indexes after one pass,
including idx_runs_story, and repeat stability. Use real SQLite and immutable
SQL fixtures; preserve historical tests and exact head43/Auth43 controls. Report
unresolved parity as a defect, not permission to alter old migrations. Schema
health must preserve the actual missing-category-table 503 boundary and normal
healthy response. Repository-contracts should cover the remaining reviewed
retention/progression, preferences and defensive-read contracts with meaningful
behaviour rather than restating source or adding generic assertion inventories.
Resolve the exact remaining disposition matrix before claiming those obligations
covered; this suite title is not a claim of complete repository acceptance.

## Bounded consolidation characterisation

Additional claims cover reuse of getSchemaVersion/setSchemaVersion by the
mission-repeat migration, removal of the CLI's redundant convergence after
getDb has already validated head43, one shared safeRead for the three existing
defensive display consumers, empty session-sync branch/result cleanup and factual
migration/initialisation prose. Preserve all existing test names and behaviour.
Exercise the real CLI on an owned fresh fixture and retain its failure exit path;
the application convergence loop remains until the separately owned rebuild path
is retired. Check migration repeat/no-op and error semantics through its public
applier, not source text. Safe reads preserve synchronous return/throw/fallback
identity and never enter the hard-stop path. Existing spend-guard tests remain.

Retain the session initialisation debounce contract, including custom delays;
only its inaccurate claim of triggering an actual sync is corrected. A timestamp
replacement does not preserve pending-timer/event-loop semantics. Retain runtime
category seed SQL and its standalone asset, but compare actual repository seeding
with the asset in real SQLite. Existing custom rows must remain unchanged and a
missing table must not trigger writes. The old asset-only test does not prove
runtime parity. No seed keys, files or interfaces are retired.

## Freeze and limits

These suites do not by themselves discharge all T-0189 ownership.
Additional independently authored controls must precede any later implementation
slice. Existing historical oracles stay unchanged; report any conflict for a
different author's Q-015 amendment. Prove actual assertion failures independently
from infrastructure errors. Do not loosen checks or edit production code to run
the oracle. After freezing, only a separately authorised author may amend it.
