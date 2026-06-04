// ═══════════════════════════════════════════════════════════════
// Holographic Memory Provider — SQLite direct access
// ═══════════════════════════════════════════════════════════════
//
// Reads directly from the holographic memory_store.db SQLite file.
// This is the original memory provider and remains fully supported.

import { existsSync, statSync } from "fs";
import { getActiveHermesPaths } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { messageFromError } from "@/lib/api-fetch";
import type {
  MemoryProvider,
  MemoryProviderHealth,
  MemoryReadResult,
  MemoryAddResult,
  MemoryUpdateResult,
  MemoryDeleteResult,
  FactInput,
  FactUpdateInput,
} from "./index";

// Dynamic import for better-sqlite3 (native module)
async function getDb(readonly = true) {
  const Database = (await import("better-sqlite3")).default;
  const dbPath = getActiveHermesPaths().memoryDb;
  const db = new Database(dbPath, { readonly, timeout: 5000 });
  if (!readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
  }
  return db;
}

export const holographicProvider: MemoryProvider = {
  type: "holographic",

  async healthCheck(): Promise<MemoryProviderHealth> {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) {
      return {
        available: false,
        provider: "holographic",
        message:
          "Holographic memory database not found. Install the hermes-memory-store plugin.",
      };
    }
    try {
      const stats = statSync(dbPath);
      const db = await getDb(true);
      try {
        const row = db
          .prepare("SELECT COUNT(*) as count FROM facts")
          .get() as { count: number };
        return {
          available: true,
          provider: "holographic",
          message: `${row.count} facts stored`,
          factCount: row.count,
          dbSize: stats.size,
        };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        available: false,
        provider: "holographic",
        message: `Error reading database: ${messageFromError(error, "Unknown error")}`,
      };
    }
  },

  async readFacts(options): Promise<MemoryReadResult> {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) {
      return {
        facts: [],
        total: 0,
        dbSize: 0,
        available: false,
        provider: "holographic",
        message:
          "Holographic memory is not installed. Install the hermes-memory-store plugin to enable persistent memory.",
      };
    }

    const stats = statSync(dbPath);
    const db = await getDb(true);
    try {
      const countRow = db
        .prepare("SELECT COUNT(*) as count FROM facts")
        .get() as { count: number };

      let query = `SELECT fact_id, content, category, tags, trust_score, created_at, updated_at
        FROM facts`;
      const params: unknown[] = [];

      if (options?.search) {
        query = `SELECT f.fact_id, f.content, f.category, f.tags, f.trust_score, f.created_at, f.updated_at
          FROM facts f
          JOIN facts_fts fts ON f.fact_id = fts.rowid
          WHERE facts_fts MATCH ?`;
        params.push(options.search);
      }

      if (options?.category) {
        query += options.search ? " AND f.category = ?" : " WHERE category = ?";
        params.push(options.category);
      }

      query += " ORDER BY updated_at DESC, created_at DESC LIMIT ?";
      params.push(options?.limit ?? 200);

      const facts = db.prepare(query).all(...params) as Array<{
        fact_id: number;
        content: string;
        category: string;
        tags: string;
        trust_score: number;
        created_at: string;
        updated_at: string;
      }>;

      const entityCount = (
        db.prepare("SELECT COUNT(*) as count FROM entities").get() as {
          count: number;
        }
      ).count;

      const bankRows = db
        .prepare(
          "SELECT bank_name, fact_count, updated_at FROM memory_banks ORDER BY fact_count DESC"
        )
        .all() as Array<{
        bank_name: string;
        fact_count: number;
        updated_at: string;
      }>;

      return {
        facts: facts.map((f) => ({
          id: f.fact_id,
          content: f.content,
          category: f.category || "general",
          tags: f.tags || "",
          trust: f.trust_score ?? 0.5,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
        total: countRow.count,
        dbSize: stats.size,
        available: true,
        provider: "holographic",
        entities: entityCount,
        banks: bankRows,
      };
    } finally {
      db.close();
    }
  },

  async addFact(input: FactInput): Promise<MemoryAddResult> {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) {
      return { success: false, error: "Holographic memory is not installed" };
    }
    try {
      const db = await getDb(false);
      try {
        const now = new Date().toISOString();
        const result = db
          .prepare(
            `INSERT INTO facts (content, category, tags, trust_score, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            input.content.trim(),
            input.category ?? "general",
            input.tags ?? "",
            input.trust_score ?? 0.7,
            now,
            now
          );
        return {
          success: true,
          fact: {
            id: result.lastInsertRowid as number,
            content: input.content.trim(),
            category: input.category ?? "general",
            tags: input.tags ?? "",
            trust: input.trust_score ?? 0.7,
            createdAt: now,
            updatedAt: now,
          },
        };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to add fact: ${messageFromError(error, "Unknown error")}`,
      };
    }
  },

  async updateFact(input: FactUpdateInput): Promise<MemoryUpdateResult> {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) {
      return { success: false, error: "Holographic memory is not installed" };
    }
    try {
      const db = await getDb(false);
      try {
        const existing = db
          .prepare("SELECT fact_id FROM facts WHERE fact_id = ?")
          .get(input.id);
        if (!existing) {
          return { success: false, error: "Fact not found" };
        }

        const updates: string[] = [];
        const values: unknown[] = [];

        if (input.content !== undefined && typeof input.content === "string") {
          updates.push("content = ?");
          values.push(input.content.trim());
        }
        if (input.category !== undefined && typeof input.category === "string") {
          updates.push("category = ?");
          values.push(input.category);
        }
        if (input.tags !== undefined && typeof input.tags === "string") {
          updates.push("tags = ?");
          values.push(input.tags);
        }
        if (
          input.trust_score !== undefined &&
          typeof input.trust_score === "number"
        ) {
          updates.push("trust_score = ?");
          values.push(input.trust_score);
        }

        if (updates.length === 0) {
          return { success: false, error: "No fields to update" };
        }

        updates.push("updated_at = ?");
        values.push(new Date().toISOString());
        values.push(input.id);

        db.prepare(
          `UPDATE facts SET ${updates.join(", ")} WHERE fact_id = ?`
        ).run(...values);

        return { success: true, id: input.id };
      } finally {
        db.close();
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to update fact: ${messageFromError(error, "Unknown error")}`,
      };
    }
  },

  async deleteFact(id: number): Promise<MemoryDeleteResult> {
    const dbPath = getActiveHermesPaths().memoryDb;
    if (!existsSync(dbPath)) {
      return { success: false, error: "Holographic memory is not installed" };
    }
    try {
      // Retry for database locked errors
      for (let attempt = 0; attempt < 2; attempt++) {
        const db = await getDb(false);
        try {
          db.prepare("DELETE FROM fact_entities WHERE fact_id = ?").run(id);
          try {
            db.prepare("DELETE FROM facts_fts WHERE rowid = ?").run(id);
          } catch {
            // FTS table may not exist
          }
          const result = db
            .prepare("DELETE FROM facts WHERE fact_id = ?")
            .run(id);
          db.close();

          if (result.changes === 0) {
            return { success: false, error: "Fact not found" };
          }
          return { success: true, id };
        } catch (error) {
          db.close();
          const msg = messageFromError(error, "");
          if (msg.includes("locked") && attempt < 1) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
      return { success: false, error: "Database is busy, please try again" };
    } catch (error) {
      logApiError("DELETE /api/memory", "deleting fact", error);
      return {
        success: false,
        error: `Failed to delete fact: ${messageFromError(error, "Unknown error")}`,
      };
    }
  },
};
