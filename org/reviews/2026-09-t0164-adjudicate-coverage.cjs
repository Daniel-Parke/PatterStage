// Apply the independent atom sceptic's bounded verdicts, preserving open work.
const { readFileSync } = require('node:fs');

const path = 'org/reviews/2026-09-t0164-coverage.jsonl';
const rows = readFileSync(path, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
if (rows.length !== 285) throw new Error(`Expected 285 frozen atoms, found ${rows.length}`);
const localOpen = new Set(['gap-016.a', 'gap-016.b', 'gap-043.2', 'gap-059.1']);
const exactProof = {
  'gap-037.1': 'Obtain an authorised existing-install inventory or disposable copy; record its schema version, backup provenance and current revision. Source-only migration code cannot establish the operator install state.',
  'gap-037.2': 'Obtain an authorised existing-install inventory or disposable copy; compare its age, schema version and backup with a fresh version-43 database before proposing a column change.',
  'gap-058.2': 'Ask the operator for an authorised inventory of external scripts and callers, then compare it with tracked callers; repository search alone cannot establish external absence.',
  'gap-072.b': 'Build an isolated mixed-case link fixture, run the exact-case document-link checker, and record the failure exit and target path before changing the checker.',
  'gap-099.a': 'Wait for the operator to identify the exact in-scope note and revision; then check that note against the referenced current code and record the discrepancy.',
};
const current = {
  'gap-004.a': { status: 'verified', revision: 'aeb80725a6d3a0501a7289c0f47377f4cc2515de', method: 'Run npm audit --json, npm audit --omit=dev --json and npm outdated --json against package-lock.json; record exit codes and npm explain parents.', evidence: 'org/reviews/2026-09-t0164-dependency-health.json: audit exits 1/1, outdated exit 1; ten total advisories, two production, 24 outdated direct packages; lockfile SHA and parent paths recorded.', uncertainty: 'Advisory attribution is current; route exploitability and compatible remediation are not proved.' },
  'gap-005.a': { status: 'verified', revision: '74071c2653bcac9c67ec50706ce750d0ef7df0c9', method: 'Inspect .gitleaks.toml and compare redacted strict-default, strict-plus-test-exclusion and repository-config history scans.', evidence: 'org/reviews/2026-09-gitleaks-history-control.md:145-190; strict ten, exclusion control one, repository config zero. The config excludes tests and does not enable default rules.', uncertainty: 'Configuration blind spot is established; expired historical findings and complete scanner patch coverage remain open.' },
  'gap-005.b': { status: 'unresolved', revision: '74071c2653bcac9c67ec50706ce750d0ef7df0c9', method: 'Run redacted Gitleaks 8.30.1 over the recorded 45 refs with strict rules and compare scanner patches to reachable commits.', evidence: 'org/reviews/2026-09-gitleaks-history-control.md:145-190; ten redacted candidates, 1,651 patches versus 1,666 non-merge commits and 1,753 reachable commits.', uncertainty: 'The 15-patch gap, expired historical alerts and repository config blind spot prevent a complete secret-clearance claim.', nextProof: 'Explain the 15-patch difference with a reproducible ref/merge control; account for each expired historical alert or record an explicit unrecoverable disposition if its original report is unavailable; rerun a repaired config with a planted violation.' },
  'gap-006.a': { status: 'verified', revision: 'b54701bbfb2a5a8564ab3a5ced654eeb87216059', method: 'Build an isolated Next checkout and sum unique page entry chunks from its manifest, recording raw and per-chunk gzip bytes.', evidence: 'org/reviews/2026-09-t0164-bundle-measurements.json: 29 routes; Composer 560579 raw/147925 gzip bytes, Missions 293661/91552.', uncertainty: 'Manifest chunk sum is an upper bound, not actual transferred bytes; shared cache reuse is unmeasured. These bytes are from b547; later HEAD changes CSS.' },
  'gap-006.b': { status: 'verified', revision: '74071c2653bcac9c67ec50706ce750d0ef7df0c9', method: 'Inject a candidate strict script-src on a built isolated app and compare Missions dialog with the current framing-only policy.', evidence: 'org/reviews/2026-09-t0164-csp-results.json: current policy opens dialog with zero violations; strict script-src self yields two inline-script violations and dialog stays closed.', uncertainty: 'This disproves a header-only strict CSP; nonce/dynamic-rendering feasibility across every route is not proved.' },
  'gap-020.a': { status: 'unresolved', revision: 'aeb80725a6d3a0501a7289c0f47377f4cc2515de', method: 'Run TypeScript AST candidate screen and semantic classification; independently sample mislabeled categories.', evidence: 'org/reviews/2026-09-t0164-classification.json and classify.cjs: 126 candidate suites, 101 classed live source assertions, 17 fixture/execution reads and eight other static contracts; independent check corrected ten catch labels and one suite label.', uncertainty: 'Candidate-level screen does not inspect every assertion-to-read linkage, so 126 is not a confirmed source-assertion count.', nextProof: 'Inspect each candidate suite assertion against its actual read target; record a per-suite behavioural-replacement or keep decision without deleting tests under the classify-only ruling.' },
  'gap-028.b': { status: 'verified', revision: 'aeb80725a6d3a0501a7289c0f47377f4cc2515de', method: 'Run npm run lint:knip by exit code on the current tree and compare to the reasoned baseline.', evidence: 'npm run lint:knip exit 0: knip-ratchet reports 18 exact, reasoned findings with no new or stale issue.', uncertainty: 'A green ratchet does not prove every dependency or export is used; removals still require their rulings.' },
  'gap-035.a': { status: 'verified', revision: '74071c2653bcac9c67ec50706ce750d0ef7df0c9', method: 'Trace sessions.provider through named writers, mapper, API response and a synthetic online backup.', evidence: 'org/reviews/2026-09-t0164-dimension-tooling-tests.md SQLite table: dispatch and API insert; session-repository maps/returns provider; synthetic backup retained a non-null value.', uncertainty: 'A live persisted/API contract is established; current UI display and historical data distribution are unknown.' },
  'gap-035.b': { status: 'unresolved', revision: '74071c2653bcac9c67ec50706ce750d0ef7df0c9', method: 'Trace sync_registry.source_mtime static references, synthetic recordSyncSuccess replacement and online backup.', evidence: 'org/reviews/2026-09-t0164-dimension-tooling-tests.md SQLite table: no named product read, INSERT OR REPLACE omits column and drops a synthetic non-null value, while backup retains it.', uncertainty: 'External SQL, historical install values and restore semantics are unknown; static silence does not authorise a drop.', nextProof: 'Inspect authorised historical installs/backups and external SQL callers; reproduce v2-to-head, fresh, backup and restore paths with non-null source_mtime before a retention or drop ruling.' },
  'gap-081.a': { status: 'verified', revision: 'b54701bbfb2a5a8564ab3a5ced654eeb87216059', method: 'Read isolated Next build manifests and total unique entry chunks for all 29 routes.', evidence: 'org/reviews/2026-09-t0164-bundle-measurements.json: each route has raw and gzip chunk sums, with script and build ID.', uncertainty: 'The result is a b547 manifest upper bound, not a current-HEAD transfer profile; later HEAD changes CSS and dynamic route payloads are unmeasured.' },
  'gap-082.a': { status: 'verified', revision: 'aeb80725a6d3a0501a7289c0f47377f4cc2515de', method: 'Run npm run lint:knip by exit code on current tree.', evidence: 'npm run lint:knip exit 0: 18 exact reasoned findings, no new or stale issue.', uncertainty: 'The ratchet allows named existing findings; it is not a zero-dead-code proof.' },
  'gap-095.a': { status: 'verified', revision: 'aeb80725a6d3a0501a7289c0f47377f4cc2515de', method: 'Run node scripts/tooling/check-doc-links.mjs by exit code against its tracked in-scope Markdown documents.', evidence: 'check-doc-links exit 0 for 91 tracked in-scope Markdown documents.', uncertainty: 'The checker excludes tracked org/ and data/seed/, untracked files, anchors and exact-case checks; gap-072.b retains the latter.' },
};
for (const row of rows) {
  if (localOpen.has(row.id)) {
    row.status = 'unresolved';
    const correction = 'The independent sceptic found a local source/listing step, so external deferral is not justified.';
    if (!row.uncertainty.includes(correction)) row.uncertainty += ` ${correction}`;
    row.nextProof = row.nextProof.replace(/^In an isolated or authorised fixture, /, 'At the current tree, ');
  }
  if (exactProof[row.id]) row.nextProof = exactProof[row.id];
  if (row.id === 'gap-097.a') row.uncertainty = 'The sibling EOS revisions and D012 rule were pinned and rechecked. Seed validation itself was not run.';
  if (current[row.id]) {
    const update = current[row.id];
    row.status = update.status;
    row.inspectedRevision = update.revision;
    row.method = update.method;
    row.evidence = update.evidence;
    row.uncertainty = update.uncertainty;
    if (update.nextProof) row.nextProof = update.nextProof;
    else delete row.nextProof;
    row.sceptic = {
      verdict: row.status === 'verified' ? 'supported-current-source' : 'unconfirmed-open',
      evidence: `Independent Dirac rechecked ${row.id} against its cited snapshot and current source at aeb80725. The nine verified statuses hold only as narrow revision-bound observations; the three unresolved rows retain their named next proof. See org/reviews/2026-09-t0164-sceptics.md#atomic-coverage-and-final-completeness.`,
    };
    continue;
  }
  const localPrefix = 'C:/Users/Daniel/Documents/Coding/Github/PatterStage/';
  row.method = row.method.replaceAll(localPrefix, '');
  row.evidence = row.evidence.replaceAll(localPrefix, '');
  if (row.nextProof) row.nextProof = row.nextProof.replaceAll(localPrefix, '');
  row.sceptic = row.status === 'verified'
    ? { verdict: 'supported-current-source', evidence: `Independent Dirac check of ${row.id} and all 16 verified atoms at aeb80725; see org/reviews/2026-09-t0164-sceptics.md#atomic-coverage-and-final-completeness. The narrow claim is supported; its stated limit remains.` }
    : { verdict: 'unconfirmed-open', evidence: `Independent Dirac structural review checked ${row.id} against the frozen 285-child scope at aeb80725. Current behavioural or external proof was not run; the nextProof remains necessary. See org/reviews/2026-09-t0164-sceptics.md#atomic-coverage-and-final-completeness.` };
}
console.log(rows.map((row) => JSON.stringify(row)).join('\n'));
