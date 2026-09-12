/**
 * health-message — unit tests for the HealthBanner message builder
 *
 * Pins down the 3-branch decision tree and the Redis-substring
 * heuristic so a future tightening (e.g. word-boundary match) is a
 * deliberate change rather than an accidental one.
 */

import { healthBannerMessage } from "@/components/memory/hindsight/health-message";
import type { HealthState } from "@/components/memory/hindsight/types";

const baseHealth: HealthState = { available: false, mode: "external" };

describe("health-message: Redis branch", () => {
  it("returns the Redis hint when error mentions Redis", () => {
    const h: HealthState = { ...baseHealth, error: "RedisConnectionError" };
    expect(healthBannerMessage(h)).toBe(
      "Redis is not running. Start Redis to enable memory features: redis-server",
    );
  });

  it("Redis match is case-sensitive (substring, not word-boundary)", () => {
    // The original inline check was `error?.includes("Redis")` —
    // case-sensitive. A lowercase "redis" does NOT trigger the hint;
    // the message branch fires instead. Lock that down so a future
    // "fix" to lowercase is a deliberate change.
    const h: HealthState = { ...baseHealth, error: "redis failed" };
    expect(healthBannerMessage(h)).toBe("Hindsight external: redis failed");
  });

  it("Redis hint wins over a generic message field", () => {
    const h: HealthState = {
      ...baseHealth,
      error: "Redis unavailable",
      message: "Connection refused",
    };
    expect(healthBannerMessage(h)).toBe(
      "Redis is not running. Start Redis to enable memory features: redis-server",
    );
  });
});

describe("health-message: message branch", () => {
  it("uses health.message when present and not Redis-related", () => {
    const h: HealthState = {
      ...baseHealth,
      mode: "external",
      message: "Cannot reach localhost:9177",
    };
    expect(healthBannerMessage(h)).toBe(
      "Hindsight external: Cannot reach localhost:9177",
    );
  });

  it("includes the mode in the formatted message", () => {
    const h: HealthState = { ...baseHealth, mode: "fallback", message: "down" };
    expect(healthBannerMessage(h)).toBe("Hindsight fallback: down");
  });
});

describe("health-message: fallback branch", () => {
  it("uses health.error when message is missing", () => {
    const h: HealthState = { ...baseHealth, mode: "external", error: "timeout" };
    expect(healthBannerMessage(h)).toBe("Hindsight external: timeout");
  });

  it("uses 'not responding' when both error and message are empty", () => {
    expect(healthBannerMessage(baseHealth)).toBe("Hindsight external: not responding");
  });

  it("handles empty-string error (not the same as missing)", () => {
    const h: HealthState = { ...baseHealth, error: "" };
    expect(healthBannerMessage(h)).toBe("Hindsight external: not responding");
  });
});

describe("health-message: does not crash on odd inputs", () => {
  it("handles undefined error and undefined message together", () => {
    const h: HealthState = { available: false, mode: "external" };
    expect(healthBannerMessage(h)).toBe("Hindsight external: not responding");
  });
});

/**
 * A PatterStage install with no memory provider is a supported state, not a
 * fault. The health route reports it as `{ available: false, error: "fetch
 * failed" }` with no mode, which used to render "Hindsight undefined: fetch
 * failed" — two pieces of jargon and a bug, on a first-run screen.
 */
describe("health-message: nothing installed is a supported state", () => {
  it("translates a bare transport failure into something a new user can act on", () => {
    const h = { available: false, error: "fetch failed" } as unknown as HealthState;
    const message = healthBannerMessage(h);
    expect(message).toContain("No memory provider is answering");
    expect(message).not.toContain("fetch failed");
    expect(message).not.toContain("undefined");
  });

  it("covers the other transport phrasings the same way", () => {
    for (const error of ["connect ECONNREFUSED 127.0.0.1:9177", "Connection refused", "ETIMEDOUT"]) {
      const h = { available: false, error } as unknown as HealthState;
      expect(healthBannerMessage(h)).toContain("No memory provider is answering");
    }
  });

  it("never says 'Hindsight undefined' when the payload carried no mode", () => {
    const h = { available: false, error: "boom" } as unknown as HealthState;
    expect(healthBannerMessage(h)).toBe("Hindsight: boom");
  });

  it("still quotes a provider that explained itself, transport error or not", () => {
    const h = {
      available: false,
      mode: "external",
      message: "bank 'default' is migrating",
      error: "fetch failed",
    } as HealthState;
    expect(healthBannerMessage(h)).toBe("Hindsight external: bank 'default' is migrating");
  });
});
