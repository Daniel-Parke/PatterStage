"use client";

// ═══════════════════════════════════════════════════════════════
// useGame — TanStack Query data layer for the gamification engine
// ═══════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";
import type { GameView } from "@/lib/game/game-service";
import type { PullResult } from "@/lib/game/types";

async function fetchGame(): Promise<GameView> {
  const res = await safeApiCall<{ data?: GameView }>("/api/game");
  if (!res.ok || !res.data?.data) throw new Error(res.error ?? "Failed to load game");
  return res.data.data;
}

export interface PullResponse {
  ok: boolean;
  error?: string;
  result?: PullResult;
  cores?: number;
}

export function useGame() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["game"], queryFn: fetchGame, refetchInterval: 30_000, staleTime: 10_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["game"] });

  const pull = useMutation({
    mutationFn: () => safeApiCall<{ data?: PullResponse }>("/api/game/synthesis", { method: "POST" }),
    onSuccess: invalidate,
  });
  const claim = useMutation({
    mutationFn: (questId: string) => safeApiCall("/api/game/quests/claim", { method: "POST", body: { questId } }),
    onSuccess: invalidate,
  });
  const equip = useMutation({
    mutationFn: (v: { type: string; itemId: string }) => safeApiCall("/api/game/equip", { method: "POST", body: v }),
    onSuccess: invalidate,
  });
  const equipAgent = useMutation({
    mutationFn: (v: { slug: string; type: string; itemId: string }) =>
      safeApiCall(`/api/game/agents/${encodeURIComponent(v.slug)}/equip`, { method: "POST", body: { type: v.type, itemId: v.itemId } }),
    onSuccess: invalidate,
  });

  return {
    view: query.data ?? null,
    snapshot: query.data?.snapshot ?? null,
    events: query.data?.events ?? [],
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
    pull,
    claim,
    equip,
    equipAgent,
  };
}

export type { GameView };
