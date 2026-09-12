"use client";

import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";

import Button from "@/components/ui/Button";

interface ProfileSyncBarProps {
  onPushAll: () => void;
  onPullAll: () => void;
  onImportDiscovered?: () => void;
  busy: boolean;
}

/**
 * The three controls that act on every profile at once.
 *
 * Push and pull for ONE profile used to sit here too, after a divider, worded
 * for whichever profile was selected; they are row actions on the profiles
 * table now, named for their row (T-0125). What is left is what acts on the
 * lot, as Buttons rather than the three raw ones this bar drew for itself.
 */
export default function ProfileSyncBar({ onPushAll, onPullAll, onImportDiscovered, busy }: ProfileSyncBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        color="purple"
        size="sm"
        icon={ArrowUpToLine}
        loading={busy}
        onClick={() => void onPushAll()}
        title="Push all profiles and Bob from database to Hermes disk"
      >
        Push all
      </Button>
      <Button
        variant="secondary"
        color="cyan"
        size="sm"
        icon={ArrowDownToLine}
        loading={busy}
        onClick={() => void onPullAll()}
        title="Pull all profiles and Bob from Hermes disk into database"
      >
        Pull all
      </Button>
      {onImportDiscovered ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void onImportDiscovered()}
          title="Import profile directories on disk that are not yet in SQLite"
        >
          Import discovered
        </Button>
      ) : null}
    </div>
  );
}
