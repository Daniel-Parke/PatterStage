// ═══════════════════════════════════════════════════════════════
// EnvLineRow — read-only row renderer for the .env preview in /config/[section]
// ═══════════════════════════════════════════════════════════════
//
// The .env preview in the file-section page iterates over each line,
// runs `parseEnvLine(line)` to discriminate the variant, and renders
// one of 4 visual shapes (blank / comment / invalid / keyval). The
// pre-refactor form was a 30-line `fileContent.split("\n").map(...)`
// with 3 nested `if (parsed.kind === "X") return <...>;` branches
// — a discriminated-union that the surrounding page should not have
// to carry in its render body.
//
// Extracting to its own component:
//   - Centralises the 4 visual variants in 1 file (any future "show
//     syntax highlight" or "add copy-to-clipboard for the key" tweak
//     lands here, not in the 393-line page).
//   - Lets the page-level JSX stay a flat `fileContent.split("\n").map(...)`.
//   - The `kind` discriminator (a string literal union on the
//     `EnvLine` type from `@/lib/env-line`) drives an exhaustive
//     `switch` block — adding a 5th variant later surfaces a
//     compile-time error at the unhandled case.
//   - The `parsed` prop is the **already-parsed** EnvLine (computed
//     once per line in the page's `useMemo` over the fileContent),
//     not the raw line + index pair. This way the parsing cost is
//     paid once per file content change (via useMemo) and the row
//     component is a pure presentational render.

import type { EnvLine } from "@/lib/env-line";
import { maskKeyHint } from "@/lib/secret-mask";

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
 *
 * - `blank`   → text-white/30 placeholder (`&nbsp;` for empty lines)
 * - `comment` → text-white/30 verbatim raw line
 * - `invalid` → text-white/50 verbatim raw line (preserved for the user
 *               to see they have a malformed line that the parser couldn't
 *               recognise as `key=val`)
 * - `keyval`  → 3-column flex: neon-cyan key, `=` separator, masked value
 *
 * The 3 non-blank variants are byte-equivalent to the pre-refactor
 * inline JSX — same Tailwind class strings, same DOM structure, same
 * `key={lineKey}` (forwarded from the parent's `.map` so React can
 * identify rows across re-renders).
 */
export default function EnvLineRow({ lineKey, parsed, raw }: EnvLineRowProps) {
  switch (parsed.kind) {
    case "blank":
      return (
        <div key={lineKey} className="text-xs text-white/30 font-mono">
          {raw || "\u00A0"}
        </div>
      );
    case "comment":
      return (
        <div key={lineKey} className="text-xs text-white/30 font-mono">
          {raw}
        </div>
      );
    case "invalid":
      return (
        <div key={lineKey} className="text-xs font-mono text-white/50">
          {parsed.raw}
        </div>
      );
    case "keyval":
      return (
        <div key={lineKey} className="flex items-center gap-2 text-xs font-mono">
          <span className="text-neon-cyan w-48 flex-shrink-0 truncate">
            {parsed.key}
          </span>
          <span className="text-white/50">=</span>
          <span className="text-white/30">{maskKeyHint(parsed.value)}</span>
        </div>
      );
  }
}
