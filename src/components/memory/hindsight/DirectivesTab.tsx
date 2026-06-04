// ═══════════════════════════════════════════════════════════════
// Hindsight Directives Tab — Manage agent directives
// ═══════════════════════════════════════════════════════════════

import { FileText, Plus, Pencil, ToggleRight, ToggleLeft, Trash2, RefreshCw } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { pluralise } from "@/lib/utils";
import type { Directive } from "./types";

interface DirectivesTabProps {
  directives: Directive[];
  loading: boolean;
  onCreateClick: () => void;
  onRefresh: () => void;
  onEdit: (d: Directive) => void;
  onToggle: (d: Directive) => void;
  onDelete: (id: string) => void;
}

export default function DirectivesTab({
  directives,
  loading,
  onCreateClick,
  onRefresh,
  onEdit,
  onToggle,
  onDelete,
}: DirectivesTabProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-white/30">
          {directives.length} directive{pluralise(directives.length)} — injected into agent prompts automatically
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={onCreateClick}>
            New Directive
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading directives..." />
      ) : directives.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No directives yet"
          description="Hindsight returned no directives for this bank. Directives are hard rules injected into agent prompts when you add them."
          action={
            <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={onCreateClick}>
              Create your first directive
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {directives.map((d) => (
            <div
              key={d.id}
              className={`rounded-xl border p-4 transition-colors ${
                d.is_active
                  ? "border-white/10 bg-dark-900/50 hover:border-pink-500/20"
                  : "border-white/5 bg-dark-900/20 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white/90">{d.name}</span>
                    {d.priority > 0 && (
                      <Badge color="orange" size="sm">P{d.priority}</Badge>
                    )}
                    {!d.is_active && (
                      <Badge color="gray" size="sm">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">{d.content}</p>
                  {d.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {d.tags.map(t => <Badge key={t} color="purple" size="sm">{t}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onEdit(d)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onToggle(d)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                    title={d.is_active ? "Deactivate" : "Activate"}
                  >
                    {d.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onDelete(d.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}