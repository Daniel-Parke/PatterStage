/** @jest-environment node */
import { execFileSync } from "node:child_process";

// Execute ESLint's real ESM configuration outside Jest's VM. No fixture code executes.
const paths = [
  ["tests/unit/owned-require-policy.ts", true],
  ["tests/unit/owned-require-policy.tsx", true],
  ["tests/helpers/owned-require-policy.ts", true],
  ["jest.config.js", true],
  ["src/lib/owned-require-policy.ts", false],
  ["src/components/owned-require-policy.tsx", false],
  ["scripts/tooling/owned-require-policy.ts", false],
  ["tests/unit/owned-require-policy.js", false],
  ["jest.other.js", false],
] as const;
type Observation = { file: string; severity: number; ruleErrors: number; fatal: boolean; ignored: boolean };
let observations: Observation[];
beforeAll(() => {
  const program = `
    import { ESLint } from 'eslint';
    const eslint = new ESLint({ cwd: process.cwd(), allowInlineConfig: false });
    const paths = ${JSON.stringify(paths.map(([file]) => file))};
    const rows = [];
    for (const file of paths) {
      const config = await eslint.calculateConfigForFile(file);
      const [result] = await eslint.lintText('const ownedModule = require("node:path");\\nvoid ownedModule;\\n', { filePath: file });
      const setting = config?.rules?.['@typescript-eslint/no-require-imports'];
      const level = Array.isArray(setting) ? setting[0] : setting;
      rows.push({ file, severity: level === 'off' ? 0 : level === 'warn' ? 1 : level === 'error' ? 2 : level,
        ruleErrors: result.messages.filter(message => message.ruleId === '@typescript-eslint/no-require-imports' && message.severity === 2).length,
        fatal: result.messages.some(message => message.fatal), ignored: await eslint.isPathIgnored(file) });
    }
    process.stdout.write(JSON.stringify(rows));
  `;
  observations = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", program], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60_000, windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0" },
  }));
}, 65_000);

it.each(paths)("resolved policy and actual lint enforce the exact CommonJS scope for %s (allowed=%s)", (file, allowed) => {
  const row = observations.find(item => item.file === file);
  expect(row).toBeDefined();
  expect(row!.ignored).toBe(false);
  expect(row!.fatal).toBe(false);
  expect(row!.severity).toBe(allowed ? 0 : 2);
  expect(row!.ruleErrors).toBe(allowed ? 0 : 1);
});
