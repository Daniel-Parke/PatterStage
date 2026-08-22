// ═══════════════════════════════════════════════════════════════
// AgentProfileFiles — the behaviour-file list for one profile
//
// Extracted verbatim from app/operations/agents/page.tsx. `openFileKey`
// is the file currently in the editor FOR THIS PROFILE, which is the
// same condition the page used inline (editor.fileKey matches AND
// editor.profileId is the selected profile). Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

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
      <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">
        Behaviour files
      </h3>
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.key}
            className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-colors ${
              openFileKey === file.key
                ? "border-purple-500/40 bg-purple-500/5"
                : "border-transparent hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-white/30 shrink-0" />
              <span className="text-sm text-white/70 font-mono truncate">{file.name}</span>
              {file.exists ? (
                <span className="text-xs text-white/20 shrink-0">
                  {(file.size / 1024).toFixed(1)}KB
                </span>
              ) : (
                <span className="text-xs text-white/25 shrink-0">missing</span>
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
