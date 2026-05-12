// ═══════════════════════════════════════════════════════════════
// Framework Context — cross-page active framework React Context
// ═══════════════════════════════════════════════════════════════
//
// Exported from lib so both pages (Models, Agents) can consume it.
// Provider is defined in components/models/FrameworkProvider.tsx.

"use client";

import { createContext, useContext } from "react";
import type { FrameworkEntry } from "@/lib/framework-registry";

export interface FrameworkContextValue {
  activeFrameworkId: string;
  setActiveFrameworkId: (id: string) => Promise<boolean>;
  framework: FrameworkEntry | undefined;
  frameworks: FrameworkEntry[];
  isUniversal: boolean;
  loading: boolean;
}

export const FrameworkContext = createContext<FrameworkContextValue | null>(null);

/** Hook to access the cross-page active framework state. */
export function useActiveFramework(): FrameworkContextValue {
  const ctx = useContext(FrameworkContext);
  if (!ctx) throw new Error("useActiveFramework must be used within <FrameworkProvider>");
  return ctx;
}

// Re-export the provider for convenience
export { default as FrameworkProvider } from "@/components/models/FrameworkProvider";
