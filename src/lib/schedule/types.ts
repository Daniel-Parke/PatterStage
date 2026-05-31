/** Result of parsing a schedule string for Hermes `jobs.json` (see nested Hermes `parse_schedule`). */
export type ParsedSchedule =
  | { kind: "interval"; minutes: number; display: string }
  | { kind: "cron"; expr: string; display: string }
  | { kind: "once"; run_at: string; display: string }
  | { kind: "invalid"; raw: string; message: string };

/**
 * Parse a cron expression (or "every N" string) into a human-readable label for display.
 * Handles all common patterns produced by parseSchedule(): star-slash-N, daily, weekly,
 * monthly, weekdays, "every N" format (e.g. "every 5m", "every 1h", "every 7d"), etc.
 * Returns null if the expression doesn't match any known pattern.
 */
export function parseCronExpression(expr: string): string | null {
  if (!expr) return null;
  const trimmed = expr.trim();

  // Handle "every N" format used by the cron API
  const everyMatch = trimmed.match(/^every\s+(\d+)([mhd])$/i);
  if (everyMatch) {
    const num = parseInt(everyMatch[1], 10);
    const unit = everyMatch[2].toLowerCase();
    if (unit === "m") {
      if (num >= 60) {
        const h = Math.floor(num / 60);
        const m = num % 60;
        if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
        return `${h}h ${m}m`;
      }
      return num === 1 ? "1 minute" : `${num} minutes`;
    }
    if (unit === "h") return num === 1 ? "1 hour" : `${num} hours`;
    if (unit === "d") return num === 1 ? "1 day" : `${num} days`;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) return null;
  const [min, hour, dom, mon, dow] = parts;

  // Every N minutes: */N * * * *
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${min.slice(2)}m`;
  }

  // Every N hours: 0 */N * * *
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${hour.slice(2)}h`;
  }

  // Every minute: * * * * *
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return "Every minute";
  }

  // Every hour at MM past: MM * * * *
  if (min !== "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const m = parseInt(min);
    if (Number.isFinite(m) && m >= 0 && m <= 59) {
      return `Hourly :${String(m).padStart(2, "0")}`;
    }
  }

  // Daily at HH:MM: 0 HH * * *
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Daily ${displayHour}:${displayMin}${period}`;
    }
  }

  // Weekly on specific day: 0 HH * * D
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayIndex = parseInt(dow);
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(dayIndex) && dayIndex >= 0 && dayIndex <= 6 && Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `${days[dayIndex]}s ${displayHour}:${displayMin}${period}`;
    }
  }

  // Monthly: 0 HH DD * *
  if (min !== "*" && hour !== "*" && dom !== "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    const d = parseInt(dom);
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(d)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Day ${d} ${displayHour}:${displayMin}${period}`;
    }
  }

  // Weekdays (1-5): 0 HH * * 1-5
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && /^[1-5](,[1-5])*$/.test(dow)) {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Weekdays ${displayHour}:${displayMin}${period}`;
    }
  }

  return null;
}

/**
 * Parse a cron expression (or interval shorthand) into a human-readable string for display.
 * Handles common patterns: "every Nm", interval minutes, interval hours, daily, weekly, etc.
 * Falls back to the raw expression for unrecognised patterns.
 */
export function describeSchedule(cron: string): string {
  if (!cron) return "No schedule";
  const trimmed = cron.trim();

  // Handle "every N" format (e.g. "every 5m", "every 1h", "every 7d")
  // — produced by parseSchedule display field and used by IntervalSelector / ScheduleSelector.
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

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  // Every N minutes: */N * * * *
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${min.slice(2)}m`;
  }
  // Every N hours: 0 */N * * *
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${hour.slice(2)}h`;
  }
  // Daily at specific hour: 0 H * * *
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow === "*") {
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Daily at ${displayHour}:${displayMin} ${period}`;
    }
  }
  // Weekly on specific day: 0 H * * D
  if (min !== "*" && hour !== "*" && dom === "*" && mon === "*" && dow !== "*") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayIndex = parseInt(dow);
    const h = parseInt(hour);
    const m = parseInt(min);
    if (Number.isFinite(dayIndex) && dayIndex >= 0 && dayIndex <= 6 && Number.isFinite(h) && Number.isFinite(m)) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMin = String(m).padStart(2, "0");
      return `Every ${days[dayIndex]} at ${displayHour}:${displayMin} ${period}`;
    }
  }
  return cron;
}
