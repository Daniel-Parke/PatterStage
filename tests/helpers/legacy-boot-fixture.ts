// Shared isolation for the T-0187 boot oracles. Suite-specific mocks stay in each suite.
jest.mock("@/lib/auth/boot-state", () => ({ initialiseBootState: jest.fn() }));
jest.mock("@/lib/api/auth-token", () => ({
  getAuthMode: () => "token",
  ensureAuthToken: jest.fn(),
  describeTokenSource: () => ({ kind: "environment" }),
}));
jest.mock("@/lib/deploy/boot-diagnostics", () => ({ describeOperationalFlags: () => "oracle boot" }));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/orchestration", () => ({ ensureBackgroundScheduler: jest.fn() }));
jest.mock("@/lib/seed/catalog-seed", () => ({ ensureCatalogSeededOnce: jest.fn() }));
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({ failStuckResearchRuns: () => 0 }));
jest.mock("@/lib/chat/chat-repository", () => ({ failStuckChatMessages: () => 0 }));

export function resetLegacyBootEnvironment(
  savedEnvironment: NodeJS.ProcessEnv,
  clearedKeys: readonly string[],
  overrides: Partial<NodeJS.ProcessEnv> = {},
): void {
  jest.resetModules();
  process.env = { ...savedEnvironment, NEXT_RUNTIME: "nodejs", ...overrides };
  for (const key of clearedKeys) delete process.env[key];
}

export async function captureLegacyBoot<T>(
  savedEnvironment: NodeJS.ProcessEnv,
  clearedKeys: readonly string[],
  configure: () => void,
  readSelectedValue: () => Promise<T>,
  overrides: Partial<NodeJS.ProcessEnv> = {},
): Promise<{ result: T; warnings: string[] }> {
  resetLegacyBootEnvironment(savedEnvironment, clearedKeys, overrides);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    configure();
    const { register } = await import("@/instrumentation");
    await register();
    await register();
    const warnings = warn.mock.calls.map((call: unknown[]) => call.map(String).join(" "));
    return { result: await readSelectedValue(), warnings };
  } finally {
    warn.mockRestore();
    info.mockRestore();
    error.mockRestore();
    process.env = { ...savedEnvironment };
  }
}
