// Immutable-scope census: count files from a Git commit, not the working tree.
// Run: node org/reviews/2026-09-t0164-scope-census.mjs [revision]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const revision = process.argv[2] ?? 'HEAD';
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const commit = git('rev-parse', revision).toString().trim();
const paths = git('ls-tree', '-r', '-z', '--name-only', commit).toString('utf8').split('\0').filter(Boolean).sort();

const rootTooling = new Set([
  'package.json', 'package-lock.json', 'next.config.ts', 'playwright.config.ts',
  'jest.config.js', 'eslint.config.mjs', 'knip.json', '.npmrc', '.dockerignore',
  '.gitleaks.toml', 'Dockerfile', 'docker-compose.yml', 'install.sh', 'install.ps1',
  'tsconfig.json', 'tsconfig.tests.json',
]);
const rootDocs = new Set(['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'NOTICE', 'LICENSE', 'TRADEMARK.md', 'SECURITY.md', 'SUPPORT.md']);
const derived = new Set(['org/TASKS.md', 'org/STATE.md', 'docs/manifest.json']);

function scope(path) {
  if (derived.has(path)) return 'generated';
  if (path.startsWith('org/decisions/') || path.startsWith('org/roles/') ||
      path === 'org/CONSTITUTION.md' || path === 'org/policy.json') return 'protected';
  if (path.startsWith('org/tasks/') || path.startsWith('org/plans/') || path.startsWith('org/reviews/')) return 'history';
  if (path.startsWith('org/')) return path === 'org/claims.json' ? 'operational' : 'organisationLive';
  if (path.startsWith('docs/adr/')) return 'history';
  if (path.startsWith('docs/images/')) return 'publishedBinary';
  if (path.startsWith('docs/') || rootDocs.has(path)) return 'documentationLive';
  if (/^scripts\/tooling\/.*(?:baseline|growth|ledger).*\.json$/.test(path)) return 'toolingLedger';
  if (path.startsWith('scripts/') || path.startsWith('test-harness/') ||
      path.startsWith('mock-hermes/') || path.startsWith('mock-hindsight/') ||
      path.startsWith('mock-llm/') || path.startsWith('.github/') || rootTooling.has(path)) return 'toolingLive';
  return null;
}

const buckets = new Map();
for (const path of paths) {
  const category = scope(path);
  if (!category) continue;
  const bytes = git('show', `${commit}:${path}`);
  const text = bytes.includes(0) ? null : bytes.toString('utf8').replaceAll('\r\n', '\n');
  const lines = text === null || text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (!buckets.has(category)) buckets.set(category, { files: 0, lines: 0, bytes: 0, paths: [] });
  const bucket = buckets.get(category);
  bucket.files += 1;
  bucket.lines += lines;
  bucket.bytes += bytes.length;
  bucket.paths.push(path);
}
const scopes = Object.fromEntries([...buckets].sort(([a], [b]) => a.localeCompare(b))
  .map(([name, { files, lines, bytes, paths }]) => [name, {
    files, lines, bytes,
    pathSetSha256: createHash('sha256').update(paths.join('\n') + '\n').digest('hex'),
  }]));
console.log(JSON.stringify({ revision: commit, scopeVersion: 1,
  rule: 'git ls-tree and git show at revision; LF-normalised line count; protected/history/generated/operational and tooling ledgers are separate from live reduction scopes',
  scopes }, null, 2));
