import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth, requireNotReadOnly } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { getAgentRoot } from "@/lib/agent-root-repository";
import {
  getDisabledSkills,
  getProfile,
} from "@/lib/profiles-repository";
import { applyProfileOrRootPatch, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
import { resolveSafeProfileName } from "@/lib/path-security";
import { serializeJsonArray } from "@/lib/profile-config-builder";
import { getSkill } from "@/lib/skills-repository";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;
  const ro = requireNotReadOnly("skill toggles are disabled");
  if (ro) return ro;

  const { name } = await params;

  const bodyResult = await parseJsonBody(request);
  if (bodyResult instanceof NextResponse) return bodyResult;

  ensureDb();
  const { profile: profileParam, enabled } = bodyResult;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
  }

  try {
    const profileResult = resolveSafeProfileName(
      typeof profileParam === "string" ? profileParam : null,
    );
    if (!profileResult.ok) {
      return NextResponse.json({ error: profileResult.error }, { status: 400 });
    }
    const profile = profileResult.profile;

    if (!getSkill(name)) {
      return NextResponse.json({ error: `Skill not in catalog: ${name}` }, { status: 404 });
    }

    let currentDisabled: string[];
    if (profile === "default") {
      const row = getAgentRoot();
      currentDisabled = JSON.parse(row.disabledSkillsJson || "[]") as string[];
    }
    else {
      if (!getProfile(profile)) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      currentDisabled = getDisabledSkills(profile);
    }

    const newDisabled = enabled
      ? currentDisabled.filter((s) => s !== name)
      : currentDisabled.includes(name)
        ? currentDisabled
        : [...currentDisabled, name].sort();

    // applyProfileOrRootPatch handles default-vs-non-default dispatch
    // + 500 on push failure. The pre-check above for "Profile not
    // found" is preserved because getDisabledSkills would silently
    // return [] for a missing profile — we want a real 404 instead.
    const disabledSkillsJson = serializeJsonArray(newDisabled);
    const result = applyProfileOrRootPatch(
      profile,
      { disabledSkillsJson },
      { disabledSkillsJson },
    );
    const err = toPatchResponse(result, "Failed to toggle skill");
    if (err) return err;
    if (!result.ok) throw new Error("unreachable: toPatchResponse returned null on failure");

    return NextResponse.json({
      data: { success: true, skill: name, profile, enabled },
    });
  }
  catch (error) {
    logApiError("PUT /api/skills/[name]/toggle", `toggle ${name}`, error);
    return NextResponse.json({ error: "Failed to toggle skill" }, { status: 500 });
  }
}
