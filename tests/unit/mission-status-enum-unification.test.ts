/** @jest-environment node */

/**
 * Asserts that the legacy mission status enum has been deleted from the
 * codebase. The canonical enum is `queued | dispatched | successful | failed`
 * — see src/lib/schema/mission-v1.ts and src/lib/agent-backend/types.ts.
 *
 * Any remaining production reference to the legacy strings ("pending",
 * "running", "completed", "cancelled") in the mission-status context is a
 * bug. We allow false positives for unrelated usages of the same words
 * (e.g. cron job state, agent lifecycle state, kanban card status) by
 * scanning only the files that previously imported MissionStatus.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..");
const srcRoot = join(repoRoot, "src");

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      walkTs(p, out);
    } else if (
      (p.endsWith(".ts") || p.endsWith(".tsx")) &&
      !p.endsWith(".d.ts")
    ) {
      out.push(p);
    }
  }
  return out;
}

describe("MissionStatus enum unification", () => {
  it("agent-backend/types.ts exports the canonical four-state enum", () => {
    const src = readFileSync(
      join(srcRoot, "lib", "agent-backend", "types.ts"),
      "utf-8"
    );
    expect(src).toContain('"queued"');
    expect(src).toContain('"dispatched"');
    expect(src).toContain('"successful"');
    expect(src).toContain('"failed"');
  });

  it("agent-backend/types.ts no longer declares the legacy enum members", () => {
    const src = readFileSync(
      join(srcRoot, "lib", "agent-backend", "types.ts"),
      "utf-8"
    );
    // The legacy enum used a five-line union starting with "| \"pending\"".
    expect(src).not.toMatch(/MissionStatus\s*=\s*[^;]*"pending"/m);
    expect(src).not.toMatch(/MissionStatus\s*=\s*[^;]*"running"/m);
    expect(src).not.toMatch(/MissionStatus\s*=\s*[^;]*"completed"/m);
    expect(src).not.toMatch(/MissionStatus\s*=\s*[^;]*"cancelled"/m);
  });

  it("DispatchMissionInput exposes modelId, provider, and profileName", () => {
    const src = readFileSync(
      join(srcRoot, "lib", "agent-backend", "types.ts"),
      "utf-8"
    );
    expect(src).toMatch(/profileName\s*\?:/);
    expect(src).toMatch(/modelId\s*\?:/);
    expect(src).toMatch(/provider\s*\?:/);
  });

  it("mission-repository creates rows with status='queued', not 'pending'", () => {
    const src = readFileSync(
      join(srcRoot, "lib", "mission-repository.ts"),
      "utf-8"
    );
    expect(src).toContain("'queued'");
    expect(src).not.toMatch(/VALUES\s*\([^)]*'pending'/);
  });

  it("HermesAgentBackend uses 'dispatched' as the post-dispatch status", () => {
    const src = readFileSync(
      join(srcRoot, "lib", "backends", "hermes.ts"),
      "utf-8"
    );
    expect(src).toContain('status: "dispatched"');
    expect(src).not.toMatch(/status:\s*"pending"/);
    expect(src).not.toMatch(/status:\s*"running"/);
    expect(src).not.toMatch(/status:\s*"completed"/);
    expect(src).not.toMatch(/status:\s*"cancelled"/);
  });

  it("/api/missions cancel branch maps to 'failed' (no 'cancelled' status)", () => {
    const src = readFileSync(
      join(srcRoot, "app", "api", "missions", "route.ts"),
      "utf-8"
    );
    expect(src).toMatch(/status:\s*"failed"[\s\S]*Cancelled by user/);
    expect(src).not.toMatch(/status:\s*"cancelled"/);
  });

  it("/api/missions dispatch branch passes modelId/provider/profileName through", () => {
    const src = readFileSync(
      join(srcRoot, "app", "api", "missions", "route.ts"),
      "utf-8"
    );
    expect(src).toContain("modelId");
    expect(src).toContain("provider");
    expect(src).toContain("profileName");
  });

  it("status enum migration file exists and is well-formed", () => {
    const src = readFileSync(
      join(srcRoot, "lib", "db", "migrations", "005_mission_status_enum.sql"),
      "utf-8"
    );
    expect(src).toMatch(/CREATE TABLE missions_new/);
    expect(src).toMatch(/CHECK \(status IN \('queued', 'dispatched', 'successful', 'failed'\)\)/);
    expect(src).toMatch(/'pending'\s+THEN\s+'queued'/);
    expect(src).toMatch(/'running'\s+THEN\s+'dispatched'/);
    expect(src).toMatch(/'completed'\s+THEN\s+'successful'/);
    expect(src).toMatch(/'cancelled'\s+THEN\s+'failed'/);
    expect(src).toMatch(/DROP TABLE missions/);
    expect(src).toMatch(/ALTER TABLE missions_new RENAME TO missions/);
  });

  it("no production source file imports a removed-from-enum literal as a MissionStatus", () => {
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      const text = readFileSync(file, "utf-8");
      // A status: "pending"|"running"|"completed"|"cancelled" assignment in
      // a mission-update context is illegal under the new enum. We grep for
      // "MissionStatus" + suspicious literals on the same line.
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          /MissionStatus/.test(line) &&
          /"(pending|running|completed|cancelled)"/.test(line)
        ) {
          offenders.push(`${file}:${i + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
