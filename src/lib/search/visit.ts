// ═══════════════════════════════════════════════════════════════
// search/visit.ts — fetch a page and extract its readable text
//
// Lightweight HTML→text (no dependency): strips scripts/styles/markup,
// decodes common entities, caps the size. Returns null on failure or
// non-text content. Reused by DeepResearch and future tools.
// ═══════════════════════════════════════════════════════════════

import type { VisitedPage } from "./types";
import { checkUrlSafe } from "./url-guard";

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

/** Redirect hops to follow. Each one is re-checked against the SSRF guard. */
const MAX_REDIRECTS = 4;

export async function visitPage(url: string, maxChars = 6000): Promise<VisitedPage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    // SSRF guard. These URLs come from search-engine HTML, so they are
    // attacker-influenceable; without this the server would fetch the Hermes
    // gateway on localhost, cloud metadata, or the operator's LAN, and hand the
    // body to an LLM that writes it into a report.
    let current = url;
    let res: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const verdict = await checkUrlSafe(current);
      if (!verdict.ok) return null;

      // Manual redirects: a public URL that 302s to 127.0.0.1 would otherwise
      // walk straight past the check above.
      res = await fetch(verdict.url, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PatterStage/1.0)" },
      });

      // Positively identify a redirect rather than "not a success", so a
      // response with an unexpected/absent status is treated as terminal
      // instead of sending us round the loop chasing a Location header.
      const isRedirect = res.status >= 300 && res.status < 400;
      if (!isRedirect) break;

      const location = res.headers.get("location");
      if (!location) return null;
      current = new URL(location, verdict.url).toString();
      res = null;
    }

    if (!res || !res.ok) return null;
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
