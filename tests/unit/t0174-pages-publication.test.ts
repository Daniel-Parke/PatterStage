/** @jest-environment node */

// T-0174 acceptance oracle. Authored before the Pages v5 workflow and guard.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";

const ROOT = join(__dirname, "..", "..");
const WORKFLOW = join(ROOT, ".github", "workflows", "docs-pages.yml");
const GUARD = join(ROOT, "scripts", "docs", "check-publish-artifact.mjs");
const CANARY = "T0174_PRIVATE_FIXTURE_CONTENT_DO_NOT_PRINT";

type Mapping = Record<string, unknown>;

function mapping(value: unknown): Mapping {
  expect(value).toBeTruthy();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Mapping;
}

function workflow(): Mapping {
  return mapping(yaml.load(readFileSync(WORKFLOW, "utf8")));
}

function deployJob(): Mapping {
  return mapping(mapping(workflow().jobs)["build-deploy"]);
}

function steps(): Mapping[] {
  const value = deployJob().steps;
  expect(Array.isArray(value)).toBe(true);
  return (value as unknown[]).map(mapping);
}

function actionStep(name: string): { index: number; step: Mapping } {
  const matches = steps().flatMap((step, index) =>
    typeof step.uses === "string" && step.uses.startsWith(`${name}@`) ? [{ index, step }] : [],
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

function commandStep(command: string): number {
  const matches = steps().flatMap((step, index) => {
    if (typeof step.run !== "string") return [];
    const commands = step.run.split(/\r?\n/).map((line) => line.trim());
    return commands.includes(command) ? [index] : [];
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe("T-0174 Pages workflow", () => {
  it("keeps main push and manual triggers, publication permissions, and the project base", () => {
    const parsed = workflow();
    const triggers = mapping(parsed.on);
    expect(Object.keys(triggers).sort()).toEqual(["push", "workflow_dispatch"]);
    expect(mapping(triggers.push).branches).toEqual(["main"]);
    expect(parsed.permissions).toEqual({ contents: "read", pages: "write", "id-token": "write" });
    expect(commandStep("npm run docs:build -- --base /PatterStage/")).toBeGreaterThan(
      commandStep("npm run docs:check"),
    );
  });

  it("uploads with Pages v5 and explicitly includes .nojekyll", () => {
    const upload = actionStep("actions/upload-pages-artifact");
    expect(upload.step.uses).toBe("actions/upload-pages-artifact@v5");
    expect(mapping(upload.step.with).path).toBe("site");
    expect(mapping(upload.step.with)["include-hidden-files"]).toBe(true);
  });

  it("deploys the uploaded artifact with Pages v5", () => {
    const upload = actionStep("actions/upload-pages-artifact");
    const deploy = actionStep("actions/deploy-pages");
    expect(deploy.step.uses).toBe("actions/deploy-pages@v5");
    expect(deploy.index).toBeGreaterThan(upload.index);
  });

  it("checks the built site before the hidden-inclusive upload", () => {
    const build = commandStep("npm run docs:build -- --base /PatterStage/");
    const guard = commandStep("node scripts/docs/check-publish-artifact.mjs site");
    const upload = actionStep("actions/upload-pages-artifact").index;
    expect(guard).toBeGreaterThan(build);
    expect(guard).toBeLessThan(upload);
  });

  it("limits the deploy job to the main ref even on manual dispatch", () => {
    const condition = deployJob().if;
    expect(typeof condition).toBe("string");
    const expression = (condition as string).trim().replace(/^\$\{\{\s*/, "").replace(/\s*\}\}$/, "");
    expect(expression).toMatch(/^github\.ref\s*==\s*['"]refs\/heads\/main['"]$/);
  });
});

describe("T-0174 publication guard CLI", () => {
  let fixture: string;
  let site: string;

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), "ps-t0174-pages-"));
    site = join(fixture, "site");
    mkdirSync(site);
    writeFileSync(join(site, "index.html"), "<html><body>Public docs</body></html>");
    writeFileSync(join(site, ".nojekyll"), "");
  });

  afterEach(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  function runGuard(): { status: number | null; stdout: string; stderr: string } {
    // A missing CLI is a red prerequisite, not evidence that an unsafe tree was rejected.
    if (!existsSync(GUARD)) throw new Error("T-0174 publication guard CLI does not exist yet");
    const result = spawnSync(process.execPath, [GUARD, site], {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
    expect(result.error).toBeUndefined();
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  function expectRejectedWithoutContent(): void {
    const result = runGuard();
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`.includes(CANARY)).toBe(false);
  }

  it("accepts a nonempty index and empty root .nojekyll", () => {
    expect(runGuard().status).toBe(0);
  });

  it("rejects a missing index", () => {
    rmSync(join(site, "index.html"));
    expectRejectedWithoutContent();
  });

  it("rejects an empty index", () => {
    writeFileSync(join(site, "index.html"), "");
    expectRejectedWithoutContent();
  });

  it("rejects a missing .nojekyll", () => {
    rmSync(join(site, ".nojekyll"));
    expectRejectedWithoutContent();
  });

  it("rejects a nonempty .nojekyll without printing its contents", () => {
    writeFileSync(join(site, ".nojekyll"), CANARY);
    expectRejectedWithoutContent();
  });

  it("rejects a root .env without printing its contents", () => {
    writeFileSync(join(site, ".env"), CANARY);
    expectRejectedWithoutContent();
  });

  it("rejects a nested dotfile without printing its contents", () => {
    mkdirSync(join(site, "images"));
    writeFileSync(join(site, "images", ".private"), CANARY);
    expectRejectedWithoutContent();
  });

  it("rejects a hidden directory and its contents", () => {
    mkdirSync(join(site, ".private"));
    writeFileSync(join(site, ".private", "key"), CANARY);
    expectRejectedWithoutContent();
  });

  it("rejects a symlink without printing the target contents", () => {
    const target = join(fixture, "outside");
    const link = join(site, "linked-assets");
    mkdirSync(target);
    writeFileSync(join(target, "private.txt"), CANARY);
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expectRejectedWithoutContent();
  });
});
