// ═══════════════════════════════════════════════════════════════
// API Test Helpers — shared utilities for route tests
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";

/** Create a mock NextRequest for testing API routes. */
export function mockRequest(
  url: string,
  method: string = "GET",
  body?: unknown,
  searchParams?: Record<string, string>
): NextRequest {
  let fullUrl = url;
  if (searchParams && Object.keys(searchParams).length > 0) {
    const params = new URLSearchParams(searchParams);
    fullUrl += "?" + params.toString();
  }
  return new NextRequest(fullUrl, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

/** Assert a JSON response has the expected status and shape. */
export async function expectJsonResponse(
  response: Response,
  expectedStatus: number = 200
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(expectedStatus);
  return await response.json();
}

/** Common mock setup for fs operations. Returns the mock functions. */
export function setupFsMocks() {
  const mocks = {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    readdirSync: jest.fn(),
    statSync: jest.fn(),
    mkdirSync: jest.fn(),
    rmSync: jest.fn(),
  };
  return mocks;
}

/**
 * @deprecated jest.mock inside a function is not hoisted — do not use for new tests.
 * Prefer top-of-file `jest.mock("@/modules/hermes/lib/agent-runtime", ...)` and `jest.mock("@/lib/paths", ...)`.
 */
export function setupRouteMocks() {
  const root = "/tmp/test-hermes";
  const hp = {
    root,
    env: root + "/.env",
    soul: root + "/SOUL.md",
    hermes: root + "/HERMES.md",
    agents: root + "/AGENTS.md",
    skills: root + "/skills",
    profiles: root + "/profiles",
    sessions: root + "/sessions",
    logs: root + "/logs",
    config: root + "/config.yaml",
    backups: root + "/backups",
    cronJobs: root + "/cron/jobs.json",
    memoryDb: root + "/memory_store.db",
  };
  jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
    getActiveHermesPaths: () => hp,
    getActiveHermesHome: () => root,
    getAgentLlmEndpoints: () => ({
      apiUrl: "http://127.0.0.1:9/v1/chat/completions",
      gatewayBase: "http://127.0.0.1:9",
    }),
  }));

  jest.mock("@/lib/paths", () => ({
    PS_DATA_DIR: "/tmp/ch-data",
    PATHS: {
      patterStageDb: "/tmp/ch-data/patterstage.db",
      missions: "/tmp/ch-data/missions",
      templates: "/tmp/ch-data/templates",
      stories: "/tmp/ch-data/stories",
      recroom: "/tmp/ch-data/recroom",
      workspaces: "/tmp/ch-data/workspaces",
      auditLog: "/tmp/ch-data/audit",
      psScripts: "/tmp/ch-data/scripts",
      psHardwareLogs: "/tmp/ch-data/logs",
    },
    getPsScriptsDir: () => "/tmp/ch-data/scripts",
    getPsHardwareLogDir: () => "/tmp/ch-data/logs",
  }));

  jest.mock("@/lib/api-logger", () => ({
    logApiError: jest.fn(),
    safeJsonParse: jest.fn(() => ({})),
    safeReadJsonFile: jest.fn(() => ({ ok: true, data: {} })),
  }));

  // The REAL module, with only the signing check stubbed.
  //
  // This used to replace the whole module, including `isReadOnly: () => false`.
  // That is how a read-only defect reached 34 route handlers with the suite
  // green throughout: every test that touched a route ran with the mode
  // hard-wired off, so no test could observe the bug even in principle
  // (T-0048, T-0049).
  //
  // `isReadOnly` and `requireNotReadOnly` now read the real environment, which
  // is unset in a normal test run and therefore behaves exactly as the old stub
  // did. The difference is that a test which SETS PS_READ_ONLY now gets the
  // truth instead of a decision made for it.
  //
  // `requireSignedRequest` stays stubbed: it needs an HMAC over a shared secret
  // that no route test is about, and leaving it real would make every one of
  // them carry signing headers to test something else entirely.
  jest.mock("@/lib/api-auth", () => ({
    ...jest.requireActual("@/lib/api-auth"),
    requireSignedRequest: jest.fn(() => null),
  }));

  jest.mock("@/lib/parse-json-body", () => ({
    parseJsonBody: jest.fn(async () => ({})),
  }));

  jest.mock("@/lib/audit-log", () => ({
    appendAuditLine: jest.fn(),
  }));
}
