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

const mockUpdateCronJob = jest.fn();
const mockPushJobToHermes = jest.fn();
const mockGetCronJob = jest.fn();

jest.mock("@/lib/cron-repository", () => ({
  listCronJobs: jest.fn(() => []),
  getCronJob: (...args: unknown[]) => mockGetCronJob(...args),
  createCronJob: jest.fn(),
  updateCronJob: (...args: unknown[]) => mockUpdateCronJob(...args),
  deleteCronJob: jest.fn(),
  pushJobToHermes: (...args: unknown[]) => mockPushJobToHermes(...args),
  removeJobFromHermes: jest.fn(),
  importHermesJobs: jest.fn(() => ({ imported: [], errors: [] })),
  syncCronWithHermes: jest.fn(() => ({
    errors: [],
    hermesImported: [],
    hermesExportErrors: [],
  })),
  normalizeRepeat: jest.fn(),
}));

import { appendAuditLine } from "@/lib/audit-log";
import { mockRequest } from "../helpers/api-test-helpers";

describe("PUT /api/cron — pause / resume via applyEnabledChange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCronJob.mockReturnValue({ id: "cj-1", enabled: true });
    mockUpdateCronJob.mockReturnValue({
      id: "cj-1",
      name: "Test",
      schedule: "0 * * * *",
      enabled: false,
      state: "paused",
    });
    mockPushJobToHermes.mockResolvedValue({ ok: true, hermesJobId: "hj-1" });
  });

  it("pause action disables the job, sets state=paused, audits, and pushes to Hermes", async () => {
    const { PUT } = await import("@/app/api/cron/route");
    const req = mockRequest("http://127.0.0.1/api/cron", "PUT", {
      id: "cj-1",
      action: "pause",
    });
    const res = await PUT(req);
    const body = (await res.json()) as { data?: { success?: boolean } };

    expect(res.status).toBe(200);
    expect(body.data?.success).toBe(true);
    expect(mockUpdateCronJob).toHaveBeenCalledWith("cj-1", {
      enabled: false,
      state: "paused",
    });
    expect(mockPushJobToHermes).toHaveBeenCalledWith("cj-1");
    expect(appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cron.pause", resource: "cj-1", ok: true }),
    );
  });

  it("resume action enables the job, sets state=scheduled, audits, and pushes to Hermes", async () => {
    mockUpdateCronJob.mockReturnValue({
      id: "cj-1",
      name: "Test",
      schedule: "0 * * * *",
      enabled: true,
      state: "scheduled",
    });

    const { PUT } = await import("@/app/api/cron/route");
    const req = mockRequest("http://127.0.0.1/api/cron", "PUT", {
      id: "cj-1",
      action: "resume",
    });
    const res = await PUT(req);
    const body = (await res.json()) as { data?: { success?: boolean } };

    expect(res.status).toBe(200);
    expect(body.data?.success).toBe(true);
    expect(mockUpdateCronJob).toHaveBeenCalledWith("cj-1", {
      enabled: true,
      state: "scheduled",
    });
    expect(mockPushJobToHermes).toHaveBeenCalledWith("cj-1");
    expect(appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cron.resume", resource: "cj-1", ok: true }),
    );
  });

  it("returns 502 with cronPushError when pushJobToHermes fails on pause", async () => {
    mockPushJobToHermes.mockResolvedValue({
      ok: false,
      error: "Hermes venv Python not found",
    });

    const { PUT } = await import("@/app/api/cron/route");
    const req = mockRequest("http://127.0.0.1/api/cron", "PUT", {
      id: "cj-1",
      action: "pause",
    });
    const res = await PUT(req);
    const body = (await res.json()) as { error?: string; cronPushError?: string };

    expect(res.status).toBe(502);
    expect(body.cronPushError).toContain("Hermes venv");
    expect(appendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cron.pause", ok: false }),
    );
  });

  it("returns 404 if the job disappears between GET and update", async () => {
    mockUpdateCronJob.mockReturnValueOnce(null);

    const { PUT } = await import("@/app/api/cron/route");
    const req = mockRequest("http://127.0.0.1/api/cron", "PUT", {
      id: "cj-missing",
      action: "pause",
    });
    const res = await PUT(req);
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
    expect(mockPushJobToHermes).not.toHaveBeenCalled();
  });
});
