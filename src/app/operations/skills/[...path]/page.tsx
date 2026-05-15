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

function SimpleMarkdown({ content }: { content: string }) {
  // Lightweight markdown rendering — no external dependencies needed
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 rounded-lg border border-white/10 bg-dark-800/80 overflow-hidden"
          >
            {codeBlockLang && (
              <div className="px-3 py-1.5 border-b border-white/5 text-[10px] font-mono text-white/30 uppercase">
                {codeBlockLang}
              </div>
            )}
            <pre className="p-3 text-sm font-mono text-white/70 overflow-x-auto">
              {codeBlockLines.join("\n")}
            </pre>
          </div>
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-white/10"
        >
          {trimmed.slice(2)}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-lg font-bold text-white mt-5 mb-2 pb-1 border-b border-white/5"
        >
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={i} className="my-4 border-white/10" />);
      continue;
    }

    // List items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 ml-4">
          <span className="text-neon-cyan mt-1.5 flex-shrink-0">•</span>
          <span className="text-sm text-white/70">
            {inlineFormat(trimmed.slice(2))}
          </span>
        </div>
      );
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 ml-4">
          <span className="text-neon-cyan font-mono text-sm mt-0.5 flex-shrink-0">
            {numMatch[1]}.
          </span>
          <span className="text-sm text-white/70">
            {inlineFormat(trimmed.slice(numMatch[0].length))}
          </span>
        </div>
      );
      continue;
    }

    // Empty line
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm text-white/70 my-1 leading-relaxed">
        {inlineFormat(trimmed)}
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  // Handle inline code
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-dark-800/80 text-neon-green px-1.5 py-0.5 rounded text-xs font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        return (
          <strong key={`${i}-${j}`} className="font-semibold text-white">
            {bp.slice(2, -2)}
          </strong>
        );
      }
      // Italic
      const italicParts = bp.split(/(\*[^*]+\*)/g);
      return italicParts.map((ip, k) => {
        if (ip.startsWith("*") && ip.endsWith("*") && !ip.startsWith("**")) {
          return (
            <em key={`${i}-${j}-${k}`} className="italic text-white/80">
              {ip.slice(1, -1)}
            </em>
          );
        }
        return ip || null;
      });
    });
  });
}

export default function SkillDetailPage() {
  const params = useParams();
  const skillPath = (params.path as string[]).join("/");
  const [data, setData] = useState<SkillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const loadSkill = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills/${skillPath}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to load skill");
      }
      const json = await res.json();
      setData(json.data || json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [skillPath]);

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
          <p className="text-white/40 font-mono mb-4">{error}</p>
          <Link
            href="/skills"
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
        backHref="/skills"
        backLabel="SKILLS"
        actions={
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs font-mono text-white/40 hover:text-white/60 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
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
                <pre className="text-sm font-mono text-white/70 whitespace-pre-wrap break-words">
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
                <h3 className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
                  Metadata
                </h3>
                <div className="space-y-2">
                  {Object.entries(data.frontmatter).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-[10px] font-mono text-white/30 uppercase">
                        {key}
                      </div>
                      <div className="text-sm text-white/60 font-mono truncate">
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
                <h3 className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-3">
                  Linked Files
                </h3>
                <div className="space-y-1.5">
                  {data.linkedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-white/60 font-mono">
                        <Folder className="w-3 h-3 text-neon-green/60" />
                        {file.name}
                      </span>
                      <span className="text-white/30 font-mono">
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
