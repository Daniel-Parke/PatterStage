// ═══════════════════════════════════════════════════════════════
// useQuestHost — the four things a quest can need from this install
//
// Most quests are attemptable anywhere. Four are not: chat and dispatch want a
// reachable agent, retaining a fact wants a memory provider, the Composer
// quests want the flag, and putting a host script on a timer wants a scheduler
// native Windows does not have (decision 10). This hook reads those four
// answers so `questAvailable` can be asked about a real host.
//
// EVERY CAPABILITY IS TRUE WHILE UNKNOWN. A status endpoint that has not
// answered yet, or one that failed, must never hide a quest: the operator
// would be shown a shorter programme than they own with no way to tell that
// apart from a shorter programme than they can run. "Unavailable" is a claim,
// and this hook only makes it once something actually said so.
//
// Three GETs, and not one of them evaluates a quest. Completion arrives on the
// /api/stats poll the shell already runs, which is why the page costs nothing
// extra for the part that matters.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMemo } from "react";

import type { QuestHostCapabilities } from "@/lib/quests/quest-defs";
import type { RuntimeStatus } from "@/lib/status/runtime-status-format";
import type { SubsystemRow, SubsystemSummary } from "@/lib/status/subsystems";

import { useApiResource } from "./useApiResource";
import { useFeatureFlags } from "./useFeatureFlags";

export function useQuestHost(): QuestHostCapabilities {
  const subsystems = useApiResource<SubsystemRow[]>(["status-subsystems"], "/api/status/subsystems", {
    select: (p) => (p as SubsystemSummary | undefined)?.subsystems,
    fallback: [],
    staleTime: 30_000,
  });
  // The same key the System page reads under, so the two share one answer.
  const runtime = useApiResource<RuntimeStatus>(["runtime-status"], "/api/status/runtime", {
    select: (p) => p as RuntimeStatus | undefined,
    staleTime: 60_000,
  });
  const flags = useFeatureFlags();

  const rows = subsystems.data;
  const platform = runtime.data?.platform;
  const composerFlag = flags.data?.composer;

  return useMemo(() => {
    // A row this install did not send is not a row that is down.
    const up = (id: SubsystemRow["id"]): boolean => {
      const row = rows?.find((r) => r.id === id);
      return row ? row.state !== "down" : true;
    };
    return {
      gateway: up("gateway"),
      memory: up("memory"),
      composer: composerFlag !== false,
      hostScheduler: platform ? platform !== "win32" : true,
    };
  }, [rows, platform, composerFlag]);
}
