"use client";

// Applies the operator's equipped cosmetic theme by overriding the neon design
// tokens on :root. Default (nothing equipped) = the current Cherenkov palette,
// so this is a no-op until a theme is equipped. Purely visual.

import { useEffect, type ReactNode } from "react";
import { useGame } from "@/hooks/useGame";
import { themeById } from "@/lib/game/content/themes";

const ACCENTS = ["cyan", "purple", "pink", "green", "orange", "yellow"] as const;

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { snapshot } = useGame();
  const equipped = snapshot?.equipped.theme;

  useEffect(() => {
    const id = equipped?.startsWith("theme-") ? equipped.slice("theme-".length) : equipped;
    const theme = themeById(id);
    const root = document.documentElement;
    for (const k of ACCENTS) {
      root.style.setProperty(`--color-neon-${k}`, theme.accents[k]);
      root.style.setProperty(`--ch-rgb-neon-${k}`, hexToRgb(theme.accents[k]));
    }
    for (const k of ["950", "900", "800", "700", "600"] as const) {
      const v = theme.surfaces?.[k];
      if (v) root.style.setProperty(`--color-dark-${k}`, v);
      else root.style.removeProperty(`--color-dark-${k}`);
    }
  }, [equipped]);

  return <>{children}</>;
}
