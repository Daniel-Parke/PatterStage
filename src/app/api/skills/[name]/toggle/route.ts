import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { requireAuth, isChReadOnly } from "@/lib/api-auth";
import { ensureDb } from "@/lib/db";
import { getAgentRoot, updateAgentRoot } from "@/lib/agent-root-repository";
import {
  getDisabledSkills,
  getProfile,
  setProfileDisabledSkills,
} from "@/lib/profiles-repository";
import { pushProfileToHermes, pushRootToHermes } from "@/lib/hermes-profile-sync";
import { resolveSafeProfileName } from "@/lib/path-security";
import { serializeJsonArray } from "@/lib/profile-config-builder";
import { getSkill } from "@/lib/skills-repository";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = requireAuth(request);
  if (auth) return auth;
  if (isChReadOnly()) {
    return NextResponse.json(
      { error: "Control Hub is in read-only mode — skill toggles are disabled" },
      { status: 503 }
    );
  }

  const { name } = await params;

  try {
    ensureDb();
    const body = await request.json();
    const { profile: profileParam, enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
    }

    const profileResult = resolveSafeProfileName(profileParam);
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

    if (profile === "default") {
      updateAgentRoot({ disabledSkillsJson: serializeJsonArray(newDisabled) });
      const push = pushRootToHermes();
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }
    else {
      setProfileDisabledSkills(profile, newDisabled);
      const push = pushProfileToHermes(profile);
      if (!push.success) {
        return NextResponse.json({ error: push.error ?? "Push failed" }, { status: 500 });
      }
    }

    return NextResponse.json({
      data: { success: true, skill: name, profile, enabled },
    });
  }
  catch (error) {
    logApiError("PUT /api/skills/[name]/toggle", `toggle ${name}`, error);
    return NextResponse.json({ error: "Failed to toggle skill" }, { status: 500 });
  }
}
