// ═══════════════════════════════════════════════════════════════
// Memory Manager — Provider-aware memory browser
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { Brain } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AppPageShell from "@/components/layout/AppPageShell";
import type { MemoryProviderType, MemoryData } from "@/types/hermes";
import { timeAgo } from "@/lib/utils";

// Lazy load provider-specific components
import HindsightBrowser from "@/components/memory/HindsightBrowser";

// Holographic browser (inline for holographic provider)
function HolographicBrowser({ initialData }: {
  initialData?: MemoryData | null;
}) {
  const [data, setData] = useState<MemoryData | null>(() => initialData ?? null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    // Only fetch if no initial data was provided by the parent
    if (initialData) return;
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => { /* silently handled by data.available check */ })
      .finally(() => setLoading(false));
  }, [initialData]);

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
    const occurred = occurredMatch ? timeAgo(occurredMatch[1]) : "";

    return { text, type, entities, occurred };
  } catch {
    return { text: raw, type: "observation", entities: "", occurred: "" };
  }
}

const PROVIDER_META: Record<string, { title: string; description: string }> = {
  hindsight: { title: "Hindsight Memory", description: "Knowledge graph memory with semantic search" },
  holographic: { title: "Holographic Memory", description: "Structured fact storage with trust scoring" },
};

export default function MemoryPage() {
  const [provider, setProvider] = useState<MemoryProviderType | null>(null);
  const [memData, setMemData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    fetch("/api/memory", { signal })
      .then((r) => r.json())
      .then((d) => {
        if (!signal.aborted) {
          setProvider(d.data?.provider || "none");
          setMemData(d.data || null);
        }
      })
      .catch(() => {
        if (!signal.aborted) {
          setProvider("none");
        }
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, []);

  const title = PROVIDER_META[provider ?? ""]?.title || "Memory";
  const description = provider
    ? (PROVIDER_META[provider]?.description || "No memory provider configured")
    : "Loading...";

  if (loading) {
    return (
      <AppPageShell>
        <PageHeader icon={Brain} title="Memory" subtitle="Loading..." color="pink" />
        <div className="px-6 py-12"><LoadingSpinner text="Detecting memory provider..." /></div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <PageHeader
        icon={Brain}
        title={title}
        subtitle={description}
        color="pink"
      />

      <div className="px-6 py-6">
        {provider === "hindsight" && <HindsightBrowser />}
        {provider === "holographic" && memData && <HolographicBrowser initialData={memData} />}
        {provider === "none" && (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-pink-400/40 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No Memory Provider</h2>
            <p className="text-sm text-white/50">Configure a memory provider to enable persistent memory.</p>
            <p className="text-xs text-white/30 font-mono mt-2">hermes memory setup</p>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}


