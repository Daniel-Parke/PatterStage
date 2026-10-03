/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";

type WorkflowStep = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type Workflow = {
  permissions?: Record<string, string>;
  jobs?: {
    scan?: {
      permissions?: Record<string, string>;
      steps?: WorkflowStep[];
    };
  };
};

const workflowPath = join(__dirname, "..", "..", ".github", "workflows", "gitleaks.yml");
const workflow = load(readFileSync(workflowPath, "utf8")) as Workflow;
const scanJob = workflow.jobs?.scan;
const steps = scanJob?.steps ?? [];

describe("T-0180 hosted secret-scan workflow amendment", () => {
  it("runs both hosted scans before checked-out canary code", () => {
    const cliIndex = steps.findIndex((step) => step.run?.includes("ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:"));
    const actionIndex = steps.findIndex((step) => step.uses?.startsWith("gitleaks/gitleaks-action@"));
    const canaryIndex = steps.findIndex((step) => step.run?.includes("node tests/security/secret-scan-canary.mjs"));

    expect(cliIndex).toBeGreaterThanOrEqual(0);
    expect(actionIndex).toBeGreaterThanOrEqual(0);
    expect(canaryIndex).toBeGreaterThanOrEqual(0);
    expect(cliIndex).toBeLessThan(canaryIndex);
    expect(actionIndex).toBeLessThan(canaryIndex);
  });

  it("keeps the hosted CLI on its default full-history Git traversal", () => {
    const cliScan = steps.find((step) => step.run?.includes("ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:"))?.run;

    expect(cliScan).toMatch(/\bgit \.\s/);
    expect(cliScan).not.toContain("--log-opts");
  });

  it("does not persist checkout credentials for the canary", () => {
    const checkout = steps.find((step) => step.uses?.startsWith("actions/checkout@"));

    expect(checkout).toBeDefined();
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });

  it("limits the scan job token to repository read and optional PR feedback", () => {
    const permissions = scanJob?.permissions ?? workflow.permissions;

    expect(permissions).toBeDefined();
    expect(permissions?.contents).toBe("read");
    expect(Object.keys(permissions ?? {}).every((scope) => scope === "contents" || scope === "pull-requests")).toBe(true);
  });
});
