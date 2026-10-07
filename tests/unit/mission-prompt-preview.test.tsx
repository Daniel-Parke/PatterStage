/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import MissionPromptPreview from "@/components/missions/MissionPromptPreview";

describe("MissionPromptPreview", () => {
  const baseProps = {
    instruction: "Do the refactor",
    context: "",
    goals: "",
    outputFormat: "",
    constraints: "",
    localDirs: [],
    references: [],
    skills: [],
    missionTimeMinutes: 15,
    timeoutMinutes: 10,
    toolsets: [],
  };

  it("defaults to human view without nested collapse", () => {
    render(<MissionPromptPreview {...baseProps} />);
    expect(screen.getByText("Human")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText(/## Instruction/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assembled agent prompt/i })).toBeNull();
  });

  it("switches to AI view when AI tab clicked", () => {
    render(<MissionPromptPreview {...baseProps} />);
    fireEvent.click(screen.getByText("AI"));
    expect(screen.getByText(/<hermes_mission>/)).toBeInTheDocument();
    expect(screen.getByText(/Copy agent prompt/)).toBeInTheDocument();
  });
});
