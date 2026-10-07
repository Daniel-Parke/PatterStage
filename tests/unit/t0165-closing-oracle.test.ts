/** @jest-environment node */
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = join(__dirname, "..", "..");
const script = join(root, "scripts", "tooling", "refactor-closing-oracle.mjs");

describe("the Phase 2 closing oracle", () => {
  it("reports each target row independently, including the measured delta", () => {
    const moduleUrl = pathToFileURL(script).href;
    const expression = `import { evaluate } from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(evaluate([{key:'source',baseline:100,target:80},{key:'tests',baseline:50,target:45}],{source:90,tests:44})));`;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", expression], { cwd: root, encoding: "utf8" });
    expect(JSON.parse(output)).toEqual([
      { key: "source", baseline: 100, target: 80, final: 90, delta: -10, passed: false },
      { key: "tests", baseline: 50, target: 45, final: 44, delta: -6, passed: true },
    ]);
  });

  it("does not accept a caller-supplied baseline or selection", () => {
    const result = spawnSync(process.execPath, [script, "--baseline", "forged.json"], {
      cwd: root, encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/no selectors or baseline overrides/);
  });

  it("requires a final reason and evidence for every finding, split ruling and atomic proof", () => {
    const moduleUrl = pathToFileURL(script).href;
    const expression = `import { auditDispositions } from ${JSON.stringify(moduleUrl)}; const expected={findings:['f1'],operatorDispositions:['f1a'],coverage:['g1']}; const rows={findings:[{id:'f1',status:'done',reason:'A measured source fix',evidence:'test:1',owner:'T-1'}],operatorDispositions:[{id:'f1a',status:'ruled-out',reason:'Operator keeps route',evidence:'Q-1:2',owner:'operator'}],coverage:[{id:'g1',status:'deferred',reason:'Needs real install',evidence:'ledger:3',owner:'operator'}]}; const good=auditDispositions(expected,rows); rows.coverage=[]; let bad=''; try{auditDispositions(expected,rows)}catch(error){bad=error.message}; process.stdout.write(JSON.stringify({good,bad}));`;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", expression], { cwd: root, encoding: "utf8" });
    const result = JSON.parse(output) as { good: Record<string, number>; bad: string };
    expect(result.good).toEqual({ findings: 1, operatorDispositions: 1, coverage: 1 });
    expect(result.bad).toMatch(/coverage.*g1/i);
  });
});
