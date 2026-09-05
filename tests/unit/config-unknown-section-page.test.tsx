/**
 * @jest-environment jsdom
 */

// ═══════════════════════════════════════════════════════════════
// T-0038 acceptance oracle (part 2 of 2): the recovery page
//
// Frozen before the implementation existed. The resolver half of the
// oracle lives in tests/unit/config-section-redirect.test.ts.
//
// An operator who types a config URL by hand and gets it slightly wrong
// currently sees the slug echoed back and a single Back link, which sends
// them to the index to start over. This file pins the two things that
// change that: the page lists every section it could have meant, and a
// near miss is redirected to the section it obviously meant.
//
// The two guards that must NOT change are pinned here too, because they
// are the ways this feature can do harm: a redirect must never fire for a
// slug that is valid, and a redirect target must never redirect again.
// ═══════════════════════════════════════════════════════════════

import { act, render, screen, waitFor } from "@testing-library/react";
import { CONFIG_SECTIONS } from "@/lib/config-schema";

const mockUseParams = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  usePathname: () => "/agent/settings",
  useSearchParams: () => new URLSearchParams(),
  notFound: jest.fn(),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  setErrorFromCaught: jest.fn(),
}));

import ConfigSectionPage from "@/app/agent/settings/[section]/page";

const IDS = Object.keys(CONFIG_SECTIONS);

beforeEach(() => {
  mockUseParams.mockReset();
  mockReplace.mockReset();
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({ data: {} });
});

function renderAt(slug: string) {
  mockUseParams.mockReturnValue({ section: slug });
  return render(<ConfigSectionPage />);
}

/**
 * Render a VALID section and let its config load settle. A valid section
 * always fetches, so the settled state is the one where a stray redirect
 * would already have fired.
 */
async function renderLoadedSection(slug: string) {
  const view = renderAt(slug);
  await act(async () => {});
  expect(mockApiFetch).toHaveBeenCalled();
  return view;
}

/** Every anchor on the page that points at a section route. */
const sectionLinks = (): string[] =>
  Array.from(document.querySelectorAll('a[href^="/agent/settings/"]')).map(
    (a) => a.getAttribute("href") ?? "",
  );

describe("Unknown config section: INV-7 the page lists what the operator could have meant", () => {
  it("renders a link to every section in CONFIG_SECTIONS", async () => {
    renderAt("totally-unknown-section");
    await screen.findByText(/Unknown Config Section/i);

    const hrefs = new Set(sectionLinks());
    const missing = IDS.filter((id) => !hrefs.has(`/agent/settings/${id}`));
    expect(missing).toEqual([]);
  });

  it("renders exactly as many section links as there are sections, count derived not written down", async () => {
    renderAt("totally-unknown-section");
    await screen.findByText(/Unknown Config Section/i);

    expect(new Set(sectionLinks()).size).toBe(IDS.length);
  });

  it("labels each link with that section's own label", async () => {
    renderAt("totally-unknown-section");
    await screen.findByText(/Unknown Config Section/i);

    const missing = IDS.map((id) => CONFIG_SECTIONS[id].label).filter(
      (label) => screen.queryAllByText(label).length === 0,
    );
    expect(missing).toEqual([]);
  });

  it("still shows the operator which slug failed", async () => {
    renderAt("totally-unknown-section");
    await screen.findByText(/Unknown Config Section/i);

    expect(screen.getByText(/totally-unknown-section/)).toBeInTheDocument();
  });

  it("still offers the way back to the config index", async () => {
    renderAt("totally-unknown-section");
    await screen.findByText(/Unknown Config Section/i);

    expect(document.querySelector('a[href="/agent/settings"]')).not.toBeNull();
  });
});

describe("Unknown config section: the nearest match redirects", () => {
  it("sends the reported guess agent-settings to /config/agent", async () => {
    renderAt("agent-settings");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/agent/settings/agent"));
  });

  it.each([
    ["session-reset", "/agent/settings/session_reset"],
    ["platform-toolsets", "/agent/settings/platform_toolsets"],
    ["code-execution", "/agent/settings/code_execution"],
    ["smart-model-routing", "/agent/settings/smart_model_routing"],
    ["human-delay", "/agent/settings/human_delay"],
    ["hermes-md", "/agent/settings/hermes_md"],
  ])("sends the hyphenated id %s to %s", async (slug, target) => {
    renderAt(slug);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(target));
  });

  it("keeps the pre-existing alias working: model goes to the models page", async () => {
    renderAt("model");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/agent/models"));
  });

  it("shows a redirecting notice, not the full list, while the redirect is in flight", async () => {
    renderAt("agent-settings");

    expect(screen.getByText(/Redirecting/)).toBeInTheDocument();
    expect(sectionLinks()).toEqual([]);
  });
});

describe("Unknown config section: the guards that must not change", () => {
  it("never redirects a slug that IS a valid section", async () => {
    for (const id of IDS) {
      mockReplace.mockClear();
      mockApiFetch.mockClear();
      const view = await renderLoadedSection(id);
      expect({ id, replaced: mockReplace.mock.calls }).toEqual({ id, replaced: [] });
      view.unmount();
    }
  });

  it("does not loop: the target of a redirect stays put when rendered", async () => {
    renderAt("agent-settings");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/agent/settings/agent"));

    mockReplace.mockClear();
    mockApiFetch.mockClear();
    await renderLoadedSection("agent");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not redirect the alias target either, so model cannot bounce forever", async () => {
    // /config/models is its own static page, so this component never sees
    // "models" in production. If routing ever changed, it must still stop
    // here rather than hand the router the same path again.
    renderAt("models");
    await screen.findByText(/Unknown Config Section/i);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the list rather than guessing when the slug prefixes several sections", async () => {
    renderAt("s");
    await screen.findByText(/Unknown Config Section/i);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(new Set(sectionLinks()).size).toBe(IDS.length);
  });
});
