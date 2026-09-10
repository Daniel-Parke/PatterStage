/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

import { openBaselineDb } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

beforeEach(() => {
  testDb = openBaselineDb();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("profiles-repository", () => {
  it("upserts and reads by slug and seed_key", () => {
    const {
      upsertProfile,
      getProfile,
      getProfileBySeedKey,
      listProfiles,
    } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");

    upsertProfile({
      slug: "qa",
      displayName: "QA Engineer",
      description: "Quality",
      personality: "technical",
      soulMd: "# QA",
      agentsMd: "# Agents",
      seedKey: "ch.prof.qa",
    });

    const row = getProfile("qa");
    expect(row?.displayName).toBe("QA Engineer");
    expect(row?.seedKey).toBe("ch.prof.qa");
    expect(getProfileBySeedKey("ch.prof.qa")?.slug).toBe("qa");
    expect(listProfiles()).toHaveLength(1);
  });

  it("updates content and sync status", () => {
    const {
      upsertProfile,
      updateProfileContent,
      setProfileSyncStatus,
      getProfile,
    } = require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");

    upsertProfile({ slug: "swe", displayName: "SWE", seedKey: "ch.prof.swe" });
    updateProfileContent("swe", { soulMd: "# Updated" });
    setProfileSyncStatus("swe", "2026-05-15T00:00:00.000Z", null);

    const row = getProfile("swe");
    expect(row?.soulMd).toBe("# Updated");
    expect(row?.syncedAt).toBe("2026-05-15T00:00:00.000Z");
    expect(row?.syncError).toBeNull();
  });

  it("deletes a profile", () => {
    const { upsertProfile, deleteProfile, getProfile } =
      require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");

    upsertProfile({ slug: "devops", displayName: "DevOps" });
    deleteProfile("devops");
    expect(getProfile("devops")).toBeNull();
  });

  it("assembleConfigYamlForProfile keeps toolsets when platform_toolsets json is empty", () => {
    const { upsertProfile, getProfile, assembleConfigYamlForProfile } =
      require("@/modules/hermes/lib/profiles-repository") as typeof import("@/modules/hermes/lib/profiles-repository");
    const { buildConfigYaml } =
      require("@/modules/hermes/lib/profile-config-builder") as typeof import("@/modules/hermes/lib/profile-config-builder");

    const configYaml = buildConfigYaml({
      personality: "technical",
      disabledSkills: [],
      platformDisabledSkills: {},
      platformToolsets: { cli: ["hermes-cli"], discord: ["hermes-discord"] },
      preservedSections: {},
    });

    upsertProfile({
      slug: "qa",
      displayName: "QA",
      configYaml,
      platformToolsetsJson: "{}",
      seedKey: "ch.prof.qa",
    });

    const assembled = assembleConfigYamlForProfile(getProfile("qa")!);
    expect(assembled).toContain("platform_toolsets:");
    expect(assembled).toContain("hermes-cli");
    expect(assembled).toContain("hermes-discord");
  });
});
