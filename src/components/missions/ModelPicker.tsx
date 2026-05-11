"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal shape of a model returned by /api/models. */
interface ApiModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string | null;
  contextLength: number | null;
  credentialsId: string | null;
  frameworkId: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape of defaults returned by /api/models/defaults. */
interface ApiDefaults {
  agent: string | null;
  hindsight: string | null;
  compression: string | null;
  vision: string | null;
  web_extract: string | null;
  session_search: string | null;
  title_generation: string | null;
  skills_hub: string | null;
  mcp: string | null;
  triage_specifier: string | null;
  approval: string | null;
  delegation: string | null;
}

interface ModelPickerProps {
  /** Hermes CLI model id (e.g. anthropic/claude-sonnet-4). */
  modelId: string;
  /** Hermes CLI provider id. */
  provider: string;
  onChange: (modelId: string, provider: string) => void;
  /** Optional id for labels / tests */
  id?: string;
  /**
   * `below` — helper paragraph under empty/error state (default).
   * `tooltip` — long copy on `title` only so row height matches loaded state.
   */
  helperPlacement?: "below" | "tooltip";
}

/**
 * Registry-backed model select. Emits Hermes `modelId` + `provider` strings
 * (same shape as built-in templates and dispatch).
 */
const EMPTY_REGISTRY_TITLE =
  "Configure models under Config → Models. Dispatch falls back to Hermes config when none selected.";

export default function ModelPicker({
  modelId,
  provider,
  onChange,
  id = "mission-model-picker",
  helperPlacement = "below",
}: ModelPickerProps) {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [defaults, setDefaults] = useState<ApiDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didAutoFill = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (modelId.trim() === "" && provider.trim() === "") {
      didAutoFill.current = false;
    }
  }, [modelId, provider]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/models").then((r) => r.json()),
      fetch("/api/models/defaults").then((r) => r.json()),
    ])
      .then(([mRes, dRes]) => {
        const list = (mRes.data?.models ?? []) as ApiModel[];
        const def = (dRes.data?.defaults ?? null) as ApiDefaults | null;
        setModels(list);
        setDefaults(def);
      })
      .catch(() => {
        setError("Failed to load models");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const registryValue = (() => {
    const m = models.find((x) => x.modelId === modelId && x.provider === provider);
    if (m) return m.id;
    return "";
  })();

  useEffect(() => {
    if (loading || models.length === 0 || didAutoFill.current) return;
    if (modelId.trim() !== "" || provider.trim() !== "") return;
    const fromSlot =
      defaults?.agent && models.find((x) => x.id === defaults.agent);
    const pick = fromSlot || models[0] || null;
    if (pick) {
      didAutoFill.current = true;
      onChangeRef.current(pick.modelId, pick.provider);
    }
  }, [loading, models, defaults, modelId, provider]);

  const handleSelect = (registryId: string) => {
    if (!registryId) {
      onChange("", "");
      return;
    }
    const row = models.find((x) => x.id === registryId);
    if (row) onChange(row.modelId, row.provider);
  };

  if (loading) {
    return (
      <select
        id={id}
        disabled
        className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/40 font-mono"
      >
        <option>Loading models…</option>
      </select>
    );
  }

  if (error || models.length === 0) {
    const optionLabel =
      models.length === 0
        ? "No models registered — Hermes default will be used"
        : error ?? "Models unavailable";
    if (helperPlacement === "tooltip") {
      return (
        <select
          id={id}
          disabled
          title={
            models.length === 0
              ? `${optionLabel}\n\n${EMPTY_REGISTRY_TITLE}`
              : String(error ?? "Models unavailable")
          }
          className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/40 font-mono"
        >
          <option>{optionLabel}</option>
        </select>
      );
    }
    return (
      <div className="space-y-1">
        <select
          id={id}
          disabled
          className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/40 font-mono"
        >
          <option>{optionLabel}</option>
        </select>
        <p className="text-[10px] text-white/25 font-mono">{EMPTY_REGISTRY_TITLE}</p>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={registryValue}
      onChange={(e) => handleSelect(e.target.value)}
      className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-neon-cyan/50 font-mono"
    >
      <option value="">Default (registry / Hermes)</option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} — {m.modelId}
        </option>
      ))}
    </select>
  );
}
