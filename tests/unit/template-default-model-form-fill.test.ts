/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * PR 7 — built-in mission templates surface model defaults via /api/templates
 * so the missions form can auto-fill them.  After the model-defaults refactor,
 * built-in templates no longer carry explicit defaultModel/defaultProvider —
 * the form must derive the model from the registry agent default instead.
 */

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
      };
    },
  },
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock("@/lib/paths", () => ({
  PATHS: { templates: "/tmp/ch/templates" },
  PS_DATA_DIR: "/tmp/ch",
}));

jest.mock("@/lib/db", () => ({
  ensureDb: jest.fn(),
}));

jest.mock("@/lib/catalog-template-repository", () => ({
  listCatalogTemplates: jest.fn(() => [
    {
      id: "bug-hunt",
      seedKey: "ch.tpl.bug-hunt",
      name: "Bug Hunt",
      icon: "Bug",
      color: "pink",
      categoryId: "quality",
      profileSlug: "qa",
      description: "Test",
      instruction: "Fix bugs",
      context: "",
      goals: ["Reproduce"],
      outputFormat: "Markdown",
      constraints: "Scope only",
      suggestedSkills: [],
      localDirs: [],
      references: [],
      missionTimeMinutes: null,
      timeoutMinutes: 30,
    },
  ]),
}));

describe("/api/templates GET — built-in template defaults", () => {
  it("built-in template entries carry no explicit defaultModel or defaultProvider", async () => {
    const { GET } = require("@/app/api/templates/route") as typeof import("@/app/api/templates/route");

    const res = await GET();
    const body = (await res.json()) as {
      data?: {
        templates: Array<{
          id: string;
          isCustom: boolean;
          defaultModel?: string;
          defaultProvider?: string;
        }>;
      };
    };

    const builtIns = body.data?.templates.filter((t) => !t.isCustom) ?? [];
    expect(builtIns.length).toBeGreaterThan(0);

    for (const t of builtIns) {
      // Built-ins defer to the registry agent default — no explicit model on the template.
      expect(t.defaultModel).toBeUndefined();
      expect(t.defaultProvider).toBeUndefined();
    }
  });
});
