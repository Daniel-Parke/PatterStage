// ═══════════════════════════════════════════════════════════════
// FrameworkProvider — cross-page active framework React Context
// ═══════════════════════════════════════════════════════════════
//
// Provides the active framework ID and setter to every page that
// needs to read or change the framework scope. Persists via the
// /api/models/framework API so changes survive page reloads.
//
// Usage: wrap <ComponentTree> with <FrameworkProvider> in layout.
// Consuming pages call useFramework() from framework-context.tsx.

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getFramework, listFrameworks, UNIVERSAL_FRAMEWORK_ID } from "@/lib/framework-registry";
import { FrameworkContext } from "@/lib/framework-context";

interface FrameworkProviderProps {
  children: ReactNode;
}

export default function FrameworkProvider({ children }: FrameworkProviderProps) {
  const [activeFrameworkId, setActiveFrameworkIdLocal] = useState<string>(UNIVERSAL_FRAMEWORK_ID);
  const [loading, setLoading] = useState(true);

  // Load persisted active framework on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/models/framework");
        if (res.ok) {
          const { data } = (await res.json()) as { data?: { active?: string } };
          if (!cancelled && data?.active) {
            setActiveFrameworkIdLocal(data.active);
          }
        }
      } catch {
        // best-effort: fall back to Universal
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const setActiveAndPersist = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/models/framework", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework: id }),
      });
      if (!res.ok) return false;
      setActiveFrameworkIdLocal(id);
      return true;
    } catch {
      return false;
    }
  }, []);

  const framework = getFramework(activeFrameworkId);
  const frameworks = listFrameworks();
  const isUniversal = activeFrameworkId === UNIVERSAL_FRAMEWORK_ID;

  return (
    <FrameworkContext.Provider value={{ activeFrameworkId, setActiveFrameworkId: setActiveAndPersist, framework, frameworks, isUniversal, loading }}>
      {children}
    </FrameworkContext.Provider>
  );
}
