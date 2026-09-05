/** @jest-environment jsdom */
/**
 * B2 (T-0096), D66 and D51: one confirm primitive.
 *
 * D66 (blocker). The mission panel's Cancel button armed on the first click and
 * disabled itself on the same predicate, so the confirming second click could
 * never land; after four seconds it re-enabled as "Cancel" and the loop began
 * again. A running mission could not be cancelled from the board at all.
 *
 * D51. Five sites still used the native window.confirm, against the product's
 * own two-step pattern and inside a dark-themed modal.
 *
 * ConfirmButton is the two-step pattern as a component: it arms, it is never
 * disabled BY being armed, it fires on the second click, it disarms on its own.
 * A design-lint rule keeps window.confirm out.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RULES, scanTree, violationsIn } from "../../scripts/tooling/design-lint.mjs";
import ConfirmButton from "@/components/ui/ConfirmButton";
import MissionEditorPanel from "@/components/missions/MissionEditorPanel";
import type { MissionDetail, MissionRow } from "@/hooks/missions-page-types";

jest.mock("@/components/missions/MissionLiveProgress", () => ({ __esModule: true, default: () => null }));

const ROOT = join(__dirname, "..", "..");

describe("ConfirmButton", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("arms on the first click and fires only on the second", () => {
    const onConfirm = jest.fn();
    render(<ConfirmButton onConfirm={onConfirm}>Delete</ConfirmButton>);
    const button = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /confirm\?/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirm\?/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("is never disabled by being armed", () => {
    render(<ConfirmButton onConfirm={() => {}}>Cancel</ConfirmButton>);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /confirm\?/i })).not.toBeDisabled();
  });

  it("disarms on its own after the auto-dismiss window", () => {
    render(<ConfirmButton onConfirm={() => {}} autoDismissMs={4000}>Remove</ConfirmButton>);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    act(() => {
      jest.advanceTimersByTime(4100);
    });
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm\?/i })).toBeNull();
  });

  it("honours loading and an external disabled, which are the only things that disable it", () => {
    const { rerender } = render(<ConfirmButton onConfirm={() => {}} loading>Delete</ConfirmButton>);
    expect(screen.getByRole("button")).toBeDisabled();
    rerender(<ConfirmButton onConfirm={() => {}} disabled>Delete</ConfirmButton>);
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("button", { name: /confirm\?/i })).toBeNull();
  });

  it("names the armed state for assistive tech", () => {
    render(<ConfirmButton onConfirm={() => {}}>Delete</ConfirmButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("data-armed", "true");
  });
});

describe("D66: the mission panel's Cancel can be confirmed", () => {
  function row(over: Partial<MissionRow> = {}): MissionRow {
    return {
      id: "m1",
      name: "Nightly triage",
      prompt: "Triage the queue",
      status: "dispatched",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      updatedAt: new Date(Date.now() - 12_000).toISOString(),
      ...over,
    } as MissionRow;
  }
  const detailFor = (m: MissionRow): MissionDetail => ({ mission: m, run: null, schedule: null });

  it("arms on the first click, stays enabled, and cancels on the second", () => {
    const onCancel = jest.fn();
    const m = row();
    render(
      <MissionEditorPanel
        detail={detailFor(m)}
        detailLoading={false}
        mission={m}
        promptCollapsed
        onPromptCollapsedChange={() => {}}
        onEdit={() => {}}
        onCancel={onCancel}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const armed = screen.getByRole("button", { name: /confirm\?/i });
    expect(armed).not.toBeDisabled();
    fireEvent.click(armed);
    expect(onCancel).toHaveBeenCalledWith("m1");
  });
});

describe("the native confirm is gone", () => {
  it("design-lint carries a no-native-confirm rule", () => {
    expect(RULES.some((r: { id: string }) => r.id === "no-native-confirm")).toBe(true);
  });

  it("the rule sees window.confirm and a bare confirm( and not the hook's .confirm(", () => {
    const hits = violationsIn("src/app/x/page.tsx", [
      'if (!window.confirm("Delete?")) return;',
      'if (!confirm("Delete this story?")) return;',
      "void deleteConfirm.confirm(() => onDelete(id));",
      "const { confirm } = useTwoStepConfirm();",
    ]);
    const lines = hits.get("no-native-confirm::src/app/x/page.tsx")?.map((h) => h.line) ?? [];
    expect(lines).toEqual([1, 2]);
  });

  it("no source file still calls it", () => {
    const { counts } = scanTree();
    expect(Object.keys(counts).filter((k) => k.startsWith("no-native-confirm::"))).toEqual([]);
  });

  it("the five sites use the primitive", () => {
    for (const f of [
      "src/app/recroom/story-weaver/page.tsx",
      "src/app/recroom/story-weaver/library/page.tsx",
      "src/app/work/scripts/page.tsx",
      "src/components/composer/WorkflowCanvas.tsx",
    ]) {
      const src = readFileSync(join(ROOT, f), "utf-8");
      expect({ f, native: /(?<![\w.$])(?:window\.)?confirm\(/.test(src) }).toEqual({ f, native: false });
    }
  });
});
