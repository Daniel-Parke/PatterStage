"use client";

// ── ChatModelSelector — the chat header's model dropdown + offline badge ──
// Extracted from app/orchestration/chat/page.tsx. Owns the registry→dropdown
// merge: the Models registry is the source of truth for selectable models
// (gateway /v1/models IDs are intentionally excluded), with CHAT_DEFAULT_MODEL
// always shown first as the pre-load fallback and a `seen` set to dedupe.

import { useMemo, useCallback } from "react";
import { InlineSelect } from "@/components/ui/Select";
import { CHAT_DEFAULT_MODEL } from "@/types/chat";
import { formatModelName } from "@/lib/chat-utils";

export interface ChatModelSelectorProps {
  model: string;
  onChange: (model: string) => void;
  registryModelIds: string[];
  modelLabels: Record<string, string>;
  modelsLoading: boolean;
  modelsError: string | null;
}

export function ChatModelSelector({
  model,
  onChange,
  registryModelIds,
  modelLabels,
  modelsLoading,
  modelsError,
}: ChatModelSelectorProps) {
  const mergedModels = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    const add = (id: string) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(id);
    };
    add(CHAT_DEFAULT_MODEL);
    for (const id of registryModelIds) add(id);
    return merged;
  }, [registryModelIds]);

  const displayModelName = useCallback(
    (id: string) => modelLabels[id] || formatModelName(id),
    [modelLabels],
  );

  return (
    <>
      <InlineSelect
        value={model}
        onChange={onChange}
        options={mergedModels.map((m) => ({ value: m, label: displayModelName(m) }))}
        accentColor="purple"
        className="w-[220px] text-xs"
        disabled={modelsLoading}
      />
      {modelsError && (
        <span className="text-xs text-neon-orange/90 font-mono" title={modelsError}>
          !
        </span>
      )}
    </>
  );
}
