// ═══════════════════════════════════════════════════════════════
// Hindsight Mental Models Tab — Cached reflect results
// ═══════════════════════════════════════════════════════════════

import { Settings, Plus, Zap, RefreshCw, Clock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { pluralise, timeAgo } from "@/lib/utils";
import { RowEditButton, RowDeleteButton } from "./RowActionButtons";
import type { MentalModel } from "./types";

interface MentalModelsTabProps {
  models: MentalModel[];
  loading: boolean;
  refreshingModelId: string | null;
  onCreateClick: () => void;
  onRefresh: () => void;
  onEdit: (m: MentalModel) => void;
  onRefreshModel: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function MentalModelsTab({
  models,
  loading,
  refreshingModelId,
  onCreateClick,
  onRefresh,
  onEdit,
  onRefreshModel,
  onDelete,
}: MentalModelsTabProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-ps-text-muted">
          {models.length} mental model{pluralise(models.length)} — cached reflect results with auto-refresh
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={onCreateClick}>
            New Model
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading mental models..." />
      ) : models.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="No mental models yet"
          description="Hindsight returned no mental models for this bank. Models are cached reflect analyses—create one with a source query to generate content."
          action={
            <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={onCreateClick}>
              Create your first mental model
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {models.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-pink-500/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-ps-text-primary">{m.name}</span>
                    {m.content && <Badge color="green" size="sm">Ready</Badge>}
                    {!m.content && <Badge color="orange" size="sm">Generating</Badge>}
                  </div>
                  <p className="text-xs text-ps-text-muted mb-2 font-mono">Query: {m.source_query}</p>
                  {m.content && (
                    <p className="text-sm text-ps-text-secondary leading-relaxed line-clamp-3">{m.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-ps-text-muted">
                    {m.last_refreshed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Updated {timeAgo(m.last_refreshed_at)}
                      </span>
                    )}
                    {m.tags.length > 0 && (
                      <span className="flex gap-1">
                        {m.tags.map(t => <Badge key={t} color="purple" size="sm">{t}</Badge>)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <RowEditButton onClick={() => onEdit(m)} />
                  <button
                    onClick={() => onRefreshModel(m.id)}
                    disabled={refreshingModelId === m.id}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-ps-text-muted hover:text-ps-text-secondary transition-colors disabled:opacity-30"
                    title="Refresh (re-run reflect)"
                  >
                    <Zap className={`w-4 h-4 ${refreshingModelId === m.id ? "animate-pulse text-yellow-400" : ""}`} />
                  </button>
                  <RowDeleteButton onClick={() => onDelete(m.id)} label={m.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}