"use client";

// ═══════════════════════════════════════════════════════════════
// SubsystemsPanel: the five rows a person reads before anything else
//
// Round 6's second architecture recommendation (T-0091). Each row is a state
// in words as well as colour, a label, and the reason the collector gave.
// The reason is the point: "Gateway: down" tells nobody what to do;
// "down: could not reach http://127.0.0.1:8642 (connection refused)" does.
// ═══════════════════════════════════════════════════════════════

import { Activity } from "lucide-react";
import { Panel, PanelHeader } from "@/components/dashboard/Panel";
import { SUBSYSTEM_STATE_LABELS, statusTone } from "@/lib/status-labels";
import { statusToneClasses } from "@/lib/theme";
import type { SubsystemRow, SubsystemState } from "@/lib/status/subsystems";

/**
 * The dot takes its colour from the same word the row prints (T-0120). The
 * WORD map below is SUBSYSTEM_STATE_LABELS - Healthy, Degraded, Not running -
 * so the colour and the word cannot disagree, which is the whole point of
 * hanging tone off the ratified vocabulary.
 */
const DOT: Record<SubsystemState, string> = {
  ok: statusToneClasses[statusTone(SUBSYSTEM_STATE_LABELS.ok)].dot,
  degraded: statusToneClasses[statusTone(SUBSYSTEM_STATE_LABELS.degraded)].dot,
  down: statusToneClasses[statusTone(SUBSYSTEM_STATE_LABELS.down)].dot,
};

// The ratified words (decision 13), the same ones the pills above this panel
// use, so one screen never says "ok" and "Healthy" about the same gateway.
const WORD: Record<SubsystemState, string> = SUBSYSTEM_STATE_LABELS;

// The word and its colour come from the same place, for the same reason the
// word itself does: one screen must not say "Degraded" in the colour it uses
// for "Healthy". `down` was neon-pink, which is an accent rather than the
// danger token (T-0120).
const WORD_COLOR: Record<SubsystemState, string> = {
  ok: statusToneClasses[statusTone(SUBSYSTEM_STATE_LABELS.ok)].text,
  degraded: statusToneClasses[statusTone(SUBSYSTEM_STATE_LABELS.degraded)].text,
  down: statusToneClasses[statusTone(SUBSYSTEM_STATE_LABELS.down)].text,
};

export default function SubsystemsPanel({
  subsystems,
  checkedAt,
}: {
  subsystems: SubsystemRow[] | null;
  checkedAt: string | null;
}) {
  const worst: SubsystemState = subsystems?.some((s) => s.state === "down")
    ? "down"
    : subsystems?.some((s) => s.state === "degraded")
      ? "degraded"
      : "ok";
  return (
    <Panel accent={worst === "ok" ? "green" : worst === "degraded" ? "orange" : "pink"}>
      <PanelHeader
        icon={Activity}
        label="Subsystems"
        accent={worst === "ok" ? "green" : worst === "degraded" ? "orange" : "pink"}
        rightSlot={
          checkedAt ? (
            <span className="text-micro font-mono text-ps-text-muted">
              checked {new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          ) : null
        }
      />
      {!subsystems ? (
        <p className="px-4 pb-4 text-body text-ps-text-muted">Checking the gateway, memory, sync, config.yaml and the gateway gate…</p>
      ) : (
        <ul role="list" className="px-4 pb-4 space-y-2">
          {subsystems.map((row) => (
            <li key={row.id} role="listitem" data-state={row.state} className="flex items-start gap-3 text-body">
              <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[row.state]}`} />
              <span className="w-24 shrink-0 font-mono text-ps-text-secondary">{row.label}</span>
              <span className={`w-24 shrink-0 font-mono ${WORD_COLOR[row.state]}`}>{WORD[row.state]}</span>
              <span className="min-w-0 break-words text-ps-text-muted">{row.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
