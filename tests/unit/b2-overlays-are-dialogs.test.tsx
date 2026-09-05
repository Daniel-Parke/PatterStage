/** @jest-environment jsdom */
/**
 * B2 (T-0096), D116: twelve overlays rendered `fixed inset-0` without the
 * dialog contract Modal and Sheet share (role, aria-modal, Escape, a Tab trap,
 * focus restored to the trigger, body scroll lock). A keyboard user opened
 * the Story Bible and could not close it; a screen reader announced a plain
 * div. Every overlay now calls useDialogA11y, and a file-level design-lint rule
 * refuses the next one that does not.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { RULES, scanTree, violationsIn } from "../../scripts/tooling/design-lint.mjs";
import ContinueStoryModal from "@/modules/rec-room/components/ContinueStoryModal";
import EditChapterModal from "@/modules/rec-room/components/EditChapterModal";
import StoryBiblePanel from "@/modules/rec-room/components/StoryBiblePanel";
import MobileChapterDrawer from "@/modules/rec-room/components/MobileChapterDrawer";
import ReaderSettings, { DEFAULT_SETTINGS } from "@/modules/rec-room/components/ReaderSettings";
import FallbackUrlEditModal from "@/components/models/FallbackUrlEditModal";

const escape = () => fireEvent.keyDown(document, { key: "Escape" });

describe("the rule", () => {
  it("is registered", () => {
    expect(RULES.some((r: { id: string }) => r.id === "overlay-uses-dialog-a11y")).toBe(true);
  });

  it("flags a file that paints an overlay without the contract, at the overlay's line", () => {
    const hits = violationsIn("src/components/Bespoke.tsx", [
      'export default function Bespoke({ onClose }) {',
      '  return <div className="fixed inset-0 z-50" onClick={onClose}><div>hi</div></div>;',
      "}",
    ]);
    expect(hits.get("overlay-uses-dialog-a11y::src/components/Bespoke.tsx")?.[0].line).toBe(2);
  });

  it("is satisfied by a file that calls useDialogA11y", () => {
    const hits = violationsIn("src/components/Proper.tsx", [
      'import { useDialogA11y } from "@/hooks/useDialogA11y";',
      "export default function Proper({ open, onClose }) {",
      "  const ref = useDialogA11y({ open, onClose });",
      '  return <div className="fixed inset-0 z-50"><div ref={ref} role="dialog" /></div>;',
      "}",
    ]);
    expect(hits.has("overlay-uses-dialog-a11y::src/components/Proper.tsx")).toBe(false);
  });

  it("the tree has no bespoke overlay left", () => {
    const { counts } = scanTree();
    expect(Object.keys(counts).filter((k) => k.startsWith("overlay-uses-dialog-a11y::"))).toEqual([]);
  });
});

describe("the converted overlays", () => {
  it("ContinueStoryModal is a dialog that Escape closes", () => {
    const onCancel = jest.fn();
    render(
      <ContinueStoryModal
        direction=""
        onDirectionChange={() => {}}
        count={2}
        onCountChange={() => {}}
        wordCount="standard"
        onWordCountChange={() => {}}
        onCancel={onCancel}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: /continue story/i })).toHaveAttribute("aria-modal", "true");
    escape();
    expect(onCancel).toHaveBeenCalled();
  });

  it("EditChapterModal is a dialog that Escape closes", () => {
    const onCancel = jest.fn();
    render(
      <EditChapterModal
        chapterNumber={3}
        prompt=""
        onPromptChange={() => {}}
        wordCount="standard"
        onWordCountChange={() => {}}
        count={2}
        onCountChange={() => {}}
        onCancel={onCancel}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: /edit chapter 3/i })).toBeInTheDocument();
    escape();
    expect(onCancel).toHaveBeenCalled();
  });

  it("StoryBiblePanel is a dialog that Escape closes", () => {
    const onClose = jest.fn();
    render(<StoryBiblePanel storyArc={null} open onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: /story bible/i })).toBeInTheDocument();
    escape();
    expect(onClose).toHaveBeenCalled();
  });

  it("MobileChapterDrawer is a dialog that Escape closes", () => {
    const onClose = jest.fn();
    render(
      <MobileChapterDrawer
        chapters={[]}
        currentChapter={1}
        theme={{ bg: "", text: "", panel: "", accent: "", rule: "" }}
        onClose={onClose}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: /chapter/i })).toBeInTheDocument();
    escape();
    expect(onClose).toHaveBeenCalled();
  });

  it("ReaderSettings opens a dialog that Escape closes", () => {
    render(<ReaderSettings settings={DEFAULT_SETTINGS} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /reading settings/i }));
    expect(screen.getByRole("dialog", { name: /reading settings/i })).toBeInTheDocument();
    escape();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("FallbackUrlEditModal keeps its role and gains Escape", () => {
    const onClose = jest.fn();
    render(
      <FallbackUrlEditModal
        entry={{ id: "f1", modelName: "gpt-4o" } as never}
        url=""
        saving={false}
        onUrlChange={() => {}}
        onClose={onClose}
        onSave={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    escape();
    expect(onClose).toHaveBeenCalled();
  });
});
