/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

jest.mock("@/lib/api-auth", () => ({ requireAuth: jest.fn(() => null) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

const mockListModels = jest.fn();
const mockUpdateModel = jest.fn();

jest.mock("@/lib/models-repository", () => ({
  listModels: () => mockListModels(),
  updateModel: (...args: unknown[]) => mockUpdateModel(...args),
}));

const mockReadHermesConfigModels = jest.fn();

jest.mock("@/modules/hermes/lib/hermes-config-read", () => ({
  readHermesConfigModels: () => mockReadHermesConfigModels(),
}));

describe("POST /api/models/sync/pull — contextLength", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListModels.mockReturnValue([
      {
        id: "reg-1",
        name: "Agent",
        modelId: "anthropic/claude-sonnet-4",
        provider: "anthropic",
        baseUrl: null,
        contextLength: 128000,
      },
    ]);
    mockReadHermesConfigModels.mockReturnValue(
      new Map([
        [
          "anthropic::anthropic/claude-sonnet-4",
          {
            modelId: "anthropic/claude-sonnet-4",
            provider: "anthropic",
            baseUrl: null,
            contextLength: 200000,
          },
        ],
      ]),
    );
  });

  it("updates contextLength when config.yaml differs", async () => {
    const { POST } = require("@/app/api/models/sync/pull/route") as {
      POST: (req: { json(): Promise<{ modelId: string }> }) => Promise<{
        json(): Promise<{ data: { diffs: Array<{ field: string }> } }>;
      }>;
    };

    const res = await POST({
      json: async () => ({ modelId: "reg-1" }),
    });
    const body = await res.json();

    expect(body.data.diffs.some((d) => d.field === "contextLength")).toBe(true);
    expect(mockUpdateModel).toHaveBeenCalledWith(
      "reg-1",
      expect.objectContaining({ contextLength: 200000 }),
    );
  });
});
