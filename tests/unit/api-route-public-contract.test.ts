/** @jest-environment node */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import baseline from "../fixtures/api-route-contract-baseline.json";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { serverErrorFromCatch, serverErrorFromError } from "@/lib/api/api-logger";
import { route } from "@/lib/api/api-route";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { dbSingletonMock, openBaselineDb } from "../helpers/baseline-db";

let mockAuthorised = true;
let mockDb: ReturnType<typeof openBaselineDb> | null = null;
beforeEach(() => { mockDb = openBaselineDb(); });
afterEach(() => { mockDb?.close(); mockDb = null; });
jest.mock("@/lib/auth/stream-guard", () => ({ streamAuthorizer: () => () => mockAuthorised }));

jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn(), getSyncScheduler: jest.fn(), runFullSync: jest.fn() }));
jest.mock("@/lib/db", () => ({ ...dbSingletonMock(() => mockDb), ensureDb: jest.fn(), getSchemaHealth: jest.fn(() => ({ hasMissionCategoriesTable: true, schemaVersion: 1 })) }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ ensureDefaultCategories: jest.fn(), listCategoriesWithDefaults: jest.fn(() => []), updateCategory: jest.fn() }));
jest.mock("@/lib/system/operator-prefs-repository", () => ({ readOperatorPrefs: jest.fn(() => ({})), validateOperatorPref: jest.fn(), writeOperatorPref: jest.fn() }));
jest.mock("@/lib/sessions/session-orphan-sweep", () => ({ previewOrphanSweep: jest.fn(() => ({ total: 0, bySource: {}, byNewStatus: {} })), closeOrphanedActiveSessions: jest.fn(() => ({ total: 0, bySource: {}, byNewStatus: {} })) }));
jest.mock("@/lib/api/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api/api-auth", () => ({ getCorrelationId: () => "owned-correlation", isDeployApiEnabled: () => true, requireAuthenticatedHostWrites: jest.fn(), requireDeployApiEnabled: jest.fn(), requireSignedRequest: jest.fn() }));
jest.mock("@/lib/deploy/deploy-status", () => ({ isDeployInProgress: () => false, readDeployStatus: jest.fn(), tailLogHint: jest.fn() }));
jest.mock("@/lib/update-handlers/deploy-actions", () => ({ handleRebuildAction: jest.fn(), handleRestartAction: jest.fn(), handleUpdateAction: jest.fn() }));
jest.mock("@/lib/update-handlers/remote-branches", () => ({ listRemoteBranches: jest.fn() }));
jest.mock("@/lib/update-handlers/shared", () => ({ UPDATE_BRANCH: "dev" }));
jest.mock("@/lib/update-handlers/version-check", () => ({ checkVersion: jest.fn() }));
jest.mock("@/lib/composer/composer-repository", () => ({ getComposerRun: jest.fn(), getNode: jest.fn(), recordComposerApproval: jest.fn(), updateComposerRun: jest.fn() }));
jest.mock("@/lib/composer/engine", () => ({ advanceComposerRun: jest.fn(() => { throw new Error("Oracle must never advance a workflow"); }) }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

import { ensureSyncLayer } from "@/lib/sync";
import { ensureDb } from "@/lib/db";
import { updateCategory } from "@/lib/missions/mission-category-repository";
import { checkVersion } from "@/lib/update-handlers/version-check";
import { handleUpdateAction } from "@/lib/update-handlers/deploy-actions";
import { requireAuthenticatedHostWrites, requireDeployApiEnabled, requireSignedRequest } from "@/lib/api/api-auth";
import { previewOrphanSweep, closeOrphanedActiveSessions } from "@/lib/sessions/session-orphan-sweep";
import { getComposerRun, recordComposerApproval } from "@/lib/composer/composer-repository";
import { GET as syncGet, POST as syncPost } from "@/app/api/sync/route";
import { GET as categoriesGet, PUT as categoriesPut } from "@/app/api/mission-categories/route";
import { GET as updateGet, POST as updatePost } from "@/app/api/update/route";
import { PUT as prefsPut } from "@/app/api/prefs/route";
import { GET as backfillGet, POST as backfillPost } from "@/app/api/admin/sessions/backfill-status/route";
import { POST as approvePost } from "@/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route";

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name).replaceAll("\\", "/")]);
}

describe("T-0192 public route contracts", () => {
  it("preserves every shipped route URL and actual exported HTTP method", () => {
    const files = walk("src/app/api").filter(file => /\/route\.tsx?$/.test(file));
    const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
    const program = ts.createProgram(files, options);
    const checker = program.getTypeChecker();
    const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
    const routes = files.map(file => {
      const source = program.getSourceFile(file)!;
      const symbol = checker.getSymbolAtLocation(source);
      expect(symbol).toBeDefined();
      return {
        path: "/" + file.replace(/^src\/app\//, "").replace(/\/route\.tsx?$/, "")
          .split("/").filter(segment => !/^\(.*\)$/.test(segment)).join("/"),
        methods: checker.getExportsOfModule(symbol!).map(exported => exported.name).filter(name => methods.has(name)).sort(),
      };
    }).sort((a, b) => a.path.localeCompare(b.path, "en"));
    expect(routes).toEqual(baseline.routes);
    expect(new Set(routes.map(r => r.path)).size).toBe(routes.length);
  });

  it("reads aliases as real TypeScript exports rather than function-name text", () => {
    const source = ts.createSourceFile("fixture.ts", "const handler = () => 1; export { handler as GET }; export const POST = handler; // export function DELETE() {}", ts.ScriptTarget.Latest, true);
    const host = ts.createCompilerHost({ noLib: true });
    host.getSourceFile = file => file === "fixture.ts" ? source : undefined;
    const checker = ts.createProgram(["fixture.ts"], { noLib: true }, host).getTypeChecker();
    expect(checker.getExportsOfModule(checker.getSymbolAtLocation(source)!).map(s => s.name).sort()).toEqual(["GET", "POST"]);
  });

  it.each([null, false, 7, "text", [], { action: "list" }])("does not impose generic object validation on valid JSON %j", async body => {
    const request = new NextRequest("http://owned.test/api/oracle", { method: "POST", body: JSON.stringify(body) });
    expect(await parseJsonBody(request)).toEqual(body);
  });

  it("preserves the generic parser's exact invalid JSON error", async () => {
    const result = await parseJsonBody(new NextRequest("http://owned.test/api/oracle", { method: "POST", body: "{" }));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it.each([
    ["Error", new Error("detail"), "detail"], ["empty Error", new Error(""), ""],
    ["string", "refusal", "refusal"], ["null", null, "null"], ["object", { code: 7 }, "[object Object]"],
  ])("preserves fixed and dynamic helper errors for %s", async (_name, thrown, suffix) => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const fixed = serverErrorFromCatch("GET /api/oracle", "reading", thrown, "Failed to read");
      const dynamic = serverErrorFromError("GET /api/oracle", "reading", thrown, "Read failed");
      expect(fixed.status).toBe(500);
      expect(dynamic.status).toBe(500);
      expect(await fixed.json()).toEqual({ error: "Failed to read" });
      expect(await dynamic.json()).toEqual({ error: `Read failed: ${suffix}` });
    } finally { log.mockRestore(); }
  });

  it.each(["success", "caught error"])("reauthorises at response settlement after %s", async outcome => {
    mockAuthorised = true;
    const held = pendingLookup<void>();
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const handler = route("GET /api/oracle", "reading", "Read refused", async (_request: NextRequest) => {
        await held.promise;
        if (outcome === "caught error") throw new Error("owned failure");
        return NextResponse.json({ data: "private" });
      });
      const pending = handler(new NextRequest("http://owned.test/api/oracle", { headers: { cookie: "ps_session=owned-session" } }));
      mockAuthorised = false;
      held.complete();
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ error: "Browser session is no longer authorised." });
    } finally { mockAuthorised = true; log.mockRestore(); }
  });

  it("passes specialised envelopes and stream bytes through the wrapper unchanged", async () => {
    const responses = [NextResponse.json({ data: { error: "Saved partly" } }), NextResponse.json({ data: { error: "Hindsight unavailable" } }, { status: 503 }), new Response("event: delta\ndata: owned\n\n", { headers: { "Content-Type": "text/event-stream" } })];
    for (const response of responses) {
      expect(await route("GET /api/oracle", "reading", "Failed", () => response)()).toBe(response);
    }
  });

  it("releases the original response when the browser session remains authorised", async () => {
    mockAuthorised = true;
    const response = NextResponse.json({ data: "owned result" });
    const handler = route("GET /api/oracle", "reading", "Failed", (_request: NextRequest) => response);
    const request = new NextRequest("http://owned.test/api/oracle", { headers: { cookie: "ps_session=owned-session" } });
    expect(await handler(request)).toBe(response);
  });

});

const thrownCases = [
  { label: "Error", thrown: new Error("detail"), sync: "Error: detail", category: "detail" },
  { label: "empty Error", thrown: new Error(""), sync: "Error", category: "" },
  { label: "string", thrown: "refusal", sync: "refusal", category: "refusal" },
  { label: "null", thrown: null, sync: "null", category: "null" },
  { label: "object", thrown: { code: 7 }, sync: "[object Object]", category: "[object Object]" },
];

describe("T-0192 actual route catch compatibility before helper folds", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  for (const entry of thrownCases) {
    it(`preserves sync GET and POST errors for ${entry.label}`, async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      jest.mocked(ensureSyncLayer).mockImplementation(() => { throw entry.thrown; });
      try {
        const get = await syncGet(new NextRequest("http://owned.test/api/sync"));
        const post = await syncPost(new NextRequest("http://owned.test/api/sync", { method: "POST" }));
        expect(get.status).toBe(500);
        expect(post.status).toBe(500);
        expect(await get.json()).toEqual({ error: "Failed to read sync status" });
        expect(await post.json()).toEqual({ error: `Failed to trigger sync: ${entry.sync}` });
      } finally { jest.mocked(ensureSyncLayer).mockReset(); }
    });

    it(`preserves category GET and PUT errors for ${entry.label}`, async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      jest.mocked(ensureDb).mockImplementationOnce(() => { throw entry.thrown; });
      jest.mocked(updateCategory).mockImplementationOnce(() => { throw entry.thrown; });
      const get = await categoriesGet(new NextRequest("http://owned.test/api/mission-categories"));
      const put = await categoriesPut(new NextRequest("http://owned.test/api/mission-categories", { method: "PUT", body: '{"id":"owned-category","name":"Owned"}' }));
      expect(get.status).toBe(500);
      expect(put.status).toBe(500);
      expect(await get.json()).toEqual({ error: entry.category || "Failed to load categories" });
      expect(await put.json()).toEqual({ error: entry.category || "Update failed" });
    });

    it(`preserves update GET and POST fixed errors for ${entry.label}`, async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      jest.mocked(checkVersion).mockImplementationOnce(() => { throw entry.thrown; });
      jest.mocked(handleUpdateAction).mockImplementationOnce(() => { throw entry.thrown; });
      const get = await updateGet(new NextRequest("http://owned.test/api/update"));
      const post = await updatePost(new NextRequest("http://owned.test/api/update", { method: "POST", body: "{}" }));
      expect(get.status).toBe(500);
      expect(post.status).toBe(500);
      expect(await get.json()).toEqual({ error: "Failed to check version" });
      expect(await post.json()).toEqual({ error: "Update failed" });
    });
  }
});

describe("T-0192 deliberate parser and guard exceptions", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it.each(["{", "null", "false", "[]", "{}"])("preserves the preference-specific error for body %s", async body => {
    const response = await prefsPut(new NextRequest("http://owned.test/api/prefs", { method: "PUT", body }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Body must be { key, value } with a key from the allow-list." });
  });

  it.each(["", "{", "{}", '{"dryRun":true}'])("keeps backfill default dry-run for body %s", async body => {
    const response = await backfillPost(new NextRequest("http://owned.test/api/admin/sessions/backfill-status", { method: "POST", body }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { dryRun: true, total: 0 } });
    expect(previewOrphanSweep).toHaveBeenCalledTimes(1);
    expect(closeOrphanedActiveSessions).not.toHaveBeenCalled();
  });

  it("keeps explicit backfill apply distinct from default and JSON null", async () => {
    const response = await backfillPost(new NextRequest("http://owned.test/api/admin/sessions/backfill-status", { method: "POST", body: '{"dryRun":false}' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { dryRun: false } });
    expect(closeOrphanedActiveSessions).toHaveBeenCalledTimes(1);
    expect(previewOrphanSweep).not.toHaveBeenCalled();
    // Existing direct-handler distinction, not a claim about Next's outer 500 body.
    await expect(backfillPost(new NextRequest("http://owned.test/api/admin/sessions/backfill-status", { method: "POST", body: "null" }))).rejects.toBeInstanceOf(TypeError);
  });

  it("preserves backfill GET's exact 405 and Allow header", async () => {
    const response = await backfillGet();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual({ error: "GET is not supported here — this endpoint BACKFILLS session status and is POST-only" });
  });

  it.each(["", "{"])("keeps update's optional invalid body default action for %j", async body => {
    jest.mocked(handleUpdateAction).mockResolvedValueOnce(NextResponse.json({ data: "owned dispatch only" }));
    const response = await updatePost(new NextRequest("http://owned.test/api/update", { method: "POST", body }));
    expect(response.status).toBe(200);
    expect(handleUpdateAction).toHaveBeenCalledWith({}, "owned-correlation");
  });

  it.each(["host", "deploy", "signature"])("keeps %s refusal ahead of parsing and deploy dispatch", async blockedAt => {
    const gates = [requireAuthenticatedHostWrites, requireDeployApiEnabled, requireSignedRequest];
    const index = ["host", "deploy", "signature"].indexOf(blockedAt);
    const calls: string[] = [];
    const refusal = NextResponse.json({ error: `Owned ${blockedAt} refusal` }, { status: 403 });
    gates.forEach((gate, i) => jest.mocked(gate).mockImplementationOnce(() => { calls.push(["host", "deploy", "signature"][i]); return i === index ? refusal : null; }));
    const request = new NextRequest("http://owned.test/api/update", { method: "POST", body: "{" });
    const read = jest.spyOn(request, "json");
    try {
      expect(await updatePost(request)).toBe(refusal);
      expect(calls).toEqual(["host", "deploy", "signature"].slice(0, index + 1));
      expect(read).not.toHaveBeenCalled();
      expect(handleUpdateAction).not.toHaveBeenCalled();
    } finally { gates.forEach(gate => jest.mocked(gate).mockReset()); read.mockRestore(); }
  });

  it.each([
    ["{", "Invalid JSON"],
    ['{"action":"approve"}', 'action must be "accept" or "reject" (got "approve"). To approve a gate, send "accept".'],
    ["{}", 'action must be "accept" or "reject" (got null). To approve a gate, send "accept".'],
  ])("preserves Composer's bespoke approval error for %s", async (body, error) => {
    const previous = process.env.PS_COMPOSER;
    process.env.PS_COMPOSER = "1";
    try {
      const response = await approvePost(new NextRequest("http://owned.test/api/composer/runs/owned/nodes/gate/approve", { method: "POST", body }), { params: Promise.resolve({ id: "owned", nodeId: "gate" }) });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error });
      expect(getComposerRun).not.toHaveBeenCalled();
      expect(recordComposerApproval).not.toHaveBeenCalled();
    } finally { if (previous === undefined) delete process.env.PS_COMPOSER; else process.env.PS_COMPOSER = previous; }
  });
});
