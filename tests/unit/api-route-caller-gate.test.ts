/** @jest-environment node */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import baseline from "../fixtures/api-route-contract-baseline.json";

// Accepted T-0170 intent/invariant; docs/reference/api.md:25,111.
// This compatibility contract is not evidence of an in-tree caller.
const publicLivenessCompatibilityDispositions = [{
  path: "/api/healthz",
  authority: "T-0170; docs/reference/api.md:25,111",
  reason: "Retained unauthenticated GET JSON liveness alias of /api/health returning bare { ok: true }; unsafe methods remain authenticated.",
}] as const;

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name).replaceAll("\\", "/")]);
}

// Count URL arguments reaching HTTP calls, including locally/imported wrappers
// whose bodies can be traced to those calls. Mere constants, route interception
// and fixture tables are not callers. This is static evidence, not reachability.
function references(source: ts.SourceFile, checker?: ts.TypeChecker): string[] {
  const result: string[] = [];
  type Bindings = Map<ts.Symbol | string, ts.Expression>;
  function key(node: ts.Node): ts.Symbol | string { return checker?.getSymbolAtLocation(node) ?? node.getText(); }
  function declaration(node: ts.Node): ts.Declaration | undefined {
    let symbol = checker?.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker?.getAliasedSymbol(symbol);
    return symbol?.valueDeclaration;
  }
  function property(node: ts.Expression, name: string, bindings: Bindings, seen = new Set<ts.Node>()): ts.Expression | undefined {
    if (seen.has(node)) return undefined;
    seen.add(node);
    if (ts.isIdentifier(node)) {
      const decl = declaration(node);
      const value = bindings.get(key(node)) ?? (decl && ts.isVariableDeclaration(decl) ? decl.initializer : undefined);
      return value ? property(value, name, bindings, seen) : undefined;
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const member of [...node.properties].reverse()) {
        if (ts.isSpreadAssignment(member)) {
          const value = property(member.expression, name, bindings, seen);
          if (value) return value;
        } else if (member.name?.getText().replace(/^['"]|['"]$/g, "") === name) {
          if (ts.isPropertyAssignment(member)) return member.initializer;
          if (ts.isShorthandPropertyAssignment(member)) return member.name;
        }
      }
    }
    return undefined;
  }
  function values(node: ts.Expression, bindings: Bindings, seen = new Set<ts.Node>()): string[] {
    if (seen.has(node)) return ["__segment__"];
    const next = new Set(seen).add(node);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return [node.text];
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isAwaitExpression(node)) return values(node.expression, bindings, next);
    if (ts.isTemplateExpression(node)) {
      let parts = [node.head.text];
      for (const span of node.templateSpans) parts = parts.flatMap(prefix => values(span.expression, bindings, next).map(part => prefix + part + span.literal.text));
      return parts;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return values(node.left, bindings, next).flatMap(left => values(node.right, bindings, next).map(right => left + right));
    }
    if (ts.isConditionalExpression(node)) return [...values(node.whenTrue, bindings, next), ...values(node.whenFalse, bindings, next)];
    if (ts.isIdentifier(node)) {
      const bound = bindings.get(key(node));
      if (bound) return values(bound, bindings, next);
      const decl = declaration(node);
      if (decl && ts.isVariableDeclaration(decl) && decl.initializer) return values(decl.initializer, bindings, next);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const value = property(node.expression, node.name.text, bindings);
      if (value) return values(value, bindings, next);
      const decl = declaration(node);
      if (decl && ts.isPropertyAssignment(decl)) return values(decl.initializer, bindings, next);
    }
    const type = checker?.getTypeAtLocation(node);
    const variants = type?.isUnion() ? type.types : type ? [type] : [];
    return variants.length && variants.every(t => t.isStringLiteral() || t.isNumberLiteral())
      ? variants.map(t => String((t as ts.StringLiteralType | ts.NumberLiteralType).value)) : ["__segment__"];
  }
  function record(argument: ts.Expression, bindings: Bindings) {
    for (const value of values(argument, bindings)) {
      // Absolute URLs and an unknown origin prefix may still have a known path.
      if (!/^(?:https?:\/\/[^/]+|__segment__)?\/api\//.test(value)) continue;
      const url = value.slice(value.indexOf("/api/")).split(/[?#\s]/)[0].replace(/\/$/, "");
      if (/^\/api\/[\w/.[\]-]+$/.test(url)) result.push(url);
    }
  }
  function visit(node: ts.Node, bindings: Bindings, stack: Set<ts.Node>) {
    // Native anchors perform HTTP navigation/downloads; arbitrary href props do not.
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === "a") {
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && attr.name.getText() === "href" && attr.initializer) {
          const value = ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : attr.initializer;
          if (value) record(value, bindings);
        }
      }
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const target = node.expression;
      const args = node.arguments ?? [];
      const name = ts.isIdentifier(target) ? target.text : "";
      const decl = declaration(target);
      const globalHttp = ["fetch", "EventSource"].includes(name) && (!decl || decl.getSourceFile().isDeclarationFile);
      const requestMethod = ts.isPropertyAccessExpression(target) && /^(get|post|put|patch|delete|head|fetch)$/.test(target.name.text)
        && checker?.typeToString(checker.getTypeAtLocation(target.expression)).includes("APIRequestContext");
      if ((globalHttp || requestMethod) && args[0]) record(args[0], bindings);
      else if (ts.isCallExpression(node) && args.some(arg => [arg, property(arg, "url", bindings)].some(value => value && values(value, bindings).some(text => text.includes("/api/"))))) {
        // Follow real function bodies rather than blessing names such as apiFetch.
        const resolved = checker?.getResolvedSignature(node)?.declaration;
        const fn = resolved && (ts.isFunctionDeclaration(resolved) || ts.isFunctionExpression(resolved) || ts.isArrowFunction(resolved) || ts.isMethodDeclaration(resolved)) ? resolved : undefined;
        if (fn?.body && !fn.getSourceFile().fileName.includes("node_modules") && !stack.has(fn)) {
          const nested = new Map(bindings);
          fn.parameters.forEach((parameter, index) => {
            if (!args[index]) return;
            if (ts.isObjectBindingPattern(parameter.name)) {
              for (const element of parameter.name.elements) {
                const value = property(args[index], (element.propertyName ?? element.name).getText(), bindings);
                if (value) nested.set(key(element.name), value);
              }
            } else nested.set(key(parameter.name), args[index]);
          });
          visit(fn.body, nested, new Set(stack).add(fn));
        }
      }
    }
    ts.forEachChild(node, child => visit(child, bindings, stack));
  }
  visit(source, new Map(), new Set());
  return [...new Set(result)];
}

function matches(route: string, reference: string): boolean {
  const routeParts = route.split("/");
  const referenceParts = reference.split("/");
  if (routeParts.length !== referenceParts.length) return false;
  return routeParts.every((part, index) => part === referenceParts[index]
    || /^\[[^\]]+\]$/.test(part));
}

describe("T-0192 shipped route caller gate", () => {
  it("requires a first-party reference or one of exactly four retained operator APIs", () => {
    const files = ["src", "scripts", "tests/e2e", "tests/integration"].flatMap(walk)
      .filter(file => /\.(?:[cm]?[jt]sx?)$/.test(file) && !file.startsWith("src/app/api/"));
    const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
    const program = ts.createProgram(files, { ...options, allowJs: true });
    const checker = program.getTypeChecker();
    const callers = files.flatMap(file => references(program.getSourceFile(file)!, checker));
    const allowed = new Set(baseline.operatorAllowlist.map(row => row.path));
    const missing = baseline.routes.filter(route => !allowed.has(route.path) && !publicLivenessCompatibilityDispositions.some(disposition => disposition.path === route.path) && !callers.some(caller => matches(route.path, caller))).map(route => route.path);
    expect(missing).toEqual([]);
  });

  it("pins the exact accepted public JSON liveness compatibility disposition and reason", () => {
    expect(publicLivenessCompatibilityDispositions).toEqual([{
      path: "/api/healthz",
      authority: "T-0170; docs/reference/api.md:25,111",
      reason: "Retained unauthenticated GET JSON liveness alias of /api/health returning bare { ok: true }; unsafe methods remain authenticated.",
    }]);
    expect(baseline.routes.some(route => route.path === "/api/healthz")).toBe(true);
    expect(baseline.operatorAllowlist.some(row => row.path === "/api/healthz")).toBe(false);
  });

  it("pins each operator exception with its individual reason", () => {
    expect(baseline.operatorAllowlist.map(row => row.path).sort()).toEqual([
      "/api/admin/sessions/backfill-status", "/api/agents/progression", "/api/memory", "/api/missions/[id]",
    ]);
    for (const row of baseline.operatorAllowlist) {
      expect(row.reason.trim().length).toBeGreaterThan(20);
      expect(baseline.routes.some(route => route.path === row.path)).toBe(true);
    }
  });

  it("recognises static, queried and segmented template callers without accepting comments", () => {
    const source = ts.createSourceFile("control.ts", 'fetch("/api/status?detail=1"); fetch(`/api/models/${id}`); // fetch("/api/orphan")', ts.ScriptTarget.Latest, true);
    const callers = references(source);
    expect(callers).toEqual(["/api/status", "/api/models/__segment__"]);
    expect(callers.some(caller => matches("/api/models/[id]", caller))).toBe(true);
    expect(callers.some(caller => matches("/api/orphan", caller))).toBe(false);
    expect(matches("/api/models/[id]/probe", "/api/models/__segment__")).toBe(false);
    expect(matches("/api/orphan", "/api/__segment__")).toBe(false);
    expect(references(ts.createSourceFile("unknown.ts", 'fetch(`${origin}${path}`)', ts.ScriptTarget.Latest, true))).toEqual([]);
  });

  it("expands a finite action union without treating arbitrary expressions as static-route callers", () => {
    const source = ts.createSourceFile("actions.ts", 'declare const action: "push" | "pull"; declare const unknownAction: string; fetch(`/api/models/sync/${action}`); fetch(`/api/models/sync/${unknownAction}`);', ts.ScriptTarget.Latest, true);
    const host = ts.createCompilerHost({ noLib: true });
    host.getSourceFile = file => file === "actions.ts" ? source : undefined;
    const checker = ts.createProgram(["actions.ts"], { noLib: true }, host).getTypeChecker();
    const callers = references(source, checker);
    expect(callers.sort()).toEqual(["/api/models/sync/__segment__", "/api/models/sync/pull", "/api/models/sync/push"]);
    expect(callers.some(caller => matches("/api/models/sync/delete", caller))).toBe(false);
  });

  it("rejects unused URL literals, fixtures and interception references as caller evidence", () => {
    const source = ts.createSourceFile("non-callers.ts", 'const unused = "/api/orphan"; const fixture = { url: "/api/fixture" }; page.route("/api/intercept", handler); expect("/api/assertion"); new URL("/api/parsed", origin); apiFetch("/api/untraced");', ts.ScriptTarget.Latest, true);
    expect(references(source)).toEqual([]);
  });

  it("traces wrapper parameters to HTTP sinks without accepting unrelated wrapper arguments", () => {
    const source = ts.createSourceFile("wrappers.ts", 'function request(url: string, unused: string) { return fetch(url); } function wrapper(url: string) { return request(url, "/api/unused-argument"); } wrapper("/api/wrapped"); function apiFetch(url: string) { return url; } apiFetch("/api/fake-wrapper");', ts.ScriptTarget.Latest, true);
    const host = ts.createCompilerHost({ noLib: true });
    host.getSourceFile = file => file === "wrappers.ts" ? source : undefined;
    const checker = ts.createProgram(["wrappers.ts"], { noLib: true }, host).getTypeChecker();
    expect(references(source, checker)).toEqual(["/api/wrapped"]);
  });

  it("traces spread options into destructured HTTP arguments without blessing fixture objects", () => {
    const source = ts.createSourceFile("options.ts", 'function send({url}: {url: string}) { return fetch(url); } function write(opts: {url: string}) { return send({...opts, note: "/api/unused-note"}); } write({url: "/api/written"}); const fixture = {url: "/api/fixture"}; function fake(opts: {url: string}) { return opts.url; } fake({url: "/api/not-sent"});', ts.ScriptTarget.Latest, true);
    const host = ts.createCompilerHost({ noLib: true });
    host.getSourceFile = file => file === "options.ts" ? source : undefined;
    const checker = ts.createProgram(["options.ts"], { noLib: true }, host).getTypeChecker();
    expect(references(source, checker)).toEqual(["/api/written"]);
  });

  it("recognises native HTTP download links but rejects arbitrary href props", () => {
    const source = ts.createSourceFile("links.tsx", '<><a href={`/api/research/${id}/export`} download>Export</a><Widget href="/api/fixture" /></>', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect(references(source)).toEqual(["/api/research/__segment__/export"]);
  });
});
