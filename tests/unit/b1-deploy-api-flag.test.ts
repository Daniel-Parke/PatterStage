/** @jest-environment node */
/**
 * B1 (T-0095), D53 and D105: the deploy API on a fresh solo install.
 *
 * `isDeployApiEnabled()` falls back to `NODE_ENV !== "production"`, and neither
 * setup script wrote the variable, so every production install started with
 * the deploy buttons painted enabled and answering 403. Decision 17: setup
 * writes PS_ENABLE_DEPLOY_API=true (matching .env.example), one line turns it
 * off, and the product says which it is BEFORE the click, so GET /api/update
 * carries `deployEnabled` and the footer reads it on mount.
 *
 * The function is exported once and read by boot-diagnostics, which used to
 * carry its own copy of the rule.
 */
import { readFileSync } from "fs";
import { join } from "path";

jest.mock("@/lib/update-handlers/deploy-actions", () => ({
  handleRestartAction: jest.fn(),
  handleRebuildAction: jest.fn(),
  handleUpdateAction: jest.fn(),
}));
jest.mock("@/lib/update-handlers/remote-branches", () => ({ listRemoteBranches: () => ["dev"] }));
jest.mock("@/lib/update-handlers/shared", () => ({ UPDATE_BRANCH: "dev" }));
jest.mock("@/lib/update-handlers/version-check", () => ({
  checkVersion: () => ({
    localHash: "abc1234",
    remoteHash: "abc1234",
    updateAvailable: false,
    commitMessage: "",
    commitDate: "",
    behind: 0,
    comparedBranch: "dev",
    checkoutBranch: "dev",
    lastChecked: "2026-09-05T00:00:00Z",
    checkFailed: false,
  }),
}));
jest.mock("@/lib/deploy-status", () => ({
  isDeployInProgress: () => false,
  readDeployStatus: () => ({ state: "idle", action: "", phase: "", message: "Ready", startedAt: "", finishedAt: "", exitCode: "", logHint: "" }),
  tailLogHint: () => [],
}));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({
  ...jest.requireActual("@/lib/api-auth"),
  requireSignedRequest: () => null,
}));

import { NextRequest } from "next/server";

const ROOT = join(__dirname, "..", "..");
const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("isDeployApiEnabled is one exported function", () => {
  it("reads the variable, and boot-diagnostics agrees with it", async () => {
    const auth = await import("@/lib/api-auth");
    const { describeOperationalFlags } = await import("@/lib/boot-diagnostics");
    expect(typeof auth.isDeployApiEnabled).toBe("function");

    process.env.PS_ENABLE_DEPLOY_API = "false";
    expect(auth.isDeployApiEnabled()).toBe(false);
    expect(describeOperationalFlags()).toContain("deploy-api=off");

    process.env.PS_ENABLE_DEPLOY_API = "true";
    expect(auth.isDeployApiEnabled()).toBe(true);
    expect(describeOperationalFlags()).toContain("deploy-api=on");
  });

  it("boot-diagnostics no longer carries its own copy of the rule", () => {
    const src = readFileSync(join(ROOT, "src", "lib", "boot-diagnostics.ts"), "utf-8");
    expect(src).toMatch(/isDeployApiEnabled/);
    expect(src).not.toMatch(/NODE_ENV !== "production"/);
  });
});

describe("GET /api/update says whether the deploy API is on", () => {
  it("on the version answer", async () => {
    process.env.PS_ENABLE_DEPLOY_API = "false";
    const { GET } = await import("@/app/api/update/route");
    const res = await GET(new NextRequest("http://localhost/api/update?branch=dev"));
    const body = (await res.json()) as { data: { deployEnabled?: boolean } };
    expect(body.data.deployEnabled).toBe(false);
  });

  it("on the deploy-status answer, which is the one the footer reads on mount", async () => {
    process.env.PS_ENABLE_DEPLOY_API = "true";
    const { GET } = await import("@/app/api/update/route");
    const res = await GET(new NextRequest("http://localhost/api/update?deploy=1"));
    const body = (await res.json()) as { data: { deployEnabled?: boolean; deploy?: { state: string } } };
    expect(body.data.deployEnabled).toBe(true);
    expect(body.data.deploy?.state).toBe("idle");
  });
});

describe("setup turns the deploy API on for a fresh install, without overriding a choice", () => {
  it("env-local.mjs can set a variable only when it is absent", async () => {
    const { mkdtempSync, readFileSync: read, writeFileSync } = await import("fs");
    const { tmpdir } = await import("os");
    const dir = mkdtempSync(join(tmpdir(), "ps-envlocal-"));
    const file = join(dir, ".env.local");
    // Relative, like tests/unit/design-lint-baseline-ratchet.test.ts imports its .mjs.
    const mod = (await import("../../scripts/bootstrap/env-local.mjs")) as unknown as {
      setEnvVarIfAbsent: (file: string, key: string, val: string) => boolean;
    };

    writeFileSync(file, "PORT=3000\nPS_ENABLE_DEPLOY_API=false\n");
    expect(mod.setEnvVarIfAbsent(file, "PS_ENABLE_DEPLOY_API", "true")).toBe(false);
    expect(read(file, "utf-8")).toContain("PS_ENABLE_DEPLOY_API=false");
    expect(read(file, "utf-8")).not.toContain("PS_ENABLE_DEPLOY_API=true");

    writeFileSync(file, "PORT=3000\n");
    expect(mod.setEnvVarIfAbsent(file, "PS_ENABLE_DEPLOY_API", "true")).toBe(true);
    expect(read(file, "utf-8")).toContain("PS_ENABLE_DEPLOY_API=true");
    expect(read(file, "utf-8")).toContain("PORT=3000");
  });

  it("both setup scripts write it that way", () => {
    const sh = readFileSync(join(ROOT, "scripts", "bootstrap", "setup.sh"), "utf-8");
    expect(sh).toMatch(/ps_env_set_if_absent "\$ENV_LOCAL" "PS_ENABLE_DEPLOY_API" "true"/);
    const mjs = readFileSync(join(ROOT, "scripts", "bootstrap", "setup.mjs"), "utf-8");
    expect(mjs).toMatch(/IfAbsent\("PS_ENABLE_DEPLOY_API", "true"\)/);
  });

  it(".env.example still documents the default as on", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf-8");
    expect(example).toMatch(/^PS_ENABLE_DEPLOY_API=true$/m);
  });
});
