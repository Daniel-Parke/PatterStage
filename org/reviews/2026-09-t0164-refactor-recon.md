---
summary: T-0164 current-tree reconnaissance after foundation and session-security batches
type: review
tags: [review, phase-1, refactor]
status: in-progress
---

# PatterStage refactor reconnaissance, 28 September 2026

This supersedes the 11 September preliminary review **where current evidence is
recorded**. It does not turn a source-level pattern into a reproduced defect or
a historical estimate into a saving. The baseline source revision for the five
dimension reviews is `65670c61a2bfcbece80b456c86b19d967d322f47`. Their
individual headers record checkout revision, methods and limits. Two Composer
defects were found and fixed at `4c029ffe` and `74071c26`; the final built-app
visual probe inspected `74071c2653bcac9c67ec50706ce750d0ef7df0c9`.

The linked [finding ledger](2026-09-t0164-findings.jsonl) has one entry for
each of the 265 preliminary IDs and preserves 163 split operator dispositions.
The [coverage scope](2026-09-t0164-coverage-scope.json) expands the original
107 gap bullets into 285 separately named obligations. The
[coverage ledger](2026-09-t0164-coverage.jsonl) gives each one a current
evidence or explicit unresolved/deferred status and a next proof. The
[red-first oracle](../../tests/unit/t0164-recon-ledger.test.ts) checks IDs,
children, provenance and no missing disposition; it cannot certify the truth
of a cited source by itself. Totals must be computed from the ledgers, never
transcribed from the preliminary index.

`node org/reviews/2026-09-t0164-totals.mjs` currently generates **265
findings: 244 verified source observations, 12 refuted and nine unresolved**;
it also counts all 163 operator dispositions. “Verified” here does not mean
implemented, tested in a browser or approved for removal. The same command
generates **285 coverage atoms: 25 verified narrow facts, 215 unresolved and
45 deferred**, under all 107 parent bullets. The independent coverage
sceptic upheld 25 narrow facts and left the other 260 explicitly open.
`2026-09-t0164-merge-findings.cjs` and
`2026-09-t0164-adjudicate-coverage.cjs` were rerun against their output; both
produced byte-identical SHA-256 results on the second pass.

## Methods and dimension review

The independent source reviews cover [app and hooks](2026-09-t0164-dimension-app-hooks.md),
[library data and domains](2026-09-t0164-dimension-lib.md),
[components and cross-cutting security](2026-09-t0164-dimension-cross-components.md),
[docs and organisation](2026-09-t0164-dimension-docs-org.md), and
[tooling and tests](2026-09-t0164-dimension-tooling-tests.md). Each table has a
current-tree source anchor and a qualification. `live` describes the source
shape only. It does not authorise removal or establish net saving.

Independent sceptics challenge each dimension separately. Their corrections
must be applied to the itemised ledger before closing this review. The final
completeness critic must check that every assigned ID occurs exactly once,
that every atom has a defensible disposition, and that no pending verdict is
misstated as acceptance. This review remains open until those steps finish.

## Security and deployment

T-0158 replaced raw-token browser cookies with revocable opaque sessions under
accepted ADR-0012, ADR-0013 and ADR-0014. Its hosted push and pull-request
workflows both passed. The source review preserves the narrower residual
findings: optional API signatures do not cover request bodies; forwarded
address throttling depends on the deployment network boundary; a CSP that
restricts inline scripts needs design and built-app proof. It does not revive
the refuted universal TLS-cookie assertion: normal Next requests honour
`X-Forwarded-Proto`.

The independent critic/components sceptic found a conditional log-path escape
which narrows the earlier `critic-14` closure: the lexical segment guard is
fixed, but an existing symlink named `x.log` could lead GET to read and DELETE
to truncate a target outside the log directory. The source path is evidenced
in `src/lib/fs/log-files.ts:156,191` and `src/app/api/logs/route.ts:106,143`.
No real file was modified to test it. An isolated sentinel reproducer and a
security fix are first-batch work; the full boundary is not certified fixed.

The [built-app CSP probe](2026-09-t0164-csp-results.json) started an isolated
Next instance on port 3804 with temporary data. The present framing policy
allowed the Missions dialog and caused zero CSP violations. Injecting a
candidate `script-src 'self'` policy caused two inline-script violations and
the dialog failed to open. This establishes that a strict policy cannot simply
be added as a header; nonce and rendering behaviour need a separate design.

The [redacted secret-scan control](2026-09-gitleaks-history-control.md) used
official Gitleaks 8.30.1 against the recorded 45 local refs. Strict default
rules found ten candidates; default rules plus the existing test exclusion
found one; repository `.gitleaks.toml` found zero because it does not enable
default rules. Nine candidates are synthetic test fixtures and one is a
64-character test hash, but expired historical findings still need separate
accounting. Gitleaks reports 1,651 scanned patches against 1,666 non-merge
commits and 1,753 reachable commits in the current native pass. The mismatch
is unresolved. A green hosted scan under the blind config is not clearance.

## Dependencies and distribution

On 28 September, `npm audit --json` exited 1: ten advisories in the full
dependency tree (five high, three moderate, two low). `npm audit --omit=dev
--json` also exited 1: two production advisories, `js-yaml` (high) and
`baseline-browser-mapping` (moderate). `npm outdated --json` exited 1 and
listed 24 direct dependencies. The committed
[dependency attribution](2026-09-t0164-dependency-health.json) records
advisory identities, installed versions, npm parent paths, exact exits and
the lockfile SHA-256; the capture JSON remains in ignored `.gate` for local
reruns. Parent paths are sampled when numerous, with their complete count and
digest retained. The direct production roots include Next for
`baseline-browser-mapping` and `js-yaml` itself for its high advisory.
Exact commands and package versions can be rerun.
An advisory is not a demonstrated exploitable application route. The next
dependency batch must attribute each advisory to its parent, bound its
runtime exposure and test a compatible fix.

The production `Dockerfile` does not copy root `LICENSE` or `NOTICE` into the
runner stage. A local lockfile scan counted 917 dependency licence labels;
752 of 776 locally installed entries had licence files and three carried
`NOTICE`. These are local-source counts, not a built-image licence inventory
or legal compatibility verdict. A distribution-stage inspection remains.

The [route bundle measurement](2026-09-t0164-bundle-measurements.json) reads
Next's committed-build manifest and sums unique page entry chunks. It is an
upper bound on route JavaScript, not network transfer. At its build revision
`b54701bb`, Composer measured 560,579 raw and 147,925 per-chunk gzip bytes;
Missions 293,661 raw and 91,552 gzip bytes. All 29 routes and the measurement
script are retained. Shared chunks, cache reuse and CSS are not apportioned
into those figures.

## SQLite and data paths

An isolated fresh database at schema version 43 contained 49 tables and 529
columns. The table-column inventory SHA-256 was
`c892bfb802303e2b5aa49096daa1e55449a9c0734cd16534b1497bbe159a93d3`;
42 SQL files were inspected for named readers, writers and migrations. No
column is pronounced dead merely because the isolated fixture is empty or
all-null. `sessions.provider` has a live reader. The three
`benchmark_runs.used_*` columns have no named current static caller, but old
backups or external SQL are unknown. `sync_registry.source_mtime` has no
current static caller and an isolated write path drops a prior non-null value;
the retention and compatibility implications remain open. A damaged
version-15 database can advance schema version through a broad caught `ALTER`
despite a missing benchmark table. The focused SQLite checks passed 8/8; the
damaged-state defect needs an oracle before repair.

## Source and test classifications

The [AST classification](2026-09-t0164-classification.json), reproducible with
`node org/reviews/2026-09-t0164-classify.cjs`, identified 253 bindingless
`catch` clauses and 126 *candidate* source-reading suites. Semantic categories
distinguish fallback, parsing, lifecycle, best-effort and silent foreground
handling; 101 suites were classed as live source assertions, 17 as fixture or
execution reads and eight as other static contracts. Independent sampling
corrected ten catch labels and one suite label. These are candidate-level classifications, not proof
that every assertion in every suite was inspected. The classify-only ruling
still applies; no blanket catch or test deletion follows.

## Browser states and user journeys

The [controlled visual result](2026-09-t0164-visual-results.json) used an
isolated built app on port 3802 and a seeded temporary data directory. It
captured 19 states at 1440×900 and 390×844, including Missions board, form
validation, Composer run/status dropdown/build/inspector, and Hindsight Add
Memory, directive and mental-model dialogs. It records fixture counts,
revision and SHA-256 for each image. No inspected state had horizontal
overflow, missing `h1` or JavaScript page error. The optional Hindsight
backend was absent, so six associated API requests returned 503 and produced
console errors; those journeys were not functional-backend acceptance.

The walk caught Composer controls hidden below the viewport by a broad bloom
selector and then white-on-white React Flow controls. Two separate Playwright
oracles were committed red, the CSS was fixed, and both tests passed against a
rebuilt isolated app. [Focused defect records](2026-09-t0164-defects.md)
preserve the qualified Missions and other follow-up faults. Current checks do
not cover every possible user pathway, paid provider, deployment or historical
database; later batch Verify lines must name those limits.

A separate [static-route walk](2026-09-t0164-route-results.json), reproducible
with [its script](2026-09-t0164-route-walk.mjs), built `aeb80725` with a fresh
temporary data directory and walked all 22 static page routes at both
1440×900 and 390×844 on port 3805. All 44 states returned a page, had an
`h1`, had no horizontal overflow and raised no browser page error. The
optional Hindsight API returned 503 on `/agent/memory`, and an empty logs
fixture returned 404 on `/results/logs`, at both widths. The five dynamic
page files are named in the result and require fixture-specific paths;
existing end-to-end suites cover several of them. The phone Composer status
dropdown, build and inspector states were not separately captured by the
19-state controlled probe, so their responsive behaviour is not certified by
this walk.

## LOCKBOOK and governance

Three current-text LOCKBOOK mismatches need a source-of-truth correction:
line 151 calls CI smoke-only although main-target pull requests and manual
runs have full Playwright; line 190 calls the design-lint baseline empty
although 104 raw-control and four raw-write allowances remain; lines 203–207
say all `config.yaml` writes use `writeHermesConfigFile`, while profile sync
first uses `atomicWriteFile` and finalises through the cache-aware writer.
The last statement needs a failure-between-writes test before a behaviour
claim. Historical entries must remain historical, and any protected edit
requires an accepted ADR.

The five original consolidation targets remain historical commitments:
100,983→98,000 source lines, 124,351→116,000 test lines, 1,000→600
repeated source windows, 4,345→2,500 repeated test windows, and 103→95
one-importer components. The current `line-census --report` at `74071c26`
returned 102,141 source lines, 133,747 test lines, 1,012 repeated source
windows, 4,786 repeated test windows and 104 one-importer components. The
next programme must use its own committed baseline and targets set once;
neither the historical target nor the overlapping 12,800-line estimate can
be silently restated.
The T-0164 baseline explicitly records ten added source lines for the two
Composer fixes and 162 added test lines for their red-first browser oracles
and the independent-ledger check. Other measured counts did not rise.

The [new scope census](2026-09-t0164-scope-census.mjs) counts tooling,
documentation and live organisation files from a Git commit and reports
protected, historical, generated, operational, tooling-ledger and binary
material separately. Its committed baseline must be written after all T-0164
changes land, so its revision is immutable and cannot count itself.

## Open proof and exit

T-0164 remains open until the sceptic corrections, gap dispositions, final
completeness check, committed scope baseline, unchanged-tree full gate,
committed-tree mutation sweep and every hosted job are recorded by exit code.
T-0165 can then use this recon to propose fixed structural targets and
independently revertible batches. Approval of that complete plan is a separate
operator action. Q-011 still places the first release before structural
clean-up; no release or PR merge is implied by this review.
