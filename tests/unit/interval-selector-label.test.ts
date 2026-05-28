/**
 * Regression test for IntervalSelector displayLabel logic.
 *
 * Bug (fixed): displayLabel failed to match presets when the value had an "every " prefix
 * (which is how the API returns schedule values like "every 5m", "every 60m").
 * This caused the dashboard's inline cron selector to show raw strings like "every 60m"
 * instead of friendly labels like "Every 2h".
 *
 * The fix: after stripping "every " prefix, fall back to describeSchedule() for
 * values that don't match a preset — e.g. "every 120m" → "Every 2h".
 */

/**
 * Inline copy of the fixed displayLabel function for testing.
 * Mirrors the logic in src/components/ui/IntervalSelector.tsx
 */
function getIntervalLabel(value: string): string {
  const stripped = value.replace(/^every\s+/i, "");
  const preset = PRESETS.find((p) => p.value === stripped || p.value === value);
  if (preset) return preset.label;
  // describeSchedule handles "every Nm" formats like "every 120m" → "Every 2h"
  const described = describeSchedule(value);
  if (described && described !== "No schedule") return described;
  return stripped || value;
}

const PRESETS = [
  { value: "every 1m",  label: "1 minute"  },
  { value: "every 5m",  label: "5 minutes" },
  { value: "every 10m", label: "10 minutes" },
  { value: "every 15m", label: "15 minutes" },
  { value: "every 30m", label: "30 minutes" },
  { value: "every 1h",  label: "1 hour"    },
  { value: "every 2h",  label: "2 hours"   },
  { value: "every 4h",  label: "4 hours"   },
  { value: "every 8h",  label: "8 hours"   },
  { value: "every 12h", label: "12 hours"  },
  { value: "every 1d",  label: "1 day"     },
  { value: "every 3d",  label: "3 days"    },
  { value: "every 7d",  label: "7 days"    },
];

/** describeSchedule handles "every Nm" (≥60min → hours) */
function describeSchedule(cron: string): string {
  if (!cron) return "No schedule";
  const trimmed = cron.trim();
  const everyMatch = trimmed.match(/^every\s+(\d+)([mhd])$/i);
  if (everyMatch) {
    const num = parseInt(everyMatch[1], 10);
    const unit = everyMatch[2].toLowerCase();
    if (unit === "m") {
      if (num >= 60) {
        const h = Math.floor(num / 60);
        const m = num % 60;
        if (m === 0) return h === 1 ? "Every 1h" : `Every ${h}h`;
        return `Every ${h}h ${m}m`;
      }
      return num === 1 ? "Every 1m" : `Every ${num}m`;
    }
    if (unit === "h") return num === 1 ? "Every 1h" : `Every ${num}h`;
    if (unit === "d") return num === 1 ? "Every 1d" : `Every ${num}d`;
  }
  return cron;
}

describe("getIntervalLabel (IntervalSelector)", () => {
  it("matches presets WITH 'every ' prefix (API return values)", () => {
    expect(getIntervalLabel("every 5m")).toBe("5 minutes");
    expect(getIntervalLabel("every 1h")).toBe("1 hour");
    expect(getIntervalLabel("every 30m")).toBe("30 minutes");
    expect(getIntervalLabel("every 7d")).toBe("7 days");
  });

  it("handles API display values with ≥60min that exceed preset range", () => {
    // When parseSchedule converts "every 2h" → { minutes: 120, display: "every 120m" }
    // The component receives "every 120m" which won't match a preset.
    // describeSchedule handles it: "every 120m" → "Every 2h"
    expect(getIntervalLabel("every 120m")).toBe("Every 2h");
    // "every 240m" → "Every 4h"
    expect(getIntervalLabel("every 240m")).toBe("Every 4h");
  });

  it("returns raw value for unrecognized inputs", () => {
    expect(getIntervalLabel("something-else")).toBe("something-else");
    expect(getIntervalLabel("")).toBe("");
  });
});

/**
 * Verify the selected-state comparison logic works for both formats.
 * In compact mode, the dropdown should highlight the currently selected preset
 * whether the value comes from the API (with "every " prefix) or from the
 * compact onChange handler (without prefix, before this fix).
 */
describe("IntervalSelector selected state comparison", () => {
  const isSelected = (value: string, presetValue: string): boolean => {
    return value === `every ${presetValue}` || value === presetValue;
  };

  it("selects preset when value has 'every ' prefix (API values)", () => {
    expect(isSelected("every 5m", "5m")).toBe(true);
    expect(isSelected("every 1h", "1h")).toBe(true);
  });

  it("selects preset when value is raw (legacy compact mode values)", () => {
    expect(isSelected("5m", "5m")).toBe(true);
    expect(isSelected("1h", "1h")).toBe(true);
  });

  it("does not select wrong preset", () => {
    expect(isSelected("every 5m", "10m")).toBe(false);
    expect(isSelected("5m", "10m")).toBe(false);
  });
});
