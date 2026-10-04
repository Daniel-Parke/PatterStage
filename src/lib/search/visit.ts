// ═══════════════════════════════════════════════════════════════
// search/visit.ts — fetch a page and extract its readable text
//
// Lightweight HTML→text (no dependency): strips scripts/styles/markup,
// decodes common entities, caps the size. Returns null on failure or
// non-text content. Reused by DeepResearch and future tools.
// ═══════════════════════════════════════════════════════════════

import type { VisitedPage } from "./types";
import { resolvePublicUrl } from "./url-guard";
import { Agent, fetch } from "undici";
import type { LookupFunction } from "node:net";

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
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const verdict = await resolvePublicUrl(current, controller.signal);
      if (!verdict.ok) return null;
      const hostname = verdict.url.hostname.replace(/^\[|\]$/g, "");
      const lookup: LookupFunction = (host, options, callback) => {
        const addresses = verdict.addresses.filter(address => !options.family || address.family === options.family);
        if (host !== hostname || controller.signal.aborted || !addresses.length) {
          callback(new Error("No admitted research address"), "", 0);
        } else if (options.all) {
          callback(null, addresses.map(address => ({ ...address })));
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      };
      const dispatcher = new Agent({ connect: { lookup } });
      let res: Awaited<ReturnType<typeof fetch>> | undefined;
      try {
        res = await fetch(verdict.url, {
          dispatcher,
          signal: controller.signal,
          redirect: "manual",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PatterStage/1.0)" },
        });
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location) return null;
          current = new URL(location, verdict.url).toString();
          continue;
        }
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
        const html = await res.text();
        const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleM ? titleM[1].replace(/\s+/g, " ").trim() : url;
        let content = htmlToText(html);
        if (content.length > maxChars) content = `${content.slice(0, maxChars)}…`;
        return { url, title, content };
      } finally {
        try {
          if (res?.body && !res.bodyUsed) await res.body.cancel();
        } finally {
          await dispatcher.destroy();
        }
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
