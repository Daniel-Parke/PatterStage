/** @jest-environment node */

jest.mock("child_process", () => ({
  execSync: jest.fn(() => ""),
  exec: jest.fn((_cmd, _opts, cb: (err: Error | null, stdout: string) => void) => {
    cb(null, "");
    return { on: jest.fn(), stdout: { on: jest.fn() }, stderr: { on: jest.fn() } };
  }),
}));

jest.mock("fs", () => ({
  readFileSync: jest.fn(() => "[]"),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => false),
  unlinkSync: jest.fn(),
}));

jest.mock("@/lib/api-auth", () => ({
  isReadOnly: jest.fn(() => false),
}));

jest.mock("@/lib/hardware-cron", () => ({
  crontabLineUsesScriptsDir: jest.fn(() => true),
}));

jest.mock("@/lib/paths", () => ({
  PS_DATA_DIR: "/tmp/ch-data",
  getPsScriptsDir: () => "/tmp/ch-data/scripts",
  getPsHardwareLogDir: () => "/tmp/ch-data/logs",
}));

import { GET } from "@/app/api/cron/hardware/route";
import { mockRequest } from "../helpers/api-test-helpers";

describe("GET /api/cron/hardware", () => {
  it("returns job list shape", async () => {
    const res = await GET(mockRequest("http://127.0.0.1/api/test"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.jobs)).toBe(true);
  });
});
