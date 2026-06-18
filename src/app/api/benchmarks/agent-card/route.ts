// ═══════════════════════════════════════════════════════════════
// GET /api/benchmarks/agent-card?profile=<slug>&suite=<key>
//
// A redacted, shareable "agent card": the profile's public config summary +
// its gamified Agent Rating. Built from a STRICT ALLOWLIST — it deliberately
// excludes config_yaml, SOUL.md, AGENTS.md, USER.md, MEMORY.md, gateway hosts
// and api_key_ref. This is the artifact a user would push to a future hosted
// leaderboard, so "no user-sensitive data" is enforced here, not by convention.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok, badRequest, notFound } from "@/lib/api-response";
import { getProfile } from "@/lib/profiles-repository";
import { agentRatingForProfile } from "@/lib/benchmarks/rating";
import { getSuite, listSuiteMeta } from "@/lib/benchmarks/suites";

function safeCount(json: string): number {
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.length;
    if (v && typeof v === "object") return Object.keys(v).length;
    return 0;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const slug = sp.get("profile");
  if (!slug) return badRequest("profile is required");
  const suiteKey = sp.get("suite") || listSuiteMeta()[0]?.key || undefined;
  if (suiteKey && !getSuite(suiteKey)) return badRequest("Unknown suite");

  try {
    const profile = getProfile(slug);
    if (!profile) return notFound("Profile not found");

    // ── strict allowlist — no md content, no secrets ──
    const card = {
      schema: "ch.agent-card.v1",
      generatedAt: new Date().toISOString(),
      profile: {
        slug: profile.slug,
        displayName: profile.displayName,
        description: profile.description,
        personality: profile.personality,
        disabledSkillCount: safeCount(profile.disabledSkillsJson),
        platformToolsetCount: safeCount(profile.platformToolsetsJson),
      },
      agentRating: agentRatingForProfile(slug, suiteKey),
      note: "Contains no user data, memory, prompts, or credentials.",
    };
    return ok({ card });
  } catch (error) {
    return serverErrorFromCatch("GET /api/benchmarks/agent-card", `slug=${slug}`, error, "Failed to build agent card");
  }
}
