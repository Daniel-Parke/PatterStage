/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(__dirname, "../..");
const configName = "tsconfig.scripts.json";
const executableRoots = [
  "scripts/tooling/ensure-hermes-model-sync.ts", "scripts/tooling/import-hermes-state.ts",
  "scripts/tooling/migrate-db.ts", "scripts/tooling/retention-prune.ts", "scripts/tooling/seed-catalog.ts",
  "scripts/tooling/generate-json-schema.ts", "scripts/docs/extract.ts", "scripts/docs/check.mts",
];
const declarations = ["scripts/tooling/design-lint.d.mts", "scripts/tooling/derive-surface-ladder.d.mts", "scripts/tooling/output-canary.d.mts", "scripts/docs/lib.d.mts"];
const manifest = () => JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
function proposedConfig() {
  if (!existsSync(join(root, configName))) throw new Error(`MISSING CONTRACT: ${configName}`);
  return readFileSync(join(root, configName), "utf8");
}
function parseConfig(text: string, directory = root) {
  const parsed = ts.parseConfigFileTextToJson(configName, text);
  expect(parsed.error).toBeUndefined();
  const config = ts.parseJsonConfigFileContent(parsed.config, ts.sys, directory);
  expect(config.errors).toEqual([]);
  return config;
}
function typedFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? typedFiles(file) : /\.(ts|mts)$/.test(file) ? [file] : [];
  });
}
// Only an unconditional && chain proves the new check is mandatory. Reject optional/echoed calls.
function mandatoryLint(lint: string): boolean {
  return /^[\w./:@= -]+(?:&&[\w./:@= -]+)*$/.test(lint) && lint.split("&&").map(step => step.trim()).includes("npm run typecheck:scripts");
}
function gateRunsLint(source: string): boolean {
  const ast = ts.createSourceFile("gate.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "STEPS" || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      for (const element of declaration.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue;
        const values: Record<string, string> = {};
        for (const property of element.properties) {
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && ts.isStringLiteral(property.initializer)) values[property.name.text] = property.initializer.text;
        }
        if (values.name === "lint" && values.command === "npm run lint") return true;
      }
    }
  }
  return false;
}
function compilerCommand(command: string): boolean {
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] === "npx") tokens.shift();
  if (tokens.shift() !== "tsc") return false;
  let project = false, noEmit = false;
  while (tokens.length) {
    const token = tokens.shift();
    if (token === "--noEmit") noEmit = true;
    else if ((token === "-p" || token === "--project") && tokens.shift() === configName) project = true;
    else if (token === "--incremental" && tokens.shift() === "false") continue;
    else return false;
  }
  return project && noEmit;
}

// These fixtures contain inert substitutes at the real root paths. Only TypeScript/npm may run.
// Compiler error and correction qualify the command, not the production script bodies.
function plantedCommand(configText: string, command: string, extension: "ts" | "mts") {
  expect(compilerCommand(command)).toBe(true); // Never execute an arbitrary package script.
  const scratch = join(root, "tmp"); mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(join(scratch, "t0192-typing-"));
  try {
    const put = (file: string, contents: string) => { const target = join(directory, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, contents); };
    put("tsconfig.json", readFileSync(join(root, "tsconfig.json"), "utf8"));
    put(configName, configText);
    put("next-env.d.ts", "export {};\n");
    for (const file of [...executableRoots, ...declarations]) put(file, "export {};\n");
    put("package.json", JSON.stringify({ private: true, scripts: { "typecheck:scripts": command, lint: "npm run typecheck:scripts" } }));
    const compiler = join(root, "node_modules/typescript/bin/tsc");
    const bin = "node_modules/.bin/tsc";
    if (process.platform === "win32") put(bin + ".cmd", `@"${process.execPath}" "${compiler}" %*\r\n`);
    else { put(bin, `#!/bin/sh\nexec '${process.execPath.replaceAll("'", "'\\''")}' '${compiler.replaceAll("'", "'\\''")}' "$@"\n`); chmodSync(join(directory, bin), 0o700); }
    const npm = [process.env.npm_execpath, join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
      join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"), "/usr/share/nodejs/npm/bin/npm-cli.js"]
      .find((file): file is string => Boolean(file && file.endsWith("npm-cli.js") && existsSync(file)));
    if (!npm) throw new Error("INFRASTRUCTURE: npm CLI unavailable for the owned command fixture");
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.platform === "win32" ? dirname(process.execPath) : [dirname(process.execPath), "/usr/bin", "/bin"].join(":"), HOME: directory, USERPROFILE: directory,
      TMP: directory, TEMP: directory, TMPDIR: directory, npm_config_cache: join(directory, "npm-cache"), npm_config_ignore_scripts: "true", npm_config_update_notifier: "false" };
    for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env[key] = process.env[key];
    const plant = `scripts/tooling/new-script-oracle.${extension}`;
    const source = (value: string) => `import {writeFileSync} from 'node:fs';\nwriteFileSync('CLI-EXECUTED','forbidden');\nexport const typedValue: number = ${value};\n`;
    const run = () => {
      const result = spawnSync(process.execPath, [npm, "run", "lint"], { cwd: directory, env, encoding: "utf8", timeout: 30_000, windowsHide: true });
      if (result.error || result.signal) throw new Error(`INFRASTRUCTURE: compiler child failed to complete: ${result.error ?? result.signal}`);
      expect(existsSync(join(directory, "CLI-EXECUTED"))).toBe(false);
      return result;
    };
    put(plant, source('"planted-wrong-type"'));
    const failed = run();
    expect(failed.status).not.toBe(0);
    expect(failed.stdout + failed.stderr).toContain("TS2322");
    expect(failed.stdout + failed.stderr).toContain(`new-script-oracle.${extension}`);
    put(plant, source("42"));
    const corrected = run();
    expect({ status: corrected.status, output: corrected.stdout + corrected.stderr }).toEqual({ status: 0, output: expect.any(String) });
    function emitted(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === "npm-cache") return [];
        const file = join(dir, entry.name);
        return entry.isDirectory() ? emitted(file) : /\.(js|jsx|mjs|cjs|tsbuildinfo)$/.test(file) ? [relative(directory, file)] : [];
      });
    }
    expect(emitted(directory)).toEqual([]);
    expect(readFileSync(join(directory, configName), "utf8")).toBe(configText);
  } finally {
    if (dirname(resolve(directory)) !== scratch) throw new Error("Unsafe typing fixture cleanup");
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("T-0192 script typecheck contract", () => {
  it("covers all eight existing executable roots, declarations and every current TS/MTS script", () => {
    const config = parseConfig(proposedConfig());
    const files = config.fileNames.map(file => relative(root, file).replaceAll("\\", "/"));
    for (const file of [...executableRoots, ...declarations, ...typedFiles(join(root, "scripts")).map(file => relative(root, file).replaceAll("\\", "/"))]) expect(files).toContain(file);
  });
  it("uses strict no-emit non-incremental options without enabling blanket JavaScript checking", () => {
    const { options } = parseConfig(proposedConfig());
    expect(options).toMatchObject({ strict: true, noEmit: true, incremental: false });
    expect(options.checkJs).not.toBe(true);
  });
  it("the configured real scripts program has no syntax or type errors", () => {
    const config = parseConfig(proposedConfig());
    const program = ts.createProgram(config.fileNames, { ...config.options, noEmit: true, incremental: false });
    expect(ts.getPreEmitDiagnostics(program).map(error => ({ code: error.code, file: error.file?.fileName, message: ts.flattenDiagnosticMessageText(error.messageText, "\n") }))).toEqual([]);
  });
  it("the unchanged mandatory gate reaches both script and test typechecks through lint", () => {
    const scripts = manifest().scripts;
    expect(gateRunsLint(readFileSync(join(root, "scripts/tooling/gate.mjs"), "utf8"))).toBe(true);
    expect(mandatoryLint(scripts.lint)).toBe(true);
    expect(scripts.lint.split("&&").map(step => step.trim())).toContain("npm run typecheck:tests");
    expect(compilerCommand(scripts["typecheck:scripts"] ?? "")).toBe(true);
  });
  it.each(["ts", "mts"] as const)("actual mandatory compiler command refuses a planted .%s error then accepts its correction without running the CLI", extension => {
    plantedCommand(proposedConfig(), manifest().scripts["typecheck:scripts"] ?? "", extension);
  }, 30_000);

  it("gate guards reject optional, echoed, disconnected and failure-masked commands", () => {
    expect(mandatoryLint("eslint . && npm run typecheck:scripts && npm run typecheck:tests")).toBe(true);
    for (const lint of ["echo npm run typecheck:scripts", 'echo "unused && npm run typecheck:scripts && unused"', "npm run --if-present typecheck:scripts", "false || npm run typecheck:scripts", "npm run typecheck:scripts || true", "eslint .; npm run typecheck:scripts", "false && echo 'npm run typecheck:scripts'"]) expect(mandatoryLint(lint)).toBe(false);
    expect(gateRunsLint('const example = "npm run lint"; const STEPS = [{name:"other",command:"echo npm run lint"}];')).toBe(false);
    for (const command of ["tsx scripts/tooling/migrate-db.ts", "tsc -p tsconfig.scripts.json", "tsc --noEmit -p tsconfig.scripts.json || true", "echo tsc --noEmit -p tsconfig.scripts.json"]) expect(compilerCommand(command)).toBe(false);
  });
  it("isolated harness control proves real compiler refusal and correction before the proposed config exists", () => {
    const reference = JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { strict: true, noEmit: true, incremental: false, allowImportingTsExtensions: true }, include: ["scripts/**/*.ts", "scripts/**/*.mts"], exclude: ["node_modules"] });
    plantedCommand(reference, "tsc --noEmit -p tsconfig.scripts.json", "ts");
  }, 30_000);
});
