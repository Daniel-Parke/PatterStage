# T-0189 data verification, in progress

The task is ruled R2. No implementation or acceptance is recorded yet. Closure
head `d6989a30` passed all11 PR jobs, nine applicable push jobs and both secret
scans, independently confirmed by Schrodinger. Setup commits `d0b9a7ed` and
`780fb143` record exact claims before separate-author oracle work.

## Reproduced before implementation

| Boundary | Actual-source observation | Retained evidence |
| --- | --- | --- |
| Process snapshot | Real SQLite second-insert abort leaves0 old rows instead of1 | `tmp/t0189-source-preflight-20261002/receipt.json` |
| Error log | Repeated inserts append duplicates; ten duplicates crowd out a distinct error | Same receipt |
| Story reads/recovery | Malformed config throws SyntaxError; null config and object-shaped writing chapters throw TypeError; raw bytes retained | `tmp/t0189-story-preflight-20261002.json` |
| Model/default write | Refused default insertion leaves1 new model and0 prior defaults | `tmp/t0189-additional-preflight-20261002.json` |
| Sync scheduler | Resolved failure drops lastError; concurrent calls execute twice; post-timeout call executes again before underlying work settles | Same receipt; all pending work settled |
| Actual schema | Owned production fixture has49 application tables and529 columns | `tmp/t0189-live-schema-inventory-20261002.json` |

These probes run unchanged source with explicit boundary stubs and real in-memory
SQLite or timers. They are not independent oracles, provider integration or
column-deadness proof. Scheduler preflight used the actual default30-second
timeout; the formal oracle must pin timeout boundaries separately.

## Personal browser observation

The isolated built instance used port3998 and its own database/home/Hermes files.
At1440x900 and390x844 a healthy story appeared after reload. Adding one JSONnull
config story made actual POST/api/stories return200 with an empty story list,
hiding the healthy story and displaying an empty bookshelf. Damaged bytes stayed
unchanged. Both views had one h1, no document overflow and no page errors.
All four screenshots were inspected; the owned process was stopped.

The extended owned journey also passes at both widths: Read opens the stored
chapter; return to the library; the first Delete click changes no stored row;
confirmation returns 200 and soft-deletes; reload keeps the story absent.
Receipt1790952066358 records both reader geometries with one h1, no horizontal
overflow and no page errors. Both reader screenshots were inspected. The earlier
extended observer1790952032359 raced an old response body against navigation;
it is retained. Awaiting the back-navigation read before the next observation
resolved the observer error without a product or frozen-test change.

Receipt: `tmp/t0188-green-validation/tmp/t0188-chat-viewport-1790951134704/walk.json`.
The earlier observer receipt1790951042092 is retained: it incorrectly expected
an error banner before inspection revealed the handler's200empty fallback.
No product or frozen test changed to make the observation pass.

Follow-up: T-0192 must inspect `src/modules/rec-room/handlers/crud.ts:17-23`, which
conceals all list errors, including database failures. T-0191 owns the cramped
phone card title/metadata, observed in inspected screenshots despite no document
overflow. These are future explicitly claimed repairs, not completed fixes.

## Preservation and remaining proof

`tmp/t0189-preservation-baseline-20261002.json` records raw hashes and committed
blob IDs for1,006 existing test, protected and historical migration files before
implementation. No historical test changes are currently authorised. The
separate ORACLE lane owns eight new suites. All20 findings, six split rulings and
31 coverage obligations still need individual final dispositions and evidence.
Full gate, mutation sweep, affected browser acceptance, independent final review
and exact-head hosted checks remain pending.

## Scope decisions before implementation

The disposition register contains exactly20 findings, six split rulings and31
coverage IDs, validated against the ownership ledger. All remain pending final
disposition. The independent review identified six additional cleanup decisions
that cannot be silently closed with the initial transaction slice.

The measured safeRead proposal replaces21 body lines across three display-only
consumers with11 helper/comment/import lines, net minus10 before the final census.
No new caller, asynchronous recovery or spend-guard fallback is permitted.
Category seeds retain10 identical data lines in embedded runtime SQL and the
standalone asset: loading the asset at runtime adds a path/tracing dependency,
while replacing the asset requires a new compatibility/generation contract.
Add actual runtime/asset parity evidence; the existing asset-only test does not
establish that equivalence. The timer debounce retains its existing custom-delay
and event-loop contract, with corrected prose. A timestamp substitution would
change pending-timer semantics for a small saving. These retained duplicates
must not be reported as removals. See `tmp/t0189-net-assessment-20261002.json`.

Separate REVIEWER clarification preserves finite usage components on sum overflow
rather than dropping the row and possibly understating spend. Concurrent sync
callers share a bounded result; a timeout keeps the execution claim until the
underlying work settles. Late settlement cannot clear its recorded timeout.

## Candidate column trace rechecked at f652de00

The source remains unchanged from the oracle baseline. These are source traces,
not proof about deployed databases or external SQLite clients.

| Candidate | Current evidence | Disposition boundary |
| --- | --- | --- |
| benchmark_runs.used_skills, used_tools, used_memory | Named production references remain the three ALTER statements in immutable 015_benchmark_config.sql. T-0188's real SQLite partial-apply control now preserves a non-null used_tools value. | Retain all three. No current product reader does not establish safe deletion; generic online backup preserves the database. The legacy rebuild whitelist omits benchmark_runs. |
| sessions.provider | dispatch.ts:68 and sessions/route.ts:122 supply it; session-repository.ts:186/219 maps and inserts it. session-sync-repository.ts:87-115 inserts NULL for new foreign sessions and does not overwrite it on conflict. | Live persisted/API contract. Retain. Missing UI use is irrelevant to that contract. |
| sync_registry.source_mtime | Baseline line239 defines it. The only current named source occurrence is the schema. SessionSync invokes INSERT OR REPLACE writers which omit the column; upgrade.ts:51-68/93-122 includes generic export and shared-column import. | Remove only the ruled status writers. Keep table, column and existing rows. Historical non-null values and external SQL remain unresolved. |

Re-run with `rg -n -e used_skills -e used_tools -e used_memory src scripts tests docs`,
`rg -n 'source_mtime|sync_registry' src scripts tests`, and the named provider
paths. The inventory of49tables/529columns does not change these conclusions.
`snapshotDatabase` uses the driver's online backup at db/backup.ts:155-169;
`restoreCommand` documents stopping the server and removing stale WAL sidecars.
No operator backup or restore was inspected or executed. The legacy rebuild
predicate requires version greater than103, which the current head43 chain does
not emit. Its separate retirement and destructive manual prebuild path remain
T-0199 obligations. Migration history stays immutable; ADR-0004 preserves
benchmark history and ADR-0009's opt-in pruning does not authorise table drops.

## First oracle checkpoint and review hold

Commit f652de00 preserves eight independently authored suites:398 discovered,
333 executed,192 passed,140 behavioural failures, one missing-parser
infrastructure failure and65 conditional parser cases not executed. The first
freeze is retained unchanged at tmp/t0189-oracle/freeze-20261002.json. Review
requires stronger mixed-chapter, recovery, stale-process and WhatsApp assertions,
explicit infrastructure classification and an actual failing aggregate read.
Planck owns that narrow amendment separately from original author Sartre and
the coordinator. No implementation is permitted until its red commit and review.

Eighteen unchanged historical suites pass205/205 tests, with no skips, in the
isolated checkout at d0b9a7ed. Receipt
`tmp/t0189-historical-controls/1790953409207/summary.json` names every test and
records unchanged source and selected-suite hashes. This covers existing
retention, progression, Composer, credentials, schedules, chat, research spend,
stats, analytics, spend refusal, ConfigSync, scheduler, backup and migration
controls. It does not replace the new oracle or the finished-tree full gate.

An additional synthetic recovery probe invokes the actual snapshotDatabase API
with the source database open in WAL mode, then closes it and copies the backup
to a separate, previously absent owned path. All five candidate column values
survive and restored integrity_check returns ok. Receipt
`tmp/t0189-column-backup/1790953996932/receipt.json` binds the source to f652de00
and records the backup hash. This establishes preservation in that fixture only;
it does not inspect operator history, prove concurrent updater ownership or test
application/authentication restart after restore.

Adjacent source-only hypotheses remain for host-tooling verification in T-0196:
ProcessSync's process enumerator converts an exec error without stdout into an
empty list; LogSync's stream error handler resolves its partial buffer. The
current transaction oracle proves write atomicity and successful empty scans,
not whether those discovery failures should publish success. No runtime failure
injection or behaviour change for these two paths is claimed here.
