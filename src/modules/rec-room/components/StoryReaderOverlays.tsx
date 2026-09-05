// ── StoryReaderOverlays — everything the reader renders ON TOP of itself.
// Extracted verbatim from app/recroom/story-weaver/[id]/page.tsx: the
// dismissible error banner, the story bible panel, the generate overlay,
// the edit-chapter and continue-story modals, and the sticky
// generation-failed banner, in that DOM order.
//
// Story Weaver behaviour is out of scope for T-0011. Nothing here holds
// state: every value and every callback comes from the page, which is
// why the prop list is long. That is the cost of a presentation-only
// split and it is deliberate.

"use client";

import StoryBiblePanel from "@/modules/rec-room/components/StoryBiblePanel";
import GenerateOverlay from "@/modules/rec-room/components/GenerateOverlay";
import { ReaderErrorBanner, StoryFailureBanner } from "@/modules/rec-room/components/ReaderBanners";
import EditChapterModal from "@/modules/rec-room/components/EditChapterModal";
import ContinueStoryModal from "@/modules/rec-room/components/ContinueStoryModal";
import type { StoryState } from "@/modules/rec-room/components/story-reader-types";

export interface StoryReaderOverlaysProps {
  story: StoryState;
  error: string | null;
  autoPaused: boolean;
  maxAutoFailures: number;
  onDismissError: () => void;
  bibleOpen: boolean;
  onCloseBible: () => void;
  overlayVisible: boolean;
  overlayDone: boolean;
  onOverlayComplete: () => void;
  editModalOpen: boolean;
  editChapterNum: number;
  editPrompt: string;
  onEditPromptChange: (value: string) => void;
  editWordCount: string;
  onEditWordCountChange: (id: string) => void;
  editCount: number;
  onEditCountChange: (n: number) => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
  continueModalOpen: boolean;
  continueDirection: string;
  onContinueDirectionChange: (value: string) => void;
  continueCount: number;
  onContinueCountChange: (n: number) => void;
  continueWordCount: string;
  onContinueWordCountChange: (id: string) => void;
  onCancelContinue: () => void;
  onSubmitContinue: () => void;
  onRetryFromCreate: () => void;
}

export default function StoryReaderOverlays({
  story,
  error,
  autoPaused,
  maxAutoFailures,
  onDismissError,
  bibleOpen,
  onCloseBible,
  overlayVisible,
  overlayDone,
  onOverlayComplete,
  editModalOpen,
  editChapterNum,
  editPrompt,
  onEditPromptChange,
  editWordCount,
  onEditWordCountChange,
  editCount,
  onEditCountChange,
  onCancelEdit,
  onSubmitEdit,
  continueModalOpen,
  continueDirection,
  onContinueDirectionChange,
  continueCount,
  onContinueCountChange,
  continueWordCount,
  onContinueWordCountChange,
  onCancelContinue,
  onSubmitContinue,
  onRetryFromCreate,
}: StoryReaderOverlaysProps) {
  return (
    <>
      {/* Error banner — rendered above the overlay so it is always visible */}
      {error && (
        <ReaderErrorBanner
          error={error}
          autoPaused={autoPaused}
          maxAutoFailures={maxAutoFailures}
          onDismiss={onDismissError}
        />
      )}

      {/* Story Bible — read-only view of the predetermined arc */}
      <StoryBiblePanel
        storyArc={story.storyArc}
        rollingSummary={story.rollingSummary}
        open={bibleOpen}
        onClose={onCloseBible}
      />

      {/* Progress overlay for continue and edit */}
      <GenerateOverlay
        title={story?.title || "Story"}
        visible={overlayVisible}
        done={overlayDone}
        onComplete={onOverlayComplete}
      />

      {/* Edit Chapter Modal */}
      {editModalOpen && (
        <EditChapterModal
          chapterNumber={editChapterNum}
          prompt={editPrompt}
          onPromptChange={onEditPromptChange}
          wordCount={editWordCount}
          onWordCountChange={onEditWordCountChange}
          count={editCount}
          onCountChange={onEditCountChange}
          onCancel={onCancelEdit}
          onSubmit={onSubmitEdit}
        />
      )}

      {/* Continue Story Modal */}
      {continueModalOpen && (
        <ContinueStoryModal
          direction={continueDirection}
          onDirectionChange={onContinueDirectionChange}
          count={continueCount}
          onCountChange={onContinueCountChange}
          wordCount={continueWordCount}
          onWordCountChange={onContinueWordCountChange}
          onCancel={onCancelContinue}
          onSubmit={onSubmitContinue}
        />
      )}

      {/* Story generation error banner */}
      {story.status === "failed" && story.generationError && (
        <StoryFailureBanner
          generationError={story.generationError}
          onRetryFromCreate={onRetryFromCreate}
        />
      )}
    </>
  );
}
