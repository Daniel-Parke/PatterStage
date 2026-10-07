/** @jest-environment jsdom */

// T-0082 — the banner is rendered, not grepped.
//
// Mutation found this, and it is the same shape T-0080 found one batch ago:
// the DECISION was tested (`drift-banner-headline`) and the component that
// draws it was tested by nobody. Replacing `{headline}` with the old hardcoded
// sentence changed no test result, so the fix could have been reverted in the
// one file that matters and every suite would have stayed green.
//
// The banner is a local of AgentProfilesOverview since C6 (T-0143): it is
// rendered through the overview, from profiles whose syncStatus gives the
// counts the banner used to take as props.

import { render, screen, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = (name: string) => () => `[${name}]`;
  return new Proxy({}, { get: (_t, prop: string) => passthrough(prop) });
});
jest.mock("@/components/agents/AgentPerformanceStrip", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/help/ConceptHint", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import AgentProfilesOverview from "@/components/agents/AgentProfilesOverview";
import type { AgentProfile } from "@/types/console";

// No onPushAll and no pushing since U18 (T-0132): the bar under the banner
// owns the one Push all.
function renderBanner(driftCount: number, errorCount: number) {
  const profiles = [
    ...Array.from({ length: driftCount }, (_, i) => ({ id: `d${i}`, name: `Drifted ${i}`, syncStatus: "drift" })),
    ...Array.from({ length: errorCount }, (_, i) => ({ id: `e${i}`, name: `Errored ${i}`, syncStatus: "error" })),
  ] as unknown as AgentProfile[];
  return render(
    <AgentProfilesOverview
      profiles={profiles}
      syncBusy={false}
      onPushAll={() => {}}
      onPullAll={() => {}}
      onImportDiscovered={() => {}}
    />,
  );
}

/** The banner's own element: the headline's grandparent. */
function bannerOf(headline: HTMLElement): HTMLElement {
  return headline.parentElement!.parentElement!;
}

describe("the profiles banner says what is actually wrong", () => {
  it("headlines an ERROR when nothing has drifted", () => {
    // The reported shape: a push threw, nothing drifted, and the banner led
    // with "Profile drift — database and Hermes disk differ". The operator was
    // sent to reconcile a difference that did not exist.
    renderBanner(0, 2);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/sync error/i);
    expect(text).not.toMatch(/disk differ/i);
  });

  it("headlines DRIFT when that is what happened", () => {
    renderBanner(3, 0);

    expect(document.body.textContent).toMatch(/drift/i);
  });

  it("names both when both are true", () => {
    renderBanner(1, 1);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/drift/i);
    expect(text).toMatch(/error/i);
  });

  it("still lists the counts underneath, whatever the headline says", () => {
    // The detail line was already right. Fixing the headline must not cost it.
    renderBanner(2, 1);

    const text = document.body.textContent ?? "";
    expect(text).toContain("2 profiles drifted from database");
    expect(text).toContain("1 sync error");
  });

  it("still names the action that fixes it, which lives in the bar below", () => {
    renderBanner(0, 1);

    // The banner carried its own Push all button until U18 (T-0132); the bar
    // under it has the one Push all now, and the sentence points at it.
    const banner = bannerOf(screen.getByText(/1 sync error/));
    expect(within(banner).queryByRole("button")).toBeNull();
    expect(within(banner).getByText(/Push all/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /push all/i })).toHaveLength(1);
  });

  it("GREEN CONTROL: renders nothing at all when nothing is wrong", () => {
    renderBanner(0, 0);

    // The overview still stands (its note and its bar); the banner does not.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/drifted from database|sync error/i);
    expect(screen.queryByText(/Push all, below/)).toBeNull();
  });
});
