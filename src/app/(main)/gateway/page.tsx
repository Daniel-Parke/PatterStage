// ═══════════════════════════════════════════════════════════════
// Gateway Status — Platform connection status
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Globe,
  MessageCircle,
  Hash,
  Phone,
  RefreshCw,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AppPageShell from "@/components/layout/AppPageShell";
import Button from "@/components/ui/Button";

interface GatewayData {
  platforms: Record<string, boolean>;
  connectedCount: number;
  lastSynced: string | null;
}

const platformMeta: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  telegram: { icon: MessageCircle, color: "text-neon-cyan", label: "Telegram" },
  discord: { icon: Hash, color: "text-neon-purple", label: "Discord" },
  slack: { icon: Globe, color: "text-neon-green", label: "Slack" },
  whatsapp: { icon: Phone, color: "text-neon-green", label: "WhatsApp" },
};

export default function GatewayPage() {
  const [data, setData] = useState<GatewayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gateway", { signal });
      if (!res.ok) throw new Error("Failed to load gateway data");
      const json = await res.json();
      if (!signal?.aborted) setData(json.data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    loadData(controller.signal);
    return () => { controller.abort(); };
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    loadData(controller.signal);
  }, [loadData]);

  return (
    <AppPageShell>
      <PageHeader
        title="Gateway Status"
        subtitle="Platform connections and recent gateway logs"
        icon={Globe}
        color="cyan"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={loading}
            icon={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {loading && !data ? (
          <LoadingSpinner text="Loading gateway status..." />
        ) : error ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        ) : (
          <>
            {/* Platform Status Cards */}
            <div>
              <h2 className="text-sm font-mono text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe className="w-3 h-3 text-neon-cyan" />
                Platform Connections
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
                {Object.entries(platformMeta).map(([key, meta]) => {
                  const active = data?.platforms?.[key] ?? false;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-5 transition-all min-w-0 ${
                        active
                          ? "border-neon-green/30 bg-dark-900/50"
                          : "border-white/5 bg-dark-900/30 opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Icon
                          className={`w-5 h-5 ${active ? meta.color : "text-white/20"}`}
                        />
                        <div
                          className={`w-2 h-2 rounded-full ${
                            active ? "bg-neon-green pulse-glow" : "bg-white/20"
                          }`}
                        />
                      </div>
                      <div className="text-base font-semibold text-white">
                        {meta.label}
                      </div>
                      <div className="text-xs text-white/40 font-mono mt-1">
                        {active ? "Connected" : "Disabled"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        )}
      </div>
    </AppPageShell>
  );
}
