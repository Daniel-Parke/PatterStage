/** @jest-environment node */
import { buildHermesPathBundle } from "@/modules/hermes/lib/paths";

describe("buildHermesPathBundle", () => {
  it("normalizes trailing slashes and builds expected paths", () => {
    const b = buildHermesPathBundle("/opt/hermes/");
    expect(b.root).toBe("/opt/hermes");
    expect(b.config).toBe("/opt/hermes/config.yaml");
    expect(b.cronJobs).toBe("/opt/hermes/cron/jobs.json");
    expect(b.profiles).toBe("/opt/hermes/profiles");
  });
});
