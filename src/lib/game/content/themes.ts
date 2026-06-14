import type { Rarity } from "../types";

/**
 * Cosmetic themes re-skin the app by overriding the neon CSS variables. The
 * ThemeProvider (Phase G6) computes the rgb mirrors + applies these on :root.
 * Default = the current Cherenkov look (no-op). Purely visual.
 */
export interface ThemeDef {
  id: string;
  name: string;
  rarity: Rarity;
  accents: { cyan: string; purple: string; pink: string; green: string; orange: string; yellow: string };
  surfaces?: Partial<Record<"950" | "900" | "800" | "700" | "600", string>>;
}

export const DEFAULT_THEME_ID = "cherenkov";

export const THEMES: ThemeDef[] = [
  { id: "cherenkov", name: "Cherenkov", rarity: "common", accents: { cyan: "#00bfff", purple: "#8b5cff", pink: "#e879f9", green: "#a3ff12", orange: "#ff9f1c", yellow: "#facc15" } },
  { id: "viridian", name: "Viridian Grid", rarity: "rare", accents: { cyan: "#2dd4bf", purple: "#34d399", pink: "#6ee7b7", green: "#a3ff12", orange: "#fbbf24", yellow: "#fde047" } },
  { id: "mono", name: "Monochrome", rarity: "rare", accents: { cyan: "#e5e7eb", purple: "#cbd5e1", pink: "#f1f5f9", green: "#d1d5db", orange: "#e2e8f0", yellow: "#f8fafc" } },
  { id: "crimson-protocol", name: "Crimson Protocol", rarity: "epic", accents: { cyan: "#ff3b6b", purple: "#ff6b9d", pink: "#ff8fa3", green: "#ff5252", orange: "#ffb347", yellow: "#ffd166" }, surfaces: { "900": "#1a0c12", "950": "#100610" } },
  { id: "synthwave", name: "Synthwave", rarity: "legendary", accents: { cyan: "#22d3ee", purple: "#a855f7", pink: "#ec4899", green: "#34d399", orange: "#fb923c", yellow: "#facc15" }, surfaces: { "950": "#0b0420", "900": "#160a2e" } },
  { id: "gold-standard", name: "Gold Standard", rarity: "legendary", accents: { cyan: "#fbbf24", purple: "#f59e0b", pink: "#fcd34d", green: "#a3e635", orange: "#f97316", yellow: "#fde047" }, surfaces: { "900": "#16120a" } },
];

export function themeById(id: string | undefined | null): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
