/**
 * T-0113: three screens say the memory provider is set on the Memory page.
 *
 * It was not settable anywhere. The Memory card offered Host, Port, Bank, Test
 * connection and Save, and Save posted `type: current.type` -- the same provider
 * it had loaded. The config page marked `memory.provider` as managed elsewhere
 * and rendered it read-only under "Set this on the Memory page". A provider
 * message told the reader to "choose a different provider" there. So the product
 * pointed at a control that did not exist, from three directions.
 *
 * The capability was never missing, only the control: POST /api/memory/config
 * already accepts a `type`, calls updateMemoryProvider with it and writes it
 * through to the agent's config.yaml. So the honest fix is to offer the choice,
 * not to retreat the copy to match a gap.
 *
 * What these pin is the promise the rest of the product makes on this screen's
 * behalf: a provider can be picked here, and picking one is what gets sent.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
// Reads go through useApiResource since T-0129, so the component wants a QueryClient.
import { renderWithQuery } from "../helpers/render-with-query";
import React from "react";

import MemoryProviderSettings from "@/components/memory/MemoryProviderSettings";

const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];

let activeType = "hindsight";

jest.mock("@/lib/api/api-fetch", () => ({
  // The card LOADS its own row, so the GET has to answer with one or the
  // buttons stay disabled and every case below would pass vacuously.
  safeApiCall: jest.fn(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
    calls.push({ path, method: init?.method ?? "GET", body: init?.body ?? {} });
    if (path === "/api/memory/config" && (init?.method ?? "GET") === "GET") {
      return {
        ok: true,
        data: {
          data: {
            active: { type: activeType, config: { host: "127.0.0.1", port: 9177, bank: "hermes" } },
            providers: [
              { type: activeType, label: activeType, host: "127.0.0.1", port: 9177, bank: "hermes", isActive: true, enabled: true },
            ],
          },
        },
      };
    }
    return { ok: true, data: { data: { configYaml: { written: true, error: null } } } };
  }),
  apiFetch: jest.fn(async () => ({ ok: true, data: {} })),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

beforeEach(() => {
  calls.length = 0;
  activeType = "hindsight";
});

/** Render the card and wait for the row it fetches, since Save waits for it. */
async function mount(type = "hindsight") {
  activeType = type;
  const r = renderWithQuery(<MemoryProviderSettings />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled());
  return r;
}

describe("the memory provider can be chosen on the page that claims to own it", () => {
  it("offers the providers the schema declares, not just the one already set", async () => {
    await mount();
    // The Field Kit select is a button that opens a listbox, so the options
    // only exist once it is opened. That is the control an operator uses.
    fireEvent.click(screen.getByRole("button", { name: /provider/i }));
    const listed = screen.getAllByRole("option").map((o) => o.textContent?.trim());
    // The config schema's own options for memory.provider. If one is added
    // there and not here, this screen stops being the place it is set.
    expect(listed).toEqual(expect.arrayContaining(["hindsight", "holographic"]));
  });

  it("shows the provider that is currently active", async () => {
    await mount("holographic");
    expect(screen.getByRole("button", { name: /provider/i }).textContent).toMatch(/holographic/i);
  });

  it("sends the chosen provider, not the one it loaded", async () => {
    // The defect exactly: Save posted `type: current.type`, so a choice could
    // never leave the screen even once a chooser existed.
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /provider/i }));
    fireEvent.click(screen.getByRole("option", { name: /holographic/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      const put = calls.find((c) => c.path === "/api/memory/config" && c.method === "PUT");
      expect(put).toBeDefined();
      expect(put!.body.type).toBe("holographic");
    });
  });

  it("makes the newly chosen provider the active one", async () => {
    // Switching backend and leaving the old row active would leave the product
    // reading one provider while the operator believes they picked another.
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /provider/i }));
    fireEvent.click(screen.getByRole("option", { name: /holographic/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      const put = calls.find((c) => c.path === "/api/memory/config" && c.method === "PUT");
      expect(put!.body.makeActive).toBe(true);
    });
  });

  it("GREEN CONTROL: saving without changing the provider still sends the current one", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      const put = calls.find((c) => c.path === "/api/memory/config" && c.method === "PUT");
      expect(put!.body.type).toBe("hindsight");
    });
  });
});
