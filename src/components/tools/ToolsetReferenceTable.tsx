// ═══════════════════════════════════════════════════════════════
// ToolsetReferenceTable — the Hermes toolset catalogue, as a table
// ═══════════════════════════════════════════════════════════════
//
// WG-WEB-003 (D) ends "a table or a ledger, not a rounded box", and where a
// surface genuinely is a table it should be one. This is that surface. The
// catalogue is one row per toolset with the same two facts on every row, and
// the Toolsets page already drew column-ish structure for it: a <ul> under a
// `grid sm:grid-cols-2`, with the id and the description crammed into a single
// <li> and joined by a dash. That is a table wearing a list, and a screen
// reader gets nothing out of it — no header association, no row semantics, no
// way to say "column two".
//
// So it is a <table> with a real <thead>. Nothing about the records changed:
// the same entries, in the same order, saying the same words.
//
// The entries arrive as a prop rather than being imported here. The catalogue
// lives in src/modules/hermes/, and ADR-0005 says core may not import a module
// (design-lint enforces it as `core-imports-no-module`); the page is in
// src/app/, which is exempt, so the page reads the catalogue and hands it over.
// That also makes this component testable with two rows instead of thirty.

export interface ToolsetReferenceEntry {
  id: string;
  description: string;
}

export default function ToolsetReferenceTable({
  entries,
}: {
  entries: readonly ToolsetReferenceEntry[];
}) {
  return (
    // The pane the table sits in is narrow on a phone and the id column has a
    // floor, so the table scrolls inside its own box rather than pushing the
    // page sideways.
    <div className="overflow-x-auto">
      <table className="w-full text-micro font-mono border-collapse">
        <thead>
          <tr className="border-b border-ps-edge-hairline text-left">
            <th
              scope="col"
              className="py-1.5 pr-4 font-mono font-normal uppercase tracking-widest text-ps-text-faint"
            >
              Toolset
            </th>
            <th
              scope="col"
              className="py-1.5 font-mono font-normal uppercase tracking-widest text-ps-text-faint"
            >
              What it enables
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ps-edge-hairline">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <th
                scope="row"
                className="py-1.5 pr-4 align-top font-mono font-normal text-left whitespace-nowrap text-ps-text-secondary"
              >
                {entry.id}
              </th>
              <td className="py-1.5 align-top text-ps-text-muted">
                {entry.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
