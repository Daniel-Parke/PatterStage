// ═══════════════════════════════════════════════════════════════
// Config Section Editor — Dynamic form for any config section
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Save, Check, RotateCcw, AlertCircle } from "lucide-react";
import Link from "next/link";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { Toggle, Select, NumberInput, TextInput } from "@/components/ui/Input";
import { LoadingSpinner, ErrorBanner } from "@/components/ui/LoadingSpinner";
import { getSectionDef, type FieldDef } from "@/lib/config-schema";
import { getConfigSectionIcon } from "@/lib/config-section-icons";

const FULLSCREEN_CLASS = "min-h-screen bg-dark-950 grid-bg flex items-center justify-center";

export default function ConfigSectionPage() {
  const params = useParams();
  const sectionId = params.section as string;
  const sectionDef = getSectionDef(sectionId);
  const isFileSection = sectionDef?.type === "file";

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // File editor state
  const [fileContent, setFileContent] = useState("");
  const [originalFileContent, setOriginalFileContent] = useState("");

  // Stable ref for change detection — avoids JSON.stringify on every render
  const hasChangesRef = useRef(false);

  const hasChanges = isFileSection
    ? fileContent !== originalFileContent
    : hasChangesRef.current;

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      if (isFileSection && sectionDef?.filePath) {
        const res = await fetch(`/api/agent/files/${sectionDef.filePath === ".env" ? "env" : "hermes"}`, { signal });
        const json = await res.json();
        const content = json.data?.content || "";
        setFileContent(content);
        setOriginalFileContent(content);
      } else {
        const res = await fetch("/api/config", { signal });
        if (!res.ok) throw new Error("Failed to load config");
        const json = await res.json();
        const config = json.data || json;
        const sectionValues = (config[sectionId] as Record<string, unknown>) || {};
        setValues(sectionValues);
        setOriginalValues({ ...sectionValues });
        hasChangesRef.current = false;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [sectionId, isFileSection, sectionDef]);

  useEffect(() => {
    const controller = new AbortController();
    loadConfig(controller.signal);
    return () => controller.abort();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    if (!sectionDef) return;

    setSaving(true);
    setSaveStatus("saving");
    try {
      if (isFileSection) {
        const fileKey = sectionDef.filePath === ".env" ? "env" : "hermes";
        const res = await fetch(`/api/agent/files/${fileKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: fileContent, backup: true }),
        });
        if (!res.ok) throw new Error("Failed to save file");
        setOriginalFileContent(fileContent);
      } else {
        const editableKeys = sectionDef.fields.map((f) => f.key);
        const editableValues: Record<string, unknown> = {};
        for (const key of editableKeys) {
          if (key in values) editableValues[key] = values[key];
        }
        const res = await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: sectionId, values: editableValues }),
        });
        if (!res.ok) throw new Error("Failed to save");
        setOriginalValues({ ...values });
        hasChangesRef.current = false;
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [sectionDef, isFileSection, fileContent, sectionId, values]);

  const handleReset = useCallback(() => {
    if (isFileSection) {
      setFileContent(originalFileContent);
    } else {
      setValues({ ...originalValues });
      hasChangesRef.current = false;
    }
  }, [isFileSection, originalFileContent, originalValues]);

  const updateValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      hasChangesRef.current = true;
      return next;
    });
  }, []);

  if (!sectionDef) {
    return (
      <div className={FULLSCREEN_CLASS}>
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
      <div className={FULLSCREEN_CLASS}>
        <LoadingSpinner text={`Loading ${sectionDef.label}...`} />
      </div>
    );
  }

  const renderField = (field: FieldDef) => {
    const value = values[field.key];

    switch (field.type) {
      case "boolean":
        return (
          <Toggle
            key={field.key}
            label={field.label}
            value={Boolean(value)}
            onChange={(v) => updateValue(field.key, v)}
            description={field.description}
            color={sectionDef.color}
          />
        );
      case "number":
        return (
          <NumberInput
            key={field.key}
            label={field.label}
            value={typeof value === "number" ? value : 0}
            onChange={(v) => updateValue(field.key, v)}
            min={field.min}
            max={field.max}
            description={field.description}
          />
        );
      case "select":
        return (
          <Select
            key={field.key}
            label={field.label}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => updateValue(field.key, v)}
            options={field.options || []}
            description={field.description}
            color={sectionDef.color}
          />
        );
      case "textarea":
        return (
          <div key={field.key} className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">
              {field.label}
            </label>
            {field.description && (
              <p className="text-xs text-white/40">{field.description}</p>
            )}
            <textarea
              value={typeof value === "string" ? value : ""}
              onChange={(e) => updateValue(field.key, e.target.value)}
              rows={4}
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 transition-colors font-mono resize-y"
            />
          </div>
        );
      default:
        return (
          <TextInput
            key={field.key}
            label={field.label}
            value={typeof value === "string" ? value : String(value ?? "")}
            onChange={(v) => updateValue(field.key, v)}
            description={field.description}
            placeholder={field.placeholder}
          />
        );
    }
  };

  const SectionIcon = getConfigSectionIcon(sectionDef.icon);
  const showActions = sectionDef.fields.length > 0 || isFileSection;

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
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith("#")) {
                    return (
                      <div key={i} className="text-xs text-white/30 font-mono">
                        {line || "\u00A0"}
                      </div>
                    );
                  }
                  const eqIdx = line.indexOf("=");
                  if (eqIdx < 0) return <div key={i} className="text-xs font-mono text-white/50">{line}</div>;
                  const key = line.slice(0, eqIdx).trim();
                  const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
                  const masked = val.length > 8 ? val.slice(0, 4) + "..." + val.slice(-4) : "****";
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-neon-cyan w-48 flex-shrink-0 truncate">{key}</span>
                      <span className="text-white/50">=</span>
                      <span className="text-white/30">{masked}</span>
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
            {sectionDef.fields.map(renderField)}
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
              {sectionDef.complexKeys.map((key) => {
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
              Edit complex fields in{" "}
              <Link
                href="/config"
                className="text-neon-cyan hover:underline"
              >
                config.yaml raw editor
              </Link>
            </p>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}
