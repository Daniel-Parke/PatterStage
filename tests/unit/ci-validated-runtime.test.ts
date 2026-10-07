/** @jest-environment node */
import { readFileSync } from "node:fs";
import { load } from "js-yaml";

type Step = { uses?: string; with?: { "node-version"?: string } };
type Workflow = { jobs: Record<string, { steps?: Step[] }> };

test("CI uses the independently validated Node 24.21.0 in every existing Node setup", () => {
  const workflow = load(readFileSync(".github/workflows/ci.yml", "utf8")) as Workflow;
  const setups = Object.values(workflow.jobs).flatMap(job =>
    (job.steps ?? []).filter(step => step.uses?.startsWith("actions/setup-node@")),
  );
  expect(setups).toHaveLength(6);
  expect(setups.map(step => step.with?.["node-version"])).toEqual(Array(6).fill("24.21.0"));
});
