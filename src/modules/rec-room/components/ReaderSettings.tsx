// ReaderSettings — the reading controls: size, spacing and face.
//
// The panel offered a page theme too, dark or black, two tints of one
// register with a panel colour each. WG-WEB-001 rules one register, and two
// near-black tints of it were a setting nobody could tell apart; decision 6's
// batch took the second one out with the rest of the reader's private token
// set (U12, T-0126). A saved `pageTheme` from before is dropped on load.
//
// The panel is a Popover on the shared dismissable, not a hand-rolled fixed
// overlay: outside click and Escape are the hook's, and there is no backdrop
// to trap focus behind.
"use client";

import { useCallback, useState } from "react";
import { Settings } from "lucide-react";

import Button from "@/components/ui/Button";
import Popover from "@/components/ui/Popover";

export interface ReadingSettings {
  fontSize: number;       // 12-28
  fontFamily: string;
  lineHeight: number;     // 1.2-2.5
  brightness: number;     // 0.4-1.0
}

export const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 17,
  fontFamily: "EB Garamond",
  lineHeight: 1.2,
  brightness: 1.0,
};

export const FONTS = [
  { name: "Literata", label: "Literata", family: "var(--font-literata), Georgia, serif" },
  { name: "EB Garamond", label: "EB Garamond", family: "var(--font-eb-garamond), Georgia, serif" },
  { name: "Lora", label: "Lora", family: "var(--font-lora), Georgia, serif" },
  { name: "Merriweather", label: "Merriweather", family: "var(--font-merriweather), Georgia, serif" },
  { name: "Inter", label: "Inter", family: "var(--font-inter), system-ui, sans-serif" },
];

export const WORD_COUNT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "short", label: "800-1.2k" },
  { id: "medium", label: "1.2-1.8k" },
  { id: "standard", label: "1.8-2.5k" },
  { id: "long", label: "2.5-3.5k" },
  { id: "epic", label: "3.5-5k" },
  { id: "marathon", label: "5k+" },
];

const STORAGE_KEY = "story-weaver-reader-settings";

export function loadSettings(): ReadingSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normaliseSettings(JSON.parse(saved) as Record<string, unknown>);
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/**
 * Bring a stored setting back into the supported shape.
 *
 * localStorage outlives the code that wrote it. A reader who chose a page
 * theme, or `sepia` or `light` before WO-0005, still has that key on disk;
 * only the four settings that exist are kept, each checked for its type, so
 * a stale key is corrected once here rather than defended against at every
 * read.
 */
function normaliseSettings(raw: Record<string, unknown>): ReadingSettings {
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return {
    fontSize: num(raw.fontSize, DEFAULT_SETTINGS.fontSize),
    fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily : DEFAULT_SETTINGS.fontFamily,
    lineHeight: num(raw.lineHeight, DEFAULT_SETTINGS.lineHeight),
    brightness: num(raw.brightness, DEFAULT_SETTINGS.brightness),
  };
}

function saveSettings(s: ReadingSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

const ROW = "mb-1.5 flex items-center justify-between font-mono text-micro text-ps-text-muted";

/**
 * A labelled range slider. The reader's two sliders were two copies of the
 * same three lines; this is the one copy, and the one raw control the file
 * keeps: the field kit's Input paints a boxed text control (a border, a fill,
 * padding), and a slider is a track. No primitive draws one.
 */
function Slider({
  label,
  readout,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  readout: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className={ROW}>
        <span>{label}</span>
        <span>{readout}</span>
      </div>
      {/* design-lint-disable-next-line no-raw-control-outside-ui -- a range slider is a track, not a boxed text control, and the field kit draws no slider */}
      <input aria-label={label} type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="h-1 w-full accent-neon-purple" />
    </div>
  );
}

export default function ReaderSettings({ settings, onChange }: {
  settings: ReadingSettings;
  onChange: (s: ReadingSettings) => void;
}) {
  const [open, setOpen] = useState(false);

  const update = useCallback((patch: Partial<ReadingSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    saveSettings(next);
  }, [settings, onChange]);

  const reset = () => {
    onChange(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      className="w-72 p-5"
      trigger={
        <Button
          variant="secondary"
          icon={Settings}
          aria-label="Reading settings"
          aria-expanded={open}
          title="Reading settings"
          onClick={() => setOpen((o) => !o)}
        >
          Aa
        </Button>
      }
    >
      {/* A non-modal dialog: it holds controls and Escape closes it, but it
          traps nothing and the page behind it stays live. */}
      <div role="dialog" aria-label="Reading settings" className="space-y-4">
        <div className="font-mono text-micro uppercase tracking-widest text-ps-text-muted">Reading settings</div>

        <Slider
          label="Font size"
          readout={`${settings.fontSize}px`}
          min={12}
          max={28}
          value={settings.fontSize}
          onChange={(v) => update({ fontSize: v })}
        />

        <Slider
          label="Line spacing"
          readout={settings.lineHeight.toFixed(1)}
          min={12}
          max={25}
          value={Math.round(settings.lineHeight * 10)}
          onChange={(v) => update({ lineHeight: v / 10 })}
        />


        <div className="space-y-1.5">
          <span className="block font-mono text-micro text-ps-text-muted">Font</span>
          {/* Two-up, so the five faces and Reset fit the popover's height
              without a scroll. */}
          <div className="grid grid-cols-2 gap-1.5">
            {FONTS.map((f) => (
              <Button
                key={f.name}
                variant={settings.fontFamily === f.name ? "primary" : "ghost"}
                color="purple"
                size="sm"
                aria-pressed={settings.fontFamily === f.name}
                onClick={() => update({ fontFamily: f.name })}
                style={{ fontFamily: f.family }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
          Reset to defaults
        </Button>
      </div>
    </Popover>
  );
}
