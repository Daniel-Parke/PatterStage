/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U17 · A banner's sentence comes first; its action wraps under it.
 *
 * Three banners put a button on the same row as the sentence the banner is
 * for, with the sentence marked to shrink and the button marked not to. On a
 * phone the button won: "Profile drift — database and Hermes disk differ" in
 * a 150px column beside "Push all to Hermes" on /agent/profiles; the memory
 * health banner's sentence beside Retry on /agent/memory; two "Pull from
 * Hermes" beside two one-line reasons on /agent/models (the UI review of
 * 2026-09-08, P1).
 *
 * Below sm the action takes its own row under the sentence; from sm up it
 * sits beside it as before. The compact LoadErrorBanner lives in a list
 * column that is narrow at every width, so its Retry always wraps under.
 */

import { render, screen, within } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/agents/AgentPerformanceStrip", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/help/ConceptHint", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import AgentProfilesOverview from "@/components/agents/AgentProfilesOverview";
import ModelsDriftBanner from "@/components/models/ModelsDriftBanner";
import MessageBubble from "@/components/chat/MessageBubble";
import type { SyncDrift } from "@/components/models/types";
import type { ChatMessage } from "@/types/chat";
import type { AgentProfile } from "@/types/console";

const drift: SyncDrift = {
  hasDrift: true,
  driftDetails: [],
  lines: [
    {
      kind: "primary",
      text: "Hermes runs anthropic/claude-x; the agent default is openai/gpt-y",
      provider: "anthropic",
      modelId: "claude-x",
      registryId: null,
    },
    {
      kind: "db-only",
      text: "PatterStage has openai/gpt-y; Hermes does not",
      provider: "openai",
      modelId: "gpt-y",
      registryId: "m2",
    },
  ],
} as SyncDrift;

describe("U17 · banners wrap their action", () => {
  it("LoadErrorBanner: Retry wraps under the sentence below sm", () => {
    render(<LoadErrorBanner error="No memory provider is answering at the configured host and port." onRetry={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("flex-wrap");
    const retry = screen.getByRole("button", { name: /retry/i });
    expect(retry).toHaveClass("basis-full");
    expect(retry).toHaveClass("sm:basis-auto");
  });

  it("LoadErrorBanner compact: Retry always wraps under, because the column is always narrow", () => {
    render(<LoadErrorBanner compact error="Conversation unavailable (500)" onRetry={() => {}} />);
    const retry = screen.getByRole("button", { name: /retry/i });
    expect(retry).toHaveClass("basis-full");
    expect(retry).not.toHaveClass("sm:basis-auto");
  });

  it("ProfilesDriftBanner: the sentences have the whole width, because the action moved to the bar", () => {
    // Its Push all wrapped under the sentences below sm in U17; U18 (T-0132)
    // took the button out altogether, the bar under the banner being the one
    // Push all (u18-one-push-all). What is left to hold is that the words
    // are not sharing their row with anything.
    // The banner is a local of AgentProfilesOverview since C6 (T-0143), so it
    // is rendered through the overview and its bar's buttons sit OUTSIDE it.
    const drifted = [
      { id: "p1", name: "Bob", syncStatus: "drift" },
      { id: "p2", name: "QA", syncStatus: "drift" },
    ] as unknown as AgentProfile[];
    render(
      <AgentProfilesOverview
        profiles={drifted}
        syncBusy={false}
        onPushAll={() => {}}
        onPullAll={() => {}}
        onImportDiscovered={() => {}}
      />,
    );
    const words = screen.getByText(/2 profiles drifted/).parentElement!;
    expect(words).toHaveClass("flex-1");
    expect(within(words.parentElement!).queryByRole("button")).toBeNull();
  });

  it("ModelsDriftBanner: every line's controls wrap under its sentence below sm", () => {
    render(<ModelsDriftBanner drift={drift} agentDefaultId="m2" onPull={() => {}} onPush={() => {}} busyLine={null} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveClass("flex-wrap");
    }
    const pull = screen.getByRole("button", { name: /Pull from Hermes for anthropic\/claude-x/ });
    expect(pull.parentElement).toHaveClass("basis-full");
    expect(pull.parentElement).toHaveClass("sm:basis-auto");
    const push = screen.getByRole("button", { name: /Push to Hermes for openai\/gpt-y/ });
    expect(push.parentElement).toHaveClass("basis-full");
  });

  // Sharpened after the walk: the chat's failed-run bubble is a banner too,
  // and at 390 it gave its reason 35% of a 250px bubble, one word per line.
  it("a failed run's Retry wraps under the reason, and the bubble is wider on a phone", () => {
    const msg = {
      id: "m1",
      role: "assistant",
      content: "",
      status: "failed",
      error: "POST /v1/runs → 500 Internal Server Error",
      createdAt: "2026-06-01T09:30:00Z",
    } as unknown as ChatMessage;
    render(<MessageBubble msg={msg} onRetry={() => {}} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("flex-wrap");
    const retry = screen.getByRole("button", { name: /retry/i });
    expect(retry).toHaveClass("basis-full");
    expect(retry).toHaveClass("sm:basis-auto");
    const bubble = alert.parentElement!;
    expect(bubble).toHaveClass("max-w-[85%]");
    expect(bubble).toHaveClass("sm:max-w-[70%]");
    expect(bubble).not.toHaveClass("max-w-[70%]");
  });
});
