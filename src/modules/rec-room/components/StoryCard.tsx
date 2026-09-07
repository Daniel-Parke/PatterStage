// StoryCard — one story on the shelf.
//
// The library's row and the hub's card were two drawings of one record. The
// hub is gone (decision 6, T-0126) and this is the row: the title is the link
// to the reader, the status is the one vocabulary's word in its rung, and the
// bin asks twice. It keeps the props both callers had, so the vocabulary
// suite that renders it three times is untouched.
"use client";

import Link from "next/link";
import { BookOpen, Clock, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { statusTone } from "@/lib/status-labels";
import { statusToneClasses } from "@/lib/theme";
import { timeAgo } from "@/lib/utils";
import { storyStatusLabel } from "@/modules/rec-room/lib/story-status-labels";

interface StoryCardProps {
  story: {
    id: string; title: string; premise?: string; status?: string;
    chapters?: { number: number; title: string; status: string; wordCount?: number }[];
    config?: { genre?: string }; createdAt?: string; updatedAt?: string;
  };
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function StoryCard({ story, onRead, onDelete }: StoryCardProps) {
  const chapters = story.chapters || [];
  const totalWords = chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completeChapters = chapters.filter((c) => c.status === "complete").length;
  const total = chapters.length;
  // One vocabulary (decision 13). A story is Completed when every chapter is,
  // whatever its row says; otherwise it reads its own status word.
  const complete = story.status === "complete" || (total > 0 && completeChapters === total);
  const word = complete ? "Completed" : storyStatusLabel(story.status);
  const tone = statusToneClasses[statusTone(word)];
  const readingTime = Math.max(1, Math.round(totalWords / 250));

  return (
    <Card as="article" padding="md" hover className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/recroom/story-weaver/${story.id}`}
            className="block truncate font-serif text-lead font-semibold text-ps-text-primary transition-colors hover:text-neon-purple"
          >
            {story.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-micro text-ps-text-faint">
            <span>{story.config?.genre || "General"}</span>
            {total > 0 && <span>{completeChapters}/{total} chapters</span>}
            <span>{totalWords.toLocaleString()} words</span>
            {totalWords > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />~{readingTime} min read
              </span>
            )}
            <span>
              {complete ? "Completed" : "Last updated"} {timeAgo(story.updatedAt || story.createdAt || "")}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`inline-flex items-center rounded-ps-sm px-2 py-0.5 font-mono text-body ${tone.fill} ${tone.text}`}>{word}</span>
          <Button variant="ghost" size="sm" icon={BookOpen} aria-label={`Read ${story.title}`} onClick={() => onRead(story.id)}>
            Read
          </Button>
          <ConfirmButton
            variant="ghost"
            size="sm"
            aria-label={`Delete story ${story.title}`}
            title="Delete story"
            confirmLabel="Delete?"
            onConfirm={() => onDelete(story.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </ConfirmButton>
        </div>
      </div>
      {story.premise && <p className="line-clamp-2 text-body leading-relaxed text-ps-text-muted">{story.premise}</p>}
      {!complete && total > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-ps-surface-raised" aria-hidden="true">
          <div className={`h-full rounded-full ${statusToneClasses.running.dot}`} style={{ width: `${(completeChapters / total) * 100}%` }} />
        </div>
      )}
    </Card>
  );
}
