/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

// Jest hoists mock factories above imports.
jest.mock("lucide-react", () => require("../helpers/story").lucideNullMock());

import ReaderHeader, { type ReaderHeaderProps } from "@/modules/rec-room/components/ReaderHeader";
import { ReaderErrorBanner } from "@/modules/rec-room/components/ReaderBanners";
import { DEFAULT_SETTINGS } from "@/modules/rec-room/components/ReaderSettings";

it("keeps a save failure and dismiss control inside the reader header beside usable chapter controls", () => {
  const onDismiss = jest.fn();
  const noop = () => {};
  const props: ReaderHeaderProps = {
    title: "A Story",
    chapters: [],
    currentChapter: 1,
    allComplete: false,
    anyFailed: false,
    sidebarOpen: false,
    settings: DEFAULT_SETTINGS,
    onSettingsChange: noop,
    onBack: noop,
    onContinue: noop,
    onRetryFailed: noop,
    writing: false,
    generating: false,
    pendingCount: 0,
    nextPending: null,
    onWriteNext: noop,
    onKeepWriting: noop,
    onStop: noop,
    onOpenBible: noop,
    onToggleSidebar: noop,
    onSelectChapter: noop,
    spend: null,
    errorBanner: <ReaderErrorBanner error="Save unavailable" autoPaused={false} maxAutoFailures={3} onDismiss={onDismiss} />,
  };

  render(<ReaderHeader {...props} />);
  const alert = screen.queryByRole("alert");
  expect(alert).not.toBeNull();
  const chapters = screen.getByTitle("Show chapters");
  expect(alert).toHaveTextContent("Save unavailable");
  expect(alert!.closest(".sticky")).toContainElement(chapters);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
