// ═══════════════════════════════════════════════════════════════
// Memory Manager — Provider-aware memory browser
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { Brain } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { MemoryProviderType } from "@/types/hermes";

// Lazy load provider-specific components
import HindsightBrowser from "@/components/memory/HindsightBrowser";

// Holographic browser (inline for backward compat)
function HolographicBrowser() {
  const [data, setData] = useState<{
    facts: Array<{
      id: number; content: string; category: string; tags: string;
      trust: number; createdAt: string; updatedAt: string;
    }>; total: number; dbSize: number; available: boolean;
    provider: string; message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading memory..." />;

  if (!data?.available) {
    return (
      <div className="text-center py-12">
        <Brain className="w-12 h-12 text-pink-400/40 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Memory Not Available</h2>
        <p className="text-sm text-white/50">{data?.message || "No memory provider configured"}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-xs text-white/30">
        {data.total} facts stored — {data.dbSize > 0 ? (data.dbSize / 1024).toFixed(1) + " KB" : "Unknown size"}
      </div>
      <div className="space-y-3">
        {data.facts.map((fact) => {
          // Parse the raw Python dict string into clean fields
          const parsed = parseHolographicFact(fact.content);
          return (
            <div key={fact.id} className="rounded-xl border border-white/10 bg-dark-900/50 p-4">
              <p className="text-sm text-white/80 leading-relaxed">{parsed.text}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                  parsed.type === "observation" ? "bg-neon-cyan/15 text-neon-cyan" :
                  parsed.type === "world" ? "bg-neon-purple/15 text-neon-purple" :
                  parsed.type === "directive" ? "bg-neon-orange/15 text-neon-orange" :
                  "bg-white/10 text-white/50"
                }`}>
                  {parsed.type}
                </span>
                {parsed.entities.length > 0 && (
                  <span className="text-[10px] text-white/40">
                    {parsed.entities}
                  </span>
                )}
                {parsed.occurred && (
                  <span className="text-[10px] text-white/30 ml-auto">
                    {parsed.occurred}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Parse a holographic fact dict string into clean display fields */
function parseHolographicFact(raw: string): {
  text: string;
  type: string;
  entities: string;
  occurred: string;
} {
  try {
    // Format: {'id': '...', 'text': '...', 'fact_type': '...', 'entities': '...', 'occurred_start': '...'}
    const textMatch = raw.match(/'text':\s*'((?:[^'\\]|\\.)*)'/);
    const typeMatch = raw.match(/'fact_type':\s*'([^']*)'/);
    const entitiesMatch = raw.match(/'entities':\s*'([^']*)'/);
    const occurredMatch = raw.match(/'occurred_start':\s*'([^']*)'/);

    const text = textMatch ? textMatch[1].replace(/\\'/g, "'") : raw;
    const type = typeMatch ? typeMatch[1] : "observation";
    const entities = entitiesMatch ? entitiesMatch[1] : "";
    const occurred = occurredMatch ? formatDate(occurredMatch[1]) : "";

    return { text, type, entities, occurred };
  } catch {
    return { text: raw, type: "observation", entities: "", occurred: "" };
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function MemoryPage() {
  const [provider, setProvider] = useState<MemoryProviderType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Detect provider from config — use a simple config read, not the memory API
    const timer = setTimeout(() => {
      if (!cancelled) {
        setProvider("none");
        setLoading(false);
      }
    }, 5000); // 5s fallback

    fetch("/api/memory", { signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setProvider(d.data?.provider || "none");
          clearTimeout(timer);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProvider("none");
          clearTimeout(timer);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const getTitle = () => {
    switch (provider) {
      case "hindsight": return "Hindsight Memory";
      case "holographic": return "Holographic Memory";
      default: return "Memory";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 grid-bg">
        <PageHeader icon={Brain} title="Memory" subtitle="Loading..." color="pink" />
        <div className="px-6 py-12"><LoadingSpinner text="Detecting memory provider..." /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      <PageHeader
        icon={Brain}
        title={getTitle()}
        subtitle={provider === "hindsight" ? "Knowledge graph memory with semantic search" :
                  provider === "holographic" ? "Structured fact storage with trust scoring" :
                  "No memory provider configured"}
        color="pink"
      />

      <div className="px-6 py-6">
        {provider === "hindsight" && <HindsightBrowser />}
        {provider === "holographic" && <HolographicBrowser />}
        {provider === "none" && (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-pink-400/40 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No Memory Provider</h2>
            <p className="text-sm text-white/50">Configure a memory provider to enable persistent memory.</p>
            <p className="text-xs text-white/30 font-mono mt-2">hermes memory setup</p>
          </div>
        )}
      </div>
    </div>
  );
}
