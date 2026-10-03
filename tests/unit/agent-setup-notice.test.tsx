/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import AgentSetupNotice from "@/components/agents/AgentSetupNotice";

jest.mock("@/hooks/useApiResource", () => ({
  useApiResource: () => ({ data: { name: "Hermes", available: false } }),
}));

describe("T-0152 · the no-agent notice uses the page column", () => {
  it("does not add its own horizontal margin to the rendered card", () => {
    const { container } = render(<AgentSetupNotice what="Recording sessions" />);
    expect(screen.getByText("Hermes is not installed")).toBeVisible();
    expect(container.firstElementChild).not.toHaveClass("mx-6");
  });
});
