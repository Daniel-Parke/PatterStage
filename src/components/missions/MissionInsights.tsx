"use client";

import { useMemo } from "react";
import Card from "@/components/ui/Card";
import Donut from "@/components/viz/Donut";
import ProgressRing from "@/components/viz/ProgressRing";
import { countMissionsByColumn } from "@/lib/missions/mission-board";
import { MISSION_COLUMN_LABELS } from "@/lib/status-labels";
import type { MissionRow } from "@/hooks/missions-page-types";

/**
 * Compact insights strip for the mission board — the status MIX and the success
 * RATE. Computed from the board data itself (no extra fetch), so it reflects
 * exactly what's on screen. Hidden when there are no missions.
 *
 * It used to draw four count tiles as well: Total, Running, Completed, Failed.
 * Those restated the five numbers the board writes on its own column headers,
 * a third of the way down a screen whose busiest problem was vertical space,
 * while the status filter beside them showed no counts at all. The counts moved
 * onto the filter, where a number says what you are about to filter TO rather
 * than what you can already see (T-0123).
 *
 * A mix and a rate did NOT move, because neither is a count: you cannot read
 * the success rate off a board, and the donut says at a glance what five
 * numbers say only after you have added them up.
 */
export default function MissionInsights({ missions }: { missions: MissionRow[] }) {
  // This file does not count missions. It used to, over m.status, and
  // disagreed with the board about which column a saved draft was in
  // (T-0104, C126).
  const s = useMemo(() => {
    const c = countMissionsByColumn(missions);
    const terminal = c.successful + c.failed;
    return { ...c, total: missions.length, successRate: terminal > 0 ? c.successful / terminal : 0 };
  }, [missions]);

  if (missions.length === 0) return null;
  const successPct = Math.round(s.successRate * 100);

  return (
    <Card className="animate-float-in mb-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-2">
      <div className="flex justify-center">
        <Donut
          size={96}
          thickness={12}
          segments={[
            { label: MISSION_COLUMN_LABELS.draft, value: s.draft, color: "purple" },
            { label: MISSION_COLUMN_LABELS.queued, value: s.queued, color: "orange" },
            { label: MISSION_COLUMN_LABELS.dispatched, value: s.dispatched, color: "cyan" },
            { label: MISSION_COLUMN_LABELS.successful, value: s.successful, color: "green" },
            { label: MISSION_COLUMN_LABELS.failed, value: s.failed, color: "pink" },
          ]}
          center={s.total}
          centerSub="missions"
        />
      </div>
      <div className="flex justify-center">
        <ProgressRing
          value={s.successRate}
          color="green"
          size={84}
          thickness={8}
          label={<span className="text-body">{successPct}%</span>}
          sublabel="success"
        />
      </div>
    </Card>
  );
}
