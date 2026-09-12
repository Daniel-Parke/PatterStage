/** @jest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import ModelPicker from "@/components/missions/ModelPicker";

describe("ModelPicker defaults", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("pre-selects defaults.agent registry row when slot is set", async () => {
    const onChange = jest.fn();
    global.fetch = jest.fn((url: string | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/models/defaults")) {
        // The on-the-wire envelope is `{ data: { defaults: ... } }`,
        // which is exactly what `safeApiCall<T>` returns in `result.data`.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { defaults: { agent: "reg-2" } } }),
        } as Response);
      }
      if (u.includes("/api/models")) {
        return Promise.resolve({
          ok: true,
          // See above — wire envelope shape.
          json: () =>
            Promise.resolve({
              data: {
                models: [
                  { id: "reg-1", name: "Older", provider: "p1", modelId: "m1" },
                  { id: "reg-2", name: "AgentDefault", provider: "p2", modelId: "m2" },
                ],
              },
            }),
        } as Response);
      }
      return Promise.reject(new Error("unexpected fetch: " + u));
    }) as jest.Mock;

    renderWithQuery(<ModelPicker modelId="" provider="" onChange={onChange} id="t-model-picker" />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("m2", "p2");
    });
  });

  it("pre-selects first listed model when defaults.agent is null", async () => {
    const onChange = jest.fn();
    global.fetch = jest.fn((url: string | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/models/defaults")) {
        // See above — wire envelope shape.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { defaults: { agent: null } } }),
        } as Response);
      }
      if (u.includes("/api/models")) {
        return Promise.resolve({
          ok: true,
          // See above — wire envelope shape.
          json: () =>
            Promise.resolve({
              data: {
                models: [
                  { id: "reg-newest", name: "Newest", provider: "pv", modelId: "mv" },
                  { id: "reg-old", name: "Old", provider: "p1", modelId: "m1" },
                ],
              },
            }),
        } as Response);
      }
      return Promise.reject(new Error("unexpected fetch: " + u));
    }) as jest.Mock;

    renderWithQuery(<ModelPicker modelId="" provider="" onChange={onChange} id="t-model-picker-2" />);

    // ModelPicker uses safeApiCall which returns { ok, data } where data is the full envelope; auto-fill reads result.data?.data?.models[0].
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("mv", "pv");
    });
  });

  it("tooltip helper mode omits paragraph under empty registry", async () => {
    global.fetch = jest.fn((url: string | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/models/defaults")) {
        // See above — wire envelope shape.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { defaults: { agent: null } } }),
        } as Response);
      }
      if (u.includes("/api/models")) {
        return Promise.resolve({
          ok: true,
          // See above — wire envelope shape.
          json: () => Promise.resolve({ data: { models: [] } }),
        } as Response);
      }
      return Promise.reject(new Error("unexpected fetch: " + u));
    }) as jest.Mock;

    const { container } = renderWithQuery(
      <ModelPicker
        modelId=""
        provider=""
        onChange={() => {}}
        id="t-model-picker-tooltip"
        helperPlacement="tooltip"
      />,
    );

    const selId = "#t-model-picker-tooltip";
    await waitFor(() => {
      const s = container.querySelector(selId) as HTMLSelectElement | null;
      expect(s?.disabled).toBe(true);
      expect(s?.querySelector("option")?.textContent).toMatch(/No models registered/);
    });
    expect(container.querySelectorAll("p").length).toBe(0);
    await waitFor(() => {
      const s = container.querySelector(selId) as HTMLSelectElement;
      expect(s.title.length).toBeGreaterThan(20);
      expect(s.title).toContain("Configure models");
    });
  });

  it("shows empty registry copy when zero models", async () => {
    global.fetch = jest.fn((url: string | Request) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/models/defaults")) {
        // See above — wire envelope shape.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { defaults: { agent: null } } }),
        } as Response);
      }
      if (u.includes("/api/models")) {
        return Promise.resolve({
          ok: true,
          // See above — wire envelope shape.
          json: () => Promise.resolve({ data: { models: [] } }),
        } as Response);
      }
      return Promise.reject(new Error("unexpected fetch: " + u));
    }) as jest.Mock;

    const { getByText } = renderWithQuery(
      <ModelPicker modelId="" provider="" onChange={() => {}} id="t-model-picker-3" />,
    );

    await waitFor(() => {
      expect(getByText(/No models registered/)).toBeInTheDocument();
    });
  });

});
