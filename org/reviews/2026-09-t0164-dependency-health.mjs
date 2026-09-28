// Summarise the captured 28 September npm audit and live explain chains.
// Inputs: .gate/t0164-audit-all.json, -audit-prod.json, -outdated.json.
// The three capture commands and exit codes are documented in the output.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const npmCliCandidates = [
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
];
const npmCli = npmCliCandidates.find(existsSync);
if (!npmCli) throw new Error('Cannot locate npm CLI beside Node; run npm explain manually and record its parent chains.');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const fileHash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const project = readJson('package.json');
const projectLabel = `${project.name}@${project.version}`;
const audit = readJson('.gate/t0164-audit-all.json');
const productionAudit = readJson('.gate/t0164-audit-prod.json');
const outdated = readJson('.gate/t0164-outdated.json');
if (!audit.vulnerabilities || !productionAudit.vulnerabilities || !audit.metadata?.vulnerabilities) {
  throw new Error('Captured audit JSON is incomplete');
}

function parentChains(explanation) {
  const chains = new Set();
  function visit(entry, path, depth) {
    if (depth > 30) throw new Error(`npm explain parent chain exceeded 30 levels: ${path.join(' <- ')}`);
    const dependents = entry.dependents ?? [];
    if (dependents.length === 0) { chains.add(path.join(' <- ')); return; }
    for (const dependent of dependents) {
      if (!dependent.from) { chains.add(path.join(' <- ')); continue; }
      const parent = dependent.from;
      const label = parent.name ? `${parent.name}@${parent.version ?? 'workspace'}` : projectLabel;
      if (!parent.name) { chains.add([...path, label].join(' <- ')); continue; }
      if (path.includes(label)) { chains.add([...path, `${label} (cycle)`].join(' <- ')); continue; }
      visit(parent, [...path, label], depth + 1);
    }
  }
  visit(explanation, [`${explanation.name}@${explanation.version}`], 0);
  return [...chains].sort();
}

const vulnerabilities = [];
for (const [name, detail] of Object.entries(audit.vulnerabilities).sort(([a], [b]) => a.localeCompare(b))) {
  const output = execFileSync(process.execPath, [npmCli, 'explain', name, '--json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const explanations = JSON.parse(output);
  const chains = [...new Set(explanations.flatMap(parentChains))]
    .sort((a, b) => a.split(' <- ').length - b.split(' <- ').length || a.localeCompare(b));
  const rootDependencies = [...new Set(chains.map((chain) => {
    const steps = chain.split(' <- ');
    return steps.at(-1) === projectLabel ? steps.at(-2) : null;
  }))].filter(Boolean).sort();
  vulnerabilities.push({ name, severity: detail.severity, direct: detail.isDirect,
    productionAudit: name in productionAudit.vulnerabilities,
    affectedRange: detail.range, installedVersions: [...new Set(explanations.map((row) => row.version))].sort(),
    nodes: detail.nodes,
    advisories: detail.via.filter((entry) => typeof entry === 'object')
      .map((entry) => ({ source: entry.source, title: entry.title, url: entry.url, range: entry.range })),
    fixAvailable: detail.fixAvailable,
    parentPathCount: chains.length,
    parentPathSha256: createHash('sha256').update(chains.join('\n') + '\n').digest('hex'),
    rootDependencies,
    parentPaths: chains.slice(0, 20),
    parentPathsTruncated: chains.length > 20 });
}
const report = {
  capturedOn: '2026-09-28',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  lockfileSha256: fileHash('package-lock.json'),
  capture: [
    { command: 'npm audit --json', exitCode: 1, input: '.gate/t0164-audit-all.json', inputSha256: fileHash('.gate/t0164-audit-all.json') },
    { command: 'npm audit --omit=dev --json', exitCode: 1, input: '.gate/t0164-audit-prod.json', inputSha256: fileHash('.gate/t0164-audit-prod.json') },
    { command: 'npm outdated --json', exitCode: 1, input: '.gate/t0164-outdated.json', inputSha256: fileHash('.gate/t0164-outdated.json') },
  ],
  counts: { all: audit.metadata.vulnerabilities, production: productionAudit.metadata.vulnerabilities,
    outdatedDirect: Object.keys(outdated).length },
  vulnerabilities,
  outdatedDirect: Object.fromEntries(Object.entries(outdated).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => [name, { current: entry.current, wanted: entry.wanted, latest: entry.latest }])),
  limit: 'npm advisory and parent attribution is a dependency-tree finding, not proof of an exploitable application route or a compatible fix. Local installed-tree and captured-audit snapshot only. parentPaths lists the 20 shortest paths when more exist; parentPathCount and SHA-256 cover every generated path. Recursive npm explain cycles are terminated and labelled.',
};
console.log(JSON.stringify(report, null, 2));
