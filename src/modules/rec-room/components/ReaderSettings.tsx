// ReaderSettings — Kindle-style reading customisation panel
"use client";
import { useState, useCallback } from "react";
import { Settings, X } from "lucide-react";

export interface ReadingSettings {
  fontSize: number;       // 12-28
  fontFamily: string;
  lineHeight: number;     // 1.2-2.5
  brightness: number;     // 0.4-1.0
  /**
   * One reading register, two page tints (WG-WEB-001: dark-first, no exception).
   * `sepia` and `light` were removed in WO-0005. A saved setting naming either
   * one is normalised back to `dark` by `loadSettings`, so an existing reader's
   * stored preference degrades to the supported register instead of leaving the
   * picker with nothing selected.
   */
  pageTheme: "dark" | "black";
}

export const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 17,
  fontFamily: "EB Garamond",
  lineHeight: 1.2,
  brightness: 1.0,
  pageTheme: "dark",
};

export const FONTS = [
  { name: "Literata", label: "Literata", family: "var(--font-literata), Georgia, serif" },
  { name: "EB Garamond", label: "EB Garamond", family: "var(--font-eb-garamond), Georgia, serif" },
  { name: "Lora", label: "Lora", family: "var(--font-lora), Georgia, serif" },
  { name: "Merriweather", label: "Merriweather", family: "var(--font-merriweather), Georgia, serif" },
  { name: "Inter", label: "Inter", family: "var(--font-inter), system-ui, sans-serif" },
];

/**
 * The reading register, as tokens rather than literals. The hex lives once, in
 * globals.css, where the design-lint law says colour belongs; these are the
 * var() handles. `rule` is the panel border, shared by both tints, and it
 * replaces a `pageTheme === "light"` conditional in the reader that had no
 * remaining branch once the light theme went.
 *
 * The values move to the vendored @pattertech/ui kit under WO-0017.
 */
export const THEMES: Record<
  ReadingSettings["pageTheme"],
  { bg: string; text: string; panel: string; accent: string; rule: string }
> = {
  dark: {
    bg: "var(--ps-reader-dark-bg)",
    text: "var(--ps-reader-dark-text)",
    panel: "var(--ps-reader-dark-panel)",
    accent: "var(--ps-reader-accent)",
    rule: "var(--ps-reader-rule)",
  },
  black: {
    bg: "var(--ps-reader-black-bg)",
    text: "var(--ps-reader-black-text)",
    panel: "var(--ps-reader-black-panel)",
    accent: "var(--ps-reader-accent)",
    rule: "var(--ps-reader-rule)",
  },
};

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
    if (saved) return normaliseSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/**
 * Bring a stored setting back into the supported range.
 *
 * localStorage outlives the code that wrote it. A reader who chose `sepia` or
 * `light` before WO-0005 still has that string on disk, and the reader page's
 * `THEMES[pageTheme] || THEMES.dark` fallback would render correctly while the
 * picker showed nothing selected, because no tile matches. Normalising at the
 * load boundary means an unsupported value is corrected once rather than
 * defended against at every read.
 */
function normaliseSettings(settings: ReadingSettings): ReadingSettings {
  if (settings.pageTheme in THEMES) return settings;
  return { ...settings, pageTheme: DEFAULT_SETTINGS.pageTheme };
}

function saveSettings(s: ReadingSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
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

  return (
    <>
      {/* Toggle Button */}
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
        aria-label="Reading settings (font, size, theme)"
        title="Reading settings">
        <span className="text-sm">Aa</span>
        <Settings className="w-3.5 h-3.5" />
      </button>

      {/* Settings Panel — fixed position to avoid overflow clipping */}
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="fixed top-[52px] right-4 w-72 rounded-xl border border-white/10 bg-dark-900/95 backdrop-blur-xl p-5 z-[60] shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Reading Settings</span>
            <button onClick={() => setOpen(false)} className="p-1 text-white/30 hover:text-white/50"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* Font Size */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-white/30">Font Size</span>
              <span className="text-[10px] font-mono text-white/40">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/20">A</span>
              <input type="range" min={12} max={28} value={settings.fontSize}
                onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                className="flex-1 accent-neon-purple h-1" />
              <span className="text-lg text-white/40">A</span>
            </div>
          </div>

          {/* Line Spacing */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-white/30">Line Spacing</span>
              <span className="text-[10px] font-mono text-white/40">{settings.lineHeight.toFixed(1)}</span>
            </div>
            <input type="range" min={12} max={25} value={Math.round(settings.lineHeight * 10)}
              onChange={(e) => update({ lineHeight: parseInt(e.target.value) / 10 })}
              className="w-full accent-neon-purple h-1" />
          </div>

          {/* Font Family */}
          <div className="mb-4">
            <span className="text-[10px] font-mono text-white/30 block mb-2">Font</span>
            <div className="grid grid-cols-1 gap-1.5">
              {FONTS.map((f) => (
                <button key={f.name} onClick={() => update({ fontFamily: f.name })}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    settings.fontFamily === f.name ? "bg-neon-purple/15 text-neon-purple border border-neon-purple/30" : "text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent"
                  }`}
                  style={{ fontFamily: f.family }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page Theme */}
          <div className="mb-4">
            <span className="text-[10px] font-mono text-white/30 block mb-2">Page Theme</span>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} onClick={() => update({ pageTheme: key as ReadingSettings["pageTheme"] })}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                    settings.pageTheme === key ? "border-neon-purple/40" : "border-white/5 hover:border-white/15"
                  }`}>
                  <div className="w-8 h-8 rounded-md border border-white/10" style={{ background: t.bg }} />
                  <span className="text-[9px] font-mono text-white/30 capitalize">{key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button onClick={() => { onChange(DEFAULT_SETTINGS); saveSettings(DEFAULT_SETTINGS); }}
            className="w-full text-center text-[10px] font-mono text-white/25 hover:text-white/40 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            Reset to Defaults
          </button>
          </div>
        </>
      )}
    </>
  );
}
