// ═══════════════════════════════════════════════════════════════
// ScriptTemplateGallery — the starter-template cards
//
// Extracted verbatim from app/orchestration/scripts/page.tsx. Picking
// a card opens the template in the editor; nothing is written here.
// Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { FileCode, Plus } from "lucide-react";
import { SCRIPT_TEMPLATES } from "@/components/scripts/script-templates";

export default function ScriptTemplateGallery({
  onOpenTemplate,
}: {
  onOpenTemplate: (name: string, content: string) => void;
}) {
  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/40">
        <FileCode className="h-3.5 w-3.5" /> Examples — open in the editor, tweak, then save
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SCRIPT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenTemplate(t.name, t.content)}
            className="group rounded-xl border border-white/10 bg-dark-900/30 p-3 text-left transition-colors hover:border-neon-cyan/30 hover:bg-neon-cyan/[0.03]"
          >
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-neon-cyan" />
              <span className="font-mono text-sm text-white/85">{t.label}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-white/45">{t.description}</p>
            <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-white/30 group-hover:text-neon-cyan">
              <Plus className="h-3 w-3" /> {t.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
