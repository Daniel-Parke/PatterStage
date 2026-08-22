// ═══════════════════════════════════════════════════════════════
// profile-discovery.ts: finding, adopting and removing on disk
//
// Split out of profile-sync.ts. Push and pull both assume the
// database already knows about a profile or skill. This module is
// what happens before that: walk the agent's filesystem, report what
// is there, and adopt it into the database on request. Plus the one
// destructive operation in the family, `removeProfileFromDisk`.
//
// Adoption always ends in a pull, so the file-by-file reading logic
// lives in exactly one place (profile-pull) rather than being
// duplicated for the import path.
//
// `removeProfileFromDisk` carries two guards that look paranoid and
// are not, because it ends in a recursive delete: it refuses the
// "default" slug outright, and it requires the resolved path to
// contain "/profiles/" before it will touch anything.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "fs";

import { messageFromError } from "@/lib/api-fetch";
import { getHermesDefaultRoot } from "./profile-paths";
import { getProfile, listProfiles, upsertProfile } from "./profiles-repository";
import { parseSkillFrontmatter, upsertSkill } from "@/lib/skills-repository";
import { isValidProfileSlug } from "@/lib/profile-slug";
import { pullProfileFromHermes } from "./profile-pull";
import {
  globalSkillsRoot,
  profileRootForSlug,
  type SyncResult,
} from "./profile-sync-shared";

export interface DiscoveredProfile {
  slug: string;
  path: string;
  inDatabase: boolean;
}

export function discoverLocalProfiles(): DiscoveredProfile[] {
  const defaultRoot = getHermesDefaultRoot();
  const profilesDir = defaultRoot + "/profiles";
  const inDb = new Set(listProfiles().map((p) => p.slug));
  const found: DiscoveredProfile[] = [];
  if (!existsSync(profilesDir)) return found;
  for (const name of readdirSync(profilesDir)) {
    if (name.startsWith(".")) continue;
    const path = profilesDir + "/" + name;
    try {
      if (!statSync(path).isDirectory()) continue;
    }
    catch {
      continue;
    }
    const slug = name.toLowerCase();
    if (!isValidProfileSlug(slug)) continue;
    found.push({
      slug,
      path,
      inDatabase: inDb.has(slug),
    });
  }
  return found;
}

export function importDiscoveredProfile(slug: string): SyncResult {
  if (getProfile(slug)) {
    return pullProfileFromHermes(slug);
  }
  const discovered = discoverLocalProfiles().find((d) => d.slug === slug);
  if (!discovered) {
    return { success: false, slug, backupPath: null, error: "Profile directory not found" };
  }
  const displayName = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");
  upsertProfile({
    slug,
    displayName,
    description: "Imported from local Hermes profile",
  });
  return pullProfileFromHermes(slug);
}

export function removeProfileFromDisk(slug: string): void {
  if (slug === "default") return;
  const root = profileRootForSlug(slug);
  if (existsSync(root) && root.includes("/profiles/")) {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Walk global skills catalog on disk for discovery/import. */
export function scanDiskSkillsCatalog(): { skillKey: string; path: string }[] {
  const skillsRoot = globalSkillsRoot();
  const results: { skillKey: string; path: string }[] = [];
  if (!existsSync(skillsRoot)) return results;

  const walk = (dir: string, prefix: string): void => {
    for (const item of readdirSync(dir)) {
      if (item.startsWith(".")) continue;
      const full = dir + "/" + item;
      try {
        const st = statSync(full);
        if (!st.isDirectory()) continue;
        const key = prefix ? prefix + "/" + item : item;
        if (existsSync(full + "/SKILL.md")) {
          results.push({ skillKey: key, path: full + "/SKILL.md" });
        }
        else {
          walk(full, key);
        }
      }
      catch {
        // skip
      }
    }
  };
  walk(skillsRoot, "");
  return results;
}

export function importAllSkillsFromDisk(): SyncResult[] {
  const results: SyncResult[] = [];
  for (const { skillKey, path } of scanDiskSkillsCatalog()) {
    try {
      const content = readFileSync(path, "utf-8");
      const meta = parseSkillFrontmatter(content);
      upsertSkill({
        skillKey,
        content,
        displayName: meta.name || skillKey,
        description: meta.description,
        category: meta.category,
        source: "custom",
      });
      results.push({ success: true, slug: skillKey, backupPath: null, error: null });
    }
    catch (err) {
      const message = messageFromError(err, "");
      results.push({ success: false, slug: skillKey, backupPath: null, error: message });
    }
  }
  return results;
}
