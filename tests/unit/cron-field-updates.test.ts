// Unit tests for the cron update-payload builder
// (src/lib/cron-field-updates.ts)

import { buildCronUpdatePayload } from "@/lib/cron-field-updates";

describe("buildCronUpdatePayload", () => {
  it("returns an empty payload for an empty body", () => {
    const result = buildCronUpdatePayload({});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload).toEqual({});
  });

  it("ignores fields whose value is `undefined`", () => {
    const result = buildCronUpdatePayload({
      name: undefined,
      prompt: undefined,
      enabled: undefined,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload).toEqual({});
  });

  it("copies a string name through .trim()", () => {
    const result = buildCronUpdatePayload({ name: "  hello  " });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.name).toBe("hello");
  });

  it("copies a prompt without trimming", () => {
    const result = buildCronUpdatePayload({ prompt: "  untrimmed prompt  " });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.prompt).toBe("  untrimmed prompt  ");
  });

  it("coerces skills/model/provider/deliver/profile_name/state via String()", () => {
    const result = buildCronUpdatePayload({
      skills: ["a", "b"],
      model: 42,
      provider: true,
      deliver: "discord",
      profile_name: "default",
      state: "scheduled",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload).toMatchObject({
      skills: ["a", "b"],
      model: "42",
      provider: "true",
      deliver: "discord",
      profile_name: "default",
      state: "scheduled",
    });
  });

  it("copies base_url and script through as string|null", () => {
    const result = buildCronUpdatePayload({
      base_url: "https://api.example.com",
      script: "/path/to/script.sh",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.base_url).toBe("https://api.example.com");
    expect(result.payload.script).toBe("/path/to/script.sh");

    const nullResult = buildCronUpdatePayload({ base_url: null, script: null });
    expect(nullResult.ok).toBe(true);
    if (!nullResult.ok) throw new Error("expected ok");
    expect(nullResult.payload.base_url).toBeNull();
    expect(nullResult.payload.script).toBeNull();
  });

  it("coerces enabled via Boolean()", () => {
    const onResult = buildCronUpdatePayload({ enabled: "yes" });
    expect(onResult.ok).toBe(true);
    if (!onResult.ok) throw new Error("expected ok");
    expect(onResult.payload.enabled).toBe(true);

    const offResult = buildCronUpdatePayload({ enabled: 0 });
    expect(offResult.ok).toBe(true);
    if (!offResult.ok) throw new Error("expected ok");
    expect(offResult.payload.enabled).toBe(false);
  });

  it("parses a valid cron schedule and populates schedule + schedule_display", () => {
    const result = buildCronUpdatePayload({ schedule: "*/5 * * * *" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    // Canonical storage: the raw 5-field cron expression lives in
    // `schedule`. Storing a JSON-stringified ParsedSchedule here
    // (the prior behaviour) broke the CH↔Hermes round-trip and
    // corrupted the job to `kind: "invalid"`. See
    // `src/lib/cron/write.ts` for the full rationale.
    expect(result.payload.schedule).toBe("*/5 * * * *");
    expect(result.payload.schedule_display).toBe("*/5 * * * *");
  });

  it("trims whitespace from the schedule string", () => {
    const result = buildCronUpdatePayload({ schedule: "  */5 * * * *  " });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.schedule).toBe("*/5 * * * *");
  });

  it("derives a human display label for an 'every Nh' shorthand schedule", () => {
    const result = buildCronUpdatePayload({ schedule: "every 2h" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.schedule).toBe("every 2h");
    expect(result.payload.schedule_display).toBe("every 120m");
  });

  it("returns 400 on an invalid cron schedule", () => {
    const result = buildCronUpdatePayload({ schedule: "not a real cron line" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(400);
    // The 400 body should include an error message
    void result.response.json().then((body: { error: string }) => {
      expect(body.error).toMatch(/invalid|cron|schedule/i);
    });
  });

  it("normalizes a boolean repeat (true → null times, false → 1 time)", () => {
    // normalizeRepeat's boolean semantics: `true` = repeat forever (null times),
    // `false` = run once (1 time). This matches the Hermes jobs.json contract.
    const trueResult = buildCronUpdatePayload({ repeat: true });
    expect(trueResult.ok).toBe(true);
    if (!trueResult.ok) throw new Error("expected ok");
    expect(trueResult.payload.repeat).toEqual({ times: null, completed: 0 });

    const falseResult = buildCronUpdatePayload({ repeat: false });
    expect(falseResult.ok).toBe(true);
    if (!falseResult.ok) throw new Error("expected ok");
    expect(falseResult.payload.repeat).toEqual({ times: 1, completed: 0 });
  });

  it("normalizes a structured repeat (times=3, completed=1)", () => {
    const result = buildCronUpdatePayload({ repeat: { times: 3, completed: 1 } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.repeat).toEqual({ times: 3, completed: 1 });
  });

  it("builds a multi-field payload in one call", () => {
    const result = buildCronUpdatePayload({
      name: "  my-job  ",
      model: "gpt-4",
      provider: "openai",
      enabled: true,
      skills: ["web-search"],
      schedule: "0 * * * *",
      repeat: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.payload.name).toBe("my-job");
    expect(result.payload.model).toBe("gpt-4");
    expect(result.payload.provider).toBe("openai");
    expect(result.payload.enabled).toBe(true);
    expect(result.payload.skills).toEqual(["web-search"]);
    expect(result.payload.schedule_display).toBe("0 * * * *");
    expect(result.payload.repeat).toEqual({ times: 1, completed: 0 });
  });

  it("returns the 400 response when schedule is invalid even if other fields are valid", () => {
    const result = buildCronUpdatePayload({
      name: "valid-name",
      model: "gpt-4",
      schedule: "totally bogus",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.response.status).toBe(400);
  });
});
