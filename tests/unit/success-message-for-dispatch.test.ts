// Unit tests for the `successMessageForDispatch` helper used in
// src/hooks/useMissionsPage.ts.
//
// The helper centralises the 4 success-toast messages for the mission
// dispatch / promote paths. Before the helper was extracted, the 4
// strings were duplicated in two 4-branch resolvers (promote path +
// dispatch path), with no testable seam.
//
// The tests below lock the 4 mode→message mappings and the cron
// schedule interpolation.

import { successMessageForDispatch } from "@/hooks/success-message-for-dispatch";

describe("successMessageForDispatch", () => {
  it("returns 'Mission saved as draft' for save mode", () => {
    expect(successMessageForDispatch("save")).toBe("Mission saved as draft");
  });

  it("returns 'Mission saved to queue' for queue mode", () => {
    expect(successMessageForDispatch("queue")).toBe("Mission saved to queue");
  });

  it("returns 'Mission dispatched' for now mode", () => {
    expect(successMessageForDispatch("now")).toBe("Mission dispatched");
  });

  it("returns 'Mission scheduled: <schedule>' for cron mode", () => {
    expect(successMessageForDispatch("cron", "0 9 * * *")).toBe(
      "Mission scheduled: 0 9 * * *",
    );
  });

  it("interpolates a complex schedule string verbatim", () => {
    // Pre-refactor the resolvers used `Mission scheduled: ${newSchedule}`
    // with no transformation; the helper preserves that exact format
    // so a future cron expression change still works without churn.
    expect(successMessageForDispatch("cron", "*/5 * * * *")).toBe(
      "Mission scheduled: */5 * * * *",
    );
  });

  it("interpolates an empty schedule string for cron mode (edge case)", () => {
    // Pre-refactor the resolver used `Mission scheduled: ${newSchedule}`
    // which produced "Mission scheduled: " (trailing space) when the
    // schedule was empty. The helper preserves this exact format.
    expect(successMessageForDispatch("cron", "")).toBe("Mission scheduled: ");
  });

  it("interpolates the literal string 'undefined' when schedule is undefined", () => {
    // Pre-refactor template-literal behaviour: `\`X: ${undefined}\``
    // produces "X: undefined". The helper preserves this (no need
    // to special-case undefined — matches the inline form).
    expect(successMessageForDispatch("cron", undefined)).toBe(
      "Mission scheduled: undefined",
    );
  });
});
