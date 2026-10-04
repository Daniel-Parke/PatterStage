/** @jest-environment node */
// Source-informed metamorphic oracle: pinned TypeScript emission, not SWC/browser behaviour.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import ts from "typescript";
const root = resolve(__dirname, "../..");
const compilerVersion = "5.9.3";
const emitOptions: ts.CompilerOptions = {"target":4,"module":99,"jsx":4,"removeComments":true,"sourceMap":false,"inlineSourceMap":false,"isolatedModules":true};
const baseline = [
  {"file":"src/components/missions/templates/types.ts","source":"a48f55a47d74f68924b62dbc5f2666574971d3df8fb126d6764bfd2003cb2773","emitted":"8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"},
  {"file":"src/lib/missions/mission-types.ts","source":"bc9a41990596f5c6db2a26e7afbd007f704c7a027d458190fb407ea9e413d943","emitted":"8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"},
  {"file":"src/components/missions/CategoryManagerModal.tsx","source":"cec89b8e3c5a8ed239da95de42f2b875ef4b882349c9b5f62941727d7423a910","emitted":"ec5e40a2f5c9dc93b153d88528d439c37688eb5458b8fd38ffb4ba3a96dc00dd"},
  {"file":"src/components/models/types.ts","source":"02bba80cc46be8c0f487d16ee24344d36704cbd2443a61d56973dc3fa2a6a5a7","emitted":"968701d2e982607ddf4ec14e0741cdf239578bec27f08913f8d61ffebdcd470f"},
  {"file":"src/lib/models/model-types.ts","source":"069e0714efd0cfdb8ee4b0d8f05241c504ab35550e7405fc208c0f235e3ff179","emitted":"8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"},
  {"file":"src/components/viz/DistributionHistogram.tsx","source":"151c7ca650dfca3f4dace4c6c2890ee798fdc4138cfb810d4930410d2c77cd9a","emitted":"603d0fc4f812db6b7502b700f635202695536d1c7468c4afe6672a9d54cbcbd8"},
  {"file":"src/types/console.ts","source":"7feeaf3122d9e6d6f717b39e81f07c5783d8e1abe69b44aa1c3c506d7f67a33e","emitted":"8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"},
  {"file":"src/components/viz/StackedAreaTrend.tsx","source":"fc9c4b29320e62fca2ec1f5a75a76754d1187252d7de336e26cd7cafe830d1df","emitted":"94d001ef431c961e806491ad26e2c12433665311b11f7ee8cb29e00ad663d5ce"},
  {"file":"src/components/viz/AreaTrend.tsx","source":"95e1a1907991e79c67cff188b46ed3ae5d2efa4de24bf4b388e9ba53a7ccfb69","emitted":"c5eaefa2ebab4b037e6fc5d2887f8719f465e327987d45a3170a2202de65e2db"},
  {"file":"src/components/viz/colors.ts","source":"d7ef2f43ecfb93be26ffd604df85c63750a6992eb91f5a6630058b015de8ab05","emitted":"3fe7b7ad0ff81740a36fb4fd8a3fda90429c394c2923ebca4cca5ec05f24d224"},
  {"file":"src/components/ui/Toast.tsx","source":"45c799ec4d667610588e46f59e35e8fdd4f22fa27c11dcaf69a160b7fcc10bb4","emitted":"91a6914edeee5e1c3c0ae9d57be14816852c0e593c655f2601a98fb33d6e2900"},
  {"file":"src/components/ui/feedback-context.ts","source":"f7211afd7c408c60848b07b318227453587bce0b0015cb0be234d4e443974343","emitted":"d8907d6e0ef0b990d75f8b36da3233d0a25174b8f7bafef5a315400596cc78c2"},
  {"file":"src/lib/analytics/categories.ts","source":"fb8bf39d8042e36c7e1f3b43ceb6cf656d4317463573bcf422ce56bed9d4dde0","emitted":"9f657a01d3977c509e08376d88b605bff9a6fbda7c34cd727590a0b301a49ace"},
  {"file":"src/lib/analytics/insights-bundle.ts","source":"bf4a677d06c57bc00e2a77792a69e8696405cffc9a6a5208673d37d6d73f38c2","emitted":"888d47616d91af15ca494217e0bcb97c294e3620cb9e24c946076b42208c78b0"},
  {"file":"src/lib/analytics/run-aggregates.ts","source":"64408a9edb889a9f2c609eb371a6744a899fc8423cb8d6e956ab8d9b03b3ccd8","emitted":"9fe73d8788cc2f1c7a2338de11f4523dd752803b8bbb851c0c9b9a42bf29d315"},
  {"file":"src/lib/api/api-write.ts","source":"dac364841da95424db92a539afab66a881ac355cbbccafde6a0dbd12c1206988","emitted":"5f0eaa9a22ff9c50772e72914252f219483c485158acc99aa9eec8b572f63328"},
  {"file":"src/lib/memory/hindsight-client.ts","source":"c8fd310570a417e9cca46d017c171072748b83cd94b6cdc0d14b64aaba2e1840","emitted":"aee86e1ef06367e33ffe01ef09c60c1bc9c6e9da9fb9bcdbe2dd91a6075f110b"},
  {"file":"src/lib/missions/mission-composer-utils.ts","source":"156f55aacb02d59e5580abc931e7f7a43bb553205790fd10664890b82997741c","emitted":"d504430dce323b3c69e3672bef3ab901f51205b20a7ca53aee733d066068ba65"},
  {"file":"src/lib/missions/mission-filters.ts","source":"a72f50db7241a499fdc5653b9f665ddee220f0b384eee2bd87b7380f992c113b","emitted":"ea5ed7e0f5c11751eb8076bad9fd876c613e8aee414f8a6ec927ef18abf01fe0"},
  {"file":"src/lib/missions/mission-form-utils.ts","source":"13d73b3c5fca6f6c819df459dcd7b4f09476218db7c923ba0ced2ec73bb6fff1","emitted":"c09708c6ed1c1a7a806312412560907486654c23adf356cb8922762ccb0d64a5"},
  {"file":"src/modules/hermes/lib/sync-manager.ts","source":"a9c692a03da7aba7035ec65303e2806ff23e682e1728cc9e3d7e0fc4c85dd1fa","emitted":"59c3660bc3a74920cda1aed15574d7a467011bef63ed916e726ba5a4c05d8719"},
];
const contracts = [
  ["MissionTemplate","src/components/missions/templates/types.ts","src/lib/missions/mission-types.ts","src/components/missions/TemplateModals.tsx"],
  ["ManagedCategory","src/components/missions/CategoryManagerModal.tsx","src/lib/missions/mission-types.ts"],
  ["DriftLine","src/components/models/types.ts","src/lib/models/model-types.ts"],
  ["SyncDrift","src/components/models/types.ts","src/lib/models/model-types.ts"],
  ["HistogramBin","src/components/viz/DistributionHistogram.tsx","src/types/console.ts"],
  ["StackedPoint","src/components/viz/StackedAreaTrend.tsx","src/types/console.ts"],
  ["StackedSeries","src/components/viz/StackedAreaTrend.tsx","src/types/console.ts"],
  ["AreaPoint","src/components/viz/AreaTrend.tsx","src/types/console.ts"],
  ["NeonColor","src/components/viz/colors.ts","src/types/console.ts"],
  ["ToastType","src/components/ui/Toast.tsx","src/types/console.ts"],
  ["FeedbackContextValue","src/components/ui/feedback-context.ts","src/types/console.ts"],
];
const consumers = [
  "src/lib/analytics/categories.ts",
  "src/lib/analytics/insights-bundle.ts",
  "src/lib/analytics/run-aggregates.ts",
  "src/lib/api/api-write.ts",
  "src/lib/memory/hindsight-client.ts",
  "src/lib/missions/mission-composer-utils.ts",
  "src/lib/missions/mission-filters.ts",
  "src/lib/missions/mission-form-utils.ts",
  "src/modules/hermes/lib/sync-manager.ts"
];
const expected = `
export interface LocalDirEntry {
    path: string;
    branch: string | null;
}
export interface MissionTemplate {
    id: string;
    name: string;
    icon: string;
    color: string;
    category: string;
    profile: string;
    description: string;
    instruction: string;
    context: string;
    goals: string[];
    suggestedSkills: string[];
    suggestedToolsets?: string[];
    localDirs?: LocalDirEntry[];
    references?: string[];
    isCustom?: boolean;
    dispatchMode?: string;
    schedule?: string;
    defaultModel?: string;
    defaultProvider?: string;
    timeoutMinutes?: number;
    outputFormat?: string;
    constraints?: string;
}
export interface ManagedCategory {
    id: string;
    name: string;
    color: string;
    seedKey?: string | null;
    missionCount: number;
    templateCount: number;
}
export interface DriftLine {
    kind: "primary" | "hermes-only" | "db-only";
    text: string;
    provider: string;
    modelId: string;
    registryId: string | null;
}
export interface SyncDrift {
    hasDrift: boolean;
    driftDetails: string[];
    lines?: DriftLine[];
}
export interface HistogramBin {
    label: string;
    value: number;
}
export interface StackedPoint {
    date: string;
    values: Record<string, number>;
}
export interface StackedSeries {
    key: string;
    label: string;
    color: NeonColor;
}
export interface AreaPoint {
    date: string;
    completed: number;
    failed?: number;
}
export type NeonColor = "cyan" | "purple" | "pink" | "green" | "orange" | "yellow";
export type ToastType = "success" | "error" | "info";
export interface FeedbackContextValue {
    showToast: (message: string, type?: ToastType) => void | (() => void);
}`;

function read(file: string): string { return readFileSync(resolve(root, file), "utf8"); }
function emittedHash(file: string, source = read(file)): string {
  const result = ts.transpileModule(source, { fileName: file, compilerOptions: emitOptions, reportDiagnostics: true });
  expect(result.diagnostics).toEqual([]);
  return createHash("sha256").update(result.outputText).digest("hex");
}
const moduleName = (file: string) => "@/" + file.slice(4).replace(/\.tsx?$/, "");
function shapeDiagnostics(canonical: boolean, reference = expected): ts.Diagnostic[] {
  const probe = resolve(root, "tests/type-owner-virtual.ts");
  const checks = contracts.flatMap(([name, old, owner, barrel]) =>
    (canonical ? [owner] : [old, ...(barrel ? [barrel] : [])]).map(file =>
      'type Check' + name + file.replace(/[^a-zA-Z]/g, "") + ' = Assert<Equal<import("' + moduleName(file) + '").' + name + ', Expected.' + name + '>>;'));
  const source = 'export {}; namespace Expected {\n' + reference + '\n}\n' +
    'type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false) : false;\n' +
    'type Assert<T extends true> = T;\n' + checks.join("\n");
  const options: ts.CompilerOptions = { ...emitOptions, strict: true, noEmit: true, skipLibCheck: true,
    esModuleInterop: true, moduleResolution: ts.ModuleResolutionKind.Bundler, types: [], paths: { "@/*": [resolve(root, "src/*")] } };
  const host = ts.createCompilerHost(options), originalRead = host.readFile, originalExists = host.fileExists;
  host.readFile = file => resolve(file) === probe ? source : originalRead(file);
  host.fileExists = file => resolve(file) === probe || originalExists(file);
  const program = ts.createProgram([probe], options, host), entry = program.getSourceFile(probe)!;
  return [...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics(entry), ...program.getSemanticDiagnostics(entry)];
}
const messages = (diagnostics: readonly ts.Diagnostic[]) => diagnostics.map(d => ({ code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") }));
it("pins the compiler used for the frozen emission baseline", () => { expect(ts.version).toBe(compilerVersion); });
it.each(baseline)("preserves TypeScript-emitted JavaScript for $file", ({ file, emitted }) => {
  expect(emittedHash(file)).toBe(emitted);
});
it("preserves all historical public type shapes including the template barrel", () => {
  expect(messages(shapeDiagnostics(false))).toEqual([]);
});
it("exposes the unchanged public shapes from the agreed canonical owners", () => {
  expect(messages(shapeDiagnostics(true))).toEqual([]);
});
it("defines the eleven contracts in their canonical owners rather than re-exporting UI definitions", () => {
  const missing = contracts.filter(([name, , owner]) => {
    const source = ts.createSourceFile(owner, read(owner), ts.ScriptTarget.Latest, true);
    return !source.statements.some(node => (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === name && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  }).map(([name, , owner]) => ({ name, owner }));
  expect(missing).toEqual([]);
  for (const owner of new Set(contracts.map(row => row[2]))) expect(upwardDependencies(owner)).toEqual([]);
});
function upwardDependencies(file: string): string[] {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  const upward: string[] = [];
  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const target = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(root, file, "..", specifier);
      if (target.startsWith(resolve(root, "src/components") + sep)) upward.push(specifier);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal) && node.argument.literal.text.startsWith("@/components/")) upward.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return upward;
}
it.each(consumers)("removes component-owned type dependencies from %s", file => {
  expect(upwardDependencies(file)).toEqual([]);
});
it.each([
  ["a required-field change", () => expected.replace("id: string;", "id?: string;")],
  ["loss of the toast cleanup return", () => expected.replace("void | (() => void)", "void")],
] as const)("detects %s in the in-memory public contract", (_name, mutate) => {
  const changed = mutate();
  expect(changed).not.toBe(expected);
  const failures = shapeDiagnostics(false, changed);
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.every(d => d.code === 2344)).toBe(true);
});
it("detects an executable-statement change without executing application code", () => {
  const entry = baseline.find(row => row.file === "src/components/viz/colors.ts")!;
  expect(emittedHash(entry.file, read(entry.file) + '\nthrow new Error("oracle-only executable control");\n')).not.toBe(entry.emitted);
});
