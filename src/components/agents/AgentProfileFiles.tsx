// ═══════════════════════════════════════════════════════════════
// AgentProfileFiles — the behaviour-file list for one profile
//
// `openFileKey` is the file currently in the editor FOR THIS PROFILE
// (editor.fileKey matches AND editor.profileId is the selected profile).
// Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/theme";
import { FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import type { ProfileFile } from "@/types/console";

export default function AgentProfileFiles({
  files,
  openFileKey,
  onOpenFile,
}: {
  files: ProfileFile[];
  openFileKey: string | null;
  onOpenFile: (file: ProfileFile) => void;
}) {
  return (
    <div className="p-4 flex-1 overflow-auto">
      <h3 className={sectionHeadingClasses}>
        Behaviour files
      </h3>
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.key}
            className={`flex items-center justify-between py-2 px-3 rounded-ps-md border transition-colors ${
              openFileKey === file.key
                ? "border-neon-purple/40 bg-neon-purple/5"
                : "border-transparent hover:bg-ps-surface-raised"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-ps-text-muted shrink-0" />
              <span className="text-body text-ps-text-secondary font-mono truncate">{file.name}</span>
              {file.exists ? (
                <span className="text-body text-ps-text-faint shrink-0">
                  {(file.size / 1024).toFixed(1)}KB
                </span>
              ) : (
                <span className="text-body text-ps-text-faint shrink-0">missing</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              color="cyan"
              onClick={() => onOpenFile(file)}
            >
              {file.exists ? "Edit" : "Create"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
