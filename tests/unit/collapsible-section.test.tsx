/** @jest-environment jsdom */

/**
 * Tests for CollapsibleSection component and related UI changes.
 */

import { render, screen, fireEvent } from "@testing-library/react";

// Mock the lucide-react icons to avoid icon rendering issues in jsdom
jest.mock("lucide-react", () => ({
  ChevronDown: () => "▼",
  ChevronUp: () => "▲",
}));

import CollapsibleSection from "@/components/ui/CollapsibleSection";

describe("CollapsibleSection", () => {
  const defaultProps = {
    title: "Test Section",
    children: <div data-testid="section-content">Content here</div>,
  };

  it("renders with title visible by default", () => {
    render(<CollapsibleSection {...defaultProps} />);
    expect(screen.getByRole("button")).toHaveTextContent("Test Section");
  });

  it("starts collapsed by default — content not visible", () => {
    render(<CollapsibleSection {...defaultProps} />);
    expect(screen.queryByTestId("section-content")).not.toBeInTheDocument();
  });

  it("expands content on click", () => {
    render(<CollapsibleSection {...defaultProps} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByTestId("section-content")).toBeInTheDocument();
    expect(screen.getByText("Content here")).toBeInTheDocument();
  });

  it("collapses content on second click", () => {
    render(<CollapsibleSection {...defaultProps} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByTestId("section-content")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByTestId("section-content")).not.toBeInTheDocument();
  });

  it("shows badge when provided", () => {
    render(
      <CollapsibleSection {...defaultProps} badge={5} />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not show badge when omitted", () => {
    render(<CollapsibleSection {...defaultProps} />);
    // Badge would be the only element with a numeric text content matching the count
    // Since no badge is provided, we verify the button text doesn't have a standalone badge number
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("Test Section▼");
  });

  it("starts expanded when defaultExpanded is true", () => {
    render(
      <CollapsibleSection {...defaultProps} defaultExpanded />,
    );
    expect(screen.getByTestId("section-content")).toBeInTheDocument();
  });

  it("shows description only when expanded", () => {
    render(
      <CollapsibleSection
        {...defaultProps}
        description="This is the description"
      />,
    );
    // Description should NOT be visible when collapsed
    expect(screen.queryByText("This is the description")).not.toBeInTheDocument();

    // Expand and check
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("This is the description")).toBeInTheDocument();
  });

  it("renders headerRight actions", () => {
    render(
      <CollapsibleSection
        {...defaultProps}
        headerRight={<button data-testid="extra-action">Extra</button>}
      />,
    );
    expect(screen.getByTestId("extra-action")).toBeInTheDocument();
    expect(screen.getByText("Extra")).toBeInTheDocument();
  });

  it("applies correct badge color class for purple", () => {
    const { container } = render(
      <CollapsibleSection {...defaultProps} badge={3} badgeColor="purple" />,
    );
    const badge = container.querySelector(
      ".bg-neon-purple\\/15",
    );
    expect(badge).toBeInTheDocument();
  });

  it("applies correct badge color class for orange", () => {
    const { container } = render(
      <CollapsibleSection {...defaultProps} badge={2} badgeColor="orange" />,
    );
    const badge = container.querySelector(
      ".bg-neon-orange\\/15",
    );
    expect(badge).toBeInTheDocument();
  });
});
