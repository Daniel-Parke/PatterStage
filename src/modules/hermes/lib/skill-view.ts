// ═══════════════════════════════════════════════════════════════
// skill-view.ts — one payload for the skill viewer, whichever route serves it
// ═══════════════════════════════════════════════════════════════
//
// `/api/skills/writing` is matched by `[name]/route.ts` and
// `/api/skills/office/pdf` by `[...path]/route.ts`, and the two answered
// different shapes: the catch-all sent frontmatter, raw content and linked
// files, the single-segment one sent five fields. The viewer reached into the
// fields only one of them carried, so opening any top-level skill key threw
// (T-0103, D81).
//
// The catalogue is checked when the disk has no SKILL.md, because a skill can
// be in the catalogue before it has ever been written to disk and that is the
// row the operator clicked.

import { existsSync, readFileSync, readdirSync, statSync } from "fs";

import { logApiError } from "@/lib/api-logger";
import { getSkill, parseSkillFrontmatter, stripSkillFrontmatter } from "@/lib/skills-repository";
// design-lint-disable-next-line hermes-outside-adapter -- this module is the adapter: reading the agent's own skills tree is its whole job, and it lives under modules/hermes for exactly that reason.
import { getActiveHermesPaths } from "./agent-runtime";

export interface SkillView {
  name: string;
  path: string;
  source: "disk" | "catalog";
  frontmatter: Record<string, string>;
  content: string;
  rawContent: string;
  size: number;
  lastModified: string;
  linkedFiles: { name: string; path: string; size: number }[];
}

/** The agent's skills root. Kept here so callers do not have to know it. */
export function skillsRoot(): string {
  // design-lint-disable-next-line hermes-outside-adapter -- see the import above.
  return getActiveHermesPaths().skills;
}

function linkedFilesFor(skillDir: string): SkillView["linkedFiles"] {
  const out: SkillView["linkedFiles"] = [];
  for (const subdir of ["references", "templates", "scripts", "assets"]) {
    const subdirPath = skillDir + "/" + subdir;
    if (!existsSync(subdirPath)) continue;
    try {
      for (const item of readdirSync(subdirPath, { withFileTypes: true })) {
        if (!item.isFile()) continue;
        const fPath = subdirPath + "/" + item.name;
        out.push({ name: item.name, path: subdir + "/" + item.name, size: statSync(fPath).size });
      }
    } catch (err) {
      logApiError("skill-view", "reading linked files in " + subdirPath, err);
    }
  }
  return out;
}

/**
 * Read one skill for the viewer, disk first and catalogue second.
 *
 * `skillDir` is the caller's already-validated directory: both routes resolve
 * it through `resolveSkillDirUnderRoot`, which is the containment boundary,
 * and this function must never be handed a path that has not been through it.
 */
export function readSkillView(segments: string[], skillDir: string): SkillView | null {
  const key = segments.join("/");
  const skillMdPath = skillDir + "/SKILL.md";

  if (existsSync(skillMdPath)) {
    const rawContent = readFileSync(skillMdPath, "utf-8");
    const stats = statSync(skillMdPath);
    const fm = parseSkillFrontmatter(rawContent);
    return {
      name: segments[segments.length - 1],
      path: key,
      source: "disk",
      frontmatter: { name: fm.name, description: fm.description, category: fm.category },
      content: stripSkillFrontmatter(rawContent),
      rawContent,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      linkedFiles: linkedFilesFor(skillDir),
    };
  }

  const row = getSkill(key);
  if (!row) return null;
  const fm = parseSkillFrontmatter(row.content);
  return {
    name: segments[segments.length - 1],
    path: key,
    source: "catalog",
    frontmatter: {
      name: fm.name || row.displayName,
      description: fm.description || row.description,
      category: fm.category || row.category,
    },
    content: stripSkillFrontmatter(row.content),
    rawContent: row.content,
    size: row.content.length,
    lastModified: row.updatedAt,
    // Linked files live beside a SKILL.md that is not there.
    linkedFiles: [],
  };
}
