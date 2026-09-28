// Reconcile dimension review tables into the itemised finding ledger.
// Run only after all five independently authored dimension reviews exist.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = 'org/reviews';
const input = join(base, '2026-09-t0164-findings.jsonl');
const reviews = [
  '2026-09-t0164-dimension-docs-org.md',
  '2026-09-t0164-dimension-app-hooks.md',
  '2026-09-t0164-dimension-lib.md',
  '2026-09-t0164-dimension-cross-components.md',
  '2026-09-t0164-dimension-tooling-tests.md',
];
const sceptics = {
  '2026-09-t0164-dimension-docs-org.md': { name: 'Anscombe', section: 'docs-and-organisation-anscombe-challenging-hilbert-41-ids' },
  '2026-09-t0164-dimension-app-hooks.md': { name: 'Hilbert', section: 'app-and-hooks-hilbert-challenging-anscombe-49-ids' },
  '2026-09-t0164-dimension-lib.md': { name: 'Herschel', section: 'data-and-library-domains-herschel-challenging-dirac-46-ids' },
  '2026-09-t0164-dimension-cross-components.md': { name: 'Dirac', section: 'critic-components-and-cross-cutting-dirac-challenging-herschel-72-ids' },
  '2026-09-t0164-dimension-tooling-tests.md': { name: 'Pauli', section: 'tooling-and-tests-pauli-challenging-helmholtz-57-ids' },
};
const mixedVerdicts = {
  'lib-data-27': 'unresolved',
  'tooling-03': 'refuted',
  'tooling-12': 'live',
  'tooling-22': 'live',
  'tests-12': 'live',
  'tests-13': 'fixed',
};
const unresolvedProofs = {
  'tests-24': 'List the 14 line-census inline DB-mock suites and inspect each factory contract; for an eligible suite, preserve the test-name set and failure behaviour before/after a shared mock, then measure net lines.',
  'tests-03': 'Run a fresh isolated Jest coverage pass with the current include/exclude configuration; compare each configured floor with measured statement, branch, function and line coverage, recording full exit and report revision.',
  'tests-16': 'Reproduce repeated ? key presses with the relevant help dialog open and closed in an isolated Playwright browser at 1440 and 390 widths; collect failure/console evidence before attributing a flake to force-dynamic rendering.',
  'tooling-30': 'With authorised GitHub read access, query main branch protection and required status checks through gh api, record response status and compare with docs and installed hook state; do not infer remote protection from local files.',
  'lib-data-27': 'Create disposable v2 and fresh databases, migrate each to current v43, then compare sqlite_master for idx_runs_story and all expected indexes. Preserve the v2 fixture and migration exits before proposing parity changes.',
  'components-03': 'Run a current accessible-name inventory of visible controls at 1440 and 390 widths, including ModelEditor and Field; distinguish explicit aria-label and associated label from genuinely unnamed controls. Record screen state and violations.',
  'components-27': 'Rerun Knip with its committed scope and list each allegedly unused export; inspect direct, dynamic, test and documented consumers before counting safe removals or measuring net savings.',
  'app-08': 'In an isolated built app, force an error in the inner route boundary and then its fallback UI; observe whether the outer ErrorBoundary renders and retains navigation, before any removal proposal.',
  'app-23': 'Build an isolated current tree and inspect the route prerender/dynamic manifest for every page; compare navigation/cache behaviour for pages under headers() and force-dynamic guards before claiming universal dynamic rendering.',
};

function columns(line) {
  const result = [];
  let current = '';
  let inCode = false;
  for (let i = 1; i < line.length; i++) {
    const char = line[i];
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode && line[i - 1] !== '\\') {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

const byId = new Map();
for (const review of reviews) {
  const text = readFileSync(join(base, review), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const parts = columns(line);
    const id = parts[0];
    if (!/^[a-z][a-z-]*-\d{2}$/.test(id ?? '')) continue;
    if (parts.length !== 5) throw new Error(`${review}: ${id} has ${parts.length} columns`);
    if (byId.has(id)) throw new Error(`Duplicate dimension review ID: ${id}`);
    const verdictText = parts[1].replaceAll('*', '').trim().toLowerCase();
    const verdict = mixedVerdicts[id] ?? /^(live|fixed|refuted|unresolved|deferred)\b/.exec(verdictText)?.[1];
    if (!verdict) throw new Error(`${review}: unknown ${id} verdict ${verdictText}`);
    byId.set(id, { review, verdict, verdictText, evidence: parts[2], qualification: parts[3], owner: parts[4] });
  }
}
const rows = readFileSync(input, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
if (rows.length !== 265 || byId.size !== rows.length) throw new Error(`Review coverage: ${byId.size}/${rows.length}`);
for (const row of rows) {
  const found = byId.get(row.id);
  if (!found) throw new Error(`Missing current review: ${row.id}`);
  row.inspectedRevision = '65670c61a2bfcbece80b456c86b19d967d322f47';
  row.method = `Inspect ${found.review} and its cited current-tree source lines; compare with the historical finding. This is a source-level verdict, not a behaviour or net-saving proof.`;
  row.evidence = `${found.review}: ${found.evidence}`;
  row.uncertainty = found.qualification;
  row.ruling = found.owner;
  row.currentReview = { file: `${base}/${found.review}`, verdict: found.verdictText, qualification: found.qualification, owner: found.owner };
  row.status = found.verdict === 'refuted' ? 'refuted'
    : found.verdict === 'live' || found.verdict === 'fixed' ? 'verified' : found.verdict;
  row.resolution = found.verdict;
  if (row.id === 'tests-12') {
    row.proposalDisposition = {
      status: 'ruled-out',
      reason: 'The observed scanner overlap is live, while Q-015/free-band at org/reviews/2026-09-decision-register.md:3077 rules out merging the two suites because it does not pay net of test identity and fixture cost.',
    };
  }
  const sceptic = sceptics[found.review];
  row.sceptic = {
    verdict: found.verdict === 'refuted' ? 'refuted-current-source'
      : found.verdict === 'fixed' ? 'source-remedy-present'
        : found.verdict === 'live' ? 'supported-current-source' : 'unconfirmed-open',
    evidence: `Independent ${sceptic.name} challenged this dimension at 74071c26; see org/reviews/2026-09-t0164-sceptics.md#${sceptic.section}. This verdict is bounded by the per-ID qualification, not a runtime or net-saving proof.`,
  };
  if (row.status === 'unresolved' || row.status === 'deferred') {
    row.nextProof = unresolvedProofs[row.id];
    if (!row.nextProof) throw new Error(`No self-contained next proof for ${row.id}`);
  } else delete row.nextProof;
}
process.stdout.write(rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
