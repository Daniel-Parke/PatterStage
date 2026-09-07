// ═══════════════════════════════════════════════════════════════
// BrandMark — the product's name, drawn once
//
// It used to be drawn twice and they disagreed. The rail said "PatterStage /
// The Stage is Yours"; the mobile header said "PT / Hermes", which is an
// abbreviation of the product beside the name of its dependency, so on a phone
// the product appeared to be called something else (T-0121).
//
// The words are optional because a collapsed rail has 64px and no room for
// them; the mark is not, because the mark is the thing an operator recognises.
// ═══════════════════════════════════════════════════════════════

import { Terminal } from "lucide-react";

/**
 * `rail` is the desktop lockup at the top of the sidebar; `bar` is the compact
 * one in the mobile header, which is 3rem tall against the rail's 5rem.
 */
export default function BrandMark({
  size = "rail",
  words = true,
}: {
  size?: "rail" | "bar";
  words?: boolean;
}) {
  const box = size === "rail" ? "w-8 h-8" : "w-7 h-7";
  return (
    <>
      <div className={`${box} rounded-ps-md animated-border p-[1.5px] shrink-0`}>
        <div className="w-full h-full bg-ps-surface-panel rounded-ps-sm flex items-center justify-center">
          <Terminal className="w-4 h-4 text-neon-cyan" />
        </div>
      </div>
      {words && (
        <div className="leading-tight min-w-0">
          <div className="text-body font-bold tracking-tight text-ps-text-primary truncate">
            PatterStage
          </div>
          {size === "rail" && (
            <div className="text-micro text-ps-text-muted mt-0.5 truncate">
              The Stage is{" "}
              {/* The one call site of .text-glow-cyan in the product. Seven
                  sibling glow classes had none and were deleted at T-0120;
                  this one is the product's own name and stays. */}
              <span className="font-bold text-neon-cyan text-glow-cyan">Yours</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
