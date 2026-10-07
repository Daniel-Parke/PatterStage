/** @jest-environment node */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const root = resolve(__dirname, "../..");
const helper = join(root, "src/lib/logs/server-log.ts");
const tags = ["auth", "config", "paths", "deep-research", "chat", "scheduler", "seed", "sessions", "db", "composer"] as const;
const levels = ["log", "info", "warn", "error"] as const;
type Logger = (tag: string, level: typeof levels[number], message: string, ...details: unknown[]) => void;
function logger(): Logger {
  if (!existsSync(helper)) throw new Error("MISSING CONTRACT: closed server logger");
  return (jest.requireActual(helper) as { serverLog: Logger }).serverLog;
}
afterEach(() => jest.restoreAllMocks());

it.each(tags.flatMap(tag => levels.map(level => [tag, level] as const)))("%s preserves %s stream, message and extra arguments", (tag, level) => {
  const log = logger();
  const spies = levels.map(name => jest.spyOn(console, name).mockImplementation(() => undefined));
  const detail = new Error("existing-error-object");
  log(tag, level, "unchanged message", detail, 7);
  expect(console[level]).toHaveBeenCalledWith(`[${tag}] unchanged message`, detail, 7);
  expect(spies.map(spy => spy.mock.calls.length)).toEqual(levels.map(name => name === level ? 1 : 0));
});

it("the logger type rejects an unregistered subsystem tag", () => {
  logger();
  const scratch = join(root, "tmp"), directory = mkdtempSync(join(scratch, "t0192-log-types-"));
  try {
    const file = join(directory, "probe.ts");
    writeFileSync(file, `import {serverLog} from '../../src/lib/logs/server-log';\nserverLog('unregistered', 'warn', 'body');\nserverLog('auth', 'info', 'body');\n`);
    const program = ts.createProgram([file], { strict: true, noEmit: true, skipLibCheck: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map(entry => entry.code)).toEqual([2345]);
    expect(ts.flattenDiagnosticMessageText(diagnostics[0].messageText, "\n")).toContain("unregistered");
  } finally {
    if (dirname(resolve(directory)) !== scratch) throw new Error("Unsafe fixture cleanup");
    rmSync(directory, { recursive: true, force: true });
  }
});
