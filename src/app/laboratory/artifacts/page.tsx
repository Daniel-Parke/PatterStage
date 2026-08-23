// ═══════════════════════════════════════════════════════════════
// Laboratory → Artifacts — the registry of agent-produced deliverables
//
// Collects Composer / Deep Research / Mission outputs (auto-captured) plus
// anything manually saved, in one place to view + download. Today these are
// text/markdown/JSON (Hermes returns no files); the schema is ready for real
// files later.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { FileStack, Telescope, GitBranch, Rocket, MessageCircle, FileText, Download, Trash2 } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { Select } from "@/components/ui/field";
import { useArtifacts, useArtifact } from "@/hooks/useArtifacts";
import { renderReportHtml } from "@/lib/laboratory/deep-research/markdown";
import { downloadFile } from "@/lib/chat-utils";
import { safeApiCall } from "@/lib/api-fetch";
import { timeAgo, formatBytes } from "@/lib/utils";

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  research: Telescope,
  composer: GitBranch,
  mission: Rocket,
  chat: MessageCircle,
  manual: FileText,
};
const KIND_TONE: Record<string, string> = {
  research: "text-neon-cyan",
  composer: "text-neon-purple",
  mission: "text-neon-orange",
  chat: "text-neon-green",
  manual: "text-ps-text-secondary",
};
const KIND_FILTERS = [
  { value: "", label: "All kinds" },
  { value: "research", label: "Deep Research" },
  { value: "composer", label: "Composer" },
  { value: "mission", label: "Missions" },
  { value: "manual", label: "Saved" },
];

/** Pick a download extension from the mime type. */
function extForMime(mime: string): string {
  if (mime.includes("markdown")) return "md";
  if (mime.includes("html")) return "html";
  if (mime.includes("json")) return "json";
  if (mime.includes("csv")) return "csv";
  return "txt";
}
function slugName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "artifact";
}

export default function ArtifactsPage() {
  const [kind, setKind] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: artifacts, error, refetch } = useArtifacts(kind || undefined);
  const { data: detail } = useArtifact(selectedId);

  async function remove(id: string) {
    await safeApiCall(`/api/artifacts/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    await refetch();
  }

  function download() {
    if (!detail?.content) return;
    downloadFile(detail.content, `${slugName(detail.name)}.${extForMime(detail.mimeType)}`, detail.mimeType);
  }

  const list = artifacts ?? [];
  const isMarkup = detail && (detail.mimeType.includes("markdown") || detail.mimeType.includes("html"));

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <PageHeader
        icon={FileStack}
        title="Artifacts"
        subtitle="Deliverables your agents produced — reports, run outputs, saved snippets — collected to view + download"
        color="orange"
      />

      {error ? <LoadErrorBanner error={error} /> : null}

      <Card padding="sm">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-mono uppercase tracking-widest text-ps-text-muted">{list.length} artifact{list.length === 1 ? "" : "s"}</span>
          <div className="ml-auto w-44">
            <Select value={kind} onChange={setKind} options={KIND_FILTERS} />
          </div>
        </div>
      </Card>

      {list.length === 0 ? (
        <Card padding="md">
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <FileStack className="h-6 w-6 text-white/15" />
            <p className="text-sm text-ps-text-muted">No artifacts yet</p>
            <p className="text-xs text-ps-text-muted">Run Deep Research or a Composer workflow — its output is captured here automatically.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => {
            const Icon = KIND_ICON[a.sourceKind] ?? FileText;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-dark-900/50 p-3 text-left transition hover:border-white/25"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${KIND_TONE[a.sourceKind] ?? "text-ps-text-muted"}`} />
                  <span className="truncate text-sm text-ps-text-primary">{a.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-ps-text-muted">
                  <span>{a.sourceKind}</span>
                  <span>·</span>
                  <span>{extForMime(a.mimeType)}</span>
                  <span className="ml-auto normal-case">{formatBytes(a.sizeBytes)}</span>
                </div>
                <div className="text-xs text-ps-text-muted">{timeAgo(a.createdAt)}</div>
              </button>
            );
          })}
        </div>
      )}

      <Sheet
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
        title={detail?.name ?? "Artifact"}
        subtitle={detail ? `${detail.sourceKind} · ${detail.mimeType} · ${formatBytes(detail.sizeBytes)}` : undefined}
        footer={
          detail ? (
            <div className="flex items-center gap-2">
              <Button variant="primary" color="cyan" size="sm" onClick={download}>
                <Download className="h-3.5 w-3.5" /> Download .{extForMime(detail.mimeType)}
              </Button>
              <Button variant="ghost" color="pink" size="sm" onClick={() => void remove(detail.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          ) : null
        }
      >
        <div className="px-6 py-5">
          {!detail ? (
            <p className="text-xs text-ps-text-muted">Loading…</p>
          ) : isMarkup ? (
            /* WG-WEB-014: the reading column, same measure as the Story Weaver
               reader and the research report. max-w-none was the unbounded case
               the ruling is against, on a surface that renders whole documents. */
            <div
              className="prose prose-invert max-w-3xl text-sm text-ps-text-primary"
              dangerouslySetInnerHTML={{ __html: renderReportHtml(detail.content ?? "") }}
            />
          ) : (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-dark-900/60 px-3 py-2 text-xs leading-relaxed text-ps-text-secondary">
              {detail.content ?? "(empty)"}
            </pre>
          )}
        </div>
      </Sheet>
    </div>
  );
}
