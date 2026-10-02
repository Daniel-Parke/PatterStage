# T-0189 oracle strengthening amendment, 2 October 2026

## Independent recovery preservation witness

Schrodinger's further contract: retain Node20 compatibility; cover nested extra values, escaped strings and decoded property names, duplicate status/error keys with last-property-wins semantics, absent error fields, multiple writing chapters and repeat stability. Only effective status/error value spans may change. Preserve other substrings, including shadowed duplicate values. Span disagreement must fail and roll back rather than silently serialising the whole document. These are independent preservation witnesses, not instructions to mirror a particular parser implementation.

The reviewer also confirmed that the existing SQL LIKE prefilter misses an escaped writing status such as `"wr\u0069ting"`. Add a witness with escaped status key/value, unrelated raw values, malformed/non-writing/deleted rows and repeat stability. Selecting all non-deleted story rows for validation at boot is within this repair; record the extra parsing cost. No periodic scan, schema change or permissive parsing is proposed.

After the NODE_ENV correction, Averroes also owns the story oracle for an additive regression witness. Reviewer Schrodinger found that serialising a mixed chapter array can change an untouched `1e309` numeric value into `null` when another valid writing chapter is recovered. Test a mixed stored array with unusable overflowing chapter fields, an overflowing primitive, a valid writing chapter with unknown numeric metadata, and an untouched valid chapter. Require valid recovery and preservation of unrelated values, including positive/negative overflow and a large integer that normal JavaScript number parsing rounds. Preserve all 47 previous names and assertions. Execute the new witness against the current implementation before any repair, record structured matcher failures, and commit the new oracle red. Do not inspect implementation bodies. No new product behaviour or schema change is authorised.

Planck is the different ORACLE author. No implementation exists. Schrodinger's
review holds the first freeze. Preserve that freeze and all failed receipts.
Only the four new suites in your claims may change. Do not inspect or edit target
implementation bodies, historical tests or protected files. Preserve every test
name and assertion except the explicitly strengthened assertion identified here.

- Stories: require the display chapter array to contain exactly the valid
  chapters, excluding invalid elements. Add mixed non-string chapterContents
  values and require usable strings to survive while unusable values are omitted
  from display; raw storage must remain untouched. Exercise wrong-shaped recovery
  documents that contain "writing", so the SQL prefilter cannot bypass the check.
  After injected rollback, require an explicit thrown failure or zero counts;
  a false success with positive recovered counts is prohibited.
- Sync: prove each old process row is absent after a successful replacement,
  rather than merely proving that both old rows are not present together.
  Pin the ProcessSync WhatsApp label for each existing key-or-phone-ID case.
- Usage: an unavailable parser must throw an explicitly labelled infrastructure
  error, not a Jest matcher assertion. Keep unavailable parser cases explicitly
  unexecuted until the module exists. Prove the actual mutation classifier treats
  the missing-module evidence as infrastructure, never a kill. Do not edit the
  runner; use an ignored validation probe if necessary.
- Display fallback: exercise an actual failing run-aggregates read with real
  SQLite and assert its established empty fallback. Keep the dashboard control.

Authority is the governing different-author rule for a frozen oracle, within
T-0189's existing invariants. This is strengthening, not a changed product policy
or an amendment to a closed historical programme's oracle.

Use the existing isolated tmp/t0189-oracle-validation checkout and pinned Node24.
The matching native dependency junction is for Jest only, never a build. Clear
operator environment and use owned fixtures. Private runners and receipts belong
under tmp/t0189-oracle-amendment/. Do not overwrite original freeze files.
Record before/after test-name identity, added names, behavioural versus infrastructure
counts, raw SHA256 of all eight suites, diagnostics, timing and unchanged tree.
Append dated provenance in the four amended files. Obtain reviewer feedback and
stop writing at the new freeze. Coordinator owns commits, metadata and views.

## Additional migration witnesses, independently reviewed before implementation

The coordinator extends your claim to data-transaction-migration-parity.test.ts
before this authorship. Preserve all existing names; add real SQLite controls for:

- Pending 040 partially applied columns: complete the remaining historical
  backfill and exact partial index; preserve rows and recorded usage.
- An injected later failure rolls back pending completion and version recording.
- Public runMigrations repairs a head43 database missing idx_runs_story. Keep
  populated rows, explicit spend classifications (including Composer-linked rows),
  usage, links, version43 and Auth43 validation unchanged. Do not replay the old
  backfill at head. Pin the index's table, column and WHERE story_id IS NOT NULL.
- Repeated calls are stable. The old applyRunsSpendSourceMigration >=40 no-op
  contract survives. A conflicting index is never silently dropped/replaced.

Production scope will be the current driver, not historical SQL. Source review
suggests the older all-file upgrade partially applies040 before the ordered
driver, which then stops on a duplicate ALTER and omits the index. Treat the
precise intermediate sequence as an inference unless observed. The existing
fresh/degraded parity failures already demonstrate the missing final index.
# Independent typing correction, 2026-10-02

Averroes owns only `tests/unit/data-transaction-migration-parity.test.ts` after the committed lane transfer. The full test-program check exposes TS2769 at the CLI spawn: the filtered environment loses Next's required `NODE_ENV` property. Preserve `process.env.NODE_ENV` explicitly after the existing filtered environment spread. Do not alter assertions, names, fixture values, environment filtering or execution semantics, and do not suppress diagnostics. Do not inspect implementation bodies to derive assertions.

Use the coordinator's integrated isolated checkout with pinned Node 24.21.0 and matching native dependencies. Run the complete `tsconfig.tests.json` typecheck without filtering and all 31 migration cases with structured Jest output. Prove unchanged names, zero skips, before/after hashes and unchanged validated source. Preserve every previous red freeze and failed typecheck receipt. Return an amendment receipt for Schrodinger's independent review; no final task acceptance is implied.

