// Owned fixture only: no external DNS or service requests, no filesystem writes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import dns from 'node:dns';
import { createRequire } from 'node:module';
import ts from 'typescript';

const loadDependency = createRequire(import.meta.url);
const files = ['src/lib/search/url-guard.ts', 'src/lib/search/visit.ts'];
const sources = files.map(path => ({ path, bytes: fs.readFileSync(path) }));
const originalHashes = [
  '12e8deefef85e0dc94d8014985164e35889a31fc88d5dd77252ca2544a4dcb32',
  '98b5533085849a0b2778b1df31a7e764155f60e927cf81ab5dfd027a4d33066b',
];
for (const [index, source] of sources.entries()) {
  const digest = crypto.createHash('sha256').update(source.bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  if (digest !== originalHashes[index]) throw new Error('Historical diagnostic source changed; use the owned DNS-pinning oracle instead. No transport started.');
}
function load(path, resolveImport) {
  const ownedModule = { exports: {} };
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  new Function('module', 'exports', 'require', outputText)(ownedModule, ownedModule.exports, resolveImport);
  return ownedModule.exports;
}
let guardLookups = 0, transportLookups = 0, requests = 0;
const originalLookup = dns.lookup;
const guard = load(files[0], name => name === 'dns/promises'
  ? { lookup: async () => { guardLookups++; return [{ address: '8.8.8.8', family: 4 }]; } }
  : loadDependency(name));
const visit = load(files[1], name => name === './url-guard' ? guard : loadDependency(name));
const server = http.createServer((_request, response) => {
  requests++;
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('owned-loopback-marker');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
dns.lookup = (name, options, callback) => {
  if (name !== 'owned-rebinding.invalid') return originalLookup(name, options, callback);
  transportLookups++;
  if (typeof options === 'function') { callback = options; options = {}; }
  callback(null, options?.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4);
};
try {
  const page = await visit.visitPage(`http://owned-rebinding.invalid:${server.address().port}/`);
  console.log(JSON.stringify({
    probe: 'owned DNS answer changes between guard and transport',
    node: process.version,
    sourceBinding: sources.map(({path, bytes}) => ({path,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      lfSha256: crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex'),
    })),
    substitutions: { guardResolver: '8.8.8.8, no request sent there',
      transportResolver: '127.0.0.1 for reserved owned-rebinding.invalid only' },
    guardLookups, transportLookups, ownedLoopbackRequests: requests,
    returnedMarker: page?.content === 'owned-loopback-marker',
    unrelatedNetwork: false, filesWritten: false,
  }, null, 2));
} finally {
  dns.lookup = originalLookup;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
