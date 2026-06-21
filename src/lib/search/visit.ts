// ═══════════════════════════════════════════════════════════════
// search/visit.ts — fetch a page and extract its readable text
//
// Lightweight HTML→text (no dependency): strips scripts/styles/markup,
// decodes common entities, caps the size. Returns null on failure or
// non-text content. Reused by DeepResearch and future tools.
// ═══════════════════════════════════════════════════════════════

import type { VisitedPage } from "./types";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export async function visitPage(url: string, maxChars = 6000): Promise<VisitedPage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PatterStage/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;

    const html = await res.text();
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleM ? titleM[1].replace(/\s+/g, " ").trim() : url;
    let content = htmlToText(html);
    if (content.length > maxChars) content = `${content.slice(0, maxChars)}…`;
    return { url, title, content };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
