/** @jest-environment node */

// T0194 independent Faraday oracle, 2026-10-04. Ownership needs bounded path
// checks; public behaviour uses synthetic text and an in-memory baseline DB.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { openBaselineDb, type RealDb } from "../helpers/baseline-db";

let testDb: RealDb | null = null;
type RootSnapshot = { id: number; displayName: string; description: string; soulMd: string; syncedAt: string | null; syncError: string | null };
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
afterEach(() => { testDb?.close(); testDb = null; });

const root = resolve(__dirname, "../..");
const text = (path: string) => readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const targets = [
  { name: "agent_root repository", old: "src/lib/agents/agent-root-repository.ts", target: "src/modules/hermes/lib/agent-root-repository.ts",
    callers: ["src/modules/hermes/lib/profiles-repository.ts", "src/modules/hermes/handlers/profile-patch.ts", "src/app/api/agent/root/route.ts"] },
  { name: "env-file parser", old: "src/lib/config/env-file.ts", target: "src/modules/hermes/lib/env-file.ts",
    callers: ["src/modules/hermes/lib/config-import.ts", "src/modules/hermes/lib/hermes-env-sync.ts"] },
];
function imports(path: string) {
  const source = ts.createSourceFile(path, text(path), ts.ScriptTarget.Latest, true);
  return source.statements.filter(ts.isImportDeclaration).filter(node => ts.isStringLiteral(node.moduleSpecifier))
    .map(node => (node.moduleSpecifier as ts.StringLiteral).text);
}
function importedPath(caller: string, specifier: string) {
  if (specifier.startsWith("@/")) return resolve(root, "src", specifier.slice(2)) + ".ts";
  if (specifier.startsWith(".")) return resolve(root, dirname(caller), specifier) + ".ts";
  return specifier;
}
function sourceFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}
function loadTarget<T>(path: string): T {
  // Missing targets fail through this matcher, never a module-loader exception.
  expect(existsSync(join(root, path))).toBe(true);
  return require(join(root, path)) as T;
}

describe("T0194 Hermes library ownership", () => {
  it.each(targets)("$name lives only at its ruled Hermes target without a core shim", ({ old, target }) => {
    expect(existsSync(join(root, target))).toBe(true);
    expect(existsSync(join(root, old))).toBe(false);
  });

  it("moved agent_root exports retain singleton partial-update and sync-status contracts", () => {
    const repository = loadTarget<{
      getAgentRoot: () => RootSnapshot;
      updateAgentRoot: (patch: { displayName?: string; description?: string; soulMd?: string }) => RootSnapshot;
      setAgentRootSyncStatus: (at: string | null, error: string | null) => void;
    }>(targets[0].target);
    testDb = openBaselineDb();
    expect(repository.getAgentRoot()).toMatchObject({ id: 1 });
    repository.updateAgentRoot({ displayName: "Owned root", description: "Original", soulMd: "  literal soul\n" });
    expect(repository.updateAgentRoot({ description: "" })).toMatchObject({ id: 1, displayName: "Owned root", description: "", soulMd: "  literal soul\n" });
    repository.setAgentRootSyncStatus("2026-10-04T12:00:00Z", "Synthetic refusal");
    expect(repository.getAgentRoot()).toMatchObject({ syncedAt: "2026-10-04T12:00:00Z", syncError: "Synthetic refusal" });
    repository.setAgentRootSyncStatus(null, null);
    expect(repository.getAgentRoot()).toMatchObject({ syncedAt: null, syncError: null });
    expect(testDb.prepare("SELECT COUNT(*) AS count FROM agent_root").get()).toEqual({ count: 1 });
  });

  it("moved env-file exports retain CRLF duplicate-key and raw-value contracts", () => {
    const parser = loadTarget<{ parseEnvFile: (content: string) => Map<string, string>; ENV_LINE_RE: RegExp }>(targets[1].target);
    expect([...parser.parseEnvFile('# comment\r\n A="x=y"\r\n\r\ninvalid\r\nA=last\r\n_B=raw=tail\r\n').entries()])
      .toEqual([["A", "last"], ["_B", "raw=tail"]]);
    expect(parser.parseEnvFile("").size).toBe(0);
    expect(parser.ENV_LINE_RE.exec('QUOTED="x=y"')?.slice(1)).toEqual(["QUOTED", '"x=y"']);
  });

  it.each(targets)("representative $name callers resolve the new owner and preserve their route seam", ({ callers, target, old }) => {
    for (const caller of callers) {
      const paths = imports(caller).map(specifier => importedPath(caller, specifier));
      expect(paths).toContain(join(root, target));
      expect(paths).not.toContain(join(root, old));
      expect(existsSync(join(root, target))).toBe(true);
    }
  });

  it("moved libraries create no new direct import from core outside existing composition points", () => {
    const violations = sourceFiles("src").filter(path => !path.startsWith("src/app/") && !path.startsWith("src/modules/") &&
      !path.startsWith("src/lib/modules/") && !path.startsWith("src/lib/runtime/") && path !== "src/lib/frameworks/registry.ts")
      .flatMap(caller => imports(caller).filter(specifier => targets.some(target => importedPath(caller, specifier) === join(root, target.target)))
        .map(specifier => `${relative(root, join(root, caller))}: ${specifier}`));
    expect(violations).toEqual([]);
  });

  it("Settings field and section metadata remain exactly in core and ADR0005 stays unchanged", () => {
    for (const [path, expected] of [
      ["src/lib/config/config-schema.ts", "1fe96a48c2ecce1e342da6bfb7b284f62cf8b02de97d0611a0cb28ae454da85a"],
      ["src/lib/config/config-sections.ts", "73a8db481d7aefccb771687081043124cf78208c2e0eda812085f1679ac94d2c"],
      ["org/decisions/ADR-0005-product-modules.md", "7005b76c5ddc32460095a3a2d8431b3adafaf13b9b98891a6cfd2fd7f55f2d56"],
    ]) expect(hash(text(path))).toBe(expected);
  });

  it("Settings exception commentary cannot change either existing module-boundary predicate", () => {
    const source = ts.createSourceFile("design-lint.mjs", text("scripts/tooling/design-lint.mjs"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const printer = ts.createPrinter({ removeComments: true });
    const predicates: Record<string, string> = {};
    function visit(node: ts.Node) {
      if (ts.isObjectLiteralExpression(node)) {
        const properties = node.properties.filter(ts.isPropertyAssignment);
        const id = properties.find(property => property.name.getText(source) === "id")?.initializer;
        if (id && ts.isStringLiteral(id) && ["hermes-outside-adapter", "core-imports-no-module"].includes(id.text)) {
          predicates[id.text] = hash(properties.filter(property => ["files", "pattern"].includes(property.name.getText(source)))
            .map(property => printer.printNode(ts.EmitHint.Unspecified, property.initializer, source)).join("\n"));
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(predicates).toEqual({ "hermes-outside-adapter": "44bc70268f92975f728a06739b07c53791cdbbadfc011bce3f3519c3cc3ad2cc",
      "core-imports-no-module": "b176e30ec4d6ad43377a7be48e166c93e14892f22dfdb645256f4410ea09b5f2" });
  });

  it("accepted ADR0018 records the exact approved Settings exception decision", () => {
    const path = "org/decisions/ADR-0018-settings-schema-exception.md";
    expect(existsSync(join(root, path))).toBe(true);
    const decision = (document: string) => document.split("## Decision\n")[1]?.split("\n## ")[0].trim();
    const approved = decision(text("org/reviews/2026-10-t0194-settings-schema-adr-proposal.md"));
    expect(approved).toBeTruthy();
    expect(decision(text(path))).toBe(approved);
    expect(text(path)).toMatch(/status:\s*accepted/i);
  });
});
