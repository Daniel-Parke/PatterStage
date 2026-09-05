/** @jest-environment node */

// T-0086: PUT /api/agent/files/config answers 409 on unparseable YAML,
// mirroring the PUT /api/config precedent from T-0060. Before this it called
// configYamlToColumnValues, which silently rebuilt an empty preserved set and
// stored it -- the files editor was one of three doors the corruption walked
// through into the database.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { NextRequest } from "next/server";

const scratch = mkdtempSync(join(tmpdir(), "ps-files-route-"));
const hermes = join(scratch, "hermes");

jest.mock("@/modules/hermes/lib/profile-paths", () => {
  const actual = jest.requireActual("@/modules/hermes/lib/profile-paths") as typeof import("@/modules/hermes/lib/profile-paths");
  return {
    ...actual,
    getHermesDefaultRoot: () => hermes,
    resolveProfileHermesHome: (slug: string) => (slug === "default" ? hermes : join(hermes, "profiles", slug)),
  };
});
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({ root: hermes, config: join(hermes, "config.yaml"), backups: join(hermes, "backups") }),
  getActiveHermesHome: () => hermes,
  getHermesDefaultRoot: () => hermes,
}));

const mockWriteManaged = jest.fn();
jest.mock("@/modules/hermes/lib/agent-file-store", () => {
  const actual = jest.requireActual("@/modules/hermes/lib/agent-file-store") as typeof import("@/modules/hermes/lib/agent-file-store");
  return { ...actual, writeManagedFileContent: (...a: unknown[]) => mockWriteManaged(...a), readManagedFileContent: () => null };
});
const mockApply = jest.fn();
jest.mock("@/modules/hermes/handlers/profile-patch", () => ({
  applyProfileOrRootPatchOrFail: (...a: unknown[]) => mockApply(...a),
  pushProfileOrRootOrFail: jest.fn(),
}));
jest.mock("@/modules/hermes/lib/profiles-repository", () => ({ getProfile: () => null }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn(), getDb: jest.fn(), now: () => "t", uuid: () => "u", inTransaction: <T,>(fn: () => T) => fn() }));

import { PUT } from "@/app/api/agent/files/[key]/route";

const CORRUPT = "model:\n  default: a\nmodel:\n  default: b\n";
const CLEAN = "skills:\n  disabled: []\nmodel:\n  default: ok\n";

function put(content: string) {
  const req = new NextRequest("http://localhost/api/agent/files/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, backup: false }),
  });
  return PUT(req, { params: Promise.resolve({ key: "config" }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  rmSync(hermes, { recursive: true, force: true });
  mkdirSync(join(hermes, "backups"), { recursive: true });
  writeFileSync(join(hermes, "config.yaml"), CLEAN, "utf-8");
  mockApply.mockReturnValue({});
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

it("FUSE: the route resolves config.yaml under the scratch dir", async () => {
  const p = await import("@/modules/hermes/lib/profile-paths");
  expect(p.resolveProfileHermesHome("default")).toContain("ps-files-route-");
});

it("answers 409 with the first line of the fault and stores nothing", async () => {
  const res = await put(CORRUPT);
  const body = (await res.json()) as { error: string };

  expect(res.status).toBe(409);
  expect(body.error).toMatch(/not saved/);
  expect(body.error).toMatch(/duplicated mapping key/i);
  expect(body.error).not.toContain("default: b");
  expect(mockWriteManaged).not.toHaveBeenCalled();
  expect(mockApply).not.toHaveBeenCalled();
});

it("GREEN CONTROL: clean YAML goes through to the managed store and the patch", async () => {
  const res = await put(CLEAN);

  expect(res.status).toBe(200);
  expect(mockWriteManaged).toHaveBeenCalledWith("default", "config", expect.stringContaining("default: ok"));
  expect(mockApply).toHaveBeenCalled();
});
