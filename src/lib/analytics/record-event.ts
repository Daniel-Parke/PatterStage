// ═══════════════════════════════════════════════════════════════
// analytics/record-event.ts — the single, safe event emit helper
//
// recordEvent() is called inline at action points (mission dispatch, story
// chapter, schedule fire, …). It MUST NEVER throw into the caller's hot path
// and MUST NOT write in read-only mode. Everything is best-effort: a failed
// insert is logged and swallowed, never surfaced to the dispatch/route logic.
// ═══════════════════════════════════════════════════════════════

import { isReadOnly } from "../api-auth";
import { logApiError } from "../api-logger";
import { insertEvent } from "./analytics-repository";
import type { AnalyticsEventType, AnalyticsEntityType } from "./event-types";

export interface RecordEventOptions {
  entityType?: AnalyticsEntityType;
  entityId?: string | null;
  profile?: string | null;
  /** Small JSON-serialisable payload (e.g. { tokens, enabled }). */
  metadata?: Record<string, unknown>;
}

/**
 * Record one analytics event. Best-effort and side-effect-only:
 * - no-ops when the hub is in read-only mode,
 * - never throws (including on a non-serialisable `metadata`),
 * - logs failures via logApiError rather than propagating them.
 */
export function recordEvent(type: AnalyticsEventType, opts: RecordEventOptions = {}): void {
  try {
    if (isReadOnly()) return;
    insertEvent({
      eventType: type,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      profile: opts.profile ?? null,
      metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
    });
  } catch (err) {
    logApiError("analytics.recordEvent", type, err);
  }
}
