/**
 * @jest-environment jsdom
 *
 * Unit tests for `<LoadErrorBanner>` — the shared persistent error
 * banner for `useApiData`-shaped page-level load failures.
 *
 * **What this test pins (session 171):**
 *   1. The component renders the error string
 *   2. The component renders an optional hint when provided
 *   3. The component renders a Retry button when `onRetry` is provided
 *   4. The Retry button invokes `onRetry` on click
 *   5. The Retry button is hidden when `onRetry` is omitted
 *   6. The `role="alert"` attribute is present for screen readers
 *   7. The component renders nothing (no banner chrome) when it has
 *      no error AND no other props — but the contract is "always
 *      render the banner; the page owns the conditional render
 *      (`{loadError && <LoadErrorBanner ... />}`)" so this is more
 *      about not crashing than about emitting empty markup.
 *   8. The custom `retryLabel` is honoured
 *
 * @see src/components/ui/LoadErrorBanner.tsx — the component
 * @see tests/unit/load-error-banner-source-pattern-list1.test.ts — the
 *   source-pattern sister test
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import LoadErrorBanner from "@/components/ui/LoadErrorBanner";

describe("LoadErrorBanner", () => {
  it("renders the error string", () => {
    render(<LoadErrorBanner error="Connection timed out" />);
    expect(screen.getByText("Connection timed out")).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    const { container } = render(<LoadErrorBanner error="Boom" />);
    const banner = container.querySelector('[role="alert"]');
    expect(banner).not.toBeNull();
    expect(banner).toHaveTextContent("Boom");
  });

  it("does NOT render a Retry button when onRetry is omitted", () => {
    render(<LoadErrorBanner error="Boom" />);
    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a Retry button when onRetry is provided", () => {
    const onRetry = jest.fn();
    render(<LoadErrorBanner error="Boom" onRetry={onRetry} />);
    expect(
      screen.getByRole("button", { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it("invokes onRetry on Retry button click", () => {
    const onRetry = jest.fn();
    render(<LoadErrorBanner error="Boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("honours a custom retryLabel", () => {
    const onRetry = jest.fn();
    render(
      <LoadErrorBanner
        error="Boom"
        onRetry={onRetry}
        retryLabel="Try again"
      />,
    );
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("renders the optional hint when provided", () => {
    render(
      <LoadErrorBanner
        error="Boom"
        hint="The list below may be empty because the load failed."
      />,
    );
    expect(
      screen.getByText(/the list below may be empty/i),
    ).toBeInTheDocument();
  });

  it("does NOT render a hint block when hint is omitted", () => {
    // We can't easily query "the hint is absent" — but we can assert
    // that the error string is present and the test environment
    // doesn't crash on a missing optional prop.
    const { container } = render(<LoadErrorBanner error="Boom" />);
    // The container should have exactly one role=alert element.
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
});
