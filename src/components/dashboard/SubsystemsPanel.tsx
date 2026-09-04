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
import type { SubsystemRow, SubsystemState } from "@/lib/status/subsystems";

const DOT: Record<SubsystemState, string> = {
  ok: "bg-neon-green",
  degraded: "bg-neon-orange",
  down: "bg-neon-pink",
};

const WORD: Record<SubsystemState, string> = {
  ok: "ok",
  degraded: "degraded",
  down: "down",
};

const WORD_COLOR: Record<SubsystemState, string> = {
  ok: "text-neon-green",
  degraded: "text-neon-orange",
  down: "text-neon-pink",
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
            <span className="text-xs font-mono text-ps-text-muted">checked {checkedAt.replace("T", " ").slice(0, 19)}</span>
          ) : null
        }
      />
      {!subsystems ? (
        <p className="px-4 pb-4 text-xs text-ps-text-muted">Checking the gateway, memory, sync, config.yaml and the gateway gate…</p>
      ) : (
        <ul role="list" className="px-4 pb-4 space-y-2">
          {subsystems.map((row) => (
            <li key={row.id} role="listitem" data-state={row.state} className="flex items-start gap-3 text-xs">
              <span aria-hidden className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[row.state]}`} />
              <span className="w-24 shrink-0 font-mono text-ps-text-secondary">{row.label}</span>
              <span className={`w-16 shrink-0 font-mono uppercase ${WORD_COLOR[row.state]}`}>{WORD[row.state]}</span>
              <span className="min-w-0 break-words text-ps-text-muted">{row.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
