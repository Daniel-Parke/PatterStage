/** @jest-environment node */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { readDependencyOracleFiles } from "../helpers/dependency-oracle-types";

const { root, manifest, lockfile } = readDependencyOracleFiles(__dirname);
const knip = JSON.parse(readFileSync(join(root, "knip.json"), "utf8"));
const read = (file: string) => readFileSync(join(root, file), "utf8");
const parse = (file: string, source: string) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

function historicalConfig(file: string, source: string): ts.SourceFile {
  const tree = parse(file, source);
  if (file === "jest.config.js") {
    const declarations: ts.Node[] = [];
    function visit(node: ts.Node) {
      if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) ||
          ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
        const name = node.name;
        if (ts.isComputedPropertyName(name) ||
            ((ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text === "testEnvironment")) declarations.push(node);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    if (declarations.length !== 1) return tree;
    const declaration = declarations[0];
    if (!ts.isPropertyAssignment(declaration) || !ts.isIdentifier(declaration.name) ||
        !ts.isStringLiteral(declaration.initializer) || declaration.initializer.text !== "jest-environment-node") return tree;
    const value = declaration.initializer;
    return parse(file, source.slice(0, value.getStart(tree)) + '"jest-environment-jsdom"' + source.slice(value.end));
  }
  if (file !== "next.config.ts") return tree;
  const imports = tree.statements.filter(ts.isImportDeclaration).filter(node =>
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./src/lib/config/env");
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "readAliasedEnv") calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (imports.length !== 1 || calls.length !== 1 ||
      imports[0].getText(tree) !== 'import { readAliasedEnv } from "./src/lib/config/env";' ||
      calls[0].getText(tree) !== 'readAliasedEnv("PS_ALLOWED_DEV_ORIGINS")' || imports[0].end > calls[0].getStart(tree)) return tree;
  const call = calls[0], declaration = imports[0];
  const restored = source.slice(0, call.getStart(tree)) +
    "process.env.PS_ALLOWED_DEV_ORIGINS || process.env.CH_ALLOWED_DEV_ORIGINS" + source.slice(call.end);
  return parse(file, restored.slice(0, declaration.getStart(tree)) + restored.slice(declaration.end));
}

// Inspect syntax, never import configuration, scripts or application modules.
function packageConsumers(file: string, source: string, name: string): string[] {
  const tree = parse(file, source), found: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isStringLiteralLike(node) && (node.text === name || node.text.startsWith(`${name}/`))) {
      const parent = node.parent;
      const moduleDeclaration = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
      const call = ts.isCallExpression(parent) && parent.arguments[0] === node &&
        ["require", "require.resolve", "import"].includes(parent.expression.getText(tree));
      const externalRequire = ts.isExternalModuleReference(parent);
      let config = false;
      for (let ancestor: ts.Node | undefined = parent; ancestor; ancestor = ancestor.parent) {
        if (ts.isPropertyAssignment(ancestor) && ["preset", "transform"].includes(ancestor.name.getText(tree).replace(/["']/g, ""))) config = true;
      }
      if (moduleDeclaration || call || externalRequire || config) found.push(`${file}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return found;
}

function codeFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return codeFiles(file);
    return entry.isFile() && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name) ? [file] : [];
  });
}

describe("T-0192 dependency hygiene preserves the existing runtime", () => {
  it("keeps manifest and root lock dependency maps identical", () => {
    expect(lockfile.packages[""].dependencies).toEqual(manifest.dependencies);
    expect(lockfile.packages[""].devDependencies).toEqual(manifest.devDependencies);
  });

  it("removes ts-jest from both direct dependency maps and the root lock", () => {
    for (const record of [manifest, lockfile.packages[""]]) {
      expect(record.dependencies).not.toHaveProperty("ts-jest");
      expect(record.devDependencies).not.toHaveProperty("ts-jest");
    }
  });

  it("detects executable package references without treating pin assertions or comments as consumers", () => {
    const executable = ['import x from "ts-jest";', 'export { x } from "ts-jest";', 'require("ts-jest");', 'require.resolve("ts-jest");', 'import("ts-jest");', 'import x = require("ts-jest");', 'const config = { preset: "ts-jest" };', 'const config = { transform: { "pattern": ["ts-jest", {}] } };'];
    for (const source of executable) expect(packageConsumers("control.ts", source, "ts-jest")).toHaveLength(1);
    expect(packageConsumers("control.ts", '// require("ts-jest")\nexpect(map["ts-jest"]).toBeUndefined();', "ts-jest")).toEqual([]);
  });

  it("has no executable ts-jest consumer in source, scripts, tests or root configuration", () => {
    const files = ["src", "scripts", "tests", "mock-hermes", "mock-hindsight", "mock-llm", "test-harness"].flatMap(codeFiles);
    files.push(...readdirSync(root).filter(file => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)));
    expect(files.flatMap(file => packageConsumers(file, read(file), "ts-jest"))).toEqual([]);
    const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
    expect(Object.entries(scripts).filter(([, command]) => /\bts-jest\b/.test(command))).toEqual([]);
  });

  it("declares direct development jsdom 26.1.0 without changing the resolved DOM version", () => {
    expect(manifest.dependencies).not.toHaveProperty("jsdom");
    expect(manifest.devDependencies.jsdom).toBe("26.1.0");
    expect(lockfile.packages[""].devDependencies?.jsdom).toBe("26.1.0");
    expect(lockfile.packages["node_modules/jsdom"].version).toBe("26.1.0");
    expect(lockfile.packages["node_modules/jest-environment-jsdom"].dependencies?.jsdom).toBe("^26.1.0");
  });

  it("moves unchanged js-yaml types 4.0.9 to development dependencies", () => {
    expect(manifest.dependencies).not.toHaveProperty("@types/js-yaml");
    expect(manifest.devDependencies["@types/js-yaml"]).toBe("^4.0.9");
    expect(lockfile.packages[""].dependencies).not.toHaveProperty("@types/js-yaml");
    expect(lockfile.packages[""].devDependencies?.["@types/js-yaml"]).toBe("^4.0.9");
    expect(lockfile.packages["node_modules/@types/js-yaml"].version).toBe("4.0.9");
    expect(lockfile.packages["node_modules/@types/js-yaml"]).toHaveProperty("dev", true);
  });

  it("retains exactly the justified Knip dependency and binary exceptions", () => {
    expect(knip.ignoreDependencies).toEqual(["tailwindcss"]);
    expect(knip.ignoreBinaries).toEqual(["python", "crontab", "systemctl", "which", "ps", "sqlite3", "tasklist", "taskkill", "netstat", "ss", "lsof", "where"]);
  });

  it("uses the Knip 6 schema without changing the Knip dependency pin", () => {
    expect(knip.$schema).toBe("https://unpkg.com/knip@6/schema.json");
    expect(manifest.devDependencies.knip).toBe("^6.34.0");
    expect(lockfile.packages["node_modules/knip"].version).toBe("6.34.0");
  });

  it("preserves the full existing Knip scan scope with no new exclusion keys", () => {
    expect(Object.keys(knip).sort()).toEqual(["$schema", "entry", "ignoreBinaries", "ignoreDependencies", "project"]);
    expect(knip.entry).toEqual(["src/instrumentation.ts", "scripts/**/*.{ts,mjs}", "mock-hermes/server.mjs", "mock-hindsight/server.mjs", "mock-llm/server.mjs", "tests/integration/runtime/*.mjs", "test-harness/baseline-fix-verify.mjs", "test-harness/bench-gateway-e2e.mjs", "tests/e2e/prepare-data-dir.mjs", "tests/helpers/secret-scan-canary-preload.mjs"]);
    expect(knip.project).toEqual(["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs}", "mock-hermes/**/*.mjs", "mock-hindsight/**/*.mjs", "mock-llm/**/*.mjs", "tests/**/*.{ts,tsx,mjs,cjs}", "test-harness/**/*.{mjs,cjs}"]);
  });

  it("uses injected Jest globals in the dashboard without banning transitive @jest/globals", () => {
    expect(packageConsumers("dashboard.ts", read("tests/unit/dashboard-helpers-unit.test.ts"), "@jest/globals")).toEqual([]);
    expect(manifest.dependencies).not.toHaveProperty("@jest/globals");
    expect(manifest.devDependencies).not.toHaveProperty("@jest/globals");
  });

  it.each([
    ["next.config.ts", "e23ed9b1da7b58096fe62681503d75b8eb802c1a024b0c2d52afcaea9a66ab36"],
    ["jest.config.js", "3188e6c3935b640ba58aa02c2ebc32913b41ac5ef5eb9dd9b74563942a9a6ba0"],
  ])("preserves %s executable configuration while allowing comment-only amendments", (file, expected) => {
    const printed = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(historicalConfig(file, read(file)));
    expect(createHash("sha256").update(printed).digest("hex")).toBe(expected);
  });
});
