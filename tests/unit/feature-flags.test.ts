/**
 * @jest-environment node
 *
 * feature-flags default-ON semantics: a flag is enabled unless its env var is
 * explicitly falsy (0/false/no/off). Unset / empty / truthy → enabled.
 */

import { isFeatureEnabled, getFeatureFlags } from "@/lib/feature-flags";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PS_COMPOSER;
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("isFeatureEnabled('composer') — default ON", () => {
  it("is enabled when PS_COMPOSER is unset", () => {
    expect(isFeatureEnabled("composer")).toBe(true);
  });

  it("is enabled when PS_COMPOSER is empty / whitespace", () => {
    process.env.PS_COMPOSER = "   ";
    expect(isFeatureEnabled("composer")).toBe(true);
  });

  it.each(["1", "true", "yes", "on", "TRUE", "anything"])(
    "stays enabled for truthy/other value %p",
    (value) => {
      process.env.PS_COMPOSER = value;
      expect(isFeatureEnabled("composer")).toBe(true);
    },
  );

  it.each(["0", "false", "no", "off", "FALSE", " Off "])(
    "is disabled only for explicit falsy value %p",
    (value) => {
      process.env.PS_COMPOSER = value;
      expect(isFeatureEnabled("composer")).toBe(false);
    },
  );
});

describe("getFeatureFlags", () => {
  it("reports every known flag's state", () => {
    process.env.PS_COMPOSER = "0";
    expect(getFeatureFlags()).toEqual({ composer: false });
  });

  it("defaults all flags ON", () => {
    expect(getFeatureFlags()).toEqual({ composer: true });
  });
});
