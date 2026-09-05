#!/usr/bin/env node
/**
 * Validate or scaffold data/seed/ (profiles + template pack).
 * Profiles are authored under data/seed/profiles/<slug>/ — this script does not overwrite
 * existing SOUL.md/AGENTS.md unless --scaffold <slug> is passed.
 *
 * Run: node scripts/tooling/generate-seed-pack.mjs
 *      node scripts/tooling/generate-seed-pack.mjs --scaffold support
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const SEED_ROOT = join(ROOT, "data", "seed");
const PROFILES_ROOT = join(SEED_ROOT, "profiles");
const PACK_PATH = join(
  SEED_ROOT,
  "template-packs",
  "patterstage-professional-v1.json",
);

function agentsHeader(slug) {
  const titles = {
    qa: "QA — Development Guide",
    swe: "SWE — Development Guide",
    devops: "DevOps — Development Guide",
    "data-scientist": "Data Scientist — Development Guide",
    "creative-lead": "Creative Lead — Development Guide",
    support: "Support — Development Guide",
  };
  return `# ${titles[slug] ?? slug}\n§\n`;
}

function defaultConfig(personality) {
  return `agent:\n  personality: ${personality}\nskills:\n  enabled: []\n`;
}

function scaffoldProfile(entry) {
  const dir = join(PROFILES_ROOT, entry.slug);
  mkdirSync(dir, { recursive: true });
  const soulPath = join(dir, "SOUL.md");
  const agentsPath = join(dir, "AGENTS.md");
  const configPath = join(dir, "config.yaml");

  if (!existsSync(soulPath)) {
    let soul = `You are a subject matter expert for the ${entry.slug} role.\n`;
    if (entry.slug === "qa") {
      soul +=
        "\n§\nYou are a quality assurance specialist focused on reproduction, regression prevention, and evidence-based fixes.\n";
    }
    writeFileSync(soulPath, soul, "utf-8");
  }
  if (!existsSync(agentsPath)) {
    writeFileSync(
      agentsPath,
      agentsHeader(entry.slug) +
        "You operate within the PatterStage and Hermes ecosystem.\n§\nFollow project conventions and document outcomes clearly.\n",
      "utf-8",
    );
  }
  if (!existsSync(configPath)) {
    writeFileSync(configPath, defaultConfig(entry.personality), "utf-8");
  }
}

function validate() {
  const errors = [];
  const manifestPath = join(PROFILES_ROOT, "manifest.json");
  if (!existsSync(manifestPath)) {
    errors.push(`Missing ${manifestPath}`);
    return errors;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  for (const entry of manifest.profiles ?? []) {
    for (const file of ["SOUL.md", "AGENTS.md", "config.yaml"]) {
      const p = join(PROFILES_ROOT, entry.slug, file);
      if (!existsSync(p)) {
        errors.push(`Missing ${p}`);
      }
    }
  }
  if (!existsSync(PACK_PATH)) {
    errors.push(`Missing ${PACK_PATH}`);
  } else {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf-8"));
    if (!pack.templates?.length) {
      errors.push("Template pack has no templates");
    }
    for (const t of pack.templates ?? []) {
      if (!t.outputFormat?.length || !t.constraints?.length) {
        errors.push(`Template ${t.id} missing outputFormat or constraints`);
      }
    }
  }
  return errors;
}

const args = process.argv.slice(2);
const scaffoldIdx = args.indexOf("--scaffold");
if (scaffoldIdx >= 0) {
  const slug = args[scaffoldIdx + 1];
  const manifest = JSON.parse(
    readFileSync(join(PROFILES_ROOT, "manifest.json"), "utf-8"),
  );
  const entry = manifest.profiles.find((p) => p.slug === slug);
  if (!entry) {
    console.error(`Unknown slug: ${slug}`);
    process.exit(1);
  }
  scaffoldProfile(entry);
  console.log(`Scaffolded missing files for profile: ${slug}`);
  process.exit(0);
}

const errors = validate();
if (errors.length) {
  console.error("Seed pack validation failed:");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(join(PROFILES_ROOT, "manifest.json"), "utf-8"),
);
const pack = JSON.parse(readFileSync(PACK_PATH, "utf-8"));
console.log(
  `OK: ${manifest.profiles.length} profiles, ${pack.templates.length} templates`,
);
