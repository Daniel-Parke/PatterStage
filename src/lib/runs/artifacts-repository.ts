// ═══════════════════════════════════════════════════════════════
// artifacts-repository.ts — CRUD for the unified artifacts registry
//
// Artifacts are agent-produced deliverables (Composer/Research/Mission outputs).
// Today they're inline TEXT (Hermes returns no files); the schema is
// future-proofed (`contentType` inline|file_path|url) for real files later.
// See 028_artifacts.sql.
// ═══════════════════════════════════════════════════════════════

import { getDb, uuid, now } from "@/lib/db";
import { parseStringArrayOrEmpty } from "@/lib/db/parse-json";

export type ArtifactSourceKind = "research" | "composer" | "mission" | "chat" | "manual";
type ArtifactContentType = "inline" | "file_path" | "url";

export interface Artifact {
  id: string;
  sourceKind: ArtifactSourceKind;
  sourceRunId: string | null;
  sourceNodeId: string | null;
  name: string;
  description: string | null;
  mimeType: string;
  contentType: ArtifactContentType;
  content: string | null;
  filePath: string | null;
  url: string | null;
  sizeBytes: number;
  tags: string[];
  createdAt: string;
}

interface ArtifactRow {
  id: string;
  source_kind: string;
  source_run_id: string | null;
  source_node_id: string | null;
  name: string;
  description: string | null;
  mime_type: string;
  content_type: string;
  content: string | null;
  file_path: string | null;
  url: string | null;
  size_bytes: number;
  tags_json: string | null;
  created_at: string;
}

/** Lightweight artifact (no content body) for list views. */
export type ArtifactSummary = Omit<Artifact, "content">;

function rowToArtifact(r: ArtifactRow): Artifact {
  return {
    id: r.id,
    sourceKind: r.source_kind as ArtifactSourceKind,
    sourceRunId: r.source_run_id,
    sourceNodeId: r.source_node_id,
    name: r.name,
    description: r.description,
    mimeType: r.mime_type,
    contentType: r.content_type as ArtifactContentType,
    content: r.content,
    filePath: r.file_path,
    url: r.url,
    sizeBytes: r.size_bytes,
    tags: parseStringArrayOrEmpty(r.tags_json),
    createdAt: r.created_at,
  };
}

export interface CreateArtifactInput {
  sourceKind: ArtifactSourceKind;
  sourceRunId?: string | null;
  sourceNodeId?: string | null;
  name: string;
  description?: string | null;
  mimeType?: string;
  contentType?: ArtifactContentType;
  content?: string | null;
  filePath?: string | null;
  url?: string | null;
  tags?: string[];
}

export function createArtifact(input: CreateArtifactInput): Artifact {
  const id = uuid();
  const ts = now();
  const content = input.content ?? null;
  const sizeBytes = content ? Buffer.byteLength(content, "utf8") : 0;
  getDb()
    .prepare(
      `INSERT INTO artifacts
         (id, source_kind, source_run_id, source_node_id, name, description,
          mime_type, content_type, content, file_path, url, size_bytes, tags_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.sourceKind,
      input.sourceRunId ?? null,
      input.sourceNodeId ?? null,
      input.name,
      input.description ?? null,
      input.mimeType ?? "text/markdown",
      input.contentType ?? "inline",
      content,
      input.filePath ?? null,
      input.url ?? null,
      sizeBytes,
      JSON.stringify(input.tags ?? []),
      ts,
    );
  return getArtifact(id)!;
}

export function getArtifact(id: string): Artifact | null {
  const row = getDb().prepare("SELECT * FROM artifacts WHERE id = ?").get(id) as ArtifactRow | undefined;
  return row ? rowToArtifact(row) : null;
}

export interface ListArtifactsFilter {
  sourceKind?: ArtifactSourceKind;
  sourceRunId?: string;
  limit?: number;
}

/** List artifacts (newest first), without their content bodies. */
export function listArtifacts(filter: ListArtifactsFilter = {}): ArtifactSummary[] {
  const where: string[] = [];
  const vals: unknown[] = [];
  if (filter.sourceKind) { where.push("source_kind = ?"); vals.push(filter.sourceKind); }
  if (filter.sourceRunId) { where.push("source_run_id = ?"); vals.push(filter.sourceRunId); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(500, Math.floor(filter.limit ?? 200)));
  const rows = getDb()
    .prepare(
      `SELECT id, source_kind, source_run_id, source_node_id, name, description,
              mime_type, content_type, file_path, url, size_bytes, tags_json, created_at
       FROM artifacts ${clause} ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...vals, limit) as Omit<ArtifactRow, "content">[];
  return rows.map((r) => {
    const { content: _omit, ...rest } = rowToArtifact({ ...r, content: null });
    return rest;
  });
}

export function deleteArtifact(id: string): boolean {
  const res = getDb().prepare("DELETE FROM artifacts WHERE id = ?").run(id);
  return res.changes > 0;
}

/** Whether an artifact already exists for a source (auto-capture dedupe). */
export function hasArtifactForSource(
  sourceKind: ArtifactSourceKind,
  sourceRunId: string,
  sourceNodeId?: string | null,
): boolean {
  const row = sourceNodeId
    ? getDb()
        .prepare("SELECT 1 FROM artifacts WHERE source_kind = ? AND source_run_id = ? AND source_node_id = ? LIMIT 1")
        .get(sourceKind, sourceRunId, sourceNodeId)
    : getDb()
        .prepare("SELECT 1 FROM artifacts WHERE source_kind = ? AND source_run_id = ? AND source_node_id IS NULL LIMIT 1")
        .get(sourceKind, sourceRunId);
  return Boolean(row);
}

/**
 * Idempotently capture an auto-artifact for a run's deliverable: a no-op when
 * the content is empty or an artifact already exists for that source. Used by
 * the Composer/Research/Mission finalize hooks so re-runs don't duplicate.
 */
export function captureArtifactOnce(input: CreateArtifactInput): Artifact | null {
  if (!input.content || input.content.trim().length === 0) return null;
  if (input.sourceRunId && hasArtifactForSource(input.sourceKind, input.sourceRunId, input.sourceNodeId ?? null)) {
    return null;
  }
  return createArtifact(input);
}
