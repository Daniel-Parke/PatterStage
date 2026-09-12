"use client";

import { useEffect, useMemo, useRef } from "react";
import { useModels, useModelDefaults } from "@/hooks/useModels";
import { InlineSelect } from "@/components/ui/Select";

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
 * Hermes model select for mission dispatch. Emits Hermes `modelId` + `provider` strings
 * (same shape as built-in templates and dispatch).
 */
const EMPTY_DEFAULT_HINT =
  "Configure models under Agent → Models. Dispatch falls back to Hermes config when none selected.";

export default function ModelPicker({
  modelId,
  provider,
  onChange,
  id = "mission-model-picker",
  helperPlacement = "below",
}: ModelPickerProps) {
  const { data: modelsData, isLoading: modelsLoading, error } = useModels();
  const { data: defaults, isLoading: defaultsLoading } = useModelDefaults();
  const models = useMemo(() => modelsData ?? [], [modelsData]);
  const loading = modelsLoading || defaultsLoading;
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

  const selectedValue = (() => {
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

  // One select in three states, where there were three selects. While it is
  // loading or has nothing to offer it is disabled and its only option says
  // why; the tooltip placement says the rest through `title`, so the row
  // stays the height of the loaded one.
  const empty = models.length === 0;
  const unavailable = !loading && (Boolean(error) || empty);
  const placeholder = loading
    ? "Loading models…"
    : empty
      ? "No models registered — Hermes default will be used"
      : String(error ?? "Models unavailable");
  const tooltip =
    unavailable && helperPlacement === "tooltip"
      ? empty
        ? `${placeholder}\n\n${EMPTY_DEFAULT_HINT}`
        : placeholder
      : undefined;

  const options =
    loading || unavailable
      ? [{ value: "", label: placeholder }]
      : [
          { value: "", label: "Default (registry / Hermes)" },
          ...models.map((m) => ({ value: m.id, label: `${m.name} — ${m.modelId}` })),
        ];
  const select = (
    <InlineSelect
      ariaLabel="Model"
      id={id}
      disabled={loading || unavailable}
      title={tooltip}
      value={loading || unavailable ? "" : selectedValue}
      onChange={handleSelect}
      options={options}
    />
  );

  if (unavailable && helperPlacement === "below") {
    return (
      <div className="space-y-1">
        {select}
        <p className="text-micro text-ps-text-faint font-mono">{EMPTY_DEFAULT_HINT}</p>
      </div>
    );
  }
  return select;
}
