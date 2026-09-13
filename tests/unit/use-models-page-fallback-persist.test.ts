/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "../helpers/render-with-query";

import { useModelsPage } from "@/hooks/useModelsPage";

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: jest.fn(), toastElement: null }),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.fetch = fetchMock as typeof fetch;

  fetchMock.mockImplementation((url: string) => {
    const path = typeof url === "string" ? url : "";
    if (path.includes("/api/models/fallbacks/config") && !path.includes("sync")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            config: {
              restorePrimaryOnFallback: true,
              fallbackNotification: false,
              apiMaxRetries: 5,
            },
          },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: { models: [], credentials: [], defaults: {} } }),
    });
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useModelsPage fallback config persist", () => {
  it("debounces PUT /api/models/fallbacks/config after edits", async () => {
    const { result } = renderHook(() => useModelsPage(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleFallbackConfigChange({
        restorePrimaryOnFallback: true,
        fallbackNotification: false,
        apiMaxRetries: 5,
      });
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/models/fallbacks/config",
      expect.objectContaining({ method: "PUT" }),
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/models/fallbacks/config",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"apiMaxRetries":5'),
        }),
      );
    });
  });
});
