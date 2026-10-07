/** @jest-environment node */

// Independent Banach oracle for lib-domains-11a/13c/14b and cross-cutting-03b.
import fs from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { formatElapsed } from "@/lib/utils";

const root = resolve(__dirname, "../..");
const envPath = resolve(root, "src/lib/config/env.ts");
const initialEnv = { ...process.env };
const poisoned = ["fs", "node:fs", "os", "node:os", "@/lib/host/paths"];
type EnvModule = {
  readEnv(...keys: string[]): string | undefined;
  readAliasedEnv(canonical: string): string | undefined;
  PS_ENV_ALIASES: Readonly<Record<string, readonly string[]>>;
};
function loadEnv(): EnvModule {
  expect(fs.existsSync(envPath)).toBe(true); // Owned capability matcher, before any module loading.
  const env = require(envPath) as EnvModule;
  expect(typeof env.readEnv).toBe("function");
  expect(typeof env.readAliasedEnv).toBe("function");
  expect(env.PS_ENV_ALIASES).toEqual(expect.any(Object));
  return env;
}
afterEach(() => {
  process.env = { ...initialEnv };
  for (const id of [...poisoned, "@/types/chat"]) jest.dontMock(id);
  jest.resetModules();
});

const aliases = {"PS_DATA_DIR":["CH_DATA_DIR","CONTROL_HUB_DATA_DIR"],"PS_SCRIPTS_DIR":["CH_SCRIPTS_DIR"],"PS_HARDWARE_LOG_DIR":["CH_HARDWARE_LOG_DIR"],"PS_ENABLE_DEPLOY_API":["CH_ENABLE_DEPLOY_API"],"PS_REQUEST_SIGNING_SECRET":["CH_REQUEST_SIGNING_SECRET"],"PS_READ_ONLY":["CH_READ_ONLY"],"PS_RUN_MAX_MINUTES":["CH_RUN_MAX_MINUTES"],"PS_UPDATE_GIT_BRANCH":["CH_UPDATE_GIT_BRANCH"],"PS_PULL_RECONCILE_DISK":["CH_PULL_RECONCILE_DISK"],"PS_LLM_API":["CONTROL_HUB_LLM_API"],"PS_ALLOWED_DEV_ORIGINS":["CH_ALLOWED_DEV_ORIGINS"],"PORT":["CONTROL_HUB_PORT"],"HERMES_HOME":["AGENT_HOME"]};
const callers = [{"path":"next.config.ts","key":"PS_ALLOWED_DEV_ORIGINS","alias":"CH_ALLOWED_DEV_ORIGINS","variable":"extraOrigins","heldInitializerSha256":"48a8bac7ea74e7586122a407dcd4c2ad14c61cbde0b3171f8596569569fde489"},{"path":"src/app/api/agent/profiles/sync/pull/route.ts","key":"PS_PULL_RECONCILE_DISK","alias":"CH_PULL_RECONCILE_DISK","variable":"reconcileDisk","heldInitializerSha256":"fba15f0a8e7ec2b225ce5d7b31f659354fef1273eae1c921d82c480881f4b75d"},{"path":"src/lib/orchestration/run-deadline.ts","key":"PS_RUN_MAX_MINUTES","alias":"CH_RUN_MAX_MINUTES","variable":"DEFAULT_MAX_RUN_MINUTES","heldInitializerSha256":"da0634db4a250d03201c3cc7572b503a479a0b1110b0c01816b1d335419ca89e"},{"path":"src/lib/update-handlers/shared.ts","key":"PS_UPDATE_GIT_BRANCH","alias":"CH_UPDATE_GIT_BRANCH","variable":"UPDATE_BRANCH","heldInitializerSha256":"bbeb70e9f62b79f5600649c8b2442cb21ca992f5bf01bfbf3c13f2fee424222d"},{"path":"src/modules/hermes/lib/agent-runtime.ts","key":"PS_LLM_API","alias":"CONTROL_HUB_LLM_API","variable":"envApi","heldInitializerSha256":"3bbd5533f976894bf0bcf992d8c82d4143ddb740f731cae191b4a353946eca7f"}];
function shape(node: ts.Node, substitution?: { call: ts.Node; raw: ts.Node }): unknown {
  if (substitution && node === substitution.call) return shape(substitution.raw);
  if (ts.isParenthesizedExpression(node)) return shape(node.expression, substitution);
  const children: unknown[] = [];
  ts.forEachChild(node, child => { children.push(shape(child, substitution)); });
  return children.length ? [ts.SyntaxKind[node.kind], children] : [ts.SyntaxKind[node.kind],
    ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ? node.text : node.getText()];
}
function nodes(file: ts.Node): ts.Node[] {
  const result: ts.Node[] = [];
  function visit(node: ts.Node) { result.push(node); ts.forEachChild(node, visit); }
  visit(file); return result;
}

it.each([[86_399_000, "23h 59m"], [86_400_000, "1d 0h"], [176_400_000, "2d 1h"]] as const)(
  "elapsed %sms uses ruled duration %s", (span, expected) => {
    const now = Date.parse("2026-10-04T12:00:00Z");
    expect(formatElapsed(new Date(now - span).toISOString(), now)).toBe(expected);
  },
);

it("model display follows the imported canonical default without changing ordinary model labels", () => {
  const changed = "owned-canonical-default";
  jest.doMock("@/types/chat", () => ({ ...jest.requireActual("@/types/chat"), CHAT_DEFAULT_MODEL: changed }));
  jest.isolateModules(() => {
    const { formatModelName } = require("@/lib/chat/chat-utils") as typeof import("@/lib/chat/chat-utils");
    expect(formatModelName(changed)).toBe("Agent Default");
    expect(formatModelName("provider/model_x")).toBe("Model X");
  });
});

it("variadic readEnv retains ordered trimmed values, no implicit aliases and undefined absence", () => {
  const env = loadEnv();
  process.env.T0194_ENV_A = "   "; process.env.T0194_ENV_B = "  second  ";
  expect(env.readEnv("T0194_ENV_A", "T0194_ENV_B")).toBe("second");
  process.env.T0194_ENV_A = " first ";
  expect(env.readEnv("T0194_ENV_A", "T0194_ENV_B")).toBe("first");
  process.env.T0194_ENV_A = "0";
  expect(env.readEnv("T0194_ENV_A")).toBe("0");
  delete process.env.T0194_ENV_A; delete process.env.T0194_ENV_B;
  expect(env.readEnv("T0194_ENV_A", "T0194_ENV_B")).toBeUndefined();
  delete process.env.PS_DATA_DIR; process.env.CH_DATA_DIR = "owned-legacy";
  expect(env.readEnv("PS_DATA_DIR")).toBeUndefined();
});

it("registered alias reads preserve first truthy RAW selection including whitespace and every declared group", () => {
  const env = loadEnv();
  for (const [key, legacy] of Object.entries(aliases)) {
    for (const name of [key, ...legacy]) delete process.env[name];
    expect(env.readAliasedEnv(key)).toBeUndefined();
    const value = "  owned-" + key + "  ";
    process.env[legacy[0]] = value;
    expect(env.readAliasedEnv(key)).toBe(value);
    process.env[key] = "";
    expect(env.readAliasedEnv(key)).toBe(value);
    process.env[key] = "   ";
    expect(env.readAliasedEnv(key)).toBe("   ");
    process.env[key] = "0";
    expect(env.readAliasedEnv(key)).toBe("0");
  }
  delete process.env.PS_DATA_DIR; process.env.CH_DATA_DIR = ""; process.env.CONTROL_HUB_DATA_DIR = " second ";
  expect(env.readAliasedEnv("PS_DATA_DIR")).toBe(" second ");
});

it("the thirteen alias groups equal the Deprecated input documentation and preserve alias ordering", () => {
  const env = loadEnv();
  const docs = fs.readFileSync(resolve(root, "docs/running/env-reference.md"), "utf8").replace(/\r\n/g, "\n");
  const start = docs.indexOf("| Deprecated input | Replacement |");
  expect(start).toBeGreaterThanOrEqual(0);
  const table = docs.slice(start).split("\n\n")[0];
  const documented = Object.fromEntries(table.split("\n").flatMap(line => {
    const columns = line.split("|");
    const legacy = [...(columns[1] ?? "").matchAll(/\x60([^\x60]+)\x60/g)].map(match => match[1]);
    const canonical = (columns[2] ?? "").match(/\x60([^\x60]+)\x60/)?.[1];
    return canonical && legacy.length ? [[canonical, legacy]] : [];
  }));
  expect(Object.keys(documented)).toHaveLength(13);
  expect(documented).toEqual(aliases);
  expect(env.PS_ENV_ALIASES).toEqual(documented);
});

it("the env module imports without fs, os or paths discovery", () => {
  for (const id of poisoned) jest.doMock(id, () => { throw new Error("Owned forbidden env I/O import"); });
  jest.isolateModules(() => { loadEnv(); });
});

it("paths preserves the exact readEnv export identity without moving directory contracts", () => {
  // Only this paths import gets owned filesystem answers; env purity is tested separately.
  jest.doMock("fs", () => ({ existsSync: () => false, statSync: () => { throw new Error("Owned unused stat"); } }));
  jest.doMock("os", () => ({ homedir: () => "/owned-home" }));
  jest.isolateModules(() => {
    const env = loadEnv();
    const paths = require("@/lib/host/paths") as typeof import("@/lib/host/paths");
    expect(paths.readEnv).toBe(env.readEnv);
  });
});

it.each(callers)("$key caller connects to raw alias ownership and retains its original parser/default", entry => {
  const file = ts.createSourceFile(entry.path, fs.readFileSync(resolve(root, entry.path), "utf8"), ts.ScriptTarget.Latest, true);
  const imports = file.statements.filter(ts.isImportDeclaration).filter(statement => ts.isStringLiteral(statement.moduleSpecifier)
    && ["@/lib/config/env", "./src/lib/config/env"].includes(statement.moduleSpecifier.text));
  const binding = imports.flatMap(statement => statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
    ? statement.importClause.namedBindings.elements.filter(item => (item.propertyName ?? item.name).text === "readAliasedEnv") : [])[0]?.name.text;
  expect(binding).toBeDefined();
  const declarations = nodes(file).filter(ts.isVariableDeclaration).filter(node => ts.isIdentifier(node.name) && node.name.text === entry.variable);
  expect(declarations).toHaveLength(1);
  const initializer = declarations[0].initializer!;
  const calls = nodes(initializer).filter(ts.isCallExpression).filter(call => ts.isIdentifier(call.expression) && call.expression.text === binding);
  expect(calls).toHaveLength(1);
  expect(calls[0].arguments).toHaveLength(1);
  expect(ts.isStringLiteral(calls[0].arguments[0]) && calls[0].arguments[0].text).toBe(entry.key);
  const raw = ts.createSourceFile("raw.ts", "process.env." + entry.key + " || process.env." + entry.alias, ts.ScriptTarget.Latest, true);
  const selection = (raw.statements[0] as ts.ExpressionStatement).expression;
  const digest = createHash("sha256").update(JSON.stringify(shape(initializer, { call: calls[0], raw: selection }))).digest("hex");
  expect(digest).toBe(entry.heldInitializerSha256);
});
