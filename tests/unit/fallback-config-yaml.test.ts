/** @jest-environment node */

import { parseFallbackAgentSettingsFromYaml } from "@/lib/models/fallback-config-yaml";

describe("parseFallbackAgentSettingsFromYaml", () => {
  it("maps agent section fields", () => {
    expect(
      parseFallbackAgentSettingsFromYaml({
        api_max_retries: 5,
        restore_primary_on_fallback: false,
        fallback_notification: true,
      }),
    ).toEqual({
      apiMaxRetries: 5,
      restorePrimaryOnFallback: false,
      fallbackNotification: true,
    });
  });

  it("clamps api_max_retries to 0–10", () => {
    expect(parseFallbackAgentSettingsFromYaml({ api_max_retries: 42 }).apiMaxRetries).toBe(10);
    expect(parseFallbackAgentSettingsFromYaml({ api_max_retries: -3 }).apiMaxRetries).toBe(0);
  });

  it("returns empty object for missing agent", () => {
    expect(parseFallbackAgentSettingsFromYaml(null)).toEqual({});
    expect(parseFallbackAgentSettingsFromYaml(undefined)).toEqual({});
  });
});
