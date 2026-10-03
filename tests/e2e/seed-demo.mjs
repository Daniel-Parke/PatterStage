/**
 * Representative content for the documentation screenshots.
 *
 * Every screen in the guides gets photographed, and a screen photographed empty
 * teaches a reader nothing except that the product looks empty. So this creates
 * a small, plausible working set through the product's OWN public routes -- not
 * by writing rows into the database, which would let a screenshot show a state
 * the product cannot actually reach.
 *
 * It is deliberately modest. A dashboard carrying four hundred missions is as
 * unhelpful as one carrying none: the reader is trying to recognise the shape of
 * the screen, not admire a workload. Names are dull on purpose, because a manual
 * full of jokes dates badly.
 *
 * NOTHING HERE CALLS A MODEL. Missions are saved rather than dispatched, and the
 * Rec Room is seeded through its character and theme library rather than by
 * creating a story, because creating one can generate its first chapter and a
 * screenshot run must never be able to spend the operator's money. The Story
 * Weaver screens are therefore photographed with a stocked library and no
 * stories, which is a state a real reader passes through on their first visit.
 *
 * Every call is best-effort. A screen whose backing feature is switched off on
 * this install should still be photographed as a reader would find it, so a
 * failure here is information about the install rather than a reason to stop.
 */

const MISSIONS = [
  {
    name: "Summarise the week's commits",
    instruction:
      "Read this week's commits on the main branch and write a short summary of what changed, grouped by area.",
  },
  {
    name: "Check the dependency licences",
    instruction: "List every direct dependency and its licence, and flag anything that is not permissive.",
  },
  {
    name: "Draft the release notes",
    instruction: "Turn the changelog's unreleased section into release notes a non-technical reader can follow.",
  },
];

const SCRIPTS = [
  {
    name: "disk-usage.sh",
    content:
      "#!/usr/bin/env bash\n# Report the ten largest directories under $HOME.\nset -euo pipefail\ndu -h -d 2 \"$HOME\" | sort -rh | head -n 10\n",
  },
  {
    name: "backup-check.mjs",
    content:
      '// Report how many database backups exist and how old the newest one is.\nimport { readdirSync } from "node:fs";\n\nconst dir = process.env.PS_BACKUP_DIR ?? ".";\nconst backups = readdirSync(dir).filter((f) => f.endsWith(".bak"));\nconsole.log(`${backups.length} backup(s) in ${dir}`);\n',
  },
];

const CHARACTERS = [
  { name: "Mairi Sinclair", role: "Lighthouse keeper", description: "Practical, sleeps badly, notices everything." },
  { name: "Tom Aldridge", role: "Relief keeper", description: "New to the rock and too cheerful about it." },
];

const THEMES = [
  { name: "Coastal gothic", description: "Weather as a character; the sea keeps its own counsel." },
  { name: "Quiet procedural", description: "Competent people doing careful work while something is wrong." },
];

/** POST through the product's own API, swallowing anything that goes wrong. */
async function post(request, path, data) {
  try {
    const res = await request.post(path, { data });
    return res.ok() ? await res.json().catch(() => null) : null;
  } catch {
    return null;
  }
}

/** PUT, likewise. */
async function put(request, path, data) {
  try {
    const res = await request.put(path, { data });
    return res.ok() ? await res.json().catch(() => null) : null;
  } catch {
    return null;
  }
}

/**
 * Seed the demo content and report what landed.
 *
 * The counts come back so the caller can say what the screenshots were taken
 * against, which is the difference between "the board looks empty" and "the
 * board IS empty".
 */
export async function seedDemo(request) {
  const made = { missions: 0, scripts: 0, characters: 0, themes: 0 };

  // Saved, not dispatched: a screenshot must not depend on a gateway answering,
  // and a board of drafts is the state a reader recognises from their own first
  // afternoon with the product.
  for (const mission of MISSIONS) {
    const created = await post(request, "/api/missions", {
      action: "dispatch",
      dispatchMode: "save",
      ...mission,
    });
    if (created) made.missions += 1;
  }

  for (const script of SCRIPTS) {
    const saved = await put(request, `/api/scripts/${encodeURIComponent(script.name)}`, {
      content: script.content,
    });
    if (saved) made.scripts += 1;
  }

  for (const character of CHARACTERS) {
    const saved = await post(request, "/api/stories", {
      action: "characters",
      subAction: "create",
      ...character,
    });
    if (saved) made.characters += 1;
  }

  for (const theme of THEMES) {
    const saved = await post(request, "/api/stories", {
      action: "themes",
      subAction: "create",
      ...theme,
    });
    if (saved) made.themes += 1;
  }

  return made;
}

export { MISSIONS, SCRIPTS, CHARACTERS, THEMES };
