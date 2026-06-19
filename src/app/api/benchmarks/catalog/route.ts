// ═══════════════════════════════════════════════════════════════
// GET /api/benchmarks/catalog — the fair-test seed catalog (client-safe)
//
// Lists the toggleable seed components a benchmark can equip on the ephemeral
// fair-test agent: bundled skills, tool bundles, and how many canonical memory
// facts are available. No skill CONTENT is shipped — just metadata for the
// builder's per-component toggles.
// ═══════════════════════════════════════════════════════════════

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { listSkills } from "@/lib/skills-repository";
import { listToolBundles } from "@/lib/tool-catalog-repository";
import { countMemoryFacts } from "@/lib/memory-catalog-repository";

export async function GET() {
  try {
    const skills = listSkills()
      .filter((s) => s.source === "bundled")
      .map((s) => ({ key: s.skillKey, displayName: s.displayName, description: s.description, category: s.category }));
    const tools = listToolBundles().map((t) => ({
      key: t.toolKey,
      displayName: t.displayName,
      description: t.description,
      toolsetIds: t.toolsetIds,
      category: t.category,
    }));
    return ok({ catalog: { skills, tools, memoryFactCount: countMemoryFacts() } });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/catalog", "list", error, "Failed to load catalog");
  }
}
