/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(__dirname, "../..");
const tooling = join(root, "scripts/tooling");
const scratch = join(root, "tmp");
const owned: string[] = [];
const keys = ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR", "CONTROL_HUB_OTHER", "PS_EMPTY", "PS_DUP", "PS_SPACE", "PS_EQUALS", "PS_QUOTES", "PS_UNMATCHED", "PORT", "UNRELATED", "HERMES_HOME", "INSTALL_HERMES_TEST"];
type Snapshot = { values: Record<string, string | null>; warnings: string[]; port: string | null; error?: string };
function fixture() {
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(join(scratch, "t0192-env-"));
  owned.push(dir);
  for (const child of ["scripts/tooling", "data", "home", "hermes", "temp"]) mkdirSync(join(dir, child), { recursive: true });
  writeFileSync(join(dir, "package.json"), '{"type":"module"}');
  return dir;
}
afterEach(() => {
  for (const dir of owned.splice(0)) {
    if (dirname(resolve(dir)) !== scratch || !dir.startsWith(scratch + sep + "t0192-env-")) throw new Error("Unsafe fixture cleanup");
    rmSync(dir, { recursive: true, force: true });
  }
});
function environment(dir: string, overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  // Allowlist OS plumbing only: no provider credentials, NODE_OPTIONS or NODE_PATH are inherited.
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env[key] = process.env[key];
  return { ...env, PATH: dirname(process.execPath), HOME: join(dir, "home"), USERPROFILE: join(dir, "home"),
    TMP: join(dir, "temp"), TEMP: join(dir, "temp"), TMPDIR: join(dir, "temp"), ...overrides };
}
function child(dir: string, args: string[], overrides: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, args, { cwd: dir, env: environment(dir, overrides), encoding: "utf8", timeout: 15_000, windowsHide: true });
  if (result.error || result.signal) throw new Error(`INFRASTRUCTURE: child did not complete: ${result.error ?? result.signal}`);
  return result;
}
function copy(dir: string, name: string) { copyFileSync(join(tooling, name), join(dir, "scripts/tooling", name)); }
function copyTypeScript(dir: string, name: string, source = readFileSync(join(tooling, name + ".ts"), "utf8")) {
  // Preserve ESM evaluation order, re-exports and import.meta; only erase TypeScript syntax.
  const emitted = ts.transpileModule(source, { fileName: name + ".ts", compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true,
  } });
  const entry = join(dir, "scripts/tooling", name + ".mjs");
  writeFileSync(entry, emitted.outputText);
  return entry;
}
function load(kind: "TS" | "deploy", contents: string | null, inherited: Record<string, string> = {}, refuseRead = false): Snapshot[] {
  const name = kind === "TS" ? "load-env-local.ts" : "_env-local.mjs";
  if (!existsSync(join(tooling, name))) throw new Error(`MISSING INTERFACE: proposed ${name} is absent`);
  const dir = fixture();
  if (kind === "TS") copyTypeScript(dir, "load-env-local"); else copy(dir, name);
  if (contents !== null) writeFileSync(join(dir, ".env.local"), contents);
  const script = `
    import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
    if (${refuseRead}) { const read=fs.readFileSync; fs.readFileSync=(p,...a)=>{if(String(p).endsWith('.env.local')) throw Object.assign(new Error('owned refusal'),{code:'EACCES'});return read(p,...a)};syncBuiltinESMExports(); }
    const loader=await import('./scripts/tooling/${kind === "TS" ? "load-env-local.mjs" : name}'); const warnings=[];
    console.warn=(...args)=>warnings.push(args.join(' ')); const snapshots=[];
    for(let i=0;i<2;i++) {
      let error; try { loader.loadEnvLocal(process.cwd()); } catch(e) {error=e.code ?? e.message;}
      snapshots.push({values:Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,process.env[k]??null])),warnings:[...warnings],
        port: error ? null : loader.readEnvLocalValue?.(process.cwd(),'PORT')??null,error});
    }
    console.log(JSON.stringify(snapshots));
  `;
  const result = child(dir, ["--input-type=module", "-e", script], inherited);
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as Snapshot[];
}

const tsCases: Array<[string, string | null, Record<string, string>, Record<string, string | null>]> = [
  ["nonempty shell wins", "PS_DATA_DIR=file\n", { PS_DATA_DIR: "shell" }, { PS_DATA_DIR: "shell" }],
  ["empty shell yields", "PS_EMPTY=file\n", { PS_EMPTY: "" }, { PS_EMPTY: "file" }],
  ["whitespace shell remains nonempty", "PS_SPACE=file\n", { PS_SPACE: " " }, { PS_SPACE: " " }],
  ["first nonempty duplicate wins", "PS_DUP=\nPS_DUP=first\nPS_DUP=last\n", {}, { PS_DUP: "first" }],
  ["single quotes CRLF trimmed comments and literal hash", "  # comment\r\n PS_QUOTES = 'a=b#literal' \r\n", {}, { PS_QUOTES: "a=b#literal" }],
  ["double quotes and mismatched closing quote", 'PS_QUOTES="a=b"\nPS_UNMATCHED=\'value"\n', {}, { PS_QUOTES: "a=b", PS_UNMATCHED: '\'value"' }],
  ["missing closing quote and no-delimiter lines", "invalid\nPS_UNMATCHED='open\nPS_EQUALS=x=y\n", {}, { PS_UNMATCHED: "'open", PS_EQUALS: "x=y" }],
  ["no whitelist or alias synthesis", "UNRELATED=value\nCONTROL_HUB_DATA_DIR=older\n", {}, { UNRELATED: "value", CONTROL_HUB_DATA_DIR: "older", PS_DATA_DIR: null }],
  ["missing file preserves shell", null, { PS_DATA_DIR: "shell" }, { PS_DATA_DIR: "shell" }],
];
describe("T-0192 tooling environment precedence", () => {
  it.each(tsCases)("TS loader: %s", (_name, contents, inherited, expected) => {
    for (const snapshot of load("TS", contents, inherited)) {
      expect(snapshot.error).toBeUndefined(); expect(snapshot.values).toMatchObject(expected);
    }
  });
  it.each(["TS", "deploy"] as const)("%s propagates a file-read refusal", kind => {
    for (const snapshot of load(kind, "PS_DATA_DIR=refused", {}, true)) expect(snapshot.error).toBe("EACCES");
  });
  it("deploy file values replace inherited values including empty; last duplicate wins", () => {
    for (const snapshot of load("deploy", "PS_DATA_DIR=file\nPS_EMPTY=\nPS_DUP=first\nPS_DUP=last\n", { PS_DATA_DIR: "shell", PS_EMPTY: "shell" }))
      expect(snapshot.values).toMatchObject({ PS_DATA_DIR: "file", PS_EMPTY: "", PS_DUP: "last" });
  });
  it.each(["'", '"'])("deploy removes paired %s quotes but preserves mismatched quotes", quote => {
    for (const snapshot of load("deploy", `PS_QUOTES=${quote}a=b#literal${quote}\r\nPS_UNMATCHED=${quote}value${quote === "'" ? '"' : "'"}\n`))
      expect(snapshot.values).toMatchObject({ PS_QUOTES: "a=b#literal", PS_UNMATCHED: quote + "value" + (quote === "'" ? '"' : "'") });
  });
  it.each(["'", '"'])("deploy preserves a lone %s quote as a literal value", quote => {
    for (const snapshot of load("deploy", `PS_QUOTES=${quote}\n`)) {
      expect(snapshot.error).toBeUndefined();
      expect(snapshot.values.PS_QUOTES).toBe(quote);
    }
  });
  it("deploy admits only the exact CONTROL_HUB_DATA_DIR exception without manufacturing PS_DATA_DIR", () => {
    for (const snapshot of load("deploy", "CONTROL_HUB_DATA_DIR=older-private-sentinel\nCONTROL_HUB_OTHER=blocked\nUNRELATED=blocked\nINSTALL_HERMES_TEST=allowed\n")) {
      expect(snapshot.values).toMatchObject({ CONTROL_HUB_DATA_DIR: "older-private-sentinel", CONTROL_HUB_OTHER: null, UNRELATED: null, INSTALL_HERMES_TEST: "allowed", PS_DATA_DIR: null });
      expect(snapshot.warnings).toHaveLength(1);
      expect(snapshot.warnings[0]).toContain("CONTROL_HUB_DATA_DIR \u2192 PS_DATA_DIR");
      expect(snapshot.warnings[0]).not.toContain("older-private-sentinel");
    }
  });
  it("deploy preserves whitespace malformed lines literal hash equals and CRLF", () => {
    for (const snapshot of load("deploy", "# comment\r\ninvalid\n=ignored\nPS_SPACE=  value  \r\nPS_EQUALS=a=b#literal\r\n PS_DATA_DIR=ignored\r\n"))
      expect(snapshot.values).toMatchObject({ PS_SPACE: "  value  ", PS_EQUALS: "a=b#literal", PS_DATA_DIR: null });
  });
  it("deploy reads quoted PORT without exporting or replacing the inherited PORT", () => {
    for (const snapshot of load("deploy", 'PORT="3987"\n', { PORT: "3988" })) {
      expect(snapshot.values.PORT).toBe("3988"); expect(snapshot.port).toBe("3987");
    }
  });
  it("standalone deploy missing-file control preserves inherited configuration", () => {
    for (const snapshot of load("deploy", null, { PS_DATA_DIR: "shell" })) expect(snapshot.values.PS_DATA_DIR).toBe("shell");
  });
  it.each([
    ["legacy then canonical", "CH_DATA_DIR=private-legacy\nPS_DATA_DIR=private-canonical\n", "private-canonical", false],
    ["canonical then legacy", "PS_DATA_DIR=private-canonical\nCH_DATA_DIR=private-legacy\n", "private-canonical", false],
    ["empty canonical then legacy", "PS_DATA_DIR=\nCH_DATA_DIR=private-legacy\n", "private-legacy", true],
    ["legacy then empty canonical", "CH_DATA_DIR=private-legacy\nPS_DATA_DIR=\n", "private-legacy", true],
  ] as const)("deploy warning provenance on both loads: %s", (_name, contents, selected, warns) => {
    for (const snapshot of load("deploy", contents)) {
      expect(snapshot.values.PS_DATA_DIR || snapshot.values.CH_DATA_DIR).toBe(selected);
      expect(snapshot.warnings).toHaveLength(warns ? 1 : 0);
      if (warns) expect(snapshot.warnings[0]).toContain("CH_DATA_DIR \u2192 PS_DATA_DIR");
      expect(snapshot.warnings.join(" ")).not.toMatch(/private-legacy|private-canonical/);
    }
  });
});

const callers = ["ensure-hermes-model-sync", "import-hermes-state", "migrate-db", "seed-catalog", "retention-prune"];
// Node20-compatible ESM hooks run in a loader thread. The barrier observes the APP thread
// at evaluation time; createRequire needs a separate synchronous interception in that thread.
const importBoundary = String.raw`
  import {existsSync,realpathSync,writeSync} from 'node:fs';
  import {relative,isAbsolute,sep} from 'node:path'; import {fileURLToPath} from 'node:url';
  export function confined(url) {
    if(url.protocol!=='file:') throw Error('IMPORT ESCAPED FIXTURE');
    const file=fileURLToPath(url), root=realpathSync(process.cwd());
    for(const candidate of [file, ...(existsSync(file) ? [realpathSync(file)] : [])]) {
      const rel=relative(root,candidate);
      if(rel==='..' || rel.startsWith('..'+sep) || isAbsolute(rel)) throw Error('IMPORT ESCAPED FIXTURE');
    }
    return url;
  }
  export function observe(specifier) {
    writeSync(1,'ORACLE:'+JSON.stringify({specifier,marker:process.env.PS_ORACLE_MARKER,home:process.env.HERMES_HOME,data:process.env.PS_DATA_DIR})+'\n');
    process.exit(0);
  }
  export class ForbiddenDatabase {constructor(){throw Error('DATABASE EXECUTION FORBIDDEN')}}
`;
const esmProbe = String.raw`
  import {isBuiltin} from 'node:module'; import {existsSync} from 'node:fs';
  import {fileURLToPath} from 'node:url'; import {confined} from './boundary.mjs';
  export function resolve(specifier,context,next) {
    if(isBuiltin(specifier)) return next(specifier,context);
    if(specifier==='better-sqlite3') return {url:new URL('./database.mjs',import.meta.url).href,shortCircuit:true};
    let url;
    if(!specifier.startsWith('@/')) {
      if(!specifier.startsWith('.') && !specifier.startsWith('file:') && !specifier.startsWith('/')) throw Error('UNAPPROVED IMPORT '+specifier);
      url=confined(new URL(specifier,context.parentURL));
    }
    if(specifier.startsWith('@/') || specifier.includes('/src/')) {
      const barrier=new URL('./barrier.mjs',import.meta.url); barrier.searchParams.set('specifier',specifier);
      return {url:barrier.href,shortCircuit:true};
    }
    if(url.pathname.endsWith('.ts')) url=new URL(url.href.slice(0,-3)+'.mjs');
    else if(!existsSync(fileURLToPath(url)) && existsSync(fileURLToPath(url)+'.mjs')) url=new URL(url.href+'.mjs');
    confined(url);
    return next(url.href,context);
  }
`;
const importProbe = String.raw`
  import Module,{register,isBuiltin} from 'node:module'; import {pathToFileURL} from 'node:url';
  import {confined,observe,ForbiddenDatabase} from './boundary.mjs';
  const original=Module._load;
  Module._load=function(specifier,parent,...rest) {
    if(isBuiltin(specifier)) return original.call(this,specifier,parent,...rest);
    if(specifier==='better-sqlite3') return ForbiddenDatabase;
    if(!specifier.startsWith('@/')) {
      if(!specifier.startsWith('.') && !specifier.startsWith('file:') && !specifier.startsWith('/')) throw Error('UNAPPROVED IMPORT '+specifier);
      confined(new URL(specifier,pathToFileURL(parent.filename)));
    }
    if(specifier.startsWith('@/') || specifier.includes('/src/')) observe(specifier);
    const resolved=Module._resolveFilename(specifier,parent);
    confined(pathToFileURL(resolved));
    return original.call(this,specifier,parent,...rest);
  };
  register('./loader.mjs',import.meta.url);
`;
function probe(name: string, source?: string, cliHome = false) {
  const dir = fixture();
  const fileHome = join(dir, "hermes");
  const overrideHome = join(dir, "override-home");
  writeFileSync(join(fileHome, "config.yaml"), "model: owned-fixture\n");
  writeFileSync(join(dir, ".env.local"), `PS_ORACLE_MARKER=loaded-before-app\nPS_DATA_DIR=${join(dir, "data")}\nHERMES_HOME=${fileHome}\n`);
  const entry = copyTypeScript(dir, name, source);
  if (existsSync(join(tooling, "load-env-local.ts"))) copyTypeScript(dir, "load-env-local");
  writeFileSync(join(dir, "boundary.mjs"), importBoundary);
  writeFileSync(join(dir, "loader.mjs"), esmProbe);
  writeFileSync(join(dir, "barrier.mjs"), "import {observe} from './boundary.mjs'; observe(new URL(import.meta.url).searchParams.get('specifier'));");
  writeFileSync(join(dir, "database.mjs"), "export {ForbiddenDatabase as default} from './boundary.mjs';");
  writeFileSync(join(dir, "probe.mjs"), importProbe);
  expect(existsSync(join(dir, "src"))).toBe(false);
  const result = child(dir, ["--import", pathToFileURL(join(dir, "probe.mjs")).href, entry, ...(cliHome ? ["--hermes-home", overrideHome + "/"] : [])]);
  const line = result.stdout.split(/\r?\n/).find(value => value.startsWith("ORACLE:"));
  const event = line ? JSON.parse(line.slice(7)) as { marker?: string; home?: string; data?: string } : undefined;
  return { result, event, expectedHome: cliHome ? overrideHome : fileHome, expectedData: join(dir, "data") };
}
function ordered(observed: ReturnType<typeof probe>) {
  return observed.result.status === 0 && observed.event?.marker === "loaded-before-app"
    && observed.event.home === observed.expectedHome && observed.event.data === observed.expectedData;
}
describe("T-0192 tooling caller execution order", () => {
  it.each(callers)("%s actually invokes main and loads environment before its first application import", name => {
    const observed = probe(name); expect(observed.result.stderr).toBe(""); expect(ordered(observed)).toBe(true);
  });
  it("import-hermes-state applies explicit Hermes CLI override after file loading", () => {
    expect(ordered(probe("import-hermes-state", undefined, true))).toBe(true);
  });
  it.each(callers)("prospective shared-loader wiring: %s imports the new helper", name => {
    const ast = ts.createSourceFile(name, readFileSync(join(tooling, name + ".ts"), "utf8"), ts.ScriptTarget.Latest, true);
    expect(ast.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && /^\.\/load-env-local(?:\.ts)?$/.test(node.moduleSpecifier.text))).toBe(true);
  });
  const setup = 'import {readFileSync} from "node:fs"; function load(){for(const line of readFileSync(".env.local","utf8").trim().split("\\n")){const i=line.indexOf("=");process.env[line.slice(0,i)]=line.slice(i+1);}}';
  const app = 'await import("../../src/forbidden-app");';
  it("interception control reaches an absent application only after a real environment load", () => {
    expect(ordered(probe("control", setup + `async function main(){load();${app}} main();`))).toBe(true);
  });
  it("absent application source fails closed if interception is omitted", () => {
    const dir = fixture();
    const entry = join(dir, "scripts/tooling/fail-safe.mjs");
    writeFileSync(entry, 'await import("../../src/forbidden-app");');
    const result = child(dir, [entry]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ERR_MODULE_NOT_FOUND");
    expect(existsSync(join(dir, "src"))).toBe(false);
  });
  it.each([
    ["uncalled main", setup + `async function main(){load();${app}}`],
    ["shadowed loader", setup + `async function main(){const load=()=>{};load();${app}} main();`],
    ["delayed load", setup + `async function main(){${app}load();} main();`],
    ["false-branch import", setup + `async function main(){load();if(false){${app}}} main();`],
    ["eager re-export", setup + 'export * from "../../src/forbidden-app"; load();'],
    ["eager require", setup + 'import {createRequire} from "node:module";createRequire(import.meta.url)("../../src/forbidden-app");load();'],
  ])("execution probe rejects %s", (_name, source) => {
    const observed = probe("negative", source);
    expect(observed.result.status).toBe(0); expect(observed.result.stderr).toBe("");
    expect(ordered(observed)).toBe(false);
  });
});

// Real runner and platform module, with process/network effects blocked at built-in boundaries.
const deployPreload = String.raw`
  const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),net=require('node:net');
  const realSpawnSync=cp.spawnSync;
  const record=(value)=>fs.appendFileSync('commands.jsonl',JSON.stringify(value)+'\n');
  cp.spawnSync=(command,args=[])=>{record({command,args});return {status:0,stdout:'',stderr:''}};
  cp.execFileSync=(command,args=[])=>{record({command,args});return ''};
  cp.spawn=(command,args,options)=>{
    if(command!==process.execPath || args[0]!==path.join(process.cwd(),'node_modules/next/dist/bin/next')) throw Error('UNAPPROVED SPAWN');
    const result=realSpawnSync(command,args,{cwd:options.cwd,env:options.env,encoding:'utf8',timeout:5000,windowsHide:true});
    if(result.status!==0) throw Error('OWNED CHILD FAILED '+result.stderr);
    record({handoff:true,args}); return {pid:987654321,on(){},unref(){}};
  };
  process.kill=()=>{throw Error('PROCESS SIGNAL FORBIDDEN')};
  net.connect=()=>{const socket=new (require('node:events').EventEmitter)();socket.destroy=()=>{};socket.setTimeout=()=>{};queueMicrotask(()=>socket.emit('error',Error('owned free port')));return socket};
  global.fetch=async()=>({status:200});
  global.setTimeout=(fn)=>{queueMicrotask(fn);return {unref(){}}};
  require('node:module').syncBuiltinESMExports();
`;
function deploy(action: string, inheritedPort: boolean, quotedPort = false) {
  const dir = fixture();
  for (const name of ["ps-deploy.mjs", "_platform.mjs", "_env-local.mjs", "network-boundary.mjs"]) copy(dir, name);
  const next = join(dir, "node_modules/next/dist/bin"); mkdirSync(next, { recursive: true });
  writeFileSync(join(next, "next"), `require('node:fs').writeFileSync('child.json',JSON.stringify({args:process.argv.slice(2),data:process.env.PS_DATA_DIR,home:process.env.HERMES_HOME,marker:process.env.PS_ORACLE_MARKER}));`);
  writeFileSync(join(dir, "deploy-preload.cjs"), deployPreload);
  const data = join(dir, "changed-data"), home = join(dir, "hermes");
  writeFileSync(join(dir, ".env.local"), `PS_RENAMED=1\nPS_DATA_DIR=${data}\nHERMES_HOME=${home}\nPS_ORACLE_MARKER=changed-file\nPORT=${quotedPort ? '"3987"' : '3987'}\n`);
  const result = child(dir, ["--require", join(dir, "deploy-preload.cjs"), join(dir, "scripts/tooling/ps-deploy.mjs"), action], {
    PS_DATA_DIR: join(dir, "data"), HERMES_HOME: join(dir, "home"), PS_ORACLE_MARKER: "old-inherited", ...(inheritedPort ? { PORT: "3988" } : {}),
  });
  expect(result.status).toBe(0);
  const observed = JSON.parse(readFileSync(join(dir, "child.json"), "utf8")) as { args: string[]; data: string; home: string; marker: string };
  expect(observed).toEqual({ args: ["start", "-p", inheritedPort ? "3988" : "3987", "-H", "127.0.0.1"], data, home, marker: "changed-file" });
  expect(readFileSync(join(home, "logs/ps-deploy.status"), "utf8")).toContain("state=success");
  const commands = readFileSync(join(dir, "commands.jsonl"), "utf8");
  expect(commands).toContain('"handoff":true');
  if (action !== "restart") { expect(commands).toContain('"build"'); expect(commands).toContain('"db:migrate"'); }
  if (action === "update") expect(commands).toContain('"fetch"');
}
describe("T-0192 copied deploy runner hands changed file values to its actual owned child", () => {
  it.each(["restart", "update", "rebuild"])("%s preserves inherited PORT while applying the changed file", action => deploy(action, true));
  it("restart falls back to file PORT when the shell has none", () => deploy("restart", false));
  it("restart accepts paired-quoted file PORT at the actual child handoff", () => deploy("restart", false, true));
});
