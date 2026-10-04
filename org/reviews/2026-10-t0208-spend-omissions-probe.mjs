import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import ts from 'typescript';
import FakeTimers from '@sinonjs/fake-timers';
import Database from 'better-sqlite3';
const root = process.cwd(), clock = FakeTimers.createClock(0), db = new Database(':memory:');
const logs = [], events = [], captures = [], sourceHashes = new Map();
const hash = s => crypto.createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const absolute = rel => path.resolve(root, rel);
const allowed = new Set([
  'src/lib/models/llm.ts', 'src/lib/models/usage-shape.ts', 'src/lib/models/llm-endpoint.ts',
  'src/lib/runs/runs-repository.ts', 'src/lib/runs/parse-stored-usage.ts',
  'src/lib/db/build-update.ts', 'src/lib/db/parse-json.ts', 'src/lib/db/safe-read.ts',
  'src/lib/laboratory/deep-research/engine.ts', 'src/lib/laboratory/deep-research/usage.ts',
  'src/lib/laboratory/deep-research/research-repository.ts', 'src/lib/laboratory/deep-research/run-job.ts',
  'src/lib/spend/spend-repository.ts', 'src/lib/spend/spend-law.ts',
  'src/lib/spend/spend-window.ts', 'src/lib/spend/spend-summary.ts',
  'src/lib/analytics/model-cost.ts'
].map(absolute));
const overrides = new Map(), cache = new Map();
const override = (rel, value) => overrides.set(absolute(rel), value);
const dbAdapter = { getDb: () => db, uuid: () => crypto.randomUUID(),
  now: () => '2026-10-04T12:00:00.000Z', inTransaction: fn => db.transaction(fn)() };
override('src/lib/db.ts', dbAdapter); override('src/lib/db/index.ts', dbAdapter);
override('src/lib/models/models-repository.ts', { getModelWithKey: () => null });
override('src/lib/runtime/gateway.ts', { getAgentGateway: () => ({
  baseUrl: 'http://owned-fixture.invalid', chatCompletionsUrl: 'http://owned-fixture.invalid/v1/chat/completions' }) });
override('src/lib/runtime/secrets.ts', { getGatewayKey: () => null });
override('src/lib/api/api-logger.ts', { logApiError: (...args) => logs.push(args) });
override('src/lib/api/api-fetch.ts', { messageFromError: (err, fallback) => err.message || fallback });
override('src/lib/analytics/record-event.ts', { recordEvent: (...args) => events.push(args) });
override('src/lib/runs/artifacts-repository.ts', { captureArtifactOnce: value => captures.push(value) });
override('src/lib/search.ts', { visitPage: async () => { throw new Error('Unexpected visit'); } });
override('src/lib/laboratory/deep-research/search.ts', {
  resolveSearchProvider: () => ({ name: 'synthetic', search: async () => [] }) });
let responseQueue = [], calls = [];
async function fixtureFetch(url, init) {
  assert.ok(init?.signal); assert.equal(init.signal.aborted, false);
  if (url === 'http://owned-fixture.invalid/health') return { ok: true, status: 200 };
  assert.equal(url, 'http://owned-fixture.invalid/v1/chat/completions', 'No other URL admitted');
  const next = responseQueue.shift(); assert.ok(next, 'Synthetic response must be queued'); calls.push(next);
  return { ok: true, status: 200, json: async () => ({
    model: 'synthetic-model', choices: [{ message: { content: next.content } }], usage: next.usage }) };
}
const context = vm.createContext({ console, AbortController, AbortSignal, Date, URL, Error, Promise,
  setTimeout: (...args) => clock.setTimeout(...args), clearTimeout: id => clock.clearTimeout(id), fetch: fixtureFetch });
function load(file) {
  if (overrides.has(file)) return overrides.get(file);
  assert.ok(allowed.has(file), 'Unapproved module: ' + path.relative(root, file));
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(file, 'utf8'); sourceHashes.set(file, hash(source));
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const ownedModule = { exports: {} }; cache.set(file, ownedModule);
  const restrictedRequire = specifier => {
    assert.ok(specifier.startsWith('@/') || specifier.startsWith('.'), 'Bare import refused: ' + specifier);
    const target = specifier.startsWith('@/') ? absolute('src/' + specifier.slice(2))
      : path.resolve(path.dirname(file), specifier);
    return load(target.endsWith('.ts') ? target : target + '.ts');
  };
  new vm.Script('(function(require,module,exports){\n' + compiled + '\n})', { filename: file })
    .runInContext(context)(restrictedRequire, ownedModule, ownedModule.exports);
  return ownedModule.exports;
}
const wire = (content, prompt = 2, completion = 3) => ({
  content, usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion } });
const observed = () => calls.reduce((a, r) => ({
  input: a.input + r.usage.prompt_tokens, output: a.output + r.usage.completion_tokens,
  total: a.total + r.usage.total_tokens }), { input: 0, output: 0, total: 0 });
function rawSpend() {
  const rows = db.prepare('SELECT usage_json FROM runs ORDER BY rowid').all();
  return { rows: rows.length, ...rows.reduce((a, r) => {
    const u = JSON.parse(r.usage_json);
    return { input: a.input + u.inputTokens, output: a.output + u.outputTokens, total: a.total + u.totalTokens };
  }, { input: 0, output: 0, total: 0 }) };
}
function reset(responses) { responseQueue = responses; calls = []; logs.length = 0; events.length = 0; captures.length = 0; }
function clean() { assert.equal(logs.length, 0, 'No swallowed repository failure'); assert.equal(clock.countTimers(), 0); assert.equal(responseQueue.length, 0); }
(async () => {
  try {
    db.pragma('foreign_keys = ON');
    db.exec('CREATE TABLE runs (id TEXT PRIMARY KEY, story_id TEXT, spend_source TEXT, status TEXT, usage_json TEXT, submitted_at TEXT, completed_at TEXT, updated_at TEXT, mission_id TEXT, composer_node_run_id TEXT); CREATE TABLE missions (id TEXT PRIMARY KEY, model_id TEXT);');
    for (const name of ['019_deep_research.sql','034_research_usage.sql','036_research_gather_health.sql','033_spend_policy.sql']) {
      const migration = absolute('src/lib/db/migrations/' + name), source = fs.readFileSync(migration, 'utf8');
      sourceHashes.set(migration, hash(source)); db.exec(source);
    }
    db.exec('ALTER TABLE research_runs ADD COLUMN config_json TEXT; ALTER TABLE research_runs ADD COLUMN composer_node_run_id TEXT;');
    const llm = load(absolute('src/lib/models/llm.ts')), window = load(absolute('src/lib/spend/spend-window.ts'));
    const summary = load(absolute('src/lib/spend/spend-summary.ts'));
    reset([wire('Positive allowed control')]);
    await llm.callLLM([{ role: 'user', content: 'synthetic' }], { spend: { source: 'story', storyId: 'owned' } });
    assert.deepEqual(rawSpend(), { rows: 1, input: 2, output: 3, total: 5 }); clean();
    console.log(JSON.stringify({ case: 'gateway-positive', reported: observed(), persisted: rawSpend(), pendingTimers: clock.countTimers() }));
    db.exec('DELETE FROM runs');
    reset([wire(' '), wire('Recovered output')]);
    const retrieval = llm.callLLM([{ role: 'user', content: 'synthetic' }], { spend: { source: 'story', storyId: 'owned' } });
    await clock.tickAsync(0); assert.equal(calls.length, 1); assert.equal(rawSpend().rows, 0);
    await clock.tickAsync(5000); const reply = await retrieval; assert.equal(reply.content, 'Recovered output');
    assert.deepEqual(observed(), { input: 4, output: 6, total: 10 });
    assert.deepEqual(rawSpend(), { rows: 1, input: 2, output: 3, total: 5 }); clean();
    const priced = window.recordedSpendSince('2000-01-01 00:00:00');
    assert.equal(priced.sources.find(s => s.source === 'story').inputTokens, 2);
    console.log(JSON.stringify({ case: 'gateway-empty-retry-omission', providerAttempts: calls.length,
      reported: observed(), persisted: rawSpend(), fallbackEstimateUsd: priced.totalUsd,
      pendingTimers: clock.countTimers(), conclusion: 'CONFIRMED reported usage discarded before retry' }));
    db.exec('DELETE FROM runs');
    const repository = load(absolute('src/lib/laboratory/deep-research/research-repository.ts'));
    const realEngine = load(absolute('src/lib/laboratory/deep-research/engine.ts'));
    let activeRun, returnedResult, cancelAfterResult = false;
    override('src/lib/laboratory/deep-research/engine.ts', { ...realEngine, runDeepResearch: async (...args) => {
      returnedResult = await realEngine.runDeepResearch(...args);
      if (cancelAfterResult) assert.equal(repository.cancelResearchRun(activeRun).status, 'cancelled');
      return returnedResult;
    } });
    const job = load(absolute('src/lib/laboratory/deep-research/run-job.ts'));
    for (const cancel of [false, true]) {
      db.exec('DELETE FROM research_steps; DELETE FROM research_runs');
      reset([wire('QUERY: owned', 10, 20), wire('DONE', 10, 20), wire('Synthetic report', 10, 20)]);
      activeRun = repository.createResearchRun({ query: 'owned synthetic question' }).id; cancelAfterResult = cancel;
      await job.runResearchJob(activeRun, 'owned synthetic question', { rounds: 1, visitsPerRound: 0 });
      const row = repository.getResearchRun(activeRun);
      assert.equal(calls.length, 3); assert.deepEqual(observed(), { input: 30, output: 60, total: 90 });
      assert.equal(returnedResult.usage.promptTokens, 30); assert.equal(returnedResult.usage.completionTokens, 60);
      assert.equal(returnedResult.usage.totalTokens, 90); assert.equal(row.status, cancel ? 'cancelled' : 'completed');
      if (cancel) {
        assert.equal(row.usage, null); assert.equal(row.report, null); assert.equal(events.length, 0); assert.equal(captures.length, 0);
      } else {
        assert.equal(row.usage.promptTokens, 30); assert.equal(row.usage.completionTokens, 60);
        assert.equal(row.usage.totalTokens, 90); assert.equal(captures.length, 1);
      }
      clean();
      const researchWindow = window.recordedSpendSince('2000-01-01 00:00:00');
      const researchSummary = summary.getSpendSummary('2026-10-04T12:00:00.000Z');
      assert.equal(researchWindow.unrecordedResearchRuns, cancel ? 1 : 0);
      console.log(JSON.stringify({ case: cancel ? 'research-cancel-after-result-omission' : 'research-positive',
        reported: observed(), engineUsage: returnedResult.usage, status: row.status, persistedUsage: row.usage,
        rawTokenColumns: db.prepare('SELECT prompt_tokens,completion_tokens,total_tokens FROM research_runs WHERE id=?').get(activeRun),
        fallbackEstimateUsd: researchWindow.totalUsd, unrecordedResearchRuns: researchWindow.unrecordedResearchRuns,
        unmeasured: researchSummary.unmeasured, events: events.length, captures: captures.length,
        pendingTimers: clock.countTimers(), conclusion: cancel ? 'CONFIRMED available engine usage discarded after cancellation' : 'CONTROL persisted usage' }));
    }
    for (const [file, before] of sourceHashes) assert.equal(hash(fs.readFileSync(file,'utf8')), before, 'Source changed during probe');
    console.log(JSON.stringify({ execution: '4 cases, all causal/control assertions passed', sourceUnchangedDuringExecution: true,
      sourceBindings: [...sourceHashes].filter(([p]) => /models[\\/]llm.ts|deep-research[\\/](run-job|engine|research-repository).ts/.test(p))
        .map(([p,lfSha256]) => ({path:path.relative(root,p),lfSha256})),
      writes: 'SQLite :memory: only; zero filesystem writes', network: 'synthetic fetch only; no network module admitted',
      providerCharges: 'not measured' }));
  } finally { db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
