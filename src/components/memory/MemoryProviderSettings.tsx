// ═══════════════════════════════════════════════════════════════
// MemoryProviderSettings — PatterStage-owned memory provider config
//
// Edit the active provider's host/port/bank and Test connection — all stored in
// the DB (memory_providers), so the endpoint changes with NO Hermes file edits.
// This is the cure for the recurring port/path/db churn.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/field";
import { safeApiCall } from "@/lib/api-fetch";

interface Cfg {
  host: string;
  port: number;
  bank: string;
}
interface Health {
  available: boolean;
  status?: string;
  error?: string;
}

export default function MemoryProviderSettings() {
  const [cfg, setCfg] = useState<Cfg>({ host: "127.0.0.1", port: 9177, bank: "hermes" });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  // Whether a human has ever saved this endpoint, or it is still the shipped
  // guess. See the note beside the banner below.
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await safeApiCall<{
        data?: { active?: { config?: Cfg }; providers?: { type: string; isActive: boolean; confirmed: boolean }[] };
      }>("/api/memory/config");
      const payload = (res.data as {
        data?: { active?: { config?: Cfg }; providers?: { type: string; isActive: boolean; confirmed: boolean }[] };
      } | undefined)?.data;
      const c = payload?.active?.config;
      if (c) setCfg({ host: c.host, port: c.port, bank: c.bank });
      const activeRow = payload?.providers?.find((p) => p.isActive);
      setConfirmed(activeRow ? activeRow.confirmed : null);
    })();
  }, []);

  async function test(): Promise<Health | null> {
    setTesting(true);
    setHealth(null);
    try {
      const res = await safeApiCall<{ health?: Health }>("/api/memory/config", {
        method: "POST",
        body: { action: "test", config: cfg },
      });
      const h = (res.data as { health?: Health } | undefined)?.health ?? {
        available: false,
        error: res.error ?? "Connection test failed",
      };
      setHealth(h);
      return h;
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await safeApiCall("/api/memory/config", {
        method: "PUT",
        body: { type: "hindsight", label: "Hindsight", enabled: true, makeActive: true, config: cfg },
      });
      setSavedMsg(res.ok ? "Saved — endpoint updated." : res.error ?? "Save failed");
      if (res.ok) {
        setConfirmed(true);
        await test();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="md" glow="pink">
      <div className="mb-3 flex items-center gap-2">
        <Plug className="h-4 w-4 text-neon-pink" />
        <h2 className="text-sm font-semibold text-white">Memory provider</h2>
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs font-mono uppercase tracking-wider text-ps-text-muted">
          Hindsight
        </span>
      </div>
      <p className="mb-4 text-xs text-ps-text-muted">
        PatterStage owns this connection — edit it here, no Hermes file edits. Stored in the database.
      </p>

      {/* Say out loud that the endpoint below is a guess until somebody confirms
          it. The shipped default is 127.0.0.1:9177, which is exactly where a
          real Hindsight listens — so a second install on one machine connects
          to the first operator's memory and renders their facts as its own.
          That is not hypothetical: it is how a throwaway QA instance came to
          display the operator's real memories. The auto-connect stays, because
          it is what makes a fresh install work with no setup; what changes is
          that the product stops presenting a guess as a decision (T-0077). */}
      {confirmed === false && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-neon-orange/30 bg-neon-orange/10 px-3 py-2 text-xs text-neon-orange"
        >
          Using the built-in default — not yet confirmed. PatterStage guessed{" "}
          <span className="font-mono">
            {cfg.host}:{cfg.port}
          </span>
          . If another memory service is already running there, this will show its
          memories rather than yours. Check the values and press Save to confirm.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_1fr]">
        <Field label="Host" htmlFor="mp-host">
          <Input
            id="mp-host"
            value={cfg.host}
            onChange={(e) => setCfg({ ...cfg, host: e.target.value })}
            placeholder="127.0.0.1"
          />
        </Field>
        <Field label="Port" htmlFor="mp-port">
          <Input
            id="mp-port"
            type="number"
            value={cfg.port}
            onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) || 0 })}
            placeholder="9177"
          />
        </Field>
        <Field label="Bank" htmlFor="mp-bank">
          <Input
            id="mp-bank"
            value={cfg.bank}
            onChange={(e) => setCfg({ ...cfg, bank: e.target.value })}
            placeholder="hermes"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" color="cyan" size="sm" loading={testing} onClick={() => void test()}>
          <Plug className="h-4 w-4" /> Test connection
        </Button>
        <Button variant="primary" color="pink" size="sm" loading={saving} onClick={() => void save()}>
          Save
        </Button>
        {health ? (
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${health.available ? "text-neon-green" : "text-neon-pink"}`}
          >
            {health.available ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {health.available ? `Connected (${health.status ?? "healthy"})` : health.error ?? "Unreachable"}
          </span>
        ) : testing ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ps-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Probing…
          </span>
        ) : null}
        {savedMsg ? <span className="text-xs text-ps-text-muted">{savedMsg}</span> : null}
      </div>
    </Card>
  );
}
