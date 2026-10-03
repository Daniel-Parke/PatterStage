import { dbSingletonMock, openBaselineDb } from "./baseline-db";

let mockDb: ReturnType<typeof openBaselineDb> | null = null;
// Boundary doubles prevent token, database, scheduler and provider side effects.
// Flag and gateway readers, diagnostics and register() remain real.
jest.mock("@/lib/host/paths", () => ({
  PS_DATA_DIR: "/owned/data", getDbPath: () => "/owned/data/test.db", shadowedDataWarning: () => null,
  readEnv: jest.requireActual<typeof import("@/lib/host/paths")>("@/lib/host/paths").readEnv,
}));
jest.mock("@/lib/api/api-auth", () => ({ isDeployApiEnabled: () => false, isReadOnly: () => false }));
jest.mock("@/lib/api/read-only", () => ({ isReadOnly: () => false }));
jest.mock("@/lib/api/auth-token", () => ({ getAuthMode: () => "token", ensureAuthToken: jest.fn(), describeTokenSource: () => ({ kind: "env" }) }));
jest.mock("@/lib/auth/boot-state", () => ({ initialiseBootState: jest.fn() }));
jest.mock("@/modules/hermes/lib/home", () => ({ selectedLegacyHermesHomeName: () => null, getHermesHome: () => "/owned/hermes" }));
jest.mock("@/lib/update-handlers/shared", () => ({ runGit: () => "owned-commit" }));
jest.mock("@/lib/db", () => dbSingletonMock(() => mockDb));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/orchestration", () => ({ ensureBackgroundScheduler: jest.fn() }));
jest.mock("@/lib/seed/catalog-seed", () => ({ ensureCatalogSeededOnce: jest.fn() }));
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({ failStuckResearchRuns: jest.fn(() => 1) }));
jest.mock("@/lib/chat/chat-repository", () => ({ failStuckChatMessages: jest.fn(() => 1) }));

const savedEnvironment = { ...process.env };
beforeEach(() => {
  mockDb = openBaselineDb();
  for (const key of Object.keys(process.env)) {
    if (/^(PS_|CH_|CONTROL_HUB_|HERMES_)/.test(key)) delete process.env[key];
  }
  process.env.NEXT_RUNTIME = "nodejs";
  jest.clearAllMocks();
  for (const method of ["info", "warn", "error"] as const) jest.spyOn(console, method).mockImplementation(() => undefined);
});
afterEach(() => { mockDb?.close(); mockDb = null; process.env = { ...savedEnvironment }; jest.restoreAllMocks(); });

