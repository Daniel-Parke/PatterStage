// ═══════════════════════════════════════════════════════════════
// Quests — the programme, seven chapters of it
//
// Decision 4: real actions, proved by what PatterStage already records. The
// whole evaluation rides in on the /api/stats poll the shell runs anyway, so
// this page adds no endpoint and costs no request for the part that decides
// whether a quest is done. The three GETs it does make are about the HOST, not
// about progress: whether the agent, the memory provider, the Composer and a
// host scheduler are there to attempt four of the quests with.
//
// A failed stats read says so and keeps its Retry. It does not fall back to a
// page of zeros, which would tell an operator with thirty quests behind them
// that they had none (T-0096, the read contract).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useMemo } from "react";
import { Trophy } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import QuestChapter from "@/components/quests/QuestChapter";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import ProgressRing from "@/components/viz/ProgressRing";
import { useOperatorPrefs } from "@/hooks/useOperatorPrefs";
import { useQuestHost } from "@/hooks/useQuestHost";
import { useStats } from "@/hooks/useStats";
import type { QuestState } from "@/lib/quests/evaluate";
import { questAvailable } from "@/lib/quests/quest-defs";

export default function QuestsPage() {
  const { stats, error, refetch } = useStats();
  const { prefs, setPref, saveError } = useOperatorPrefs();
  const host = useQuestHost();
  const progress = stats?.quests ?? null;

  /**
   * The ids to write back when one more is skipped.
   *
   * The stored array is the source, because it can hold an id this build no
   * longer defines and a write that dropped it would delete an operator's
   * choice on their behalf. The server's own view is folded in as well, so a
   * click landing before the preferences read lands cannot erase what the
   * server's latch already holds.
   */
  const skipped = useMemo(() => {
    const stored = prefs["quests.skipped"];
    const fromPrefs = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
    const fromServer = progress?.quests.filter((q) => q.skipped).map((q) => q.id) ?? [];
    return [...new Set([...fromPrefs, ...fromServer])];
  }, [prefs, progress]);

  const skip = useCallback(
    (id: string) => setPref("quests.skipped", [...skipped.filter((x) => x !== id), id]),
    [setPref, skipped],
  );
  const unskip = useCallback(
    (id: string) => setPref("quests.skipped", skipped.filter((x) => x !== id)),
    [setPref, skipped],
  );
  const available = useCallback((quest: QuestState) => questAvailable(quest, host), [host]);

  return (
    <AppPageShell>
      <PageHeader
        icon={Trophy}
        subtitle="Real actions, tracked, from your first message to your first backup"
        color="orange"
      />
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-6 py-8">
        {error && (
          <LoadErrorBanner
            error={error}
            onRetry={() => void refetch()}
            hint="Your progress is read from the same poll the dashboard uses; nothing has been lost."
          />
        )}
        {/*
          A refused write is a persistent line, not a toast: the operator is
          looking at the control they just pressed, and a message that fades
          leaves a Skip that visibly did nothing and never said why.
        */}
        {saveError && <LoadErrorBanner error={saveError} compact />}

        {!error && !progress && <LoadingSpinner text="Reading your progress..." />}

        {progress && (
          <>
            <header className="flex flex-wrap items-center gap-5 rounded-xl border border-white/10 bg-dark-900/40 p-5">
              <ProgressRing
                value={progress.total > 0 ? progress.completed / progress.total : 0}
                color="orange"
                label={`${progress.completed}/${progress.total}`}
                sublabel="quests"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm text-ps-text-secondary">
                  Every one of these is something to actually do in PatterStage. Each ticks itself when
                  the product records you doing it, so there is nothing here to mark off by hand.
                </p>
                <p className="font-mono text-xs text-ps-text-muted">
                  {progress.chapters.length} chapters, first to last.
                </p>
              </div>
            </header>

            <div className="space-y-2">
              {progress.chapters.map((chapter) => (
                <QuestChapter
                  key={chapter.id}
                  chapter={chapter}
                  quests={progress.quests.filter((q) => q.chapter === chapter.number)}
                  available={available}
                  onSkip={skip}
                  onUnskip={unskip}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppPageShell>
  );
}
