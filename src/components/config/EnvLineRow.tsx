// ═══════════════════════════════════════════════════════════════
// EnvLineRow — read-only row renderer for the .env preview in /config/[section]
// ═══════════════════════════════════════════════════════════════
//
// The `parsed` prop is the already-parsed EnvLine, computed once per line
// in the page's `useMemo`, so the parsing cost is paid once per file
// content change and this row is a pure presentational render.

import type { EnvLine } from "@/lib/env-line";
import { maskEnvValue } from "@/lib/secret-mask";

interface EnvLineRowProps {
  /** Stable React key for the parent's `.map(...)` callback. */
  lineKey: string;
  /** Pre-parsed .env line — drives the discriminated render. */
  parsed: EnvLine;
  /** Raw line text — only used for the `blank` variant's `&nbsp;` placeholder. */
  raw: string;
}

/**
 * Render one row of the .env preview. The `switch` on `parsed.kind`
 * is exhaustive over the `EnvLine` discriminated union — adding a
 * new variant to `parseEnvLine` surfaces a TypeScript error here.
 * An `invalid` line is rendered verbatim so the user can see they have
 * a malformed line the parser couldn't recognise as `key=val`.
 */
export default function EnvLineRow({ lineKey, parsed, raw }: EnvLineRowProps) {
  switch (parsed.kind) {
    case "blank":
      return (
        <div key={lineKey} className="text-micro text-ps-text-muted font-mono">
          {raw || "\u00A0"}
        </div>
      );
    case "comment":
      return (
        <div key={lineKey} className="text-micro text-ps-text-muted font-mono">
          {raw}
        </div>
      );
    case "invalid":
      return (
        <div key={lineKey} className="text-micro font-mono text-ps-text-muted">
          {parsed.raw}
        </div>
      );
    case "keyval":
      return (
        <div key={lineKey} className="flex items-center gap-2 text-micro font-mono">
          <span className="text-neon-cyan w-48 flex-shrink-0 truncate">
            {parsed.key}
          </span>
          <span className="text-ps-text-muted">=</span>
          <span className="text-ps-text-muted">{maskEnvValue(parsed.key, parsed.value)}</span>
        </div>
      );
  }
}
