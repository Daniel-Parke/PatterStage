/** @jest-environment node */

// T0194 independent Faraday oracle, 2026-10-04. lib-domains-05a permits only
// the eleven traced internal helpers to retire; containing modules stay live.
import fs from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(__dirname, "../..");
const eligible = [
  ["buildDisabledYamlLines", "src/modules/hermes/lib/skills-config.ts", ["parseSkillsDisabledFromYaml"]],
  ["mergeAdvancedOverrides", "src/modules/hermes/lib/toolset-unify.ts", ["unionToolsetsFromPlatforms"]],
  ["getModule", "src/lib/modules/registry.ts", ["MODULES", "MODULE_ACCENTS"]],
  ["extractAnswerSpan", "src/lib/models/llm-output.ts", ["stripReasoning"]],
  ["formatLocalDirEntryLine", "src/lib/fs/local-dir-entry.ts", ["normalizeLocalDirsInput"]],
  ["getConversationWithMessages", "src/lib/chat/chat-repository.ts", ["getConversation", "getMessages"]],
  ["isMac", "src/lib/host/platform.ts", ["isWindows", "tmpDir"]],
  ["isLinux", "src/lib/host/platform.ts", ["isWindows", "tmpDir"]],
  ["homeDir", "src/lib/host/platform.ts", ["isWindows", "tmpDir"]],
  ["HARDWARE_CRON_PRESET_SCRIPT_FILES", "src/lib/host/hardware-cron.ts", ["HARDWARE_CRON_UI_PRESETS"]],
  ["truncate", "src/lib/utils.ts", ["messageSummary", "timeAgo"]],
] as const;

function declarations(path: string): string[] {
  const absolute = resolve(root, path);
  expect(fs.existsSync(absolute)).toBe(true);
  const source = ts.createSourceFile(path, fs.readFileSync(absolute, "utf8"), ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  function binding(name: ts.BindingName) {
    if (ts.isIdentifier(name)) names.push(name.text);
    else for (const element of name.elements) if (ts.isBindingElement(element)) binding(element.name);
  }
  for (const node of source.statements) {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) binding(declaration.name);
    else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) names.push(node.name.text);
    else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const exported of node.exportClause.elements) names.push(exported.name.text, (exported.propertyName ?? exported.name).text);
    }
  }
  expect(names.length).toBeGreaterThan(0);
  return names;
}

describe("T0194 eligible internal export retirement", () => {
  it.each(eligible)("removes %s while retaining its live module", (name, path, retained) => {
    const names = declarations(path);
    for (const live of retained) expect(names).toContain(live);
    expect(names).not.toContain(name);
  });
});
