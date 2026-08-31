/** @jest-environment jsdom */

// T-0082 — the banner is rendered, not grepped.
//
// Mutation found this, and it is the same shape T-0080 found one batch ago:
// the DECISION was tested (`drift-banner-headline`) and the component that
// draws it was tested by nobody. Replacing `{headline}` with the old hardcoded
// sentence changed no test result, so the fix could have been reverted in the
// one file that matters and every suite would have stayed green.

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = (name: string) => () => `[${name}]`;
  return new Proxy({}, { get: (_t, prop: string) => passthrough(prop) });
});

import ProfilesDriftBanner from "@/components/profiles/ProfilesDriftBanner";

const noop = () => undefined;

function renderBanner(driftCount: number, errorCount: number) {
  return render(
    <ProfilesDriftBanner
      driftCount={driftCount}
      errorCount={errorCount}
      onPushAll={noop}
      pushing={false}
    />,
  );
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

  it("still offers the action that fixes it", () => {
    renderBanner(0, 1);

    expect(screen.getByRole("button", { name: /push all/i })).toBeTruthy();
  });

  it("GREEN CONTROL: renders nothing at all when nothing is wrong", () => {
    const { container } = renderBanner(0, 0);

    expect(container.firstChild).toBeNull();
  });
});
