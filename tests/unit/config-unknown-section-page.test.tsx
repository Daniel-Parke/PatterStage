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
import { CONFIG_SECTIONS } from "@/lib/config/config-schema";

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
jest.mock("@/lib/api/api-fetch", () => ({
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
 * Render a VALID section id and let its effects settle.
 *
 * Amended 2026-09-10 (U11, T-0125). A valid id reaches this page only by a
 * client-side navigation now - the server answers the 27 URLs with a 307 to
 * the anchor before this page is involved - and the page sends it on to the
 * same anchor. There is no editor here to fetch for any more.
 */
async function renderLoadedSection(slug: string) {
  const view = renderAt(slug);
  await act(async () => {});
  return view;
}

/** Every anchor on the page that points at a section route. */
// Amended 2026-09-10 (U11, T-0125): a section is an anchor on the one Settings
// page, so the recovery list links to `/agent/settings#<id>`.
const sectionLinks = (): string[] =>
  Array.from(document.querySelectorAll('a[href^="/agent/settings#"]')).map(
    (a) => a.getAttribute("href") ?? "",
  );

describe("Unknown config section: INV-7 the page lists what the operator could have meant", () => {
  it("renders a link to every section in CONFIG_SECTIONS", async () => {
    renderAt("totally-unknown-section");
    await screen.findByText(/Unknown Config Section/i);

    const hrefs = new Set(sectionLinks());
    const missing = IDS.filter((id) => !hrefs.has(`/agent/settings#${id}`));
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
  it("sends the reported guess agent-settings to the agent section", async () => {
    renderAt("agent-settings");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/agent/settings#agent"));
  });

  it.each([
    ["session-reset", "/agent/settings#session_reset"],
    ["platform-toolsets", "/agent/settings#platform_toolsets"],
    ["code-execution", "/agent/settings#code_execution"],
    ["smart-model-routing", "/agent/settings#smart_model_routing"],
    ["human-delay", "/agent/settings#human_delay"],
    ["hermes-md", "/agent/settings#hermes_md"],
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
  // Amended 2026-09-10 (U11, T-0125). This asserted that a valid id was NOT
  // redirected, because the editor for it lived here and a redirect from a
  // page to itself is a loop. The editor lives on the Settings page now, so a
  // valid id is sent to its anchor there - which is a different page, and the
  // no-loop property is that every target leaves this route.
  it("sends a valid section id to its anchor on the Settings page, and never back here", async () => {
    for (const id of IDS) {
      mockReplace.mockClear();
      const view = await renderLoadedSection(id);
      expect({ id, replaced: mockReplace.mock.calls }).toEqual({ id, replaced: [[`/agent/settings#${id}`]] });
      view.unmount();
    }
  });

  it("does not loop: every redirect target leaves this route", async () => {
    renderAt("agent-settings");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/agent/settings#agent"));
    for (const [target] of mockReplace.mock.calls as string[][]) {
      expect(target.startsWith("/agent/settings/")).toBe(false);
    }
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
