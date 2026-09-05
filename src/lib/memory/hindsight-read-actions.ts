// ═══════════════════════════════════════════════════════════════
// hindsight-read-actions.ts - the GET actions of /api/memory/hindsight
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the route god-file. Every function here reads from
// Hindsight and maps the wire shape onto the UI shape; none of them
// write. `handleHealth` and `handleCount` swallow their own errors on
// purpose: a memory server that is down is a status to report, not a 500.

import { messageFromError } from "@/lib/api-fetch";
import {
  mapMemoryItem,
  mapDirectiveItem,
  mapMentalModelItem,
} from "@/lib/memory/hindsight-bridge";
import { requestWithTimeout } from "@/lib/memory/hindsight-request";
import { extractListItems } from "@/lib/memory/hindsight-route-helpers";

export async function handleList(bank: string, search?: string, limit?: number) {
  let params = `?limit=${limit || 100}`;
  if (search) params += `&search=${encodeURIComponent(search)}`;
  const result = await requestWithTimeout<{ items?: Record<string, unknown>[]; total?: number }>(
    `/v1/default/banks/${bank}/memories/list${params}`,
  );
  const memories = (result.items || []).map(mapMemoryItem);
  return { memories, count: memories.length, total: result.total || 0 };
}

export async function handleRecall(bank: string, query: string) {
  const result = await requestWithTimeout<{ items?: Record<string, unknown>[] }>(
    `/v1/default/banks/${bank}/memories/list?limit=20&search=${encodeURIComponent(query)}`,
  );
  const memories = (result.items || []).map(mapMemoryItem);
  return { memories, count: memories.length };
}

export async function handleReflect(bank: string, query: string, budget?: string) {
  try {
    const result = await requestWithTimeout<{ response?: string; facts?: unknown[] }>(
      `/v1/default/banks/${bank}/reflect`,
      { method: "POST", body: { query, budget: budget || "mid" }, timeoutMs: 60_000 },
    );
    return { response: result.response || String(result), facts: result.facts || [] };
  } catch {
    // Fallback: search
    const listResult = await handleRecall(bank, query);
    const facts = listResult.memories.map((m) => m.content);
    return { response: `Found ${facts.length} relevant memories.`, facts };
  }
}

export async function handleDirectives(bank: string) {
  const result = await requestWithTimeout(
    `/v1/default/banks/${bank}/directives`,
  );
  const items = extractListItems(result);
  const directives = items.map(mapDirectiveItem);
  return { directives, count: directives.length };
}

export async function handleMentalModels(bank: string) {
  const result = await requestWithTimeout(
    `/v1/default/banks/${bank}/mental-models`,
  );
  const items = extractListItems(result);
  const models = items.map(mapMentalModelItem);
  return { models, count: models.length };
}

export async function handleHealth() {
  try {
    const result = await requestWithTimeout<{ ok?: boolean; status?: string }>("/health", { timeoutMs: 3000 });
    return { available: true, mode: "external", status: result.status ?? "healthy" };
  } catch (e) {
    return {
      available: false,
      error: messageFromError(e, "Connection refused"),
    };
  }
}

export async function handleCount(bank: string) {
  try {
    const result = await requestWithTimeout<{ total?: number }>(
      `/v1/default/banks/${bank}/memories/list?limit=1`,
    );
    return { count: result.total || 0, bank };
  } catch (e) {
    return {
      count: 0,
      bank,
      error: messageFromError(e, "Unknown error"),
    };
  }
}
