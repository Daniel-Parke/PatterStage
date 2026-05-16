import { NextResponse, NextRequest } from "next/server";
import { readFileSync, existsSync, statSync, readdirSync, writeFileSync, mkdirSync } from "fs";

import { getActiveHermesHome } from "@/lib/hermes-agent-runtime";
import { logApiError } from "@/lib/api-logger";
import { resolveSafeProfileName } from "@/lib/path-security";
import { requireMcApiKey, requireNotReadOnly } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import type { ApiResponse, AgentProfile } from "@/types/hermes";

/** Strip the skills.enabled{} block from a config so new profiles start locked down. */
function stripSkillsEnabled(content: string): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "skills:") {
      output.push(lines[i]);
      i++;
      let hitEnabled = false;
      let enabledEnd = i;
      while (enabledEnd < lines.length) {
        const t = lines[enabledEnd].trim();
        if (t === "enabled:") { hitEnabled = true; enabledEnd++; continue; }
        if (hitEnabled) {
          if (t.startsWith("#")) { enabledEnd++; continue; }
          if (!lines[enabledEnd].startsWith("  ") || (!t.startsWith("-") && t)) break;
          enabledEnd++;
        } else {
          if (!lines[enabledEnd].startsWith(" ") && t) break;
          if (t) break;
          enabledEnd++;
        }
      }
      if (hitEnabled) {
        while (i < enabledEnd) i++;
        output.push("  enabled: []");
      }
    } else {
      output.push(lines[i]);
      i++;
    }
  }
  return output.join("\n");
}

function loadYamlPersonality(content: string): string {
  const lines = content.split("\n");
  let inAgent = false;
  for (const line of lines) {
    if (line.trim().startsWith("agent:")) {
      inAgent = true;
      continue;
    }
    if (inAgent && !line.startsWith(" ") && line.trim()) break;
    if (inAgent && line.includes("personality:")) {
      return line.split("personality:")[1].trim().replace(/['"]/g, "") || "technical";
    }
  }
  return "technical";
}

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  "qa-engineer": "Quality assurance and testing",
  "devops-engineer": "Infrastructure, CI/CD, and operations",
  "swe-engineer": "Software engineering and development",
};

const BUNDLED_PROFILES = new Set(["qa", "devops"]);

function getProfileFiles(profileDir: string): AgentProfile["files"] {
  const files: AgentProfile["files"] = [];
  const fileDefs = [
    { key: "soul", name: "SOUL.md", relPath: "SOUL.md" },
    { key: "agents", name: "AGENTS.md", relPath: "AGENTS.md" },
    { key: "user", name: "USER.md", relPath: "memories/USER.md" },
    { key: "memory", name: "MEMORY.md", relPath: "memories/MEMORY.md" },
  ];

  for (const def of fileDefs) {
    const fullPath = profileDir + "/" + def.relPath;
    const exists = existsSync(fullPath);
    let size = 0;
    let lastModified: string | null = null;
    if (exists) {
      try {
        const stats = statSync(fullPath);
        size = stats.size;
        lastModified = stats.mtime.toISOString();
      } catch {}
    }
    files.push({ key: def.key, name: def.name, path: fullPath, exists, size, lastModified });
  }
  return files;
}

function countProfileSkills(profileDir: string): number {
  const skillsDir = profileDir + "/skills";
  if (!existsSync(skillsDir)) return 0;
  let count = 0;
  try {
    const walk = (dir: string) => {
      for (const item of readdirSync(dir)) {
        const fullPath = dir + "/" + item;
        try {
          const st = statSync(fullPath);
          if (st.isDirectory()) {
            if (existsSync(fullPath + "/SKILL.md")) count++;
            else walk(fullPath);
          }
        } catch {}
      }
    };
    walk(skillsDir);
  } catch {}
  return count;
}

export async function GET() {
  try {
    const profiles: AgentProfile[] = [];

    // Default agent (main)
    const defaultPersonality = loadYamlPersonality(
      existsSync(getActiveHermesHome() + "/config.yaml")
        ? readFileSync(getActiveHermesHome() + "/config.yaml", "utf-8")
        : ""
    );

    profiles.push({
      id: "default",
      name: "Bob",
      description: "Main agent — full access to all tools and skills",
      personality: defaultPersonality,
      isDefault: true,
      isBundled: false,
      skillsCount: countProfileSkills(getActiveHermesHome()),
      toolsCount: 0,
      files: getProfileFiles(getActiveHermesHome()),
    });

    // Named profiles
    const profilesDir = getActiveHermesHome() + "/profiles";
    if (existsSync(profilesDir)) {
      for (const entry of readdirSync(profilesDir)) {
        const profileDir = profilesDir + "/" + entry;
        try {
          const st = statSync(profileDir);
          if (!st.isDirectory()) continue;
        } catch {
          continue;
        }

        const configPath = profileDir + "/config.yaml";
        let personality = "technical";
        if (existsSync(configPath)) {
          personality = loadYamlPersonality(readFileSync(configPath, "utf-8"));
        }

        profiles.push({
          id: entry,
          name: entry.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          description: PROFILE_DESCRIPTIONS[entry] || "Agent profile",
          personality,
          isDefault: false,
          isBundled: BUNDLED_PROFILES.has(entry),
          skillsCount: countProfileSkills(profileDir),
          toolsCount: 0,
          files: getProfileFiles(profileDir),
        });
      }
    }

    return NextResponse.json<ApiResponse<{ profiles: AgentProfile[] }>>({
      data: { profiles },
    });
  } catch (error) {
    logApiError("GET /api/agent/profiles", "listing profiles", error);
    return NextResponse.json({ error: "Failed to list profiles" }, { status: 500 });
  }
}

// ── POST — Create a new profile ──────────────────────────────────

export async function POST(request: NextRequest) {
  const ro = requireNotReadOnly();
  if (ro) return ro;
  const auth = requireMcApiKey(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const { name, description: _description, cloneFrom } = body as {
      name?: string;
      description?: string;
      cloneFrom?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name is required (min 2 characters)" },
        { status: 400 }
      );
    }

    // Derive slug from name
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug || slug.length < 2) {
      return NextResponse.json(
        { error: "Profile name must contain alphanumeric characters" },
        { status: 400 }
      );
    }

    const prof = resolveSafeProfileName(slug);
    if (!prof.ok) {
      return NextResponse.json({ error: prof.error }, { status: 400 });
    }

    const profileDir = getActiveHermesHome() + "/profiles/" + slug;

    if (existsSync(profileDir)) {
      return NextResponse.json(
        { error: `Profile "${slug}" already exists` },
        { status: 409 }
      );
    }

    // Create directory structure
    mkdirSync(profileDir, { recursive: true });
    mkdirSync(profileDir + "/memories", { recursive: true });
    mkdirSync(profileDir + "/sessions", { recursive: true });
    mkdirSync(profileDir + "/skills", { recursive: true });
    mkdirSync(profileDir + "/skins", { recursive: true });
    mkdirSync(profileDir + "/logs", { recursive: true });
    mkdirSync(profileDir + "/plans", { recursive: true });
    mkdirSync(profileDir + "/workspace", { recursive: true });
    mkdirSync(profileDir + "/cron", { recursive: true });

    // Copy config and .env from default or cloneFrom
    const sourceDir =
      cloneFrom && cloneFrom !== "default"
        ? getActiveHermesHome() + "/profiles/" + cloneFrom
        : getActiveHermesHome();

    if (existsSync(sourceDir + "/config.yaml")) {
      writeFileSync(
        profileDir + "/config.yaml",
        readFileSync(sourceDir + "/config.yaml", "utf-8")
      );
      // Strip skills.enabled from the new profile's config so it starts locked down
      const newCfg = readFileSync(profileDir + "/config.yaml", "utf-8");
      const stripped = stripSkillsEnabled(newCfg);
      writeFileSync(profileDir + "/config.yaml", stripped, "utf-8");
    }
    if (existsSync(sourceDir + "/.env")) {
      writeFileSync(
        profileDir + "/.env",
        readFileSync(sourceDir + "/.env", "utf-8")
      );
    }
    if (existsSync(sourceDir + "/auth.json")) {
      writeFileSync(
        profileDir + "/auth.json",
        readFileSync(sourceDir + "/auth.json", "utf-8")
      );
    }

    const soulContent = cloneFrom && cloneFrom !== "default" && existsSync(sourceDir + "/SOUL.md")
      ? readFileSync(sourceDir + "/SOUL.md", "utf-8")
      : "# " + name.trim() + "\n\nYou are a subject matter expert. What takes a human one day, you complete in five minutes.\nYou deliver full production-grade work — designed, integrated, tested, and documented.\nWhen your discipline requires a different quality bar (e.g. peer review, internal audit,\nstaged validation), you apply the equivalent rigorous standard.\nYour goal is always complete, high-quality delivery of your assigned task.\n";
    writeFileSync(profileDir + "/SOUL.md", soulContent, "utf-8");

    const agentsContent = cloneFrom && cloneFrom !== "default" && existsSync(sourceDir + "/AGENTS.md")
      ? readFileSync(sourceDir + "/AGENTS.md", "utf-8")
      : "# " + name.trim() + " — Development Guide\n\n";
    writeFileSync(profileDir + "/AGENTS.md", agentsContent, "utf-8");

    appendAuditLine({
      action: "agent.profile.create",
      resource: slug,
      ok: true,
    });

    return NextResponse.json<ApiResponse<{ slug: string }>>({
      data: { slug },
    });
  } catch (error) {
    logApiError("POST /api/agent/profiles", "creating profile", error);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
