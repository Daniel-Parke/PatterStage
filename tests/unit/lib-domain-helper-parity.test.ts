/** @jest-environment node */

// T0194 independent Faraday parity oracle, 2026-10-04. Existing complete suites
// retain graph, prompt and report contracts; these checks bound the four folds.
import fs from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { readDeployStatus } from "@/lib/deploy/deploy-status";
import { renderReportHtml } from "@/lib/laboratory/deep-research/markdown";
import { renderReportNavHtml } from "@/lib/laboratory/deep-research/report";

jest.mock("@/lib/runtime/workspace", () => ({ getAgentWorkspace: () => ({ logs: "synthetic-unused-logs" }) }));
afterEach(() => jest.restoreAllMocks());

const root = resolve(__dirname, "../..");
function source(path: string) {
  return ts.createSourceFile(path, fs.readFileSync(resolve(root, path), "utf8"), ts.ScriptTarget.Latest, true);
}
function descendants(node: ts.Node): ts.Node[] {
  const nodes: ts.Node[] = [];
  function visit(child: ts.Node) { nodes.push(child); ts.forEachChild(child, visit); }
  visit(node); return nodes;
}
const exported = (node: ts.FunctionDeclaration) => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

describe("T0194 bounded helper parity", () => {
  it.each(["missing", "read refusal"])("deploy %s returns a fresh complete idle result without shared mutation", mode => {
    jest.spyOn(fs, "existsSync").mockReturnValue(mode === "read refusal");
    jest.spyOn(fs, "readFileSync").mockImplementation(() => { throw new Error("Synthetic status read refusal"); });
    const expected = { state: "idle", action: "", phase: "", message: "Ready", startedAt: "", finishedAt: "", exitCode: "", logHint: "" };
    const first = readDeployStatus();
    expect(first).toEqual(expected);
    first.message = "Caller-local mutation";
    const next = readDeployStatus();
    expect(next).toEqual(expected);
    expect(next).not.toBe(first);
  });

  it("research body and navigation escape the same four characters exactly once and retain apostrophes", () => {
    const literal = '&<>"\'';
    const escaped = '&amp;&lt;&gt;&quot;\'';
    const body = renderReportHtml(`\`\`\`text\n${literal}\n\`\`\``);
    const navigation = renderReportNavHtml([0, 1, 2, 3].map(index => ({ slug: `owned-${index}`, text: literal, level: 2 })));
    for (const html of [body, navigation]) {
      expect(html).toContain(escaped);
      expect(html).not.toContain("&amp;amp;");
      expect(html).not.toContain("&apos;");
      expect(html).not.toContain("&#39;");
    }
    expect(navigation).toContain('href="#owned-0"');
  });

  it("deploy idle defaults have one private factory rather than two copied object bodies", () => {
    const file = source("src/lib/deploy/deploy-status.ts");
    const idleBodies = descendants(file).filter(ts.isObjectLiteralExpression).filter(node => {
      const properties = node.properties.filter(ts.isPropertyAssignment);
      return ["state", "message"].every((name, index) => properties.some(property => property.name.getText(file) === name &&
        ts.isStringLiteral(property.initializer) && property.initializer.text === ["idle", "Ready"][index]));
    });
    expect(idleBodies.length).toBe(1);
    let owner: ts.Node | undefined = idleBodies[0].parent;
    while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
    expect(owner).toBeDefined();
    while (owner && !ts.isStatement(owner)) owner = owner.parent;
    expect(owner && ts.canHaveModifiers(owner) && ts.getModifiers(owner)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)).toBeFalsy();
  });

  it("Composer whole-graph entrypoints do not duplicate their node-and-edge INSERT blocks", () => {
    const file = source("src/lib/composer/composer-repository.ts");
    const pairs = file.statements.filter(ts.isFunctionDeclaration).filter(fn => {
      const sql = descendants(fn).filter(ts.isStringLiteralLike).map(node => node.text);
      return ["composer_nodes", "composer_edges"].every(table => sql.some(value => new RegExp(`INSERT INTO ${table}\\b`).test(value)));
    });
    expect(pairs.length).toBeLessThanOrEqual(1);
    for (const fn of pairs) expect(exported(fn)).toBe(false);
    // Existing public single-node/single-edge insert APIs stay governed by the
    // complete Composer suites; this does not force their removal or renaming.
  });

  it("research report and markdown share escaping rather than retain two four-character implementations", () => {
    const sites = ["src/lib/laboratory/deep-research/markdown.ts", "src/lib/laboratory/deep-research/report.ts"]
      .flatMap(path => descendants(source(path)).filter(ts.isStringLiteral).filter(node => node.text === "&amp;"));
    expect(sites.length).toBeLessThanOrEqual(1);
  });

  it("prompt attribute formatting is shared only with positive measured executable-size savings", () => {
    const file = source("src/lib/missions/build-mission-prompt.ts");
    const entries = descendants(file).filter(ts.isCallExpression).filter(node => ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === "Object" && node.expression.name.text === "entries");
    expect(entries.length).toBeLessThanOrEqual(1);
    // Pinned pre-fold compiler print: two identical 156-character attribute
    // expressions. Ignore commentary; include any added private helper/types.
    expect(Buffer.byteLength(ts.createPrinter({ removeComments: true }).printFile(file))).toBeLessThan(8706);
  });
});
