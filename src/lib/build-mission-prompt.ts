// ═══════════════════════════════════════════════════════════════
// build-mission-prompt.ts — Shared prompt builder (client + server)
// ═══════════════════════════════════════════════════════════════
// Extracted from mission-repository.ts so the missions page can
// use the same logic without importing server-only modules.

import { formatLocalDirEntryLine, normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import type { LocalDirEntry } from "@/types/hermes";

export interface BuildPromptOptions {
  instruction: string;
  localDirs?: LocalDirEntry[] | string[];
  references?: string[];
  skills?: string[];
  goals?: string[];
  context?: string;
}

export function buildMissionPrompt(opts: BuildPromptOptions): string {
  const parts: string[] = [];
  const localDirsNorm = normalizeLocalDirsInput(opts.localDirs ?? []);

  // 1. WORKING DIRECTORIES — highest priority
  if (localDirsNorm.length > 0) {
    parts.push(
      "## Working Directories\n" +
      "Focus all work within the following directories:\n" +
      localDirsNorm.map((d) => formatLocalDirEntryLine(d)).join("\n") +
      "\n"
    );
  }

  // 2. KEY REFERENCES
  if (opts.references && opts.references.length > 0) {
    parts.push(
      "## Key References\n" +
      "Consult and prioritise the following sources:\n" +
      opts.references.map(r => `  - ${r}`).join("\n") + "\n"
    );
  }

  // 3. RECOMMENDED SKILLS
  if (opts.skills && opts.skills.length > 0) {
    parts.push(
      "## Recommended Skills\n" +
      "Apply expertise from the following skills where relevant:\n" +
      opts.skills.map(s => `  - ${s}`).join("\n") + "\n"
    );
  }

  // 4. CORE INSTRUCTION
  parts.push(opts.instruction.trim());

  // 5. ADDITIONAL CONTEXT
  if (opts.context && opts.context.trim()) {
    parts.push("", "---", "", "## Additional Context", "", opts.context.trim());
  }

  return parts.join("\n");
}