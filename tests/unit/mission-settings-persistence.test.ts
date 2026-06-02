/** @jest-environment node */

/**
 * Tests for mission model/provider + settings persistence (migration 013).
 * Verifies the schema, repository, API route, and page all handle these fields.
 */

import { readFileSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");

describe("Baseline — mission settings columns", () => {
  it("baseline schema includes mission model/settings columns", () => {
    const p = join(repoRoot, "src", "lib", "db", "migrations", "001_baseline.sql");
    const sql = readFileSync(p, "utf-8");
    expect(sql).toContain("model_id");
    expect(sql).toContain("provider");
    expect(sql).toContain("profile_name");
    expect(sql).toContain("mission_time_minutes");
    expect(sql).toContain("timeout_minutes");
    expect(sql).toContain("schedule");
    expect(sql).toContain("cron_job_id");
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
    expect(content).toMatch(/modelId:\s*modelId\s*\?\?\s*(undefined|null)/);
    expect(content).toMatch(/provider:\s*provider\s*\?\?\s*(undefined|null)/);
    expect(content).toContain("profileName: profileName ?? undefined");
  });

  it("API update route persists new fields via buildMissionFieldPatch", () => {
    const routePath = join(repoRoot, "src", "app", "api", "missions", "route.ts");
    const routeContent = readFileSync(routePath, "utf-8");
    expect(routeContent).toContain("buildMissionFieldPatch");

    const patchPath = join(repoRoot, "src", "lib", "mission-field-updates.ts");
    const patchContent = readFileSync(patchPath, "utf-8");
    expect(patchContent).toContain("if (input.modelId !== undefined) updates.modelId = input.modelId");
    expect(patchContent).toContain("if (input.provider !== undefined) updates.provider = input.provider");
  });

  it("Missions page handleEdit restores model/provider/settings", () => {
    const p = join(repoRoot, "src", "hooks", "useMissionsPage.ts");
    const content = readFileSync(p, "utf-8");
    // After the setModelAndProvider refactor, model + provider are restored
    // via a single paired helper (the two values always travel together —
    // a model id implies its provider). setNewProfile is unchanged.
    expect(content).toContain("setModelAndProvider(m.modelId");
    expect(content).toContain("setNewProfile(m.profileName");
  });
});
