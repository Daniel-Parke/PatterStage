/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- use the real SQLite driver outside Jest's database mock */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(__dirname, "..", "..");
const PREFIX = "t0161-state-completeness-";
const DatabaseCtor = require(join(ROOT, "node_modules", "better-sqlite3", "lib", "index.js")) as typeof import("better-sqlite3");

const BLOCK_LOCAL_ENV = String.raw`
  const fs = require('node:fs');
  const path = require('node:path');
  const original = fs.existsSync;
  fs.existsSync = function (candidate) {
    if (typeof candidate === 'string' && path.resolve(candidate) === process.env.ORACLE_LOCAL_ENV) return false;
    return original.apply(this, arguments);
  };
  require('node:module').syncBuiltinESMExports();
`;

function environment(root: string, dataDir: string, hermesHome: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test", NODE_OPTIONS: "", HOME: root, USERPROFILE: root,
    APPDATA: root, LOCALAPPDATA: root, PS_DATA_DIR: dataDir,
    CH_DATA_DIR: dataDir, CONTROL_HUB_DATA_DIR: dataDir, HERMES_HOME: hermesHome,
    ORACLE_LOCAL_ENV: join(ROOT, ".env.local"),
  };
  for (const key of ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function run(script: string, args: string[], preload: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ["--require", preload, "--import", "tsx", script, ...args], {
    cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000, windowsHide: true,
  });
}

function requireSuccess(result: ReturnType<typeof run>, step: string): void {
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`INFRASTRUCTURE: ${step} failed (${result.error?.message ?? result.signal ?? result.status})`);
  }
}

function requireCompleted(result: ReturnType<typeof run>, step: string): void {
  if (result.error || result.signal || result.status === null) {
    throw new Error(`INFRASTRUCTURE: ${step} did not complete (${result.error?.message ?? result.signal ?? result.status})`);
  }
}

function removeFixture(root: string): void {
  const actual = realpathSync(root);
  if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
    throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
  }
  rmSync(actual, { recursive: true, force: true });
}

function existingRows(db: InstanceType<typeof DatabaseCtor>) {
  return {
    root: db.prepare("SELECT * FROM agent_root ORDER BY id").all(),
    skills: db.prepare("SELECT * FROM skills ORDER BY skill_key").all(),
    profile: db.prepare("SELECT * FROM agent_profiles WHERE slug = 'existing-profile'").all(),
  };
}

function preparePartialProfileFixture(root: string) {
  const dataDir = join(root, "data");
  const hermesHome = join(root, "hermes");
  const preload = join(root, "block-local-env.cjs");
  mkdirSync(dataDir);
  mkdirSync(join(hermesHome, "skills", "fixture"), { recursive: true });
  mkdirSync(join(hermesHome, "profiles", "existing-profile"), { recursive: true });
  writeFileSync(preload, BLOCK_LOCAL_ENV);
  writeFileSync(join(hermesHome, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
  writeFileSync(join(hermesHome, "SOUL.md"), "Original disposable root.\n");
  writeFileSync(join(hermesHome, "skills", "fixture", "SKILL.md"),
    "---\nname: Fixture\ndescription: Disposable skill\n---\nOriginal disposable skill.\n");
  writeFileSync(join(hermesHome, "profiles", "existing-profile", "config.yaml"),
    "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
  writeFileSync(join(hermesHome, "profiles", "existing-profile", "SOUL.md"), "Original disposable profile.\n");
  const env = environment(root, dataDir, hermesHome);
  requireSuccess(run("scripts/tooling/migrate-db.ts", [], preload, env), "disposable migration");
  if (!existsSync(join(dataDir, "patterstage.db"))) {
    throw new Error("INFRASTRUCTURE: migration did not create the disposable database");
  }
  const initial = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
  requireSuccess(initial, "initial root, skill and profile import control");
  const db = new DatabaseCtor(join(dataDir, "patterstage.db"));
  try {
    const rows = existingRows(db);
    if (rows.root.length !== 1 || rows.skills.length !== 1 || rows.profile.length !== 1) {
      throw new Error("INFRASTRUCTURE: initial import did not establish root, skill and existing profile rows");
    }
  } finally {
    db.close();
  }
  writeFileSync(join(hermesHome, "SOUL.md"), "Changed disk root must not overwrite SQLite.\n");
  writeFileSync(join(hermesHome, "skills", "fixture", "SKILL.md"),
    "---\nname: Fixture\ndescription: Disposable skill\n---\nChanged disk skill must not overwrite SQLite.\n");
  writeFileSync(join(hermesHome, "profiles", "existing-profile", "SOUL.md"),
    "Changed disk profile must not overwrite SQLite.\n");
  const missingProfile = join(hermesHome, "profiles", "new-profile");
  mkdirSync(missingProfile, { recursive: true });
  writeFileSync(join(missingProfile, "SOUL.md"), "New SOUL-only disposable profile.\n");
  if (existsSync(join(missingProfile, "config.yaml"))) {
    throw new Error("INFRASTRUCTURE: the new disk profile is not SOUL-only");
  }
  return { dbPath: join(dataDir, "patterstage.db"), env, preload };
}

describe("T-0161 explicit Hermes state import completeness", () => {
  it("reports a new disk profile after partial import without overwriting existing rows", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const dbPath = join(dataDir, "patterstage.db");
      const preload = join(root, "block-local-env.cjs");
      mkdirSync(dataDir);
      mkdirSync(join(hermesHome, "skills", "fixture"), { recursive: true });
      writeFileSync(preload, BLOCK_LOCAL_ENV);
      writeFileSync(join(hermesHome, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
      writeFileSync(join(hermesHome, "SOUL.md"), "Preserve existing disposable root.\n");
      writeFileSync(join(hermesHome, "skills", "fixture", "SKILL.md"),
        "---\nname: Fixture\ndescription: Disposable skill\n---\nPreserve existing disposable skill.\n");
      const env = environment(root, dataDir, hermesHome);

      requireSuccess(run("scripts/tooling/migrate-db.ts", [], preload, env), "disposable migration");
      if (!existsSync(dbPath)) throw new Error("INFRASTRUCTURE: migration did not create the disposable database");
      const initial = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
      requireSuccess(initial, "initial root and skill import control");
      if (!/"skills"\s*:\s*1/.test(initial.stdout) || !/"root"\s*:\s*true/.test(initial.stdout)) {
        throw new Error("INFRASTRUCTURE: initial control did not import root and skill");
      }
      const complete = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
      requireSuccess(complete, "already-complete import control");
      if (!/"skills"\s*:\s*0/.test(complete.stdout) || !/"profiles"\s*:\s*0/.test(complete.stdout)) {
        throw new Error("INFRASTRUCTURE: already-complete control did not take the expected no-op path");
      }

      const profileRoot = join(hermesHome, "profiles", "new-profile");
      mkdirSync(profileRoot, { recursive: true });
      writeFileSync(join(profileRoot, "config.yaml"), "model:\n  default: anthropic/disposable-model\n  provider: anthropic\n");
      writeFileSync(join(profileRoot, "SOUL.md"), "New disposable profile.\n");
      const db = new DatabaseCtor(dbPath);
      try {
        const before = {
          soul: (db.prepare("SELECT soul_md FROM agent_root WHERE id = 1").get() as { soul_md: string }).soul_md,
          skill: (db.prepare("SELECT content FROM skills WHERE skill_key = 'fixture'").get() as { content: string }).content,
        };
        if (!before.soul.includes("Preserve existing") || !before.skill.includes("Preserve existing")) {
          throw new Error("INFRASTRUCTURE: initial import rows were not populated");
        }

        const incomplete = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
        if (incomplete.error || incomplete.signal || incomplete.status === null) {
          throw new Error(`INFRASTRUCTURE: partial import did not complete (${incomplete.error?.message ?? incomplete.signal ?? incomplete.status})`);
        }
        const after = {
          soul: (db.prepare("SELECT soul_md FROM agent_root WHERE id = 1").get() as { soul_md: string }).soul_md,
          skill: (db.prepare("SELECT content FROM skills WHERE skill_key = 'fixture'").get() as { content: string }).content,
          profiles: (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n,
        };
        if (after.soul !== before.soul || after.skill !== before.skill || after.profiles !== 0) {
          throw new Error("INFRASTRUCTURE: partial-import fixture unexpectedly changed existing data");
        }

        const forced = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
        requireSuccess(forced, "explicit pull control");
        const importedProfiles = (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n;
        if (importedProfiles !== 1 || !/"profiles"\s*:\s*1/.test(forced.stdout)) {
          throw new Error("INFRASTRUCTURE: explicit pull did not import the new profile");
        }

        expect({ exitedNonZero: incomplete.status !== 0, preserved: after.soul === before.soul && after.skill === before.skill })
          .toEqual({ exitedNonZero: true, preserved: true });
      } finally {
        db.close();
      }
    } finally {
      const actual = realpathSync(root);
      if (dirname(actual) !== realpathSync(tmpdir()) || !basename(actual).startsWith(PREFIX)) {
        throw new Error("INFRASTRUCTURE: refusing to remove a fixture outside the temporary directory");
      }
      rmSync(actual, { recursive: true, force: true });
    }
  });

  it("imports only a new SOUL-only profile when explicitly requested after a strict retry", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { dbPath, env, preload } = preparePartialProfileFixture(root);
      const db = new DatabaseCtor(dbPath);
      try {
        const before = existingRows(db);
        const ordinary = run("scripts/tooling/import-hermes-state.ts", [], preload, env);
        requireCompleted(ordinary, "ordinary partial retry");
        const afterOrdinary = existingRows(db);
        const absentAfterOrdinary = db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number };

        const targeted = run("scripts/tooling/import-hermes-state.ts", ["--import-missing-profiles"], preload, env);
        requireCompleted(targeted, "targeted missing-profile import");
        const afterTargeted = existingRows(db);
        const imported = db.prepare("SELECT soul_md FROM agent_profiles WHERE slug = 'new-profile'").get() as { soul_md: string } | undefined;
        expect({
          ordinaryExitedNonZero: ordinary.status !== 0,
          ordinaryPreservedRows: afterOrdinary,
          absentAfterOrdinary: absentAfterOrdinary.n,
          targetedExitedZero: targeted.status === 0,
          targetedPreservedRows: afterTargeted,
          importedSoul: imported?.soul_md,
        }).toEqual({
          ordinaryExitedNonZero: true,
          ordinaryPreservedRows: before,
          absentAfterOrdinary: 0,
          targetedExitedZero: true,
          targetedPreservedRows: before,
          importedSoul: "New SOUL-only disposable profile.\n",
        });
      } finally {
        db.close();
      }
    } finally {
      removeFixture(root);
    }
  });

  it("fails the explicit missing-profile import when SQLite refuses that profile", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { dbPath, env, preload } = preparePartialProfileFixture(root);
      const db = new DatabaseCtor(dbPath);
      try {
        const before = existingRows(db);
        db.exec(`CREATE TRIGGER oracle_refuse_profile BEFORE INSERT ON agent_profiles
          WHEN NEW.slug = 'new-profile' BEGIN SELECT RAISE(ABORT, 'oracle profile refusal'); END`);
        db.exec("SAVEPOINT oracle_refusal_probe");
        let triggerWasLive = false;
        try {
          db.prepare("INSERT INTO agent_profiles (slug) VALUES ('new-profile')").run();
        } catch (error) {
          triggerWasLive = error instanceof Error && error.message.includes("oracle profile refusal");
        } finally {
          db.exec("ROLLBACK TO oracle_refusal_probe");
          db.exec("RELEASE oracle_refusal_probe");
        }
        if (!triggerWasLive) {
          throw new Error("INFRASTRUCTURE: disposable SQLite refusal trigger did not fire");
        }
        const refused = run("scripts/tooling/import-hermes-state.ts", ["--import-missing-profiles"], preload, env);
        requireCompleted(refused, "refused missing-profile import");
        const after = existingRows(db);
        const absent = db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number };
        const forcedControl = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
        requireCompleted(forcedControl, "forced import refusal control");
        if (forcedControl.status === 0) {
          throw new Error("INFRASTRUCTURE: forced import did not reject the disposable SQLite refusal");
        }
        expect({ exitedNonZero: refused.status !== 0, preservedRows: after, missingProfileCount: absent.n })
          .toEqual({ exitedNonZero: true, preservedRows: before, missingProfileCount: 0 });
      } finally {
        db.close();
      }
    } finally {
      removeFixture(root);
    }
  });

  it("rolls back a newly upserted profile when its malformed config makes pull return failure", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { dbPath, env, preload } = preparePartialProfileFixture(root);
      writeFileSync(join(root, "hermes", "profiles", "new-profile", "config.yaml"), "model: [unterminated\n");
      const db = new DatabaseCtor(dbPath);
      try {
        const before = existingRows(db);
        const targeted = run("scripts/tooling/import-hermes-state.ts", ["--import-missing-profiles"], preload, env);
        requireCompleted(targeted, "malformed-profile targeted import");
        const after = existingRows(db);
        const afterTargetedCount = (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n;

        const moduleUrl = pathToFileURL(join(ROOT, "src", "modules", "hermes", "lib", "profile-discovery.ts")).href;
        const probe = spawnSync(process.execPath, ["--require", preload, "--import", "tsx", "--eval", `
          import(${JSON.stringify(moduleUrl)}).then(({ importDiscoveredProfile }) => {
            const result = importDiscoveredProfile('new-profile');
            process.stdout.write('ORACLE_RESULT=' + JSON.stringify({ success: result.success }) + '\\n');
          }).catch(() => { process.exitCode = 1; });
        `], {
          cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          timeout: 60_000, windowsHide: true,
        });
        requireCompleted(probe, "malformed-profile direct import control");
        const probeResult = probe.stdout.match(/ORACLE_RESULT=(\{[^\r\n]+\})/);
        const afterProbeCount = (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n;
        if (probe.status !== 0 || !probeResult || JSON.parse(probeResult[1]).success !== false || afterProbeCount !== 1) {
          throw new Error("INFRASTRUCTURE: malformed config did not cause a returned failure after the disposable profile upsert");
        }
        expect({ exitedNonZero: targeted.status !== 0, preservedRows: after, missingProfileCount: afterTargetedCount })
          .toEqual({ exitedNonZero: true, preservedRows: before, missingProfileCount: 0 });
      } finally {
        db.close();
      }
    } finally {
      removeFixture(root);
    }
  });

  it("preserves an existing SQLite profile when targeted import sees incomplete root state", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { dbPath, env, preload } = preparePartialProfileFixture(root);
      const db = new DatabaseCtor(dbPath);
      try {
        db.prepare("UPDATE agent_root SET soul_md = '' WHERE id = 1").run();
        db.prepare("UPDATE agent_profiles SET soul_md = ? WHERE slug = 'existing-profile'")
          .run("SQLite-only profile edit must survive targeted import.\n");
        const before = existingRows(db);
        const editedProfile = db.prepare("SELECT soul_md FROM agent_profiles WHERE slug = 'existing-profile'").get() as { soul_md: string };
        const incompleteRoot = db.prepare("SELECT soul_md FROM agent_root WHERE id = 1").get() as { soul_md: string };
        if (incompleteRoot.soul_md !== "" || !editedProfile.soul_md.startsWith("SQLite-only") || before.skills.length !== 1) {
          throw new Error("INFRASTRUCTURE: incomplete-root and divergent-profile fixture was not established");
        }
        const targeted = run("scripts/tooling/import-hermes-state.ts", ["--import-missing-profiles"], preload, env);
        requireCompleted(targeted, "targeted import with incomplete root");
        const after = existingRows(db);
        const rootAfter = db.prepare("SELECT soul_md FROM agent_root WHERE id = 1").get() as { soul_md: string };
        const addedProfile = db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number };
        expect({
          existingProfile: after.profile,
          existingSkills: after.skills,
          successWasComplete: targeted.status !== 0 || (rootAfter.soul_md.trim().length > 0 && addedProfile.n === 1),
        }).toEqual({ existingProfile: before.profile, existingSkills: before.skills, successWasComplete: true });
      } finally {
        db.close();
      }
    } finally {
      removeFixture(root);
    }
  });

  it("fails targeted state import if configured Hermes config disappears", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const { dbPath, env, preload } = preparePartialProfileFixture(root);
      const config = join(root, "hermes", "config.yaml");
      if (!existsSync(config)) throw new Error("INFRASTRUCTURE: configured Hermes fixture is missing config before removal");
      rmSync(config);
      if (existsSync(config)) throw new Error("INFRASTRUCTURE: Hermes config removal did not take effect");
      const db = new DatabaseCtor(dbPath);
      try {
        const before = existingRows(db);
        const targeted = run("scripts/tooling/import-hermes-state.ts", ["--import-missing-profiles"], preload, env);
        requireCompleted(targeted, "targeted import after Hermes config removal");
        const after = existingRows(db);
        const missingProfileCount = (db.prepare("SELECT COUNT(*) AS n FROM agent_profiles WHERE slug = 'new-profile'").get() as { n: number }).n;
        expect({ exitedNonZero: targeted.status !== 0, preservedRows: after, missingProfileCount })
          .toEqual({ exitedNonZero: true, preservedRows: before, missingProfileCount: 0 });
      } finally {
        db.close();
      }
    } finally {
      removeFixture(root);
    }
  });

  it("preserves SQLite-only root config when soul is blank and no skills or profiles exist", () => {
    const root = mkdtempSync(join(tmpdir(), PREFIX));
    try {
      const dataDir = join(root, "data");
      const hermesHome = join(root, "hermes");
      const preload = join(root, "block-local-env.cjs");
      const sqliteConfig = "model:\n  default: anthropic/sqlite-only-model\n";
      mkdirSync(dataDir);
      mkdirSync(hermesHome);
      writeFileSync(preload, BLOCK_LOCAL_ENV);
      writeFileSync(join(hermesHome, "config.yaml"), "model:\n  default: anthropic/disk-only-model\n");
      writeFileSync(join(hermesHome, "SOUL.md"), "Disposable disk root soul.\n");
      const env = environment(root, dataDir, hermesHome);
      requireSuccess(run("scripts/tooling/migrate-db.ts", [], preload, env), "disposable migration");
      const initial = run("scripts/tooling/import-hermes-state.ts", ["--pull"], preload, env);
      requireSuccess(initial, "disk-root control import");
      const db = new DatabaseCtor(join(dataDir, "patterstage.db"));
      try {
        const diskRoot = db.prepare("SELECT config_yaml, soul_md FROM agent_root WHERE id = 1").get() as
          { config_yaml: string; soul_md: string } | undefined;
        if (!diskRoot || !diskRoot.config_yaml.includes("disk-only-model") || !diskRoot.soul_md.includes("Disposable disk")) {
          throw new Error("INFRASTRUCTURE: initial control did not pull the disposable disk root");
        }
        const update = db.prepare("UPDATE agent_root SET config_yaml = ?, soul_md = '' WHERE id = 1").run(sqliteConfig);
        const before = db.prepare("SELECT config_yaml, soul_md FROM agent_root WHERE id = 1").get() as
          { config_yaml: string; soul_md: string };
        const counts = db.prepare("SELECT (SELECT COUNT(*) FROM skills) AS skills, (SELECT COUNT(*) FROM agent_profiles) AS profiles")
          .get() as { skills: number; profiles: number };
        if (update.changes !== 1 || before.config_yaml !== sqliteConfig || before.soul_md !== "" ||
            counts.skills !== 0 || counts.profiles !== 0) {
          throw new Error("INFRASTRUCTURE: SQLite-only partial root fixture was not established");
        }
        const targeted = run("scripts/tooling/import-hermes-state.ts", ["--import-missing-profiles"], preload, env);
        requireCompleted(targeted, "targeted import with SQLite-only root config");
        const after = db.prepare("SELECT config_yaml, soul_md FROM agent_root WHERE id = 1").get() as
          { config_yaml: string; soul_md: string };
        const afterCounts = db.prepare("SELECT (SELECT COUNT(*) FROM skills) AS skills, (SELECT COUNT(*) FROM agent_profiles) AS profiles")
          .get() as { skills: number; profiles: number };
        expect({ exitedNonZero: targeted.status !== 0, root: after, counts: afterCounts })
          .toEqual({ exitedNonZero: true, root: before, counts });
      } finally {
        db.close();
      }
    } finally {
      removeFixture(root);
    }
  });
});
