/** Shared by the template API and category moves without coupling the two repositories. */
let templatesCache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function getTemplatesCached(): unknown | null {
  if (templatesCache && Date.now() - templatesCache.timestamp < CACHE_TTL_MS) {
    return templatesCache.data;
  }
  return null;
}

export function setTemplatesCache(data: unknown): void {
  templatesCache = { data, timestamp: Date.now() };
}

export function invalidateTemplatesCache(): void {
  templatesCache = null;
}
