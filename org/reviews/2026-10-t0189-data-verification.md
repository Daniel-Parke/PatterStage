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

## Implementation review before the full gate

The integrated coordinator slice passed 380 of 380 new oracle cases and 164 of
164 historical controls, without skips. Receipts are
`tmp/t0189-coordinator-check/1790955082237/summary.json` and
`tmp/t0189-coordinator-check/1790955142468/summary.json`. Carver's separate sync
slice passed 63 of 63 focused cases, preserving all names and 950 historical
test-file hashes, in `tmp/t0189-sync-lane/handoff.json`. These partial runs do
not establish full-gate or mutation acceptance.

Full test-program typing exposed TS2769 in the frozen migration oracle's
filtered environment object. The earlier app-program check did not validate
that program. Averroes independently preserves the inherited NODE_ENV value
explicitly. The initial sandboxed attempt recorded 29 passes and two CLI
infrastructure failures from uv_os_get_passwd; the unchanged source then passed
all 31 cases and full test typing outside the sandbox. Both receipts remain in
`tmp/t0189-oracle-amendment/typing-1790956076855/` and
`tmp/t0189-oracle-amendment/typing-retry-1790956209331/`. Infrastructure failures
are not behavioural reds or mutation kills.

Schrodinger found a further implementation blocker: whole-array serialisation
during recovery can null an untouched overflowing numeric value when another
chapter is recovered. An independent mixed-array regression witness is required
before repair. Preserve numeric lexemes, unknown metadata and effective duplicate
key semantics; the current Node20 CI path excludes a Node24-only JSON API fix.

The provisional line census is source 102152, tests 142727, tooling 13667 and
repeated source windows 946. The new eight independent suites add 1435 test lines.
The inline database fixture count also rises from 14 to 15: the schema-health
oracle supplies the actual SQLite fixture through its route boundary and
exercises the real missing-table health result. This is a named fixture
exception, not a removed lint check. Later preservation witnesses and their
implementation still need a fresh census. Programme targets remain unchanged.

The final independent story freeze executed 51 cases: 47 original passes and
four new matcher failures. Its SHA256 is
`e8b01a7d3552f01425b6020cae3a401b47ed0116bc68086618d302da3824c717`;
`tmp/t0189-oracle-amendment/story-final-red-1790956875734/freeze.json`
records unchanged source, preserved names, full test typing and scoped lint.
Schrodinger accepted that oracle before red commit a49e016d.

The repaired integrated tree passes all 425 oracle cases without skips or runtime
errors in `tmp/t0189-coordinator-check/1790957188311/summary.json`; its tree stamp
does not move. Both complete TypeScript programs and scoped lint exit zero in
`tmp/t0189-static-check/1790957252020/summary.json`. Recovery now uses spans from
already validated JSON and changes only the effective status/error values. It
parses all live story rows once at boot so escaped writing statuses are included;
this adds parsing work, not a periodic scan. Numeric lexemes, duplicate fields,
unknown metadata and unrelated raw substrings survive.

The revised census is source 102216, tests 142881, tooling 13667 and repeated
source windows 946. Against the pre-batch baseline this is +15 source lines,
+1589 test lines, -10 tooling lines and -22 repeated source windows. The added
preservation code costs more than the earlier consolidation saved; the baseline
records that reason instead of hiding it. No target moves. Full gate, browser
walk, 31 proposed mutants, final independent acceptance and hosted CI remain open.

The first full gate stopped at Jest (exit 1) on an unchanged tree:
`tmp/t0189-full-gate-1790957390217/summary.json`. Lint and app typing exited zero;
Jest reported 8099 passes, seven failures and nine existing skips. Seven later
gate steps were not executed. Six failures were caused by the private launcher's
unnecessary CONTROL_HUB_DATA_DIR assignment contaminating legacy-warning checks.
After removing that assignment while retaining prefix clearing and owned paths,
the unchanged alias suite passes nine of nine in
`tmp/t0189-alias-control-1790958139125/summary.json`.

The seventh failure exposed a real static-analysis gap: removing the redundant
CLI call leaves runMigrations consumed through jest.requireActual, which Knip
does not trace. Averroes independently adds a used named type import in the new
oracle. Its emitted ESNext and CommonJS JavaScript is byte-identical; all 31
migration cases and six unchanged historical Knip-proposal cases pass, as do
full test typing, scoped lint and the unchanged Knip ratchet. Receipt:
`tmp/t0189-oracle-amendment/static-dependency-1790958177898/freeze.json`.
No ignore, baseline exception or historical test change was made. The full gate
must run again; these focused results do not replace it.

Schrodinger accepted the type-only correction at freeze hash
`5e00ae4c845631dd7ce3d32a8717fa4b9c2669841ffb90aa86dff8fe094dff50`.
The second complete gate attempt, `tmp/t0189-full-gate-1790959016924/summary.json`,
again stopped at Jest on an unchanged tree: 8105 passed, one failed, nine
existing skips. The seven prior failures were resolved. This failure is the
historically observed Windows EPERM while the unchanged T-0161 after-catalog
fixture removes its owned temporary root. Seven later stages were not run.

The unchanged suite then passed all four cases alone in
`tmp/t0189-coordinator-check/1790959482685/summary.json`. A private transparent
spawn/cleanup observer ran the full Jest workload, retaining process status,
signal, elapsed time and non-secret phase markers before cleanup could mask a
primary failure. All 8106 tests passed, with nine existing skips and an unchanged
tree, in `tmp/t0189-shell-observation-1790959743905/summary.json`. All four setup
processes completed in 690-1031 ms and cleanup succeeded. Instrumentation changes
timing, so this does not identify the prior cause or replace the full gate.
The original failed root remains preserved; inspection found no live bash/node
command line referencing it. No frozen test, deadline or coverage floor changed.
The unresolved failure is also explicit in T-0195's review follow-up. The normal
entire gate must now pass without the observer; a recurring failure cannot be
waived. Current test census: 142884 lines; original and programme targets remain.
