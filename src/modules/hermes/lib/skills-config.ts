import { existsSync, readdirSync } from "fs";

import { buildProfileHermesPathBundle } from "./profile-paths";

export interface ParsedSkillsDisabled {
  disabledNames: Set<string>;
  enabledNames: Set<string>;
  platformDisabled: Record<string, Set<string>>;
}

/**
 * Walk `skillsRoot` for directories that contain SKILL.md (leaf skill ids).
 */
export function collectSkillDirectoryNames(skillsRoot: string): string[] {
  const names: string[] = [];
  if (!existsSync(skillsRoot)) return names;

  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = dir + "/" + entry.name;
      if (!entry.isDirectory()) continue;
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (existsSync(full + "/SKILL.md")) {
        names.push(key);
      }
      else {
        walk(full, key);
      }
    }
  };

  walk(skillsRoot, "");
  return [...new Set(names)].sort();
}

function parseListValue(lines: string[], start: number, sectionEnd: number, key: string): {
  values: Set<string>;
  endExclusive: number;
} {
  const trimmed = lines[start].trim();
  const afterColon = trimmed.slice(`${key}:`.length).trim();
  const values = new Set<string>();

  if (afterColon === "[]") {
    return { values, endExclusive: start + 1 };
  }
  if (afterColon.startsWith("[") && afterColon.endsWith("]")) {
    const inner = afterColon.slice(1, -1).trim();
    if (inner) {
      for (const part of inner.split(",")) {
        const item = part.trim().replace(/^["']|["']$/g, "");
        if (item) values.add(item);
      }
    }
    return { values, endExclusive: start + 1 };
  }
  if (afterColon !== "") {
    values.add(afterColon.replace(/^["']|["']$/g, ""));
    return { values, endExclusive: start + 1 };
  }

  let j = start + 1;
  while (j < sectionEnd) {
    const row = lines[j];
    const t = row.trim();
    if (t === "" || t.startsWith("#")) {
      j++;
      continue;
    }
    const item = t.match(/^-\s*(.+)$/);
    if (item) {
      values.add(item[1].trim().replace(/^["']|["']$/g, ""));
      j++;
      continue;
    }
    break;
  }

  return { values, endExclusive: j };
}

/**
 * Parse Hermes-native skills disabled settings from config.yaml.
 */
export function parseSkillsDisabledFromYaml(content: string): ParsedSkillsDisabled {
  const lines = content.split(/\r?\n/);
  const result: ParsedSkillsDisabled = {
    disabledNames: new Set<string>(),
    enabledNames: new Set<string>(),
    platformDisabled: {},
  };

  const skillsLine = lines.findIndex((line) => line.trimStart().startsWith("skills:"));
  if (skillsLine === -1) return result;

  let sectionEnd = lines.length;
  for (let i = skillsLine + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() !== "" && !raw.startsWith(" ") && !raw.startsWith("\t")) {
      sectionEnd = i;
      break;
    }
  }

  for (let i = skillsLine + 1; i < sectionEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("enabled:")) {
      const parsed = parseListValue(lines, i, sectionEnd, "enabled");
      result.enabledNames = parsed.values;
      i = parsed.endExclusive - 1;
      continue;
    }
    if (trimmed.startsWith("disabled:")) {
      const parsed = parseListValue(lines, i, sectionEnd, "disabled");
      result.disabledNames = parsed.values;
      i = parsed.endExclusive - 1;
      continue;
    }

    if (!trimmed.startsWith("platform_disabled:")) continue;

    const baseIndent = lines[i].search(/\S/);
    let j = i + 1;
    while (j < sectionEnd) {
      const row = lines[j];
      const t = row.trim();
      const indent = row.search(/\S/);
      if (t === "" || t.startsWith("#")) {
        j++;
        continue;
      }
      if (indent <= baseIndent) break;

      const platform = t.match(/^([a-zA-Z0-9_-]+):/);
      if (!platform) break;
      const key = platform[1];
      const parsed = parseListValue(lines, j, sectionEnd, key);
      result.platformDisabled[key] = parsed.values;
      j = parsed.endExclusive;
    }
    i = j - 1;
  }

  return result;
}

export function buildDisabledYamlLines(
  disabledSorted: string[],
  platformDisabled: Record<string, string[]> = {},
): string[] {
  const lines: string[] = [];
  if (disabledSorted.length === 0) {
    lines.push("  disabled: []");
  }
  else {
    lines.push("  disabled:");
    for (const skill of disabledSorted) {
      lines.push(`    - ${skill}`);
    }
  }

  const platforms = Object.keys(platformDisabled).sort();
  if (platforms.length > 0) {
    lines.push("  platform_disabled:");
    for (const platform of platforms) {
      const values = [...new Set(platformDisabled[platform])].sort();
      if (values.length === 0) {
        lines.push(`    ${platform}: []`);
      }
      else {
        lines.push(`    ${platform}:`);
        for (const skill of values) {
          lines.push(`      - ${skill}`);
        }
      }
    }
  }
  return lines;
}

/**
 * Global skills catalog at HERMES_HOME/skills (shared across all profiles).
 * Per-profile customisation is handled via the disabled-skills config, not via separate roots.
 */
export function skillsRootForProfile(): string {
  return buildProfileHermesPathBundle("default").skills;
}

/**
 * Canonical disk path for a skill's SKILL.md file, given the skills
 * root and the catalog key. The 1-line
 *   `${root}/${skillKey}/SKILL.md`
 * shape was repeated at 4 sites across 3 files (api/skills GET,
 * api/skills/[name] GET, api/skills/[...path] GET, and the sync
 * helper's pull-from-disk walker), plus a `${root}/${key}/SKILL.md`
 * variant in the sync push helper and the skillKey.split(...) walker
 * — all byte-equivalent. Centralising the path-join here keeps the
 * "/SKILL.md" suffix in one place so a future SKILL.md → SKILL.mdx
 * rename (or a `skillPathFor(root, key)` that handles slashed
 * catalog keys uniformly) lands in a single edit.
 *
 * String concatenation is intentional (no `path.join`) — the
 * project convention is to avoid `path.join` in shared libs per
 * the Turbopack NFT tracing issue (see `src/lib/paths.ts` header).
 * The skills root is already an absolute path produced by
 * `buildProfileHermesPathBundle`, so plain "/" joining is safe.
 *
 * @param skillsRoot — the absolute skills root (e.g. `~/.hermes/skills`).
 * @param skillKey — the catalog key, e.g. `apple-notes` or
 *                   `apple/apple-notes` for nested skills. Backslashes
 *                   are normalised to forward slashes so the path
 *                   matches what `collectSkillDirectoryNames` walks
 *                   with `path.sep`-aware readers on Windows.
 */
export function skillFilePath(skillsRoot: string, skillKey: string): string {
  return skillsRoot + "/" + skillKey.replace(/\\/g, "/") + "/SKILL.md";
}

/**
 * Map denylist entries (leaf or full path) to canonical catalog `category/skill` keys.
 */
export function normalizeDisabledSkillKeys(
  rawEntries: Iterable<string>,
  catalogKeys: readonly string[],
): string[] {
  const catalog = [...catalogKeys];
  const catalogSet = new Set(catalog);
  const byLeaf = new Map<string, string[]>();
  for (const key of catalog) {
    const leaf = key.includes("/") ? key.split("/").pop() ?? key : key;
    const list = byLeaf.get(leaf) ?? [];
    list.push(key);
    byLeaf.set(leaf, list);
  }

  const resolved = new Set<string>();
  for (const raw of rawEntries) {
    const entry = raw.trim();
    if (!entry) continue;
    if (catalogSet.has(entry)) {
      resolved.add(entry);
      continue;
    }
    const suffixMatches = catalog.filter(
      (key) => key === entry || key.endsWith(`/${entry}`),
    );
    if (suffixMatches.length === 1) {
      resolved.add(suffixMatches[0]);
      continue;
    }
    if (suffixMatches.length > 1) {
      for (const match of suffixMatches) resolved.add(match);
      continue;
    }
    const leafMatches = byLeaf.get(entry);
    if (leafMatches?.length === 1) {
      resolved.add(leafMatches[0]);
      continue;
    }
    if (leafMatches && leafMatches.length > 1) {
      for (const match of leafMatches) resolved.add(match);
      continue;
    }
    resolved.add(entry);
  }
  return [...resolved].sort();
}

/**
 * Effective denylist: explicit disabled + allowlist mode (installed − enabled).
 */
function computeEffectiveDisabledNames(
  parsed: ParsedSkillsDisabled,
  catalogKeys: readonly string[],
): string[] {
  const catalog = [...catalogKeys];
  const explicit = normalizeDisabledSkillKeys(parsed.disabledNames, catalog);

  if (parsed.enabledNames.size === 0) {
    return explicit;
  }

  const allowed = new Set(
    normalizeDisabledSkillKeys(parsed.enabledNames, catalog),
  );
  const fromAllowlist = catalog.filter((key) => !allowed.has(key));
  return normalizeDisabledSkillKeys(
    [...explicit, ...fromAllowlist],
    catalog,
  );
}

/** Parse skills section and compute normalized disabled keys for SQLite / UI. */
export function computeEffectiveDisabledFromYaml(
  yamlContent: string,
  catalogKeys: readonly string[],
): string[] {
  const parsed = parseSkillsDisabledFromYaml(yamlContent);
  return computeEffectiveDisabledNames(parsed, catalogKeys);
}
