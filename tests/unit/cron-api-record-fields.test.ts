/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

const mockList = jest.fn().mockReturnValue([]);
jest.mock("@/lib/cron-repository", () => ({
  listCronJobs: (...args: unknown[]) => mockList(...args),
  importHermesJobs: jest.fn(() => ({ errors: [] })),
}));

function makeJob(overrides: Record<string, unknown>) {
  return {
    id: "job-1",
    name: "Test",
    prompt: "p",
    skills: [],
    model: "m",
    provider: "p",
    base_url: null,
    schedule: "{}",
    schedule_display: "every 5m",
    repeat: { times: null, completed: 0 },
    enabled: true,
    state: "scheduled",
    deliver: "none",
    script: "",
    profile_name: "default",
    next_run_at: null,
    last_run_at: null,
    last_status: null,
    hermes_job_id: null,
    source: "ch",
    orphan: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("GET /api/cron — recordToApiJob fields", () => {
  it("includes orphan and repeat in API response", async () => {
    mockList.mockReturnValue([makeJob({ orphan: true })]);
    const { GET } = require("@/app/api/cron/route") as {
      GET: () => Promise<{ json(): Promise<{ data: { jobs: Array<Record<string, unknown>> } }> }>;
    };

    const req = new Request("http://localhost/api/cron");
    const res = await GET(req);
    const body = await res.json();
    const job = body.data.jobs[0];

    expect(job.orphan).toBe(true);
    expect(job.repeat).toEqual({ times: null, completed: 0 });
  });

  it("normalises CH ParsedSchedule JSON to its .expr (regression: was returning the kind string)", async () => {
    // The live mission's actual storage shape: { kind: "cron", expr: "0 */2 * * *", display: "..." }
    mockList.mockReturnValue([makeJob({
      schedule: JSON.stringify({ kind: "cron", expr: "0 */2 * * *", display: "every 2h" }),
    })]);
    const { GET } = require("@/app/api/cron/route") as {
      GET: () => Promise<{ json(): Promise<{ data: { jobs: Array<Record<string, unknown>> } }> }>;
    };
    const res = await GET(new Request("http://localhost/api/cron"));
    const body = await res.json();
    expect(body.data.jobs[0].schedule).toBe("0 */2 * * *");
  });

  it("normalises legacy Hermes JSON (kind IS the cron) to its kind field", async () => {
    mockList.mockReturnValue([makeJob({
      schedule: JSON.stringify({ kind: "0 9 * * 1-5", display: "Mon 9am" }),
    })]);
    const { GET } = require("@/app/api/cron/route") as {
      GET: () => Promise<{ json(): Promise<{ data: { jobs: Array<Record<string, unknown>> } }> }>;
    };
    const res = await GET(new Request("http://localhost/api/cron"));
    const body = await res.json();
    expect(body.data.jobs[0].schedule).toBe("0 9 * * 1-5");
  });

  it("passes through raw cron strings", async () => {
    mockList.mockReturnValue([makeJob({ schedule: "0 0 * * *" })]);
    const { GET } = require("@/app/api/cron/route") as {
      GET: () => Promise<{ json(): Promise<{ data: { jobs: Array<Record<string, unknown>> } }> }>;
    };
    const res = await GET(new Request("http://localhost/api/cron"));
    const body = await res.json();
    expect(body.data.jobs[0].schedule).toBe("0 0 * * *");
  });
});
