// ═══════════════════════════════════════════════════════════════
// hindsight-write-actions.ts - the POST/DELETE actions of the route
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the route god-file. Retain a memory, and the create /
// update / delete / refresh pairs for directives and mental models.
// Unlike the read actions these never swallow an error: a failed write
// must reach the route's catch so the caller learns it did not happen.

import { normalizeTags } from "@/lib/memory/hindsight-bridge";
import { requestWithTimeout } from "@/lib/memory/hindsight-request";
import {
  buildPartialUpdateBody,
  DIRECTIVE_UPDATE_FIELDS,
  MENTAL_MODEL_UPDATE_FIELDS,
} from "@/lib/memory/hindsight-route-helpers";

export async function handleRetain(bank: string, content: string, tags?: string[]) {
  const result = await requestWithTimeout<{ success?: boolean; operation_id?: string }>(
    `/v1/default/banks/${bank}/memories`,
    { method: "POST", body: { items: [{ content, tags: tags || [] }] }, timeoutMs: 30_000 },
  );
  return { success: result.success || false, operation_id: result.operation_id };
}

export async function handleCreateDirective(
  bank: string,
  name: string,
  content: string,
  priority?: number,
  tags?: string[],
) {
  const body: Record<string, unknown> = { name, content };
  if (priority !== undefined) body.priority = priority;
  if (tags) body.tags = tags;
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/directives`, { method: "POST", body });
  return { success: true, directive: result };
}

export async function handleDeleteDirective(bank: string, id: string) {
  await requestWithTimeout(`/v1/default/banks/${bank}/directives/${id}`, { method: "DELETE" });
  return { success: true, id };
}

export async function handleUpdateDirective(
  bank: string,
  id: string,
  updates: Record<string, unknown>,
) {
  const body: Record<string, unknown> = buildPartialUpdateBody(
    updates,
    DIRECTIVE_UPDATE_FIELDS,
  );
  if (updates.tags !== undefined) body.tags = normalizeTags(updates.tags);
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/directives/${id}`, { method: "PATCH", body });
  return { success: true, directive: result };
}

export async function handleCreateMentalModel(
  bank: string,
  name: string,
  query: string,
  tags?: string[],
) {
  const body: Record<string, unknown> = { name, source_query: query };
  if (tags) body.tags = tags;
  const result = await requestWithTimeout<{ mental_model_id?: string; operation_id?: string }>(
    `/v1/default/banks/${bank}/mental-models`,
    { method: "POST", body },
  );
  return { success: true, mental_model_id: result.mental_model_id, operation_id: result.operation_id };
}

export async function handleDeleteMentalModel(bank: string, id: string) {
  await requestWithTimeout(`/v1/default/banks/${bank}/mental-models/${id}`, { method: "DELETE" });
  return { success: true, id };
}

export async function handleRefreshMentalModel(bank: string, id: string) {
  const result = await requestWithTimeout<{ operation_id?: string }>(
    `/v1/default/banks/${bank}/mental-models/${id}/refresh`,
    { method: "POST", body: {} },
  );
  return { success: true, operation_id: result.operation_id };
}

export async function handleUpdateMentalModel(
  bank: string,
  id: string,
  updates: Record<string, unknown>,
) {
  // The wire field for `query` is `source_query`; remap the
  // field-builder so the helper writes to the right key.
  const fields = {
    ...MENTAL_MODEL_UPDATE_FIELDS,
    query: (raw: unknown): [string, unknown] => ["source_query", raw],
  };
  const body: Record<string, unknown> = buildPartialUpdateBody(updates, fields);
  if (updates.tags !== undefined) body.tags = normalizeTags(updates.tags);
  const result = await requestWithTimeout(`/v1/default/banks/${bank}/mental-models/${id}`, { method: "PATCH", body });
  return { success: true, model: result };
}
