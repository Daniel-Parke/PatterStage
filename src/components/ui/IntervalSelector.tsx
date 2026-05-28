"use client";

import { useState, useRef, useCallback } from "react";
import { RefreshCw, ChevronDown } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { INTERVAL_PRESETS } from "@/components/cron/CronScheduleInput";
import { describeSchedule } from "@/lib/schedule/types";

interface IntervalSelectorProps {
  value: string;
  onChange: (interval: string) => void;
  compact?: boolean;
}

export default function IntervalSelector({ value, onChange, compact = false }: IntervalSelectorProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setOpen(false), []);

  // Parse value for display
  const displayLabel = (() => {
    const stripped = value.replace(/^every\s+/i, "");
    const preset = INTERVAL_PRESETS.find((p) => p.value === stripped || p.value === value);
    if (preset) return preset.label;
    const cronLabel = describeSchedule(value);
    if (cronLabel && cronLabel !== "No schedule") return cronLabel;
    return stripped || value;
  })();

  const stripped = value.replace(/^every\s+/i, "");
  const activePresetValue = INTERVAL_PRESETS.find(
    (p) => p.value === value || p.value === stripped || stripped === p.value
  )?.value;

  if (compact) {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60 hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors"
          title={`Interval: ${displayLabel}`}
        >
          <RefreshCw className="w-3 h-3" />
          {displayLabel}
        </button>
        {open && (
          <DropdownMenu
            anchorRef={buttonRef}
            presets={INTERVAL_PRESETS}
            activePresetValue={activePresetValue}
            onSelect={(v) => onChange(v)}
            onClose={handleClose}
            width={160}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-neon-cyan" />
          <div className="text-left">
            <div className="font-medium text-sm">Every {displayLabel}</div>
            <div className="text-[10px] text-white/30">Repeat frequency</div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <DropdownMenu
          anchorRef={buttonRef}
          presets={INTERVAL_PRESETS}
          activePresetValue={activePresetValue}
          onSelect={(v) => onChange(v)}
          onClose={handleClose}
          width={220}
        />
      )}
    </>
  );
}
