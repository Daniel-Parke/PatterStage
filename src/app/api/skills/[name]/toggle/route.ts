import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireAuth, requireNotReadOnly } from "@/lib/api-auth";
import { badRequest, notFound } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { getAgentRoot } from "@/lib/agent-root-repository";
import {
  getDisabledSkills,
  getProfile,
} from "@/lib/profiles-repository";
import { applyProfileOrRootPatch, assertPatchSucceeded, toPatchResponse } from "@/lib/apply-profile-or-root-patch";
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
    return badRequest("enabled (boolean) is required");
  }

  try {
    const profileResult = resolveSafeProfileName(
      typeof profileParam === "string" ? profileParam : null,
    );
    if (!profileResult.ok) {
      return badRequest(profileResult.error);
    }
    const profile = profileResult.profile;

    if (!getSkill(name)) {
      return notFound(`Skill not in catalog: ${name}`);
    }

    let currentDisabled: string[];
    if (profile === "default") {
      const row = getAgentRoot();
      currentDisabled = JSON.parse(row.disabledSkillsJson || "[]") as string[];
    }
    else {
      if (!getProfile(profile)) {
        return notFound("Profile not found");
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
    assertPatchSucceeded(result);

    return NextResponse.json({
      data: { success: true, skill: name, profile, enabled },
    });
  }
  catch (error) {
    return serverErrorFromCatch(
      "PUT /api/skills/[name]/toggle",
      `toggle ${name}`,
      error,
      "Failed to toggle skill",
    );
  }
}
