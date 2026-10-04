import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const HELPER = join(ROOT, "tests/helpers/test-comment-census.mjs");
const BASELINE = "tests/fixtures/test-comment-census.baseline.json";
const DOM_EXCEPTIONS = [
  "b17-the-parts-the-sweep-found", "b19-the-memory-provider-can-be-chosen", "c4-the-test-harnesses",
  "field-kit", "field-label-association", "model-bulk-default-feedback", "set-field",
  "settings-save-draft-ownership", "the-models-page-keeps-its-body", "the-restore-page-keeps-its-body",
  "the-skills-page-keeps-its-body", "u14-a-failed-run-is-an-error", "u14-retry-resends-the-prompt",
  "u14-the-rail-between-768-and-1024", "u14-the-trap-skips-what-is-not-drawn", "u15-the-dead-are-gone",
  "u17-banners-wrap-their-action", "u17-split-pane", "u17-the-phone-keeps-its-title", "u18-one-push-all",
  "u18-prose-is-inter", "u18-the-header-says-what-the-panel-says", "u18-the-transcript-says-it-once",
  "u19-an-empty-page-offers-its-action", "u19-the-board-comes-first", "u19-the-phone-jumps-to-a-section",
  "u19-the-strip-fits-a-phone", "u19-the-terminal-owns-its-toolbar", "u20-polish", "u3-page-geometry",
  "u8-buttons-and-the-loading-contract", "u8-the-card-primitive", "u8-the-interaction-primitives",
];
const SCRATCH = join(ROOT, "tmp");
mkdirSync(SCRATCH, { recursive: true });
const OWNED = mkdtempSync(join(SCRATCH, "t0195-policy-"));
for (const name of ["home", "temp", "data", "hermes"]) mkdirSync(join(OWNED, name));
const ENV: NodeJS.ProcessEnv = {
  SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PATH: process.env.PATH,
  HOME: join(OWNED, "home"), USERPROFILE: join(OWNED, "home"),
  APPDATA: join(OWNED, "home"), LOCALAPPDATA: join(OWNED, "home"),
  TEMP: join(OWNED, "temp"), TMP: join(OWNED, "temp"),
  HERMES_HOME: join(OWNED, "hermes"), PS_DATA_DIR: join(OWNED, "data"),
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(OWNED, "no-git-config"),
  NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "test", FORCE_COLOR: "0",
};
const CONFIG_ROOT = join(OWNED, "config-checkout");
mkdirSync(CONFIG_ROOT);
for (const path of ["jest.config.js", "package.json", "tsconfig.json", "scripts/tooling/coverage-floors.cjs", "tests/jest.setup.ts", "tests/__mocks__/better-sqlite3.cjs", "src/lib/db/index.ts", "src/lib/config/config-sections.ts", "src/lib/config/env.ts", ...readdirSync(ROOT).filter(name => /^next\.config\./.test(name))]) {
  mkdirSync(join(CONFIG_ROOT, path, ".."), { recursive: true });
  copyFileSync(join(ROOT, path), join(CONFIG_ROOT, path));
}
mkdirSync(join(CONFIG_ROOT, "src/app"), { recursive: true });
symlinkSync(join(ROOT, "node_modules"), join(CONFIG_ROOT, "node_modules"), process.platform === "win32" ? "junction" : "dir");
type Row = { path: string; physicalLines: number; commentLines: number; essay: boolean };
type Report = { files: Row[]; violations: { path: string; reason: string }[]; baselineSource: string };

function execute(command: string, args: string[], cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, env: ENV, encoding: "utf8", timeout: 30_000, windowsHide: true });
  if (result.error || result.signal) throw new Error(`Owned process failed: ${result.error?.message ?? result.signal}`);
  return result;
}
function git(root: string, ...args: string[]): void {
  const result = execute("git", ["-c", "core.autocrlf=false", "-c", "user.name=Oracle fixture", "-c", "user.email=oracle@example.invalid", ...args], root);
  if (result.status !== 0) throw new Error(`Owned git fixture failed: ${result.stderr}`);
}
function put(root: string, path: string, source: string): void {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), source);
}
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(OWNED, "tree-"));
  git(root, "init", "--quiet");
  for (const [path, source] of Object.entries(files)) put(root, path, source);
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "Owned fixture sources");
  return root;
}
function census(root: string, ...args: string[]) {
  if (!existsSync(HELPER)) return { status: null, report: null, stdout: "", stderr: "Comment census CLI unavailable" };
  const result = execute(process.execPath, [HELPER, "--root", root, "--baseline", BASELINE, "--json", ...args]);
  let report: Report | null = null;
  try { report = JSON.parse(result.stdout) as Report; } catch { /* Refusal may have no JSON report. */ }
  return { ...result, report };
}
function checked(root: string): Report {
  const result = census(root);
  expect({ status: result.status, report: result.report !== null }).toEqual({ status: 0, report: true });
  return result.report as Report;
}
function capture(root: string): void {
  expect(census(root, "--capture", "--reason", "Independent known-existing fixture essays").status).toBe(0);
  git(root, "add", BASELINE);
  git(root, "commit", "--quiet", "-m", "Owned committed essay baseline");
}
function essay(lines = 60, comments = 24): string {
  return Array.from({ length: lines }, (_, i) => i < comments ? `// rationale ${i}` : `const value${i} = ${i};`).join("\n") + "\n";
}
function measure(source: string, filePath: string) {
  expect(existsSync(HELPER)).toBe(true);
  const result = execute(process.execPath, ["--input-type=module", "-e", "import {pathToFileURL} from 'node:url'; const {measureComments}=await import(pathToFileURL(process.argv[1]).href); console.log(JSON.stringify(measureComments(process.argv[2],process.argv[3])));", HELPER, source, filePath]);
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as Omit<Row, "path">;
}

const PROBE = String.raw`
test('setup works in the declared environment', async () => {
  const browser = EXPECT_BROWSER;
  expect(typeof window).toBe(browser ? 'object' : 'undefined');
  expect(typeof document).toBe(browser ? 'object' : 'undefined');
  expect(new TextDecoder().decode(new TextEncoder().encode('proof'))).toBe('proof');
  const response = Response.json({value: 7}, {status: 201});
  expect(response.status).toBe(201);
  expect(response.ok).toBe(true);
  expect(await response.json()).toEqual({value: 7});
  expect(response.headers.get('content-type')).toContain('application/json');
  const request = new Request('http://localhost/proof', {method: 'POST'});
  expect(request.url).toBe('http://localhost/proof');
  expect(request.method).toBe('POST');
  if (browser) {
    const button = document.createElement('button');
    document.body.append(button);
    expect(button).toBeInTheDocument();
  }
});
test('restoration retains module factories and ordinary mock implementations', () => {
  const target = {value: 'original', method: () => 'original'};
  const ordinary = jest.fn(() => 'ordinary');
  const factory = require('@/lib/db');
  const singleton = factory.getDb();
  const sqlite = require('better-sqlite3');
  const constructor = sqlite.default;
  const spy = jest.spyOn(target, 'method').mockReturnValue('spy');
  jest.replaceProperty(target, 'value', 'replaced');
  ordinary(); constructor();
  expect([target.method(), target.value]).toEqual(['spy', 'replaced']);
  jest.restoreAllMocks();
  expect([target.method(), target.value]).toEqual(['original', 'original']);
  expect(jest.isMockFunction(target.method)).toBe(false);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(ordinary()).toBe('ordinary');
  expect(ordinary).toHaveBeenCalledTimes(2);
  expect(require('@/lib/db')).toBe(factory);
  expect(factory.getDb()).toBe(singleton);
  expect(jest.isMockFunction(factory.getDb)).toBe(true);
  expect(require('better-sqlite3').default).toBe(constructor);
  expect(jest.isMockFunction(constructor)).toBe(true);
  expect(constructor().prepare('select 1').all()).toEqual([]);
});
test('requireActual package root remains the mapped SQLite stub', () => {
  const mapped = jest.requireActual('better-sqlite3');
  expect(require.resolve('better-sqlite3').replace(/\\/g, '/')).toMatch(/tests\/__mocks__\/better-sqlite3\.cjs$/);
  expect(mapped.prepare('select 19 as value').get()).toBeUndefined();
  expect(mapped.prepare('select 19 as value').all()).toEqual([]);
});
test('absolute requireActual bypass owns a real native in-memory database', () => {
  const Database = jest.requireActual(require('node:path').join(process.cwd(), 'node_modules/better-sqlite3/lib/index.js'));
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE proof (value INTEGER UNIQUE); INSERT INTO proof VALUES (19)');
    expect(db.prepare('SELECT value FROM proof').get()).toEqual({value: 19});
    expect(() => db.prepare('INSERT INTO proof VALUES (19)').run()).toThrow();
  } finally { db.close(); }
  expect(db.open).toBe(false);
});
`;
const probes = new Map<string, ReturnType<typeof execute>>();
function probe(environment: "node" | "jsdom") {
  if (!probes.has(environment)) {
    const dir = join(OWNED, environment);
    mkdirSync(dir);
    const suite = join(dir, "setup.test.ts");
    writeFileSync(suite, `/** @jest-environment ${environment} */\n` + PROBE.replace("EXPECT_BROWSER", String(environment === "jsdom")));
    const config = join(dir, "jest.config.cjs");
    writeFileSync(config, `module.exports=async()=>({...await require(${JSON.stringify(join(CONFIG_ROOT, "jest.config.js"))})(),rootDir:${JSON.stringify(CONFIG_ROOT)},roots:[${JSON.stringify(dir)}],testMatch:[${JSON.stringify(suite.replace(/\\/g, "/"))}],modulePathIgnorePatterns:[],cacheDirectory:${JSON.stringify(join(dir, "cache"))}});`);
    const result = execute(process.execPath, [join(ROOT, "node_modules/jest/bin/jest.js"), "--config", config, "--runInBand", "--json", "--outputFile", join(dir, "results.json")], CONFIG_ROOT);
    writeFileSync(join(dir, "stdout.log"), result.stdout);
    writeFileSync(join(dir, "stderr.log"), result.stderr);
    probes.set(environment, result);
  }
  return probes.get(environment)!;
}

describe("T-0195 independent test harness policy", () => {
  it("resolves one Next-wrapped default Node config without changing the harness settings", () => {
    const result = execute(process.execPath, ["-e", "(async()=>console.log(JSON.stringify(await require('./jest.config.js')())))().catch(e=>{console.error(e);process.exitCode=1})"], CONFIG_ROOT);
    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.testEnvironment).toBe("jest-environment-node");
    expect(typeof window).toBe("undefined");
    const docblock = require("jest-docblock") as { extract: (source: string) => string; parse: (block: string) => Record<string, string> };
    for (const name of DOM_EXCEPTIONS) {
      const extension = ["c4-the-test-harnesses", "set-field"].includes(name) ? "ts" : "tsx";
      expect(docblock.parse(docblock.extract(readFileSync(join(ROOT, `tests/unit/${name}.test.${extension}`), "utf8")))["jest-environment"]).toBe("jsdom");
    }
    expect(config.projects).toBeUndefined();
    expect(readdirSync(ROOT).filter(name => /^jest\.config\./.test(name))).toEqual(["jest.config.js"]);
    expect(config.maxWorkers).toBe(2);
    expect(config.setupFilesAfterEnv).toEqual(["<rootDir>/tests/jest.setup.ts"]);
    expect(config.moduleNameMapper).toMatchObject({ "^@/(.*)$": "<rootDir>/src/$1", "^better-sqlite3$": "<rootDir>/tests/__mocks__/better-sqlite3.cjs" });
    expect(config.collectCoverageFrom).toEqual(["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/**/layout.tsx"]);
    expect(config.coverageThreshold).toEqual({ global: {statements: 38, branches: 27, lines: 40, functions: 27}, "src/lib/": {statements: 69, branches: 59, lines: 70, functions: 72}, "src/app/api/": {statements: 42, branches: 36, lines: 45, functions: 44} });
    expect(config.testMatch).toEqual(["**/tests/unit/**/*.test.ts", "**/tests/unit/**/*.test.tsx"]);
    expect(config.modulePathIgnorePatterns).toEqual(["<rootDir>/tmp/"]);
    expect(config.testPathIgnorePatterns).toEqual(["/node_modules/", "/.next/"]);
    expect(Object.keys(config.transform)).toEqual(["^.+\\.(js|jsx|ts|tsx|mjs)$"]);
    expect(Object.values(config.transform).some(value => JSON.stringify(value).replace(/\\\\/g, "/").includes("next/dist/build/swc/jest-transformer"))).toBe(true);
  });

  it("boots the unchanged setup with real Node globals and owned native SQLite", () => {
    expect(probe("node").status).toBe(0);
  });

  it("honours an explicit jsdom exception with compatible setup and owned native SQLite", () => {
    expect(probe("jsdom").status).toBe(0);
  });

  it("restores spies and replaced properties while retaining ordinary mocks and the setup module factory", () => {
    const target = { value: 1, read: () => 1 };
    const ordinary = jest.fn(() => 9);
    const factory = require("@/lib/db");
    const singleton = factory.getDb();
    jest.spyOn(target, "read").mockReturnValue(2);
    jest.replaceProperty(target, "value", 2);
    expect([target.read(), target.value, ordinary()]).toEqual([2, 2, 9]);
    jest.restoreAllMocks();
    expect([target.read(), target.value, ordinary()]).toEqual([1, 1, 9]);
    expect(ordinary).toHaveBeenCalledTimes(2);
    expect(require("@/lib/db")).toBe(factory);
    expect(factory.getDb()).toBe(singleton);
    expect(jest.isMockFunction(factory.getDb)).toBe(true);
  });

  it("states the restoration boundary accurately only with both environment proofs passing", () => {
    expect([probe("node").status, probe("jsdom").status]).toEqual([0, 0]);
    const comments = (readFileSync(join(ROOT, "tests/jest.setup.ts"), "utf8").match(/\/\/[^\r\n]*/g) ?? []).join("\n");
    expect(comments).not.toMatch(/(?:remove this global mock|avoid calling restoreAllMocks)/i);
    expect(comments).toMatch(/sp(?:y|ies)/i);
    expect(comments).toMatch(/replaced propert/i);
    expect(comments).toMatch(/(?:module factor|jest\.mock)/i);
    expect(comments).toMatch(/jest\.fn/);
  });

  it("provides the separate comment census CLI", () => {
    expect(existsSync(HELPER)).toBe(true);
    expect(execute("git", ["cat-file", "-e", `HEAD:${BASELINE}`]).status).toBe(0);
    expect(checked(ROOT)).toMatchObject({ baselineSource: "HEAD", violations: [] });
  });

  it("uses both inclusive default essay thresholds without a trailing-newline phantom line", () => {
    const files = Object.fromEntries([[59, 24], [60, 23], [60, 24], [61, 24], [61, 25]].map(([lines, comments]) => [`tests/unit/p${lines}-${comments}.test.ts`, essay(lines, comments)]));
    const root = tree(files);
    capture(root);
    const rows = checked(root).files.map(row => [row.physicalLines, row.commentLines, row.essay]);
    expect(rows.sort()).toEqual([[59, 24, false], [60, 23, false], [60, 24, true], [61, 24, false], [61, 25, true]].sort());
    expect(checked(root).violations).toEqual([]);
    expect(measure(essay(), "fixture.ts")).toMatchObject({ physicalLines: 60, commentLines: 24, essay: true });
  });

  it("counts lexical physical comment lines and ignores strings templates regex and JSX with CRLF parity", () => {
    const lexical = [
      String.raw`const a = '// fake';`, String.raw`const b = "/* fake */";`,
      "const c = `", "// fake", "/* fake */", "`;",
      String.raw`const d = /https?:\/\/host\/\*fake\*\//;`,
      "const e = 10 / 2; // real", "const f = `${1 /* real */}`;",
      String.raw`const g = 'quote\'//fake';`, "const h = <div>/* fake */ // fake</div>;",
      "/* start", "", " * middle", "end */", "const i = 1; /* real */ /* also real */",
      "const j = `// ${`/* fake */`}`;", "const k = `${", "// real", "2", "}`;",
      "/* start", "end */ const l = `text`;",
    ];
    while (lexical.length < 60) lexical.push(`const filler${lexical.length} = 0;`);
    const lf = lexical.join("\n") + "\n";
    const files = { "tests/unit/lf.test.tsx": lf, "tests/unit/crlf.test.tsx": lf.replace(/\n/g, "\r\n") };
    const root = tree(files);
    capture(root);
    expect(checked(root).files.map(row => [row.physicalLines, row.commentLines, row.essay])).toEqual([[60, 10, false], [60, 10, false]]);
    expect(measure(lf, "fixture.tsx")).toEqual(measure(files["tests/unit/crlf.test.tsx"], "fixture.tsx"));
    expect(measure(lf, "fixture.tsx")).toMatchObject({ physicalLines: 60, commentLines: 10, essay: false });
    for (const [path, source] of Object.entries(files)) expect(readFileSync(join(root, path), "utf8")).toBe(source);
  });

  it("scopes the census to tracked and nonignored untracked tests TS and TSX including helpers", () => {
    const root = tree({ ".gitignore": "tmp/\ntests/unit/ignored.test.ts\n", "tests/unit/owned.test.ts": essay(), "tests/unit/browser.test.tsx": essay(), "tests/helpers/owned.ts": essay(), "src/outside.ts": essay(), "tests/unit/notes.md": essay() });
    put(root, "tests/unit/untracked.test.ts", essay());
    put(root, "tests/unit/ignored.test.ts", essay());
    put(root, "tmp/worktree/tests/unit/ignored.test.ts", essay());
    capture(root);
    expect(checked(root).files.map(row => row.path).sort()).toEqual(["tests/helpers/owned.ts", "tests/unit/browser.test.tsx", "tests/unit/owned.test.ts", "tests/unit/untracked.test.ts"]);
  });

  it("captures known existing essays once with a written reason and preserves source bytes", () => {
    const source = essay().replace(/\n/g, "\r\n");
    const root = tree({ "tests/unit/existing.test.ts": source });
    const missingReason = census(root, "--capture");
    expect(typeof missingReason.status).toBe("number");
    expect(missingReason.status).not.toBe(0);
    expect(existsSync(join(root, BASELINE))).toBe(false);
    capture(root);
    const bytes = readFileSync(join(root, BASELINE), "utf8");
    expect(JSON.parse(bytes)).toMatchObject({ version: 1, reason: "Independent known-existing fixture essays", essays: [{ path: "tests/unit/existing.test.ts", physicalLines: 60, commentLines: 24 }] });
    const repeat = census(root, "--capture", "--reason", "Replace history");
    expect(typeof repeat.status).toBe("number");
    expect(repeat.status).not.toBe(0);
    expect(readFileSync(join(root, BASELINE), "utf8")).toBe(bytes);
    expect(readFileSync(join(root, "tests/unit/existing.test.ts"), "utf8")).toBe(source);
  });

  it("accepts honest known essays against HEAD despite a dishonest staged baseline replacement", () => {
    const root = tree({ "tests/unit/existing.test.ts": essay() });
    capture(root);
    put(root, BASELINE, JSON.stringify({ version: 1, reason: "Dishonestly hide existing essays", essays: [] }));
    git(root, "add", BASELINE);
    expect(checked(root)).toMatchObject({ baselineSource: "HEAD", violations: [], files: [{ path: "tests/unit/existing.test.ts", physicalLines: 60, commentLines: 24, essay: true }] });
  });

  it("refuses an untracked planted essay and existing essay growth despite a forged staged allowance", () => {
    const root = tree({ "tests/unit/existing.test.ts": essay() });
    capture(root);
    const grown = essay() + "// planted growth\n";
    put(root, "tests/unit/existing.test.ts", grown);
    put(root, "tests/unit/planted.test.ts", essay());
    put(root, BASELINE, JSON.stringify({ version: 1, reason: "Forged allowance", essays: [{ path: "tests/unit/existing.test.ts", physicalLines: 61, commentLines: 25 }, { path: "tests/unit/planted.test.ts", physicalLines: 60, commentLines: 24 }] }));
    git(root, "add", BASELINE, "tests/unit/existing.test.ts");
    const result = census(root);
    expect(typeof result.status).toBe("number");
    expect(result.status).not.toBe(0);
    expect(result.report?.baselineSource).toBe("HEAD");
    expect(result.report?.violations.map(row => [row.path, row.reason]).sort()).toEqual([["tests/unit/existing.test.ts", "growth"], ["tests/unit/planted.test.ts", "new"]]);
    expect(readFileSync(join(root, "tests/unit/existing.test.ts"), "utf8")).toBe(grown);
    expect(readFileSync(join(root, "tests/unit/planted.test.ts"), "utf8")).toBe(essay());
  });
});
