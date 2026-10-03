// ═══════════════════════════════════════════════════════════════
// Skill Content Viewer — Read SKILL.md with markdown rendering
// ═══════════════════════════════════════════════════════════════

"use client";

import { sectionHeadingClasses } from "@/lib/ui/theme";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Folder,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SimpleMarkdown } from "@/components/skills/SimpleMarkdown";
import { useApiResource } from "@/hooks/useApiResource";

/**
 * What the viewer renders.
 *
 * Everything but the name and the body is optional, because the route answers
 * from the catalogue when SKILL.md is not on disk and that answer is thinner
 * (T-0103, D81). The page used to reach straight into `frontmatter` and
 * `linkedFiles` and threw for any payload that did not carry them.
 */
interface SkillData {
  name: string;
  path: string;
  source?: "disk" | "catalog";
  frontmatter?: Record<string, string>;
  content: string;
  rawContent?: string;
  size?: number;
  lastModified?: string | null;
  linkedFiles?: { name: string; path: string; size: number }[];
}

export default function SkillDetailPage() {
  // Defensive: useParams can return string | string[] | undefined
  // depending on the catch-all. URL-encoded slashes (%2F) land in
  // params.path as a single string with a literal slash inside, which
  // then breaks the API call below. Validate before use.
  // Audit reference: dogfood-output/report.md Issue #4.
  const params = useParams();
  const rawPath = params.path;
  const pathSegments = Array.isArray(rawPath)
    ? rawPath
    : typeof rawPath === "string"
    ? [rawPath]
    : [];
  // Reject paths with embedded slashes (URL-encoded) or empty segments.
  const hasMalformedPath =
    pathSegments.length === 0 ||
    pathSegments.some((seg) => seg.length === 0 || seg.includes("/"));
  const skillPath = hasMalformedPath ? "" : pathSegments.join("/");
  const [showRaw, setShowRaw] = useState(false);

  // A malformed path is never asked for: the read is disabled and the page
  // says why below, rather than sending a URL with a slash in it to the API.
  const skill = useApiResource<SkillData>(`/api/skills/${skillPath}`, {
    select: (payload) => payload as SkillData | undefined,
    errorMessage: "Unknown error",
    enabled: !hasMalformedPath,
  });
  const data = skill.data;
  const loading = !hasMalformedPath && !skill.settled;
  const error = hasMalformedPath ? "Invalid skill path. Use the skills list to navigate." : skill.error;

  if (loading) {
    return (
      <div className="min-h-screen bg-ps-surface-ground grid-bg flex items-center justify-center">
        <LoadingSpinner text="Loading skill..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-ps-surface-ground grid-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-title font-bold text-ps-text-primary mb-2">Skill Not Found</h2>
          <p className="text-ps-text-muted font-mono mb-4">{error}</p>
          <Link
            href="/agent/skills"
            className="text-neon-green text-body font-mono hover:underline"
          >
            ← Back to Skills
          </Link>
        </div>
      </div>
    );
  }

  const parts = [data.path];
  if (typeof data.size === "number") parts.push(`${(data.size / 1024).toFixed(1)} KB`);
  if (data.lastModified) {
    const when = new Date(data.lastModified);
    if (!Number.isNaN(when.getTime())) parts.push(when.toLocaleDateString());
  }
  if (data.source === "catalog") parts.push("in the catalogue, not yet on disk");
  const subtitle = parts.join(" · ");
  const frontmatter = data.frontmatter ?? {};
  const linkedFiles = data.linkedFiles ?? [];

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={FileText}
          title={data.name}
          subtitle={subtitle}
          color="green"
          backHref="/agent/skills"
          backLabel="SKILLS"
          actions={
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="text-micro font-mono text-ps-text-muted hover:text-ps-text-secondary px-3 py-1.5 rounded-ps-md border border-ps-edge hover:border-ps-edge-emphasis transition-colors"
            >
              {showRaw ? "Rendered" : "Raw"}
            </button>
          }
        />
      }
    >
      <div>
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Card padding="lg">
              {showRaw ? (
                <pre className="text-body font-mono text-ps-text-secondary whitespace-pre-wrap break-words">
                  {data.rawContent ?? data.content}
                </pre>
              ) : (
                <SimpleMarkdown content={data.content} />
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 hidden lg:block space-y-4">
            {/* Frontmatter */}
            {Object.keys(frontmatter).length > 0 && (
              <Card>
                <h3 className={sectionHeadingClasses}>
                  Metadata
                </h3>
                <div className="space-y-2">
                  {Object.entries(frontmatter).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-micro font-mono text-ps-text-muted uppercase">
                        {key}
                      </div>
                      <div className="text-body text-ps-text-secondary font-mono truncate">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Linked files */}
            {linkedFiles.length > 0 && (
              <Card>
                <h3 className={sectionHeadingClasses}>
                  Linked Files
                </h3>
                <div className="space-y-1.5">
                  {linkedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between text-body"
                    >
                      <span className="flex items-center gap-1.5 text-ps-text-secondary font-mono">
                        <Folder className="w-3 h-3 text-neon-green/70" />
                        {file.name}
                      </span>
                      <span className="text-ps-text-muted font-mono">
                        {(file.size / 1024).toFixed(1)}K
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
