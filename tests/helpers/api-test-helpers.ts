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
 * Prefer top-of-file `jest.mock("@/lib/hermes-agent-runtime", ...)` and `jest.mock("@/lib/paths", ...)`.
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
  jest.mock("@/lib/hermes-agent-runtime", () => ({
    getActiveHermesPaths: () => hp,
    getActiveHermesHome: () => root,
    getAgentLlmEndpoints: () => ({
      apiUrl: "http://127.0.0.1:9/v1/chat/completions",
      gatewayBase: "http://127.0.0.1:9",
    }),
  }));

  jest.mock("@/lib/paths", () => ({
    CH_DATA_DIR: "/tmp/ch-data",
    PATHS: {
      controlHubDb: "/tmp/ch-data/control-hub.db",
      missions: "/tmp/ch-data/missions",
      templates: "/tmp/ch-data/templates",
      stories: "/tmp/ch-data/stories",
      recroom: "/tmp/ch-data/recroom",
      workspaces: "/tmp/ch-data/workspaces",
      auditLog: "/tmp/ch-data/audit",
      chScripts: "/tmp/ch-data/scripts",
      chHardwareLogs: "/tmp/ch-data/logs",
    },
    getChScriptsDir: () => "/tmp/ch-data/scripts",
    getChHardwareLogDir: () => "/tmp/ch-data/logs",
  }));

  jest.mock("@/lib/api-logger", () => ({
    logApiError: jest.fn(),
    safeJsonParse: jest.fn(() => ({})),
    safeReadJsonFile: jest.fn(() => ({ ok: true, data: {} })),
  }));

  jest.mock("@/lib/api-auth", () => ({
    requireMcApiKey: jest.fn(() => null),
    requireChApiKey: jest.fn(() => null),
    requireNotReadOnly: jest.fn(() => null),
    requireSignedRequest: jest.fn(() => null),
  }));

  jest.mock("@/lib/audit-log", () => ({
    appendAuditLine: jest.fn(),
  }));
}
