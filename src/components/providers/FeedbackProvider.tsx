// ═══════════════════════════════════════════════════════════════
// FeedbackProvider — the shell's one feedback surface
//
// Toast had one slot (T-0096, D122). T-0050 made an error toast persist
// because it is the only place its own reason appears, and then any later
// showToast, a routine success from a background poll included, replaced
// that error before it was read. Every page also rendered its own
// <Toast>, so the achievement-unlock toast belonged to the dashboard and
// fired only while the dashboard was open.
//
// This provider is mounted once in the root layout and owns:
//   - the stack: three toasts at most, and a success never evicts an error;
//   - the achievement-unlock toast, on any page, from the same stats poll
//     the dashboard already runs (react-query dedupes the request);
//   - the quest tracker (T-0111, B17), which is a child rather than a hook
//     because it reads the context this provider supplies.
//
// useToast() reads the context and keeps its API, so the 73 call sites are
// untouched. A component rendered without the shell falls back to the old
// single slot; that path exists for tests and is not the product's.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import QuestTracker from "@/components/quests/QuestTracker";
import { FeedbackContext } from "@/components/ui/feedback-context";
import { ToastView, type ToastType } from "@/components/ui/Toast";
import { useAchievementUnlocks } from "@/hooks/useAchievementUnlocks";
import { useStats } from "@/hooks/useStats";
import type { Achievement } from "@/lib/stats/derive";

const MAX_TOASTS = 3;

interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
}

let nextToastId = 1;

/**
 * Push onto the stack, evicting when full. The oldest NON-error goes first;
 * only when every slot holds an error does the oldest error go, because a
 * stack that can never shrink is a stack that fills the screen.
 */
function pushToast(stack: ToastEntry[], entry: ToastEntry): ToastEntry[] {
  const next = [...stack, entry];
  if (next.length <= MAX_TOASTS) return next;
  const oldestSuccess = next.findIndex((t, i) => i < next.length - 1 && t.type !== "error");
  const victim = oldestSuccess === -1 ? 0 : oldestSuccess;
  return next.filter((_, i) => i !== victim);
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToasts((stack) => pushToast(stack, { id: nextToastId++, message, type }));
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((stack) => stack.filter((t) => t.id !== id));
  }, []);

  // The achievement toast, from the shell. First poll seeds silently; each
  // id fires once (useAchievementUnlocks owns that rule).
  const { stats } = useStats();
  useAchievementUnlocks(
    stats?.achievements,
    useCallback((a: Achievement) => showToast(`🏆 Achievement unlocked — ${a.name}`, "success"), [showToast]),
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {/* Inside the context, so it can ask for a toast the way a page does.
          It renders nothing and reads the stats poll above it. */}
      <QuestTracker />
      {children}
      {toasts.map((t, index) => (
        <ToastView key={t.id} index={index} message={t.message} type={t.type} onClose={() => dismiss(t.id)} />
      ))}
    </FeedbackContext.Provider>
  );
}
