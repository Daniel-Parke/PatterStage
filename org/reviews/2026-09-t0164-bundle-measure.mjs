// Run from the repository root: node org/reviews/2026-09-t0164-bundle-measure.mjs <isolated-build-root>
// Manifest chunk sums are an upper bound, not a browser transfer measurement.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const buildRoot = resolve(process.argv[2] ?? '.');
const appRoot = join(buildRoot, '.next', 'server', 'app');
const staticRoot = join(buildRoot, '.next');

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

const results = walk(appRoot)
  .filter((path) => path.endsWith('page_client-reference-manifest.js'))
  .map((path) => {
    const source = readFileSync(path, 'utf8');
    const marker = source.indexOf('__RSC_MANIFEST[');
    const assignment = source.indexOf(' = {', marker);
    if (marker < 0 || assignment < 0) throw new Error(`Unexpected manifest: ${path}`);
    const manifest = JSON.parse(source.slice(assignment + 3).trim().replace(/;$/, ''));
    const chunks = new Set([
      ...Object.values(manifest.entryJSFiles).flat(),
      ...Object.values(manifest.clientModules).flatMap((module) => module.chunks),
    ].map((chunk) => chunk.replace(/^\/_next\//, '')));
    let bytes = 0;
    let gzipBytes = 0;
    for (const chunk of chunks) {
      const full = join(staticRoot, chunk);
      const data = readFileSync(full);
      bytes += statSync(full).size;
      gzipBytes += gzipSync(data).length;
    }
    return {
      route: '/' + relative(appRoot, path).replaceAll('\\', '/').replace(/(^|\/)page_client-reference-manifest\.js$/, ''),
      chunks: chunks.size,
      bytes,
      gzipBytes,
    };
  }).sort((a, b) => b.gzipBytes - a.gzipBytes || a.route.localeCompare(b.route));

console.log(JSON.stringify({
  revision: execFileSync('git', ['-c', `safe.directory=${buildRoot}`, '-C', buildRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId: readFileSync(join(buildRoot, '.next', 'BUILD_ID'), 'utf8').trim(),
  method: 'Unique entryJSFiles and clientModules chunks per page; raw and per-chunk gzip bytes. Upper bound, not measured network transfer.',
  routes: results,
}, null, 2));
