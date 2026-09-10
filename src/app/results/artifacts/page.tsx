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
import AppPageShell from "@/components/layout/AppPageShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmButton from "@/components/ui/ConfirmButton";
import Sheet from "@/components/ui/Sheet";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import LinkButton from "@/components/ui/LinkButton";
import { Select } from "@/components/ui/field";
import { useArtifacts, useArtifact } from "@/hooks/useArtifacts";
import { renderReportHtml } from "@/lib/laboratory/deep-research/markdown";
import { downloadFile } from "@/lib/chat-utils";
import { runWrite } from "@/lib/api-write";
import { useToast } from "@/components/ui/Toast";
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
  const { data: artifacts, error, refetch, isLoading } = useArtifacts(kind || undefined);
  const { data: detail } = useArtifact(selectedId);
  // The delete used to refetch straight over its own failure, so a refused
  // delete left the screen exactly as it was (D99). runWrite says the server's
  // reason, and reloads only on a success (C6, T-0143).
  const { showToast, toastElement } = useToast();

  async function remove(id: string) {
    await runWrite({
      showToast,
      url: `/api/artifacts/${id}`,
      method: "DELETE",
      successMessage: "Artifact deleted",
      errorMessage: "Could not delete that artifact",
      onSuccess: async () => {
        if (selectedId === id) setSelectedId(null);
        await refetch();
      },
    });
  }

  function download() {
    if (!detail?.content) return;
    downloadFile(detail.content, `${slugName(detail.name)}.${extForMime(detail.mimeType)}`, detail.mimeType);
  }

  const list = artifacts ?? [];
  const isMarkup = detail && (detail.mimeType.includes("markdown") || detail.mimeType.includes("html"));

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={FileStack}
          title="Artifacts"
          subtitle="Deliverables your agents produced — reports, run outputs, saved snippets — collected to view + download"
          color="orange"
        />
      }
    >
    <div className="space-y-4">
      {error ? <LoadErrorBanner error={error} onRetry={() => void refetch()} /> : null}

      <Card padding="sm">
        <div className="flex items-center gap-2 px-1">
          {/* An em space until the list has answered: "0 ARTIFACTS" was painted
              before the fetch resolved on every load (T-0128). */}
          <span className="text-micro font-mono uppercase tracking-widest text-ps-text-muted">
            {isLoading ? "\u2003" : `${list.length} artifact${list.length === 1 ? "" : "s"}`}
          </span>
          <div className="ml-auto w-44">
            <Select value={kind} onChange={setKind} options={KIND_FILTERS} />
          </div>
        </div>
      </Card>

      {/* The empty state only after a read that succeeded (T-0096). */}
      {error ? null : list.length === 0 ? (
        // The two ways to make one are IN the empty state, as links, rather
        // than named in a sentence with no way there (T-0133).
        <Card padding="md">
          <EmptyState
            icon={FileStack}
            title="No artifacts yet"
            description="Run Deep Research or a Composer workflow; its output is captured here automatically."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/work/research" variant="primary" color="cyan" size="sm" icon={Telescope}>
                  Run Deep Research
                </LinkButton>
                <LinkButton href="/work/composer" variant="ghost" color="cyan" size="sm" icon={GitBranch}>
                  Open Composer
                </LinkButton>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => {
            const Icon = KIND_ICON[a.sourceKind] ?? FileText;
            return (
              // The card is the surface and the button inside it is the whole
              // of its face: Card renders containers only, and a button is
              // not one (T-0122).
              <Card key={a.id} padding="none" hover>
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className="flex w-full flex-col gap-2 p-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${KIND_TONE[a.sourceKind] ?? "text-ps-text-muted"}`} />
                    <span className="truncate text-body text-ps-text-primary">{a.name}</span>
                  </div>
                  <div className="flex w-full items-center gap-2 text-micro font-mono uppercase tracking-wider text-ps-text-muted">
                    <span>{a.sourceKind}</span>
                    <span>·</span>
                    <span>{extForMime(a.mimeType)}</span>
                    <span className="ml-auto normal-case">{formatBytes(a.sizeBytes)}</span>
                  </div>
                  <div className="text-body text-ps-text-muted">{timeAgo(a.createdAt)}</div>
                </button>
              </Card>
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
              {/* The artifact may be the only surviving copy of a 40-minute
                  report, and this DELETE is permanent (D101). */}
              <ConfirmButton
                variant="ghost"
                color="pink"
                size="sm"
                confirmLabel="Confirm delete?"
                onConfirm={() => void remove(detail.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </ConfirmButton>
            </div>
          ) : null
        }
      >
        <div className="px-6 py-5">
          {!detail ? (
            <p className="text-body text-ps-text-muted">Loading…</p>
          ) : isMarkup ? (
            /* WG-WEB-014: the reading column, same measure as the Story Weaver
               reader and the research report. max-w-none was the unbounded case
               the ruling is against, on a surface that renders whole documents. */
            <div
              className="prose prose-invert max-w-3xl text-body text-ps-text-primary"
              // design-lint-disable-next-line no-unsanitised-html -- renderReportHtml escapes every byte first and emits only its own tag set, so a text/html artifact renders as visible source rather than live markup; that is the safe side of the trade and it is deliberate.
              dangerouslySetInnerHTML={{ __html: renderReportHtml(detail.content ?? "") }}
            />
          ) : (
            <Card variant="raised" padding="none" className="max-h-[70vh] overflow-auto px-3 py-2">
              <pre className="whitespace-pre-wrap text-body leading-relaxed text-ps-text-secondary">
                {detail.content ?? "(empty)"}
              </pre>
            </Card>
          )}
        </div>
      </Sheet>
    </div>
    {toastElement}
    </AppPageShell>
  );
}
