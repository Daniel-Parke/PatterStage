/** @jest-environment node */

/**
 * Tests for mission model/provider + settings persistence (migration 013).
 * Verifies the schema, repository, API route, and page all handle these fields.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");

describe("Migration 013 — mission settings columns", () => {
  it("migration file exists", () => {
    const p = join(repoRoot, "src", "lib", "db", "migrations", "013_mission_model_provider.sql");
    const sql = readFileSync(p, "utf-8");
    expect(sql).toContain("ALTER TABLE missions ADD COLUMN model_id");
    expect(sql).toContain("ALTER TABLE missions ADD COLUMN provider");
    expect(sql).toContain("ALTER TABLE missions ADD COLUMN profile_name");
    expect(sql).toContain("ALTER TABLE missions ADD COLUMN mission_time_minutes");
    expect(sql).toContain("ALTER TABLE missions ADD COLUMN timeout_minutes");
    expect(sql).toContain("ALTER TABLE missions ADD COLUMN schedule");
  });

  it("Mission interface has new fields (types.ts)", () => {
    const p = join(repoRoot, "src", "lib", "agent-backend", "types.ts");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("modelId?: string");
    expect(content).toContain("provider?: string");
    expect(content).toContain("profileName?: string");
    expect(content).toContain("missionTimeMinutes?: number");
    expect(content).toContain("timeoutMinutes?: number");
    expect(content).toContain("schedule?: string");
  });

  it("mission-repository createMission accepts new fields", () => {
    const p = join(repoRoot, "src", "lib", "mission-repository.ts");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("modelId?: string");
    expect(content).toContain("provider?: string");
    expect(content).toContain("profileName?: string");
    expect(content).toContain("model_id");
    expect(content).toContain("provider = ?");
  });

  it("mission-repository rowToMission maps new columns", () => {
    const p = join(repoRoot, "src", "lib", "mission-repository.ts");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("modelId: row.model_id");
    expect(content).toContain("provider: row.provider");
    expect(content).toContain("profileName: row.profile_name");
  });

  it("mission-repository updateMission supports new fields", () => {
    const p = join(repoRoot, "src", "lib", "mission-repository.ts");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("modelId?: string | null");
    expect(content).toContain("updates.modelId");
    expect(content).toContain("updates.provider");
  });

  it("API dispatch route passes new fields to createMission", () => {
    const p = join(repoRoot, "src", "app", "api", "missions", "route.ts");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("modelId: modelId ?? null");
    expect(content).toContain("provider: provider ?? null");
    expect(content).toContain("profileName: profileName ?? null");
  });

  it("API update route persists new fields", () => {
    const p = join(repoRoot, "src", "app", "api", "missions", "route.ts");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("updates.modelId = modelId");
    expect(content).toContain("updates.provider = provider");
  });

  it("Missions page handleEdit restores model/provider/settings", () => {
    const p = join(repoRoot, "src", "app", "missions", "page.tsx");
    const content = readFileSync(p, "utf-8");
    expect(content).toContain("setNewModel(m.modelId");
    expect(content).toContain("setNewProvider(m.provider");
    expect(content).toContain("setNewProfile(m.profileName");
  });
});
