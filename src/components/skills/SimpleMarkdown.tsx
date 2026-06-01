"use client";

// ═══════════════════════════════════════════════════════════════
// SimpleMarkdown — Lightweight markdown renderer for skill pages.
//
// Why no react-markdown? Adding react-markdown + remark-gfm +
// rehype-raw + rehype-sanitize + unified + mdast-* + micromark-* + ...
// would add ~30 transitive deps to render one page. The skill
// markdown here is constrained: frontmatter, headings, paragraphs,
// lists, fenced code blocks, inline code, bold, italic, and the
// occasional GFM table. A 200-line local renderer covers all of it
// without the install/audit surface.
//
// What this handles:
//   - ATX headings (h1, h2, h3)
//   - Fenced code blocks (``` ... ```) with language label
//   - GFM-style tables (| col | col | with |---|:---:|---:| sep)
//   - Unordered (-, *) and ordered (1. 2. 3.) lists
//   - Horizontal rules (---, ***)
//   - Inline code (`x`), bold (**x**), italic (*x*), links ([t](u))
//
// What this intentionally does NOT handle:
//   - Nested lists (skills SKILL.md files don't use them)
//   - HTML in markdown
//   - Reference-style links / images
//   - Footnotes, blockquotes
//
// If a future skill needs nested lists or blockquotes, swap this for
// react-markdown at that time — not before.
// ═══════════════════════════════════════════════════════════════

import React from "react";

interface TableState {
  header: string[];
  alignments: Array<"left" | "center" | "right" | null>;
  rows: string[][];
}

function parseTableSeparator(sep: string): Array<"left" | "center" | "right" | null> {
  // GFM separator: | :--- | :---: | ---: |
  return sep
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => {
      const c = cell.trim();
      const startsLeft = c.startsWith(":");
      const endsRight = c.endsWith(":");
      if (startsLeft && endsRight) return "center";
      if (endsRight) return "right";
      if (startsLeft) return "left";
      return null;
    });
}

function isTableSeparator(line: string): boolean {
  // Match lines that are only |, -, :, and whitespace, with at least one -.
  const t = line.trim();
  if (!t.includes("-")) return false;
  return /^\|?[\s:|-]+\|?$/.test(t) && /-+/.test(t);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInline(text: string): React.ReactNode {
  // Process links first (they can contain bold/italic), then inline code,
  // bold, italic. Order matters: links match `[...](...)` greedily.
  const parts: React.ReactNode[] = [];
  const remaining = text;
  let key = 0;

  const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderInlineNonLink(remaining.slice(lastIndex, match.index), key++));
    }
    parts.push(
      <a
        key={`link-${key++}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-neon-cyan hover:underline"
      >
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    parts.push(renderInlineNonLink(remaining.slice(lastIndex), key++));
  }
  return <>{parts}</>;
}

function renderInlineNonLink(text: string, keyBase: number): React.ReactNode {
  // Inline code → bold → italic. Same multi-pass approach as the
  // original SimpleMarkdown inlineFormat().
  const codeParts = text.split(/(`[^`]+`)/g);
  return codeParts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`code-${keyBase}-${i}`}
          className="bg-dark-800/80 text-neon-green px-1.5 py-0.5 rounded text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        return (
          <strong key={`bold-${keyBase}-${i}-${j}`} className="font-semibold text-white">
            {bp.slice(2, -2)}
          </strong>
        );
      }
      const italicParts = bp.split(/(\*[^*]+\*)/g);
      return italicParts.map((ip, k) => {
        if (ip.startsWith("*") && ip.endsWith("*") && !ip.startsWith("**")) {
          return (
            <em key={`em-${keyBase}-${i}-${j}-${k}`} className="italic text-white/80">
              {ip.slice(1, -1)}
            </em>
          );
        }
        return ip || null;
      });
    });
  });
}

export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";
  let inTable = false;
  let currentTable: TableState | null = null;

  const flushTable = (keyBase: number) => {
    if (!currentTable) return;
    const { header, alignments, rows } = currentTable;
    elements.push(
      <div
        key={`table-${keyBase}`}
        className="my-3 overflow-x-auto rounded-lg border border-white/10"
      >
        <table className="min-w-full text-sm">
          <thead className="bg-dark-800/80">
            <tr>
              {header.map((cell, idx) => (
                <th
                  key={idx}
                  className="text-left text-white/80 font-mono font-semibold px-3 py-2 border-b border-white/10"
                  style={{ textAlign: alignments[idx] || "left" }}
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-white/5 last:border-0">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="text-white/70 px-3 py-2 align-top"
                    style={{ textAlign: alignments[cIdx] || "left" }}
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    currentTable = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Fenced code blocks (highest priority) ──
    if (line.trim().startsWith("```")) {
      if (inTable) {
        flushTable(i);
        inTable = false;
      }
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 rounded-lg border border-white/10 bg-dark-800/80 overflow-hidden"
          >
            {codeBlockLang && (
              <div className="px-3 py-1.5 border-b border-white/5 text-[10px] font-mono text-white/30 uppercase">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 text-sm font-mono text-white/70 overflow-x-auto">
              {codeBlockLines.join("\n")}
            </pre>
          </div>,
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // ── Tables ──
    // A table is: a header row with at least one |, a separator row,
    // then zero or more data rows. We collect them in a buffer and
    // flush when the pattern breaks.
    if (trimmed.includes("|") && (trimmed.startsWith("|") || /\|.*\|/.test(trimmed))) {
      if (!inTable) {
        // Peek: is the next line a separator?
        const next = lines[i + 1];
        if (next && isTableSeparator(next)) {
          inTable = true;
          currentTable = {
            header: splitTableRow(trimmed),
            alignments: parseTableSeparator(next),
            rows: [],
          };
          continue;
        }
      } else {
        // Continuing rows of the current table.
        // Skip the separator row (it was already consumed when we set
        // inTable=true on the previous iteration).
        if (isTableSeparator(trimmed)) {
          continue;
        }
        if (trimmed === "") {
          flushTable(i);
          inTable = false;
          continue;
        }
        currentTable!.rows.push(splitTableRow(trimmed));
        continue;
      }
    } else if (inTable) {
      flushTable(i);
      inTable = false;
    }

    // ── Headings ──
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-white/10"
        >
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-lg font-bold text-white mt-5 mb-2 pb-1 border-b border-white/5"
        >
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
      continue;
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={i} className="my-4 border-white/10" />);
      continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 ml-4">
          <span className="text-neon-cyan mt-1.5 flex-shrink-0">•</span>
          <span className="text-sm text-white/70">
            {renderInline(trimmed.slice(2))}
          </span>
        </div>,
      );
      continue;
    }

    // Ordered list
    const numMatch = trimmed.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 ml-4">
          <span className="text-neon-cyan font-mono text-sm mt-0.5 flex-shrink-0">
            {numMatch[1]}.
          </span>
          <span className="text-sm text-white/70">
            {renderInline(trimmed.slice(numMatch[0].length))}
          </span>
        </div>,
      );
      continue;
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-white/70 my-1 leading-relaxed">
        {renderInline(trimmed)}
      </p>,
    );
  }

  // Flush any in-progress table at EOF.
  if (inTable && currentTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
}
