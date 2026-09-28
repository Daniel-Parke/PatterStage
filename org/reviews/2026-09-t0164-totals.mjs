// Generate reconciliation totals from the linked ledgers, never old prose.
// Run from the repository root: node org/reviews/2026-09-t0164-totals.mjs
import { readFileSync } from 'node:fs';

function rows(name) {
  return readFileSync(`org/reviews/2026-09-t0164-${name}.jsonl`, 'utf8')
    .trim().split(/\r?\n/).map((line) => JSON.parse(line));
}

function countBy(items, field) {
  return Object.fromEntries([...Map.groupBy(items, (row) => row[field]).entries()]
    .map(([key, values]) => [key, values.length]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

const findings = rows('findings');
const coverage = rows('coverage');
const result = {
  findings: {
    rows: findings.length,
    status: countBy(findings, 'status'),
    independentSceptic: countBy(findings.map((row) => ({ verdict: row.sceptic.verdict })), 'verdict'),
    operatorDispositions: findings.reduce((sum, row) => sum + (row.operatorDispositions?.length ?? 0), 0),
  },
  coverage: {
    atoms: coverage.length,
    parents: new Set(coverage.map((row) => row.parentId)).size,
    status: countBy(coverage, 'status'),
    independentSceptic: countBy(coverage.map((row) => ({ verdict: row.sceptic.verdict })), 'verdict'),
  },
};
console.log(JSON.stringify(result, null, 2));
