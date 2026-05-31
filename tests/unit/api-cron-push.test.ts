/** @jest-environment node */

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => {
  const actual = jest.requireActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return {
    ...actual,
    requireAuth: jest.fn(() => null),
  };
});

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: jest.fn(),
}));

jest.mock("@/lib/models-repository", () => ({
  getDefaultModel: jest.fn(() => ({ modelId: "test-model", provider: "openai" })),
}));

jest.mock("@/lib/cron-repository", () => ({
  listCronJobs: jest.fn(() => []),
  getCronJob: jest.fn(),
  createCronJob: jest.fn(),
  updateCronJob: jest.fn(),
  deleteCronJob: jest.fn(),
  pushJobToHermes: jest.fn(),
  removeJobFromHermes: jest.fn(),
  importHermesJobs: jest.fn(() => ({ imported: [], errors: [] })),
  syncCronWithHermes: jest.fn(() => ({
    errors: [],
    hermesImported: [],
    hermesExportErrors: [],
  })),
  normalizeRepeat: jest.fn(),
}));

import * as cronRepository from "@/lib/cron-repository";
import { mockRequest } from "../helpers/api-test-helpers";

const mockCreateCronJob = cronRepository.createCronJob as jest.Mock;
const mockDeleteCronJob = cronRepository.deleteCronJob as jest.Mock;
const mockGetCronJob = cronRepository.getCronJob as jest.Mock;
const mockUpdateCronJob = cronRepository.updateCronJob as jest.Mock;
const mockPushJobToHermes = cronRepository.pushJobToHermes as jest.Mock;

describe("POST /api/cron — Hermes sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateCronJob.mockReturnValue({ id: "cj-new" });
    mockGetCronJob.mockReturnValue({
      id: "cj-new",
      name: "Test",
      schedule: "0 * * * *",
      enabled: true,
      state: "scheduled",
    });
  });

  it("returns 502 with cronPushError when pushJobToHermes fails on create", async () => {
    mockPushJobToHermes.mockReturnValue({
      ok: false,
      error: "Hermes venv Python not found",
    });

    const { POST } = await import("@/app/api/cron/route");
    const req = mockRequest("http://127.0.0.1/api/cron", "POST", {
      name: "Hourly",
      schedule: "0 * * * *",
      prompt: "ping",
    });
    const res = await POST(req);
    const body = (await res.json()) as { error?: string; cronPushError?: string };
    expect(res.status).toBe(502);
    expect(body.cronPushError).toContain("Hermes venv");
    expect(mockDeleteCronJob).toHaveBeenCalledWith("cj-new");
  });
});

describe("PUT /api/cron pause — Hermes sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCronJob.mockReturnValue({
      id: "cj-1",
      name: "Test",
      schedule: "0 * * * *",
      enabled: true,
      state: "scheduled",
    });
    mockUpdateCronJob.mockReturnValue({
      id: "cj-1",
      name: "Test",
      schedule: "0 * * * *",
      enabled: false,
      state: "paused",
    });
  });

  it("returns 502 with cronPushError when pushJobToHermes fails on pause", async () => {
    mockPushJobToHermes.mockReturnValue({
      ok: false,
      error: "croniter missing in venv",
    });

    const { PUT } = await import("@/app/api/cron/route");
    const req = mockRequest("http://127.0.0.1/api/cron", "PUT", {
      id: "cj-1",
      action: "pause",
    });
    const res = await PUT(req);
    const body = (await res.json()) as { cronPushError?: string };

    expect(res.status).toBe(502);
    expect(body.cronPushError).toContain("croniter");
  });
});
