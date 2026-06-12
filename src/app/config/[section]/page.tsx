// ═══════════════════════════════════════════════════════════════
// Config Section Editor — Dynamic form for any config section
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { Save, Check, RotateCcw, AlertCircle } from "lucide-react";
import Link from "next/link";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LoadingSpinner, ErrorBanner } from "@/components/ui/LoadingSpinner";
import { getSectionDef, fileKeyForFilePath } from "@/lib/config-schema";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";
import { maskKeyHint } from "@/lib/secret-mask";
import { parseEnvLine } from "@/lib/env-line";
import ConfigField from "@/components/config/ConfigField";

export default function ConfigSectionPage() {
  const params = useParams();
  const sectionId = params.section as string;
  const sectionDef = getSectionDef(sectionId);
  const isFileSection = sectionDef?.type === "file";

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  // Single source of truth for save flow — `saving` is derived as
  // saveStatus === "saving" so the two are never out of sync.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saving = saveStatus === "saving";
  const [error, setError] = useState<string | null>(null);

  // File editor state
  const [fileContent, setFileContent] = useState("");
  const [originalFileContent, setOriginalFileContent] = useState("");
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup save status timer on unmount
  useEffect(() => {
    return () => {
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  const yamlHasChanges = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(originalValues),
    [values, originalValues],
  );

  const fileHasChanges = useMemo(
    () => fileContent !== originalFileContent,
    [fileContent, originalFileContent],
  );

  const hasChanges = isFileSection ? fileHasChanges : yamlHasChanges;

  const isPlatformToolsetsPreview = sectionId === "platform_toolsets";

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      if (isFileSection && sectionDef?.filePath) {
        const fileKey = fileKeyForFilePath(sectionDef.filePath);
        const json = await apiFetch(`/api/agent/files/${fileKey}`, { signal });
        const content = json.data?.content || "";
        setFileContent(content);
        setOriginalFileContent(content);
      } else if (isPlatformToolsetsPreview) {
        const json = await apiFetch("/api/agent/profiles/default/toolsets", { signal });
        if (!json.data) throw new Error("Failed to load root toolsets");
        const platformToolsets =
          (json.data?.platformToolsets as Record<string, unknown>) ?? {};
        setValues(platformToolsets);
        setOriginalValues({ ...platformToolsets });
      } else {
        const json = await apiFetch("/api/config", { signal });
        const config = json.data || json;
        const sectionValues = (config[sectionId] as Record<string, unknown>) || {};
        setValues(sectionValues);
        setOriginalValues({ ...sectionValues });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setErrorFromCaught(setError, err, "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sectionId, isFileSection, sectionDef, isPlatformToolsetsPreview]);

  useEffect(() => {
    const controller = new AbortController();
    loadConfig(controller.signal);
    return () => controller.abort();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    if (!sectionDef) return;

    setSaveStatus("saving");
    try {
      if (isFileSection && sectionDef?.filePath) {
        const fileKey = fileKeyForFilePath(sectionDef.filePath);
        await apiFetch(`/api/agent/files/${fileKey}`, {
          method: "PUT",
          body: JSON.stringify({ content: fileContent, backup: true }),
        });
        setOriginalFileContent(fileContent);
      } else {
        const editableKeys = sectionDef.fields.map((f) => f.key);
        const editableValues: Record<string, unknown> = {};
        for (const key of editableKeys) {
          if (key in values) editableValues[key] = values[key];
        }
        const res = await apiFetch("/api/config", {
          method: "PUT",
          body: JSON.stringify({ section: sectionId, values: editableValues }),
        });
        if (!res?.data) throw new Error("Failed to save");
        setOriginalValues({ ...values });
      }
      setSaveStatus("saved");
      // Clear any in-flight save-status timer from a prior save so
      // the new save's 2s window is the source of truth (a stale
      // timer from a previous save could race with this one's
      // setSaveStatus("saved") and prematurely flip the UI back to
      // "idle" before the user reads the "Saved!" indicator).
      // Mirrors the saveResetTimerRef pattern in
      // operations/agents/page.tsx (session 184).
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
      saveStatusTimerRef.current = setTimeout(() => {
        saveStatusTimerRef.current = null;
        setSaveStatus("idle");
      }, 2000);
    } catch (err) {
      setSaveStatus("error");
      setErrorFromCaught(setError, err, "Save failed");
    }
  }, [sectionDef, isFileSection, fileContent, sectionId, values]);

  const handleReset = useCallback(() => {
    if (isFileSection) {
      setFileContent(originalFileContent);
    } else {
      setValues({ ...originalValues });
    }
  }, [isFileSection, originalFileContent, originalValues]);

  const updateValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (!sectionDef) {
    return (
      <div className="min-h-screen bg-dark-950 grid-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Unknown Config Section
          </h2>
          <p className="text-white/40 font-mono mb-4">
            Section &quot;{sectionId}&quot; not found
          </p>
          <Link href="/config" className="text-neon-cyan text-sm font-mono hover:underline">
            ← Back to Config
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 grid-bg flex items-center justify-center">
        <LoadingSpinner text={`Loading ${sectionDef.label}...`} />
      </div>
    );
  }

  const SectionIcon = sectionDef.icon;
  const showActions =
    !isPlatformToolsetsPreview && (sectionDef.fields.length > 0 || isFileSection);

  return (
    <AppPageShell>
      <PageHeader
        icon={SectionIcon}
        title={sectionDef.label}
        subtitle={sectionDef.description}
        color={sectionDef.color}
        backHref="/config"
        backLabel="CONFIG"
        actions={
          showActions ? (
            <>
              {hasChanges && (
                <span className="text-xs text-neon-orange font-mono flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  UNSAVED
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges}
                icon={RotateCcw}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                color={sectionDef.color}
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges}
                loading={saving}
                icon={saveStatus === "saved" ? Check : Save}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                  ? "Saved!"
                  : "Save"}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="max-w-3xl mx-auto px-6 py-6 flex-1 w-full">
        {sectionId === "platform_toolsets" ? (
          <p className="text-xs text-white/40 font-mono border border-neon-orange/20 rounded-lg p-3 mb-6 bg-neon-orange/5">
            This section edits the <strong className="text-white/60">root</strong> Hermes{" "}
            <code className="text-white/50">config.yaml</code> only. Per-profile toolsets are managed
            on{" "}
            <a href="/operations/tools" className="text-neon-orange hover:underline">
              Operations → Tools
            </a>{" "}
            (profile selector + push).
          </p>
        ) : null}
        {error && <ErrorBanner message={error} />}

        {/* File editor for file-type sections */}
        {isFileSection && (
          <div className="rounded-xl border border-white/10 bg-dark-900/50 p-6 mb-6">
            <p className="text-xs text-white/30 font-mono uppercase tracking-widest mb-4">
              {sectionDef.sensitive ? "Sensitive File — .env" : "File Content"}
            </p>
            {sectionDef.sensitive ? (
              // .env editor with masked values
              <div className="space-y-2">
                {fileContent.split("\n").map((line, i) => {
                  const parsed = parseEnvLine(line);
                  const lineKey = `env-${i}-${line.slice(0, 24).replace(/[^a-zA-Z0-9]/g, "-")}`;
                  if (parsed.kind === "blank" || parsed.kind === "comment") {
                    return (
                      <div key={lineKey} className="text-xs text-white/30 font-mono">
                        {line || "\u00A0"}
                      </div>
                    );
                  }
                  if (parsed.kind === "invalid") {
                    return (
                      <div key={lineKey} className="text-xs font-mono text-white/50">
                        {parsed.raw}
                      </div>
                    );
                  }
                  // parsed.kind === "keyval"
                  return (
                    <div key={lineKey} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-neon-cyan w-48 flex-shrink-0 truncate">{parsed.key}</span>
                      <span className="text-white/50">=</span>
                      <span className="text-white/30">{maskKeyHint(parsed.value)}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-white/20 mt-4">
                  Edit .env directly on the server for security. This view is read-only for sensitive values.
                </p>
              </div>
            ) : (
              // Markdown file editor
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="w-full h-96 bg-dark-800 border border-white/10 rounded-lg p-4 text-sm text-white/80 font-mono resize-none focus:border-cyan-500/50 focus:outline-none"
                spellCheck={false}
              />
            )}
          </div>
        )}

        {/* Editable fields for YAML sections */}
        {sectionDef.fields.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-dark-900/50 p-6 space-y-5 mb-6">
            {sectionDef.fields.map((field) => (
              <ConfigField
                key={field.key}
                field={field}
                value={values[field.key]}
                sectionDef={sectionDef}
                onUpdate={updateValue}
              />
            ))}
          </div>
        )}

        {/* Complex / nested fields (read-only preview) */}
        {sectionDef.complexKeys && sectionDef.complexKeys.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-dark-900/50 p-6">
            {showActions && (
              <p className="text-xs text-white/30 font-mono uppercase tracking-widest mb-4">
                Complex Fields
              </p>
            )}
            <div className="space-y-4">
              {/* platform_toolsets: derive keys dynamically from loaded values
                  so new platforms added by Hermes appear automatically */}
              {(
                sectionId === "platform_toolsets"
                  ? Object.keys(values).sort()
                  : sectionDef.complexKeys
              ).map((key) => {
                const val = values[key];
                const isObj = typeof val === "object" && val !== null;
                const isEmpty = !val || (isObj && Object.keys(val as object).length === 0);
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm text-white/60 font-mono">{key}</span>
                      {isEmpty && (
                        <span className="text-[10px] font-mono text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                          empty
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/30 bg-dark-800/50 rounded-lg p-3 font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {isEmpty
                        ? "(not configured)"
                        : isObj
                        ? JSON.stringify(val, null, 2)
                        : String(val)}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-white/20 mt-4 pt-4 border-t border-white/5">
              {isPlatformToolsetsPreview ? (
                <>
                  Edit Bob (root) toolsets on{" "}
                  <Link href="/operations/tools" className="text-neon-orange hover:underline">
                    Operations → Tools
                  </Link>{" "}
                  (profile: Bob / default), then Push to Hermes.
                </>
              ) : (
                <>
                  Edit complex fields in{" "}
                  <Link href="/config" className="text-neon-cyan hover:underline">
                    config.yaml raw editor
                  </Link>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
