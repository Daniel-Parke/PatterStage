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

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import ProfilesDriftBanner from "@/components/profiles/ProfilesDriftBanner";
import ModelsDriftBanner from "@/components/models/ModelsDriftBanner";
import type { SyncDrift } from "@/components/models/types";

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

  it("ProfilesDriftBanner: Push all wraps under the two sentences below sm", () => {
    render(<ProfilesDriftBanner driftCount={2} errorCount={0} onPushAll={() => {}} pushing={false} />);
    const button = screen.getByRole("button", { name: "Push all to Hermes" });
    expect(button).toHaveClass("basis-full");
    expect(button).toHaveClass("sm:basis-auto");
    expect(button.parentElement).toHaveClass("flex-wrap");
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
});
