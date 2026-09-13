"use client";

import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import StatStrip from "@/components/viz/StatStrip";
import type { SessionTotals } from "@/lib/sessions/session-repository";

/**
 * Insights strip for the session history: source mix donut, count tiles and an
 * active-ratio ring.
 *
 * It is handed the whole-table figures the sessions repository already
 * computed for the page header, and nothing else. It used to be handed the
 * loaded page and count that instead, so the tile labelled TOTAL printed 50
 * while the header directly above it printed the real 35,790, and ACTIVE,
 * MESSAGES and CLI were page-scoped by the same mechanism without anything
 * beside them to give it away (T-0042). A strip that cannot see the page
 * cannot count the page, which is why the page is not a prop here.
 *
 * Every figure is scoped to the filter in force, exactly like the header, so
 * narrowing to one source narrows both together. Hidden when there is nothing
 * to count: a row of zeroes is noise.
 */
export default function SessionInsights({ totals }: { totals?: SessionTotals }) {
  const segments = useMemo(() => {
    const by = totals?.bySource ?? {};
    const known = [
      { label: "CLI", value: by.cli ?? 0, color: "cyan" as const },
      { label: "Mission", value: by.mission ?? 0, color: "green" as const },
      { label: "Cron", value: by.cron ?? 0, color: "orange" as const },
      { label: "API", value: by.api ?? 0, color: "purple" as const },
    ];
    // Whatever those four do not cover. `sessions.source` is a free-text
    // column and real installs carry values with no bucket on this strip, so
    // without this the donut's segments would not add up to the number
    // printed in its own centre.
    const other = (totals?.total ?? 0) - known.reduce((n, s) => n + s.value, 0);
    return other > 0
      ? [...known, { label: "Other", value: other, color: "yellow" as const }]
      : known;
  }, [totals]);

  if (!totals || totals.total === 0) return null;

  return (
    <StatStrip
      className="mb-6"
      donut={{
        segments,
        center: totals.total,
        centerSub: "sessions",
      }}
      // CLI is one of the donut's own arcs and Total is the number in its
      // centre; Active is the number in the RING beside it. What none of the
      // three pictures carries is how much was SAID - so Messages is the tile,
      // and it is the only one (T-0124).
      tiles={[
        {
          icon: MessageSquare,
          label: "Messages",
          value: totals.messages,
          color: "orange",
          // Compact, as it always was: a message count runs to six figures and
          // "918k" is the reading a person takes from a strip.
          compact: true,
          hint: "Messages across every matching session, not just the ones on this page",
        },
      ]}
      ring={{
        value: totals.active / totals.total,
        color: "green",
        label: <span className="text-body">{totals.active}</span>,
        sublabel: "active",
        hint: `${totals.active} of ${totals.total} matching sessions are still running`,
      }}
    />
  );
}
