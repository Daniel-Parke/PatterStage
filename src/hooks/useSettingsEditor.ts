// ═══════════════════════════════════════════════════════════════
// useSettingsEditor — the state of every settings section, on one page.
//
// The section editor page held one section's draft, its save status and its
// error, and there were twenty-seven of it. Settings is one page now (decision
// 7, T-0125), so this holds the same state for every section at once, keyed by
// section id, and keeps the two rules the editor had earned:
//
//   ONLY WHAT DIFFERS IS SENT. A save posts the keys whose value differs from
//   what was loaded, so a value on disk this console cannot represent never
//   blocks the save of the field beside it (T-0100, D77).
//
//   A NULL THE ROUTE HONOURED HAS LEFT. Clear sends null, the route deletes the
//   key, and the settled state drops it, or the next diff would keep offering
//   to delete a key that is already gone (T-0100, D78).
//
// The yaml sections read through useConfig, which is one cached request for
// the whole file. The two file sections and the platform-toolsets preview are
// their own routes, read through useApiResource (T-0129); a file's editable
// copy is seeded from its read and replaced only when the server's content
// changes, so a draft survives a re-read. Every save goes through runWrite.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { useApiResource } from "@/hooks/useApiResource";
import { useConfig } from "@/hooks/useConfig";
import { apiFetch, setErrorFromCaught } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";
import {
  CONFIG_SECTIONS,
  fileKeyForFilePath,
  validateSectionValues,
  type FieldProblem,
  type SectionDef,
} from "@/lib/config-schema";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
type Values = Record<string, unknown>;

interface FileEditor {
  content: string;
  original: string;
  loading: boolean;
  error: string | null;
  /** The .env preview is read-only; HERMES.md is not. */
  readOnly: boolean;
  update: (content: string) => void;
}

export interface SectionEditor {
  section: SectionDef;
  /** What the operator sees: what was loaded, overlaid with the draft. */
  values: Values;
  /** Only the keys whose value differs from what was loaded. */
  changed: Values;
  hasChanges: boolean;
  problems: FieldProblem[];
  status: SaveStatus;
  error: string | null;
  update: (key: string, value: unknown) => void;
  reset: () => void;
  save: () => Promise<void>;
  /** Present on the two file sections. */
  file?: FileEditor;
}

/** The editable copy of a file: what is on screen, and what was loaded. */
interface FileState {
  content: string;
  original: string;
}

type FileKey = "hermes" | "env";

const SAVED_FOR_MS = 2000;
const NO_TOOLSETS: Values = {};

/** Everything a settled section holds: what was saved, with the deleted keys gone. */
function settle(values: Values): Values {
  const out: Values = {};
  for (const [key, value] of Object.entries(values)) if (value !== null) out[key] = value;
  return out;
}

function selectContent(p: unknown): string {
  return (p as { content?: string } | null)?.content ?? "";
}

export function useSettingsEditor() {
  const config = useConfig();
  const { showToast } = useToast();

  const [drafts, setDrafts] = useState<Record<string, Values>>({});
  // What a save landed, per section. Overlays the config read until the next
  // read replaces it, so the fields show the settled value the moment the
  // route answers rather than a render later.
  const [settled, setSettled] = useState<Record<string, Values>>({});
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [files, setFiles] = useState<Record<FileKey, FileState>>({
    hermes: { content: "", original: "" },
    env: { content: "", original: "" },
  });
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      for (const t of Object.values(timerMap)) clearTimeout(t);
    };
  }, []);

  const hermesRead = useApiResource<string>("/api/agent/files/hermes", {
    select: selectContent,
    errorMessage: "Could not read the file",
  });
  const envRead = useApiResource<string>("/api/agent/files/env", {
    select: selectContent,
    errorMessage: "Could not read the file",
  });
  // The root agent's platform_toolsets, read-only here: the page that edits
  // them is Agent → Tools. A preview that could not be read renders as not
  // configured; the page that owns these values says the rest.
  const toolsetsRead = useApiResource<Values>("/api/agent/profiles/default/toolsets", {
    select: (p) => (p as { platformToolsets?: Values } | null)?.platformToolsets ?? {},
    fallback: {},
  });
  const toolsets = toolsetsRead.data ?? NO_TOOLSETS;

  // A file's read seeds its editable copy, and replaces it only when what the
  // server holds has changed: a re-read that answers the same content leaves
  // an unsaved draft where it is.
  const hermesContent = hermesRead.data;
  useEffect(() => {
    if (hermesContent === null) return;
    setFiles((f) =>
      f.hermes.original === hermesContent ? f : { ...f, hermes: { content: hermesContent, original: hermesContent } },
    );
  }, [hermesContent]);
  const envContent = envRead.data;
  useEffect(() => {
    if (envContent === null) return;
    setFiles((f) => (f.env.original === envContent ? f : { ...f, env: { content: envContent, original: envContent } }));
  }, [envContent]);

  const fileReads = useMemo(
    () => ({
      hermes: { loading: !hermesRead.settled, error: hermesRead.error, refetch: hermesRead.refetch },
      env: { loading: !envRead.settled, error: envRead.error, refetch: envRead.refetch },
    }),
    [hermesRead.settled, hermesRead.error, hermesRead.refetch, envRead.settled, envRead.error, envRead.refetch],
  );

  const setSectionStatus = useCallback((id: string, next: SaveStatus) => {
    setStatus((s) => ({ ...s, [id]: next }));
    if (timers.current[id]) clearTimeout(timers.current[id]);
    if (next === "saved") {
      timers.current[id] = setTimeout(() => {
        delete timers.current[id];
        setStatus((s) => ({ ...s, [id]: "idle" }));
      }, SAVED_FOR_MS);
    }
  }, []);

  const originalOf = useCallback(
    (id: string): Values => {
      if (id === "platform_toolsets") return toolsets;
      return settled[id] ?? ((config.data?.[id] as Values | undefined) ?? {});
    },
    [config.data, settled, toolsets],
  );

  const changedOf = useCallback(
    (def: SectionDef, values: Values, original: Values): Values => {
      const out: Values = {};
      for (const field of def.fields) {
        if (!(field.key in values)) continue;
        if (JSON.stringify(values[field.key]) === JSON.stringify(original[field.key])) continue;
        out[field.key] = values[field.key];
      }
      return out;
    },
    [],
  );

  const editorFor = useCallback(
    (id: string): SectionEditor | null => {
      const def = CONFIG_SECTIONS[id];
      if (!def) return null;
      const isFile = def.type === "file";
      const fileKey = isFile && def.filePath ? (fileKeyForFilePath(def.filePath) as FileKey) : null;
      const fileState = fileKey ? { ...files[fileKey], ...fileReads[fileKey] } : null;
      const original = originalOf(id);
      const values = { ...original, ...(drafts[id] ?? {}) };
      const changed = isFile ? {} : changedOf(def, values, original);
      const hasChanges = isFile
        ? fileState !== null && !def.sensitive && fileState.content !== fileState.original
        : Object.keys(changed).length > 0;
      const problems = isFile ? [] : validateSectionValues(id, changed);

      const update = (key: string, value: unknown) =>
        setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [key]: value } }));

      const reset = () => {
        if (fileKey) {
          setFiles((f) => ({ ...f, [fileKey]: { ...f[fileKey], content: f[fileKey].original } }));
          return;
        }
        setDrafts((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
      };

      const save = async () => {
        setSectionStatus(id, "saving");
        setErrors((e) => ({ ...e, [id]: null }));
        const content = fileKey ? files[fileKey].content : null;
        await runWrite({
          showToast,
          // Neither route answers the `{ success }` envelope; the request
          // itself says whether the save landed.
          checkSuccess: false,
          request: fileKey
            ? () =>
                apiFetch(`/api/agent/files/${fileKey}`, {
                  method: "PUT",
                  body: JSON.stringify({ content, backup: true }),
                })
            : async () => {
                const res = await apiFetch("/api/config", {
                  method: "PUT",
                  body: JSON.stringify({ section: id, values: changed }),
                });
                if (!res?.data) throw new Error("Failed to save");
                return res;
              },
          successMessage: `${def.label} saved`,
          errorMessage: "Save failed",
          onSuccess: () => {
            if (fileKey) {
              setFiles((f) => ({ ...f, [fileKey]: { ...f[fileKey], original: content ?? "" } }));
              // The cache holds what was read; make it hold what was saved.
              void fileReads[fileKey].refetch();
            } else {
              setSettled((s) => ({ ...s, [id]: settle({ ...original, ...changed }) }));
              setDrafts((d) => {
                const next = { ...d };
                delete next[id];
                return next;
              });
            }
            setSectionStatus(id, "saved");
          },
          onError: (err) => {
            setSectionStatus(id, "error");
            setErrorFromCaught((m) => setErrors((e) => ({ ...e, [id]: m })), err, "Save failed");
          },
        });
      };

      const file: FileEditor | undefined =
        fileKey && fileState
          ? {
              content: fileState.content,
              original: fileState.original,
              loading: fileState.loading,
              error: fileState.error,
              readOnly: def.sensitive === true,
              update: (content: string) =>
                setFiles((f) => ({ ...f, [fileKey]: { ...f[fileKey], content } })),
            }
          : undefined;

      return {
        section: def,
        values,
        changed,
        hasChanges,
        problems,
        status: status[id] ?? "idle",
        error: errors[id] ?? null,
        update,
        reset,
        save,
        file,
      };
    },
    [changedOf, drafts, errors, fileReads, files, originalOf, setSectionStatus, showToast, status],
  );

  return useMemo(
    () => ({
      config: config.data,
      isLoading: config.isLoading,
      error: config.error,
      refetch: config.refetch,
      configError: config.configError,
      subject: config.subject,
      editorFor,
    }),
    [config.configError, config.data, config.error, config.isLoading, config.refetch, config.subject, editorFor],
  );
}
