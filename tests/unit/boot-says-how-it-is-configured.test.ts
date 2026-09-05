/**
 * @jest-environment node
 *
 * T-0053 — the boot log says how this instance is configured.
 *
 * The QA pass lost THREE sessions to silent flag loss: an external watchdog
 * restarted the server without the session's environment, and nothing on screen
 * or in the log said the mode had changed. One of those sessions produced a
 * finding that had to be retracted ("read-only lets writes through" — it did
 * not; the flag was simply absent).
 *
 * A boot line naming the operational flags costs nothing and ends that whole
 * class of confusion, for an operator as much as for a QA agent. It sits beside
 * the `[auth]` line, which is the one line everybody already reads.
 *
 * NOT included, and worth recording why: the advertised PORT. It was reported as
 * derived from `process.env.PORT ?? "3000"` rather than from `-p`, which is true
 * of the source but not of the behaviour. Next assigns `process.env.PORT` at
 * bind time, before instrumentation runs. Measured on a real server booted with
 * `-p 3494` and no PORT in the environment: the boot line advertised 3494.
 */

import { describeOperationalFlags } from "@/lib/boot-diagnostics";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("describeOperationalFlags", () => {
  it("names the flags that change what the product does", () => {
    const line = describeOperationalFlags();
    for (const key of ["read-only", "deploy-api", "auth", "composer", "gateway"]) {
      expect(line).toContain(key);
    }
  });

  it("reports read-only as ON when it is on", () => {
    process.env.PS_READ_ONLY = "1";
    expect(describeOperationalFlags()).toMatch(/read-only=on/);
  });

  it("reports read-only as OFF when the variable is absent", () => {
    delete process.env.PS_READ_ONLY;
    delete process.env.CH_READ_ONLY;
    expect(describeOperationalFlags()).toMatch(/read-only=off/);
  });

  it("honours the legacy CH_ alias, which un-migrated installs still set", () => {
    delete process.env.PS_READ_ONLY;
    process.env.CH_READ_ONLY = "true";
    expect(describeOperationalFlags()).toMatch(/read-only=on/);
  });

  it("shows where the gateway is pointed, because an override is invisible otherwise", () => {
    process.env.HERMES_GATEWAY_URL = "http://127.0.0.1:8643";
    expect(describeOperationalFlags()).toContain("127.0.0.1:8643");
  });

  it("says `default` rather than nothing when the gateway is not overridden", () => {
    delete process.env.HERMES_GATEWAY_URL;
    expect(describeOperationalFlags()).toMatch(/gateway=default/);
  });

  it("never prints a secret", () => {
    // The line is meant to be pasted into a bug report.
    process.env.PS_AUTH_TOKEN = "super-secret-token-value";
    process.env.API_SERVER_KEY = "another-secret";
    const line = describeOperationalFlags();
    expect(line).not.toContain("super-secret-token-value");
    expect(line).not.toContain("another-secret");
  });

  it("is one line, so it cannot bury the [auth] line under it", () => {
    expect(describeOperationalFlags()).not.toContain("\n");
  });
});
