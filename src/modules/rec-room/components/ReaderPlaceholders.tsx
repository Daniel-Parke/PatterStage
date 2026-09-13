// ── ReaderPlaceholders — the reader's two pre-render states.
// The skeleton while the story loads, on the loading contract, and the
// not-found state with its way back (U12, T-0126).

"use client";

import { BookX, ChevronLeft } from "lucide-react";

import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import PageLoading from "@/components/ui/PageLoading";

export function ReaderLoading() {
  return (
    <div className="min-h-screen bg-ps-surface-ground p-6">
      <PageLoading label="Loading the story" rows={3} rowClassName="h-24" />
    </div>
  );
}

export function ReaderNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ps-surface-ground">
      <EmptyState
        icon={BookX}
        title="Story not found"
        description="It may have been deleted, or the address may be wrong."
        action={
          <Button color="purple" icon={ChevronLeft} onClick={onBack}>
            Back to Story Weaver
          </Button>
        }
      />
    </div>
  );
}
