/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareKnipIssues, issueKeys } from "../../scripts/tooling/knip-ratchet.mjs";

const ROOT = join(__dirname, "..", "..");

it("the Knip gate compares its expanded scan with an exact committed issue register", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  expect(pkg.scripts["lint:knip"]).toBe("node scripts/tooling/knip-ratchet.mjs");
});

const baseline = { issues: [{ kind: "exports", file: "tests/helpers/example.ts", name: "oldHelper", reason: "Retained until the release-gated cleanup" }] };
const report = (names: string[]) => ({ issues: [{ file: "tests/helpers/example.ts", owners: [], exports: names.map((name) => ({ name })), files: [], types: [] }] });

it("rejects a newly unused export even when the total is unchanged", () => {
  const result = compareKnipIssues(report(["newHelper"]), baseline);
  expect(result.newIssues).toEqual(["exports\ttests/helpers/example.ts\tnewHelper"]);
  expect(result.resolvedIssues).toEqual(["exports\ttests/helpers/example.ts\toldHelper"]);
});

it("requires a smaller committed baseline when an issue is resolved", () => {
  expect(compareKnipIssues(report([]), baseline).resolvedIssues).toHaveLength(1);
});

it("rejects malformed or duplicate scanner evidence", () => {
  expect(() => issueKeys({ issues: [] })).not.toThrow();
  expect(() => issueKeys({ issues: [{ file: "x.ts", owners: [], exports: [{ name: "x" }, { name: "x" }] }] })).toThrow(/duplicate/);
  expect(() => issueKeys({ issues: [{ file: "x.ts", owners: [], exports: [{ line: 1 }] }] })).toThrow(/unnamed/);
  expect(() => issueKeys({})).toThrow(/issues array/);
});
