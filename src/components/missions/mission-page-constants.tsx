"use client";

import type { ReactNode } from "react";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { MissionRunTone } from "@/lib/missions/mission-run-state";
import { statusToneClasses } from "@/lib/theme";

export interface StatusConfig {
  dot: "online" | "warning" | "error" | "idle";
  bg: string;
  text: string;
  icon: ReactNode;
  columnDot: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  draft: {
    dot: "idle",
    bg: "bg-ps-surface-raised",
    text: statusToneClasses.idle.text,
    icon: <Clock className={`w-3.5 h-3.5 ${statusToneClasses.idle.text}`} />,
    columnDot: statusToneClasses.idle.dot,
  },
  queued: {
    dot: "warning",
    bg: statusToneClasses.queued.fill,
    text: statusToneClasses.queued.text,
    icon: <Clock className={`w-3.5 h-3.5 ${statusToneClasses.queued.text}`} />,
    columnDot: statusToneClasses.queued.dot,
  },
  dispatched: {
    dot: "online",
    bg: statusToneClasses.running.fill,
    text: statusToneClasses.running.text,
    icon: <Loader2 className={`w-3.5 h-3.5 ${statusToneClasses.running.text} animate-spin`} />,
    columnDot: statusToneClasses.running.dot,
  },
  successful: {
    dot: "online",
    bg: statusToneClasses.ok.fill,
    text: statusToneClasses.ok.text,
    icon: <CheckCircle2 className={`w-3.5 h-3.5 ${statusToneClasses.ok.text}`} />,
    columnDot: statusToneClasses.ok.dot,
  },
  failed: {
    dot: "error",
    bg: statusToneClasses.fail.fill,
    text: statusToneClasses.fail.text,
    icon: <XCircle className={`w-3.5 h-3.5 ${statusToneClasses.fail.text}`} />,
    columnDot: statusToneClasses.fail.dot,
  },
};

/** Fallback active class for unknown category colors */
export const FALLBACK_CATEGORY_ACTIVE = "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40";

/**
 * Text colour per run tone (see describeMissionRunState). The board card and
 * the detail panel both render a duration and must agree on what "overdue"
 * looks like, so the mapping lives here rather than in either component.
 * Static strings, not an interpolated class: Tailwind only compiles what it
 * can see in the source.
 */
export const RUN_TONE_TEXT: Record<MissionRunTone, string> = {
  idle: statusToneClasses.idle.text,
  waiting: statusToneClasses.blocked.text,
  running: statusToneClasses.running.text,
  overdue: statusToneClasses.warn.text,
  // NOT the ok rung. A duration that came in on time is a NEUTRAL, not a
  // success: an on-time run is an absence of news, and painting it green would
  // make every finished mission shout the same thing twice (T-0120).
  good: "text-ps-text-secondary",
  bad: statusToneClasses.fail.text,
  // Not red. See MissionRunTone -- a cancellation is the operator's own action,
  // not a fault report. The `blocked` rung IS that orange, so the ladder keeps
  // the distinction this comment asked for rather than flattening it.
  stopped: statusToneClasses.blocked.text,
};
