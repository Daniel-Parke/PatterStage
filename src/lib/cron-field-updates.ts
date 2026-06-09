// ═══════════════════════════════════════════════════════════════
// cron-field-updates.ts — build UpdateCronJobInput from a PUT body
// ═══════════════════════════════════════════════════════════════
//
// Cron PUT bodies carry an opaque bag of optional fields. The previous
// implementation inlined an 11-branch conditional ladder in the route
// handler, which (a) was hard to unit-test in place and (b) made the
// 400-on-invalid-schedule branch easy to overlook. This module factors
// the per-field handling into a single pure function so the field-shape
// contract is testable in isolation and the route handler can stay flat.

import { NextResponse } from "next/server";
import { parseSchedule } from "@/lib/utils";
import { normalizeRepeat } from "@/lib/cron-repository";
import type { UpdateCronJobInput } from "@/lib/cron/types";

export interface CronUpdateResult {
  ok: true;
  payload: UpdateCronJobInput;
}
export interface CronUpdateFailure {
  ok: false;
  response: NextResponse;
}

/**
 * Build an `UpdateCronJobInput` from a partial PUT body.
 *
 * - Only fields that are present (i.e. `!== undefined`) are included.
 * - `schedule` is parsed; an invalid value returns `{ ok: false, response }`
 *   with a 400 status. The route handler should `return` the response
 *   immediately and not touch the payload.
 * - `repeat` is normalized via `normalizeRepeat` (handles the boolean /
 *   object ambiguity that arrives from clients).
 */
export function buildCronUpdatePayload(
  updates: Record<string, unknown>,
): CronUpdateResult | CronUpdateFailure {
  const payload: UpdateCronJobInput = {};

  if (updates.name !== undefined) payload.name = String(updates.name).trim();
  if (updates.prompt !== undefined) payload.prompt = String(updates.prompt);
  if (updates.skills !== undefined) payload.skills = updates.skills as string[];
  if (updates.model !== undefined) payload.model = String(updates.model);
  if (updates.provider !== undefined) payload.provider = String(updates.provider);
  if (updates.base_url !== undefined) {
    payload.base_url = updates.base_url as string | null;
  }
  if (updates.deliver !== undefined) payload.deliver = String(updates.deliver);
  if (updates.script !== undefined) {
    payload.script = updates.script as string | null;
  }
  if (updates.profile_name !== undefined) {
    payload.profile_name = String(updates.profile_name);
  }
  if (updates.enabled !== undefined) payload.enabled = Boolean(updates.enabled);
  if (updates.state !== undefined) payload.state = String(updates.state);

  if (updates.schedule !== undefined) {
    const scheduleStr = String(updates.schedule).trim();
    const parsed = parseSchedule(scheduleStr);
    if (parsed.kind === "invalid") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: parsed.message || `Invalid schedule: "${scheduleStr}"` },
          { status: 400 },
        ),
      };
    }
    // Canonical storage: the raw 5-field cron expression goes into
    // `schedule`. Storing `JSON.stringify(parsed)` here (the prior
    // behaviour) wrapped the cron in `{"kind":"cron","expr":"...","display":"..."}`
    // and the next read/write round-trip with Hermes corrupted the job to
    // `kind: "invalid"`. See src/lib/cron/write.ts for the full rationale.
    payload.schedule = scheduleStr;
    payload.schedule_display =
      "display" in parsed
        ? (parsed as { display: string }).display
        : scheduleStr;
  }

  if (updates.repeat !== undefined) {
    payload.repeat = normalizeRepeat(updates.repeat);
  }

  return { ok: true, payload };
}
