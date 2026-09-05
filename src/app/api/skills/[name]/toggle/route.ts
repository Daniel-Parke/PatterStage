import { NextRequest, NextResponse } from "next/server";

import { serverErrorFromCatch } from "@/lib/api-logger";
import { requireNotReadOnly } from "@/lib/api-auth";
import { badRequest, methodNotAllowed, notFound, ok } from "@/lib/api-response";

// Round 6, finding 15: GET/POST here answered Next's empty framework 405.
// The verb is PUT; say so, in the body and in Allow (T-0089).
const NOT_THIS_VERB = "Toggle a skill with PUT /api/skills/[name]/toggle and a JSON body { enabled: boolean, profile?: string }";
export async function GET() {
  return methodNotAllowed(`GET is not supported here. ${NOT_THIS_VERB}`, ["PUT"]);
}
export async function POST() {
  return methodNotAllowed(`POST is not supported here. ${NOT_THIS_VERB}`, ["PUT"]);
}
import { parseJsonBody } from "@/lib/parse-json-body";
import { ensureDb } from "@/lib/db";
import { getAgentRoot } from "@/lib/agent-root-repository";
import {
  getDisabledSkills,
  getProfile,
} from "@/modules/hermes/lib/profiles-repository";
import { applyProfileOrRootPatchOrFail } from "@/modules/hermes/handlers/profile-patch";
import { requireSafeProfileName } from "@/lib/fs/path-security";
import { serializeJsonArray } from "@/modules/hermes/lib/profile-config-builder";
import { skillIsKnown } from "@/modules/hermes/lib/skills-known";
import { recordEvent } from "@/lib/analytics/record-event";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
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
    const profileResult = requireSafeProfileName(
      typeof profileParam === "string" ? profileParam : null,
    );
    if (profileResult instanceof NextResponse) return profileResult;
    const profile = profileResult.profile;

    // The list this row came from merges the catalogue with the agent's disk,
    // so refusing on the catalogue alone denied skills the product had just
    // shown (T-0103, D82).
    if (!skillIsKnown(name)) {
      return notFound(`Skill not found in the catalogue or on disk: ${name}`);
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

    // applyProfileOrRootPatchOrFail collapses the 4-line
    // apply+toPatchResponse+assert+return-err dance into 1 call +
    // 1 instanceof check. The pre-check above for "Profile not
    // found" is preserved because getDisabledSkills would silently
    // return [] for a missing profile — we want a real 404 instead.
    const disabledSkillsJson = serializeJsonArray(newDisabled);
    const result = applyProfileOrRootPatchOrFail(
      profile,
      { disabledSkillsJson },
      { disabledSkillsJson },
      "Failed to toggle skill",
    );
    if (result instanceof NextResponse) return result;

    recordEvent("skill.toggled", {
      entityType: "skill",
      entityId: name,
      profile,
      metadata: { enabled },
    });
    return ok({ success: true, skill: name, profile, enabled });
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
