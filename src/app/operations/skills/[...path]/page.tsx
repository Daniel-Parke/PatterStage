// ═══════════════════════════════════════════════════════════════
// Skill Content Viewer — Read SKILL.md with markdown rendering
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Folder,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SimpleMarkdown } from "@/components/skills/SimpleMarkdown";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";

interface SkillData {
  name: string;
  path: string;
  frontmatter: Record<string, string>;
  content: string;
  rawContent: string;
  size: number;
  lastModified: string;
  linkedFiles: { name: string; path: string; size: number }[];
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
  const [data, setData] = useState<SkillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const loadSkill = useCallback(async () => {
    if (hasMalformedPath) {
      setError("Invalid skill path. Use the skills list to navigate.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await apiFetch(`/api/skills/${skillPath}`);
      setData(json.data || json);
    } catch (err) {
      setErrorFromCaught(setError, err, "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [hasMalformedPath, skillPath]);

  useEffect(() => {
    loadSkill();
  }, [loadSkill]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 grid-bg flex items-center justify-center">
        <LoadingSpinner text="Loading skill..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-dark-950 grid-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Skill Not Found</h2>
          <p className="text-ps-text-muted font-mono mb-4">{error}</p>
          <Link
            href="/operations/skills"
            className="text-neon-green text-sm font-mono hover:underline"
          >
            ← Back to Skills
          </Link>
        </div>
      </div>
    );
  }

  const subtitle = `${data.path} · ${(data.size / 1024).toFixed(1)} KB · ${new Date(data.lastModified).toLocaleDateString()}`;

  return (
    <AppPageShell>
      <PageHeader
        icon={FileText}
        title={data.name}
        subtitle={subtitle}
        color="green"
        backHref="/operations/skills"
        backLabel="SKILLS"
        actions={
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs font-mono text-ps-text-muted hover:text-ps-text-secondary px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          >
            {showRaw ? "Rendered" : "Raw"}
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-6 flex-1 w-full">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="rounded-xl border border-white/10 bg-dark-900/50 p-6">
              {showRaw ? (
                <pre className="text-sm font-mono text-ps-text-secondary whitespace-pre-wrap break-words">
                  {data.rawContent}
                </pre>
              ) : (
                <SimpleMarkdown content={data.content} />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-56 flex-shrink-0 hidden lg:block space-y-4">
            {/* Frontmatter */}
            {Object.keys(data.frontmatter).length > 0 && (
              <div className="rounded-xl border border-white/10 bg-dark-900/50 p-4">
                <h3 className="text-xs font-mono text-ps-text-muted uppercase tracking-widest mb-3">
                  Metadata
                </h3>
                <div className="space-y-2">
                  {Object.entries(data.frontmatter).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-xs font-mono text-ps-text-muted uppercase">
                        {key}
                      </div>
                      <div className="text-sm text-ps-text-secondary font-mono truncate">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked files */}
            {data.linkedFiles.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-dark-900/50 p-4">
                <h3 className="text-xs font-mono text-ps-text-muted uppercase tracking-widest mb-3">
                  Linked Files
                </h3>
                <div className="space-y-1.5">
                  {data.linkedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between text-xs"
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
              </div>
            )}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}
